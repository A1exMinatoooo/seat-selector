export function isLocationCheckRequired(locationCheckEnabled: boolean, locationExemptAt: Date | null): boolean {
  return locationCheckEnabled && locationExemptAt === null;
}
