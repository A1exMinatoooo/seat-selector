export type Coordinate = { latitude: number; longitude: number };

const earthRadiusMeters = 6_371_000;

function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function distanceMeters(from: Coordinate, to: Coordinate): number {
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const fromLatitude = radians(from.latitude);
  const toLatitude = radians(to.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function isLocationAllowed(distance: number, accuracy: number, radius: number): boolean {
  const maximumAccuracy = Math.max(100, Math.min(500, radius / 2));
  return accuracy <= maximumAccuracy && distance <= radius;
}
