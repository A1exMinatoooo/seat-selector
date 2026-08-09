export type HallEventStatus = "draft" | "open" | "ended";

export function canEditHallTemplate(statuses: HallEventStatus[]): boolean {
  return statuses.every((status) => status === "ended");
}

export function canDeleteHallTemplate(statuses: HallEventStatus[]): boolean {
  return statuses.length === 0;
}
