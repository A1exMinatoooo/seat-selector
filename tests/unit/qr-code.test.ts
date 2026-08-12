import QRCode, { type QRCodeToDataURLOptions } from "qrcode";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateQrCodeDataUrl } from "@/server/qr-code";

vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn() } }));

describe("QR code generation", () => {
  const toDataUrlMock = vi.mocked(QRCode.toDataURL as (value: string, options: QRCodeToDataURLOptions) => Promise<string>);

  beforeEach(() => toDataUrlMock.mockReset());

  it("uses high error correction so the centered logo remains scannable", async () => {
    toDataUrlMock.mockResolvedValue("data:image/png;base64,qr");

    await expect(generateQrCodeDataUrl("https://example.com/entry")).resolves.toBe("data:image/png;base64,qr");
    expect(QRCode.toDataURL).toHaveBeenCalledWith("https://example.com/entry", expect.objectContaining({ errorCorrectionLevel: "H", margin: 2, width: 720 }));
  });
});
