const PI = Math.PI;
const KRASOVSKY_SEMI_MAJOR_AXIS = 6_378_245;
const KRASOVSKY_ECCENTRICITY_SQUARED = 0.006693421622965943;
const CONVERGENCE_TOLERANCE = 1e-7;
const MAX_INVERSE_ITERATIONS = 30;

type Coordinate = { latitude: number; longitude: number };

export type AppleMapsLocationErrorCode =
  | "INVALID_APPLE_MAPS_URL"
  | "UNSUPPORTED_APPLE_MAPS_URL"
  | "MISSING_APPLE_MAPS_COORDINATE"
  | "AMBIGUOUS_APPLE_MAPS_COORDINATE"
  | "INVALID_APPLE_MAPS_COORDINATE";

export type AppleMapsLocationResult =
  | {
      ok: true;
      name: string | null;
      latitude: number;
      longitude: number;
      conversion: "gcj02-to-wgs84" | "unchanged";
    }
  | { ok: false; code: AppleMapsLocationErrorCode };

const hongKongPolygon: Coordinate[] = [
  { latitude: 22.5, longitude: 113.83 },
  { latitude: 22.54, longitude: 114.1 },
  { latitude: 22.55, longitude: 114.43 },
  { latitude: 22.15, longitude: 114.45 },
  { latitude: 22.15, longitude: 113.83 },
];

const macaoPolygon: Coordinate[] = [
  { latitude: 22.23, longitude: 113.52 },
  { latitude: 22.23, longitude: 113.6 },
  { latitude: 22.05, longitude: 113.6 },
  { latitude: 22.05, longitude: 113.52 },
];

const taiwanPolygon: Coordinate[] = [
  { latitude: 25.32, longitude: 121.0 },
  { latitude: 25.3, longitude: 121.65 },
  { latitude: 24.1, longitude: 121.95 },
  { latitude: 22.0, longitude: 121.05 },
  { latitude: 21.85, longitude: 120.7 },
  { latitude: 22.15, longitude: 120.0 },
  { latitude: 24.5, longitude: 120.0 },
];

function transformLatitude(latitude: number, longitude: number): number {
  let transformed =
    -100 +
    2 * longitude +
    3 * latitude +
    0.2 * latitude * latitude +
    0.1 * longitude * latitude +
    0.2 * Math.sqrt(Math.abs(longitude));
  transformed += ((20 * Math.sin(6 * longitude * PI) + 20 * Math.sin(2 * longitude * PI)) * 2) / 3;
  transformed += ((20 * Math.sin(latitude * PI) + 40 * Math.sin((latitude / 3) * PI)) * 2) / 3;
  transformed +=
    ((160 * Math.sin((latitude / 12) * PI) + 320 * Math.sin((latitude * PI) / 30)) * 2) / 3;
  return transformed;
}

function transformLongitude(latitude: number, longitude: number): number {
  let transformed =
    300 +
    longitude +
    2 * latitude +
    0.1 * longitude * longitude +
    0.1 * longitude * latitude +
    0.1 * Math.sqrt(Math.abs(longitude));
  transformed += ((20 * Math.sin(6 * longitude * PI) + 20 * Math.sin(2 * longitude * PI)) * 2) / 3;
  transformed += ((20 * Math.sin(longitude * PI) + 40 * Math.sin((longitude / 3) * PI)) * 2) / 3;
  transformed +=
    ((150 * Math.sin((longitude / 12) * PI) + 300 * Math.sin((longitude / 30) * PI)) * 2) / 3;
  return transformed;
}

function wgs84ToGcj02({ latitude, longitude }: Coordinate): Coordinate {
  let latitudeDelta = transformLatitude(latitude - 35, longitude - 105);
  let longitudeDelta = transformLongitude(latitude - 35, longitude - 105);
  const radians = (latitude / 180) * PI;
  const sine = Math.sin(radians);
  const magic = 1 - KRASOVSKY_ECCENTRICITY_SQUARED * sine * sine;
  const squareRootMagic = Math.sqrt(magic);
  latitudeDelta =
    (latitudeDelta * 180) /
    (((KRASOVSKY_SEMI_MAJOR_AXIS * (1 - KRASOVSKY_ECCENTRICITY_SQUARED)) /
      (magic * squareRootMagic)) *
      PI);
  longitudeDelta =
    (longitudeDelta * 180) /
    ((KRASOVSKY_SEMI_MAJOR_AXIS / squareRootMagic) * Math.cos(radians) * PI);
  return { latitude: latitude + latitudeDelta, longitude: longitude + longitudeDelta };
}

