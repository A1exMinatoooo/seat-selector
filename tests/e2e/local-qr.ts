import jsQR from "jsqr";
import { PNG } from "pngjs";

/** Decode the real PNG returned by the admin QR endpoint without copying its pixel buffer. */
export function decodeQrUrl(imageDataUrl: string): string {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/]+=*)$/.exec(imageDataUrl);
  if (!match?.[1]) throw new Error("The QR endpoint did not return a PNG data URL");

  const png = PNG.sync.read(Buffer.from(match[1], "base64"));
  const pixels = new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.byteLength);
  const decoded = jsQR(pixels, png.width, png.height);
  if (!decoded) throw new Error("Could not decode the real QR image");
  return decoded.data;
}
