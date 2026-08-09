export function canDeleteLocation(associatedEventCount: number): boolean {
  return associatedEventCount === 0;
}

export class LocationInUseError extends Error {
  readonly code = "LOCATION_IN_USE";
}
