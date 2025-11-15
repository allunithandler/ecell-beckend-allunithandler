export type ProfileQRData = {
  name: string;
  phone?: string | null;
  email?: string | null;
  ecellId?: string | null;
};

export async function makeProfileQR(data: ProfileQRData): Promise<string> {
  const { default: QRCode } = await import("qrcode");
  const payload = {
    t: "ECellProfile",
    name: data.name,
    phone: data.phone || "",
    email: data.email || "",
    id: data.ecellId || "",
  };
  return QRCode.toDataURL(JSON.stringify(payload), {
    margin: 1,
    scale: 4,
    errorCorrectionLevel: "M",
  });
}
