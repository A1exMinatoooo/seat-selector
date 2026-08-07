export function uniqueDeviceParticipant<T>(candidates: readonly T[]): T | null {
  return candidates.length === 1 ? candidates[0] ?? null : null;
}
