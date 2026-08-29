"use server";

import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  adminActionError,
  adminActionSuccess,
  type AdminActionState,
} from "@/features/admin/admin-action-state";
import {
  parseParticipantCsv,
  parseParticipantInput,
  validateResolvable,
  type ParticipantImportRow,
} from "@/features/participants/import";
import { getDb } from "@/server/db/client";
import {
  eventAuditLogs,
  events,
  participants,
  participantTickets,
  reservations,
  ticketTypes,
} from "@/server/db/schema";
import { requireAdmin } from "@/server/security/admin-session";

async function eventTicketTypes(eventId: string) {
  return getDb()
    .select({
      id: ticketTypes.id,
      name: ticketTypes.name,
      lotteryEligible: ticketTypes.lotteryEligible,
    })
    .from(ticketTypes)
    .where(eq(ticketTypes.eventId, eventId));
}

async function insertRows(eventId: string, rows: ParticipantImportRow[], source: "csv" | "manual") {
  const existing = await getDb()
    .select({
      nickname: participants.nickname,
      nicknameFirst: participants.nicknameFirst,
      phoneDigits: participants.phoneDigits,
      phoneLast4: participants.phoneLast4,
      phoneIsFull: participants.phoneIsFull,
      ticketTotal: participants.ticketTotal,
    })
    .from(participants)
    .where(eq(participants.eventId, eventId));
  validateResolvable([...existing.map((row) => ({ ...row, tickets: [] })), ...rows]);
  await getDb().transaction(async (tx) => {
    for (const row of rows) {
      const [created] = await tx
        .insert(participants)
        .values({
          eventId,
          nickname: row.nickname,
          nicknameFirst: row.nicknameFirst,
          phoneDigits: row.phoneDigits,
          phoneLast4: row.phoneLast4,
          phoneIsFull: row.phoneIsFull,
          ticketTotal: row.ticketTotal,
        })
        .returning({ id: participants.id });
      if (!created) throw new Error("Participant creation did not return an id");
      await tx
        .insert(participantTickets)
        .values(row.tickets.map((ticket) => ({ participantId: created.id, ...ticket })));
      if (source === "manual")
        await tx.insert(eventAuditLogs).values({
          eventId,
          participantId: created.id,
          action: "participant_added",
          details: { ticketTotal: row.ticketTotal },
        });
    }
    if (source === "csv")
      await tx.insert(eventAuditLogs).values({
        eventId,
        action: "participants_imported",
        details: {
          count: rows.length,
          ticketTotal: rows.reduce((sum, row) => sum + row.ticketTotal, 0),
        },
      });
  });
}

const eventIdSchema = z.string().uuid();
const participantTargetSchema = z.object({
  eventId: z.string().uuid(),
  participantId: z.string().uuid(),
});

async function editableParticipantEvent(eventId: string) {
  const [event] = await getDb()
    .select({ status: events.status, participationMode: events.participationMode })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  return event?.status !== "ended" && event?.participationMode === "preregistered";
}

export async function importParticipantsAction(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();
  const parsed = z
    .object({
      eventId: eventIdSchema,
      csv: z.instanceof(File).refine((file) => file.size > 0 && file.size <= 2_000_000),
    })
    .safeParse({ eventId: formData.get("eventId"), csv: formData.get("csv") });
  if (!parsed.success)
    return adminActionError("请选择小于 2MB 的有效 CSV 文件。", "INVALID_PARTICIPANT_CSV");
  const { eventId, csv } = parsed.data;
  if (!(await editableParticipantEvent(eventId)))
    return adminActionError("活动不存在、已结束或不允许预录参与者。", "EVENT_NOT_EDITABLE");
  let types: Awaited<ReturnType<typeof eventTicketTypes>>;
  try {
    types = await eventTicketTypes(eventId);
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "participant_ticket_types_load_failed",
        eventId,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    return adminActionError("参与者导入失败，请稍后重试。", "PARTICIPANT_IMPORT_FAILED");
  }
  let rows: ParticipantImportRow[];
  try {
    rows = parseParticipantCsv(await csv.text(), types);
    if (rows.length === 0)
      return adminActionError("CSV 中没有可导入的参与者。", "EMPTY_PARTICIPANT_CSV");
  } catch (error) {
    return adminActionError(
      error instanceof Error ? error.message : "参与者文件格式无效，请检查后重试。",
      "INVALID_PARTICIPANT_CSV",
    );
  }
  try {
    await insertRows(eventId, rows, "csv");
    revalidatePath(`/admin/events/${eventId}/participants`);
    return adminActionSuccess(`已导入 ${rows.length} 位参与者。`, "PARTICIPANTS_IMPORTED");
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "participant_import_failed",
        eventId,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    return adminActionError("参与者导入失败，请稍后重试。", "PARTICIPANT_IMPORT_FAILED");
  }
}

