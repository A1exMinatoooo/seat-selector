export function uniqueDeviceParticipant<T>(candidates: readonly T[]): T | null {
  return candidates.length === 1 ? candidates[0] ?? null : null;
}

export function allWorkflowEventsCompleted(
  events: ReadonlyArray<{ historical: boolean }>,
): boolean {
  return events.length > 0 && events.every((event) => event.historical);
}
