import { z } from "zod";
import { isSupportedTimeZone, localDateTimeToDate } from "@/shared/date-time";

const ticketTypeSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(40),
  lotteryEligible: z.boolean(),
});

const prizeSchema = z.object({
  name: z.string().trim().min(1).max(80),
  quantity: z.coerce.number().int().min(1).max(100_000),
});

const eventConfigurationFields = {
  name: z.string().trim().min(1).max(100),
  locationId: z.string().uuid(),
  radiusMeters: z.coerce.number().int().min(50).max(100_000),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  timeZone: z.string().trim().min(1).max(64).refine(isSupportedTimeZone, "无效的时区"),
  locationCheckEnabled: z.preprocess((value) => value === true || value === "on" || value === "true", z.boolean()),
  lotteryEnabled: z.preprocess((value) => value === true || value === "on" || value === "true", z.boolean()),
  ticketTypes: z.array(ticketTypeSchema).min(1).max(20).refine((items) => new Set(items.map((item) => item.name)).size === items.length, "票种名称不能重复"),
  prizes: z.array(prizeSchema).max(100),
};

function validateEventConfiguration(input: z.infer<z.ZodObject<typeof eventConfigurationFields>>, context: z.RefinementCtx) {
  if (input.lotteryEnabled && input.prizes.length === 0) context.addIssue({ code: "custom", path: ["prizes"], message: "开启抽奖时至少需要一项奖品" });
  if (input.lotteryEnabled && !input.ticketTypes.some((type) => type.lotteryEligible)) context.addIssue({ code: "custom", path: ["ticketTypes"], message: "开启抽奖时至少需要一个参与抽奖的票种" });
  if (!input.lotteryEnabled && input.ticketTypes.some((type) => type.lotteryEligible)) context.addIssue({ code: "custom", path: ["ticketTypes"], message: "未开启抽奖时票种不能参与抽奖" });
  if (new Set(input.prizes.map((prize) => prize.name)).size !== input.prizes.length) context.addIssue({ code: "custom", path: ["prizes"], message: "奖品名称不能重复" });
  if (!localDateTimeToDate(input.startDate, input.startTime, input.timeZone)) context.addIssue({ code: "custom", path: ["startTime"], message: "活动开始时间无效" });
}

export const eventConfigurationInputSchema = z.object({
  id: z.string().uuid(),
  ...eventConfigurationFields,
}).superRefine(validateEventConfiguration).transform((input) => ({
  ...input,
  startsAt: localDateTimeToDate(input.startDate, input.startTime, input.timeZone)!,
}));

export const eventInputSchema = z.object({
  hallId: z.string().uuid(),
  availableSeatIds: z.array(z.string().uuid()).max(2500),
  ...eventConfigurationFields,
}).superRefine(validateEventConfiguration).transform((input) => ({
  ...input,
  startsAt: localDateTimeToDate(input.startDate, input.startTime, input.timeZone)!,
}));
