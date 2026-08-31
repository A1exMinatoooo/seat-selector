import { describe, expect, it } from "vitest";
import { distanceMeters } from "@/features/locations/distance";
import { gcj02ToWgs84, parseAppleMapsLocation } from "@/server/domain/apple-maps-location";

const shenzhenUrl =
  "https://maps.apple.com/place?address=Baishi%203rd%20Road%20and%20Shenwan%202nd%20Road%20Interchange%20Chushenwan%20Ruiyun%20Center%20Shenzhenwan%20Ruiyin%20RAIL%20F%20INL4,%20Nanshan,%20Shenzhen,%20Guangdong%20China&coordinate=22.523833,113.969738&name=Hoyts%20Cinema%20(Shenzhenwan%20Rail%20In%20Branch)&place-id=H2710I3F96CDA45B40D&map=explore";
const shenzhenBoundaryUrls = [
  "https://maps.apple.com/place?address=No.1881,%20Bao'an%20South%20Road%20The%20Mixc%20Middle%20Area%20F%20F3%20S333,%20363,%20F%20F4%20S433,%20463%20Luohu,%20Shenzhen,%20Guangdong%20China&coordinate=22.539141,114.110672&name=Wanxiang%20Movie%20City%20(Shenzhen%20the%20Mixc%20Branch)&place-id=H2710I3F92689948BDF&map=explore",
  "https://maps.apple.com/place?address=Binhe%20Avenue%20No.9283%20Zhongzhou%20Bay%20CFutureCityL2-3,%20Futian,%20Shenzhen,%20Guangdong%20China&coordinate=22.527987,114.028554&name=Huanying%20Cinema%20(Zhongzhouwan%20C%20Future%20City%20Shop)&place-id=H2710I3F9557EAB6132&map=explore",
];

describe("Apple Maps location parsing", () => {
  it("extracts a name and iteratively converts mainland GCJ-02 coordinates", () => {
    const result = parseAppleMapsLocation(shenzhenUrl);
    expect(result).toMatchObject({
      ok: true,
      name: "Hoyts Cinema (Shenzhenwan Rail In Branch)",
      conversion: "gcj02-to-wgs84",
    });
    if (!result.ok) return;
    expect(distanceMeters(result, { latitude: 22.5267893, longitude: 113.9648171 })).toBeLessThan(
      2,
    );
  });

  it("accepts ll and q aliases and decodes plus signs", () => {
    expect(
      parseAppleMapsLocation(
        "https://maps.apple.com/?q=Tokyo+Station%2BExit&ll=35.6812,139.7671&address=Tokyo%20Japan",
      ),
    ).toEqual({
      ok: true,
      name: "Tokyo Station+Exit",
      latitude: 35.6812,
      longitude: 139.7671,
      conversion: "unchanged",
    });
  });

  it("converts an in-range coordinate without an address but respects explicit exclusions", () => {
    expect(
      parseAppleMapsLocation("https://maps.apple.com/?coordinate=22.523833,113.969738"),
    ).toMatchObject({ ok: true, conversion: "gcj02-to-wgs84" });
    expect(
      parseAppleMapsLocation(
        "https://maps.apple.com/?coordinate=22.3193,114.1694&address=Hong%20Kong%20China",
      ),
    ).toMatchObject({
      ok: true,
      latitude: 22.3193,
      longitude: 114.1694,
      conversion: "unchanged",
    });
    expect(
      parseAppleMapsLocation("https://maps.apple.com/?coordinate=25.0330,121.5654"),
    ).toMatchObject({ ok: true, conversion: "unchanged" });
  });

  it("lets explicit Shenzhen addresses override the coarse Hong Kong boundary fallback", () => {
    for (const url of shenzhenBoundaryUrls) {
      expect(parseAppleMapsLocation(url)).toMatchObject({
        ok: true,
        conversion: "gcj02-to-wgs84",
      });
    }
  });

  it("rejects unsupported, missing, ambiguous, and invalid coordinates", () => {
    expect(parseAppleMapsLocation("not a url")).toEqual({
      ok: false,
      code: "INVALID_APPLE_MAPS_URL",
    });
    expect(parseAppleMapsLocation("http://maps.apple.com/?coordinate=1,2")).toEqual({
      ok: false,
      code: "UNSUPPORTED_APPLE_MAPS_URL",
    });
    expect(parseAppleMapsLocation("https://example.com/?coordinate=1,2")).toEqual({
      ok: false,
      code: "UNSUPPORTED_APPLE_MAPS_URL",
    });
    expect(parseAppleMapsLocation("https://maps.apple.com/place?name=入口")).toEqual({
      ok: false,
      code: "MISSING_APPLE_MAPS_COORDINATE",
    });
    expect(parseAppleMapsLocation("https://maps.apple.com/?coordinate=1,2&ll=3,4")).toEqual({
      ok: false,
      code: "AMBIGUOUS_APPLE_MAPS_COORDINATE",
    });
    expect(parseAppleMapsLocation("https://maps.apple.com/?coordinate=91,181")).toEqual({
      ok: false,
      code: "INVALID_APPLE_MAPS_COORDINATE",
    });
  });

  it("converges deterministically within the selected tolerance", () => {
    const first = gcj02ToWgs84({ latitude: 22.523833, longitude: 113.969738 });
    const second = gcj02ToWgs84({ latitude: 22.523833, longitude: 113.969738 });
    expect(second).toEqual(first);
    expect(first.latitude).toBeCloseTo(22.526802, 7);
    expect(first.longitude).toBeCloseTo(113.9648271, 7);
  });
});