export async function addParticipantAction(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();
  const eventId = eventIdSchema.safeParse(formData.get("eventId"));
  if (!eventId.success) return adminActionError("活动标识无效，请刷新后重试。", "INVALID_EVENT");
  if (!(await editableParticipantEvent(eventId.data)))
    return adminActionError("活动不存在、已结束或不允许预录参与者。", "EVENT_NOT_EDITABLE");
  let types: Awaited<ReturnType<typeof eventTicketTypes>>;
  try {
    types = await eventTicketTypes(eventId.data);
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "participant_ticket_types_load_failed",
        eventId: eventId.data,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    return adminActionError("参与者增加失败，请稍后重试。", "PARTICIPANT_ADD_FAILED");
  }
  let row: ParticipantImportRow;
  try {
    const quantities = Object.fromEntries(
      types.map((type) => [type.id, formData.get(`ticket:${type.id}`)]),
    );
    row = parseParticipantInput(
      { nickname: formData.get("nickname"), phone: formData.get("phone"), quantities },
      types,
    );
  } catch (error) {
    return adminActionError(
      error instanceof Error ? error.message : "参与者信息无效，请检查后重试。",
      "INVALID_PARTICIPANT",
    );
  }
  try {
    await insertRows(eventId.data, [row], "manual");
    revalidatePath(`/admin/events/${eventId.data}/participants`);
    return adminActionSuccess("参与者已增加。", "PARTICIPANT_ADDED");
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "participant_add_failed",
        eventId: eventId.data,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    return adminActionError("参与者增加失败，请稍后重试。", "PARTICIPANT_ADD_FAILED");
  }
}

export async function resetDeviceAction(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();
  const parsed = participantTargetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return adminActionError("参与者标识无效，请刷新后重试。", "INVALID_PARTICIPANT");
  const { eventId, participantId } = parsed.data;
  try {
    const updated = await getDb().transaction(async (tx) => {
      const [row] = await tx
        .update(participants)
        .set({ deviceHash: null, deviceBoundAt: null })
        .where(
          and(
            eq(participants.id, participantId),
            eq(participants.eventId, eventId),
            isNotNull(participants.deviceHash),
          ),
        )
        .returning({ id: participants.id });
      if (row)
        await tx.insert(eventAuditLogs).values({ eventId, participantId, action: "device_reset" });
      return row;
    });
    if (!updated)
      return adminActionError(
        "设备已解绑或参与者状态已变化，请刷新后重试。",
        "PARTICIPANT_STATE_CONFLICT",
      );
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "participant_device_reset_failed",
        eventId,
        participantId,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    return adminActionError("设备解绑失败，请稍后重试。", "DEVICE_RESET_FAILED");
  }
  revalidatePath(`/admin/events/${eventId}/participants`);
  redirect(`/admin/events/${eventId}/participants?notice=participant-device-reset`);
}

export async function toggleLocationExemptionAction(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();
  const parsed = participantTargetSchema
    .extend({ enabled: z.enum(["0", "1"]) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return adminActionError("定位豁免数据无效，请刷新后重试。", "INVALID_LOCATION_EXEMPTION");
  const { eventId, participantId } = parsed.data;
  const enabled = parsed.data.enabled === "1";
  try {
    const updated = await getDb().transaction(async (tx) => {
      const [row] = await tx
        .update(participants)
        .set({ locationExemptAt: enabled ? new Date() : null })
        .where(
          and(
            eq(participants.id, participantId),
            eq(participants.eventId, eventId),
            enabled
              ? isNull(participants.locationExemptAt)
              : isNotNull(participants.locationExemptAt),
          ),
        )
        .returning({ id: participants.id });
      if (row)
        await tx.insert(eventAuditLogs).values({
          eventId,
          participantId,
          action: "location_exemption_changed",
          details: { enabled },
        });
      return row;
    });
    if (!updated)
      return adminActionError("定位豁免状态已变化，请刷新后重试。", "PARTICIPANT_STATE_CONFLICT");
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "location_exemption_update_failed",
        eventId,
        participantId,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    return adminActionError("定位豁免更新失败，请稍后重试。", "LOCATION_EXEMPTION_UPDATE_FAILED");
  }
  revalidatePath(`/admin/events/${eventId}/participants`);
  redirect(
    `/admin/events/${eventId}/participants?notice=${enabled ? "location-exemption-enabled" : "location-exemption-disabled"}`,
  );
}

export async function resetSelectionAction(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();
  const parsed = participantTargetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return adminActionError("参与者标识无效，请刷新后重试。", "INVALID_PARTICIPANT");
  const { eventId, participantId } = parsed.data;
  try {
    const deleted = await getDb().transaction(async (tx) => {
      const [row] = await tx
        .delete(reservations)
        .where(
          and(eq(reservations.eventId, eventId), eq(reservations.participantId, participantId)),
        )
        .returning({ id: reservations.id });
      if (row) {
        await tx
          .update(events)
          .set({ version: sql`${events.version} + 1` })
          .where(eq(events.id, eventId));
        await tx.insert(eventAuditLogs).values({
          eventId,
          participantId,
          action: "selection_reset",
          details: { reservationId: row.id },
        });
      }
      return row;
    });
    if (!deleted)
      return adminActionError(
        "选座记录已被清除或参与者状态已变化，请刷新后重试。",
        "SELECTION_STATE_CONFLICT",
      );
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "participant_selection_reset_failed",
        eventId,
        participantId,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    return adminActionError("选座清除失败，请稍后重试。", "SELECTION_RESET_FAILED");
  }
  revalidatePath(`/admin/events/${eventId}/participants`);
  redirect(`/admin/events/${eventId}/participants?notice=selection-reset`);
}
