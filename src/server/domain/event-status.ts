export type EventStatus = "draft" | "open" | "ended";

export function canChangeEventStatus(from: EventStatus, to: EventStatus): boolean {
  return (from === "draft" && to === "open") || (from === "open" && to === "ended") || (from === "ended" && to === "open");
}

export function hasSufficientLotteryPool(eligibleTicketCount: number, poolBonus: number, prizeCount: number): boolean {
  return eligibleTicketCount + poolBonus >= prizeCount;
}
