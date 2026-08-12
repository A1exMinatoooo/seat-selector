import QRCode from "qrcode";

const qrCodeOptions = {
  width: 720,
  margin: 2,
  errorCorrectionLevel: "H" as const,
  color: { dark: "#15201d", light: "#fffdf7" },
};

export function generateQrCodeDataUrl(value: string) {
  return QRCode.toDataURL(value, qrCodeOptions);
}