export function gcj02ToWgs84(coordinate: Coordinate): Coordinate {
  let estimate = { ...coordinate };
  for (let iteration = 0; iteration < MAX_INVERSE_ITERATIONS; iteration += 1) {
    const projected = wgs84ToGcj02(estimate);
    const latitudeDelta = projected.latitude - coordinate.latitude;
    const longitudeDelta = projected.longitude - coordinate.longitude;
    estimate = {
      latitude: estimate.latitude - latitudeDelta,
      longitude: estimate.longitude - longitudeDelta,
    };
    if (
      Math.abs(latitudeDelta) <= CONVERGENCE_TOLERANCE &&
      Math.abs(longitudeDelta) <= CONVERGENCE_TOLERANCE
    ) {
      break;
    }
  }
  return estimate;
}

function isInsidePolygon(coordinate: Coordinate, polygon: Coordinate[]): boolean {
  let inside = false;
  for (
    let current = 0, previous = polygon.length - 1;
    current < polygon.length;
    previous = current++
  ) {
    const currentPoint = polygon[current]!;
    const previousPoint = polygon[previous]!;
    const crossesLatitude =
      currentPoint.latitude > coordinate.latitude !== previousPoint.latitude > coordinate.latitude;
    const intersectionLongitude =
      ((previousPoint.longitude - currentPoint.longitude) *
        (coordinate.latitude - currentPoint.latitude)) /
        (previousPoint.latitude - currentPoint.latitude) +
      currentPoint.longitude;
    if (crossesLatitude && coordinate.longitude < intersectionLongitude) inside = !inside;
  }
  return inside;
}

function isWithinChinaBounds({ latitude, longitude }: Coordinate): boolean {
  return latitude >= 0.8293 && latitude <= 55.8271 && longitude >= 72.004 && longitude <= 137.8347;
}

function isExcludedRegion(coordinate: Coordinate, address: string | null): boolean {
  if (address) return /hong\s*kong|香港|macao|macau|澳门|澳門|taiwan|台湾|台灣/i.test(address);
  return [hongKongPolygon, macaoPolygon, taiwanPolygon].some((polygon) =>
    isInsidePolygon(coordinate, polygon),
  );
}

function shouldConvertFromGcj02(coordinate: Coordinate, address: string | null): boolean {
  if (!isWithinChinaBounds(coordinate) || isExcludedRegion(coordinate, address)) return false;
  if (!address) return true;
  return /china|中国/i.test(address);
}

function parseCoordinate(value: string): Coordinate | null {
  const parts = value.split(",").map((part) => part.trim());
  if (parts.length !== 2) return null;
  const latitude = Number(parts[0]);
  const longitude = Number(parts[1]);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }
  return { latitude, longitude };
}

export function parseAppleMapsLocation(input: string): AppleMapsLocationResult {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, code: "INVALID_APPLE_MAPS_URL" };
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "maps.apple.com" ||
    url.username ||
    url.password
  ) {
    return { ok: false, code: "UNSUPPORTED_APPLE_MAPS_URL" };
  }

  const coordinateValues = [
    ...url.searchParams.getAll("coordinate"),
    ...url.searchParams.getAll("ll"),
  ];
  if (coordinateValues.length === 0) {
    return { ok: false, code: "MISSING_APPLE_MAPS_COORDINATE" };
  }
  if (coordinateValues.length > 1) {
    return { ok: false, code: "AMBIGUOUS_APPLE_MAPS_COORDINATE" };
  }
  const coordinate = parseCoordinate(coordinateValues[0]!);
  if (!coordinate) return { ok: false, code: "INVALID_APPLE_MAPS_COORDINATE" };

  const address = url.searchParams.get("address")?.trim() || null;
  const extractedName =
    url.searchParams.get("name")?.trim() || url.searchParams.get("q")?.trim() || null;
  const convert = shouldConvertFromGcj02(coordinate, address);
  const normalizedCoordinate = convert ? gcj02ToWgs84(coordinate) : coordinate;
  return {
    ok: true,
    name: extractedName,
    latitude: normalizedCoordinate.latitude,
    longitude: normalizedCoordinate.longitude,
    conversion: convert ? "gcj02-to-wgs84" : "unchanged",
  };
}
