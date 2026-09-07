export const VISITOR_STORAGE_KEY = "privacv-visitor-v2";
export const VISITOR_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

type DailyVisitor = { day: string; visitorId: string };

/** No identity is derived from resume data, IP addresses, or browser properties. */
export function dailyVisitor(
  storage: Pick<Storage, "getItem" | "setItem">,
  now = new Date(),
): DailyVisitor {
  const day = now.toISOString().slice(0, 10);
  try {
    const saved = JSON.parse(storage.getItem(VISITOR_STORAGE_KEY) ?? "null") as {
      visitorId?: string;
    } | null;
    if (typeof saved?.visitorId === "string" && VISITOR_ID_PATTERN.test(saved.visitorId)) {
      return { day, visitorId: saved.visitorId };
    }
  } catch {
    /* Replace malformed data with a fresh random identifier. */
  }
  const visitor = { day, visitorId: crypto.randomUUID() };
  storage.setItem(VISITOR_STORAGE_KEY, JSON.stringify({ visitorId: visitor.visitorId }));
  return visitor;
}

export async function trackIdentifiedMetric(
  path: string,
  data: Record<string, string>,
): Promise<boolean> {
  if (typeof window === "undefined" || document.documentElement.dataset.desktopApp === "true")
    return false;
  if (
    navigator.doNotTrack === "1" ||
    (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl
  )
    return false;
  try {
    // Serialize first use across tabs so all event types share one profile ID.
    const read = () => dailyVisitor(localStorage);
    const visitor = navigator.locks
      ? await navigator.locks.request(VISITOR_STORAGE_KEY, read)
      : read();
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, visitorId: visitor.visitorId }),
      credentials: "omit",
      referrerPolicy: "no-referrer",
      keepalive: true,
    });
    return response.ok;
  } catch {
    // Blocked storage/network must not affect editing or invent a new user per event.
    return false;
  }
}
