import { formatLocalDateTime } from "@/shared/date-time";

export type ConsecutiveEventConfiguration = {
  id: string;
  name: string;
  status: "draft" | "open" | "ended";
  participationMode: "onsite" | "preregistered";
  startsAt: Date;
  timeZone: string;
  locationId: string;
};

export type ConsecutiveTargetViolation =
  | "SOURCE_NOT_ONSITE"
  | "TARGET_NOT_ONSITE"
  | "TARGET_ENDED"
  | "TARGET_NOT_LATER"
  | "TARGET_LOCATION_MISMATCH"
  | "TARGET_TIME_ZONE_MISMATCH"
  | "TARGET_DATE_MISMATCH";

export function consecutiveTargetViolation(
  source: ConsecutiveEventConfiguration,
  target: ConsecutiveEventConfiguration,
): ConsecutiveTargetViolation | null {
  if (source.participationMode !== "onsite") return "SOURCE_NOT_ONSITE";
  if (target.participationMode !== "onsite") return "TARGET_NOT_ONSITE";
  if (target.status === "ended") return "TARGET_ENDED";
  if (target.startsAt.getTime() <= source.startsAt.getTime()) return "TARGET_NOT_LATER";
  if (target.locationId !== source.locationId) return "TARGET_LOCATION_MISMATCH";
  if (target.timeZone !== source.timeZone) return "TARGET_TIME_ZONE_MISMATCH";
  if (
    formatLocalDateTime(target.startsAt, source.timeZone).date !==
    formatLocalDateTime(source.startsAt, source.timeZone).date
  )
    return "TARGET_DATE_MISMATCH";
  return null;
}

export function isConsecutiveTarget(
  source: ConsecutiveEventConfiguration,
  target: ConsecutiveEventConfiguration,
): boolean {
  return source.id !== target.id && consecutiveTargetViolation(source, target) === null;
}
