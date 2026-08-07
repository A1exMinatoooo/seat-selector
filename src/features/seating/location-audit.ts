export type BrowserLocationFailure = "permission_denied" | "position_unavailable" | "timeout" | "unknown";

export function browserLocationFailure(code: number): BrowserLocationFailure {
  if (code === 1) return "permission_denied";
  if (code === 2) return "position_unavailable";
  if (code === 3) return "timeout";
  return "unknown";
}

export async function reportBrowserLocationFailure(eventCode: string, errorCode: number): Promise<void> {
  try {
    const response = await fetch(`/api/events/${eventCode}/location-failure`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: browserLocationFailure(errorCode) }),
    });
    if (!response.ok) throw new Error(`Location failure audit failed with ${response.status}`);
  } catch (error) {
    console.error("Location failure audit failed", error);
  }
}
