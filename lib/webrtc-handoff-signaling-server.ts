export const WEBRTC_HANDOFF_SIGNALING_PATH = "/api/handoff/signal/";
export const WEBRTC_HANDOFF_ROOM_TTL_MS = 5 * 60_000;

const MAX_SIGNAL_CHARACTERS = 100_000;
const ROOM_PATTERN = /^[A-Za-z\d_-]{22}$/u;
const SIGNAL_PATTERN = /^[A-Za-z\d_-]+$/u;
const DESKTOP_ORIGIN = "http://127.0.0.1:47837";

export type WebRTCHandoffRoomRecord = {
  sender?: string;
  receiver?: string;
  expiresAt: number;
};

export type WebRTCHandoffRoomStore = {
  read(): Promise<WebRTCHandoffRoomRecord | undefined>;
  write(record: WebRTCHandoffRoomRecord): Promise<void>;
  delete(): Promise<void>;
  scheduleExpiry(expiresAt: number): Promise<void>;
};

function responseHeaders(request: Request) {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  });
  const origin = request.headers.get("origin");
  if (origin === DESKTOP_ORIGIN) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "GET, PUT, DELETE, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    headers.set("Vary", "Origin");
  }
  return headers;
}

function jsonResponse(request: Request, body: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: responseHeaders(request),
  });
}

function requestAllowed(request: Request) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const forwardedProtocol = request.headers.get("x-forwarded-proto") ?? url.protocol.slice(0, -1);
  const forwardedOrigin = forwardedHost ? `${forwardedProtocol}://${forwardedHost}` : null;
  return (
    !origin || origin === url.origin || origin === forwardedOrigin || origin === DESKTOP_ORIGIN
  );
}

export async function handleWebRTCHandoffSignaling(
  request: Request,
  roomId: string,
  store: WebRTCHandoffRoomStore,
) {
  if (!ROOM_PATTERN.test(roomId)) return jsonResponse(request, { error: "Room not found." }, 404);
  if (!requestAllowed(request)) return jsonResponse(request, { error: "Forbidden." }, 403);
  if (request.method === "OPTIONS") return jsonResponse(request, null, 204);

  if (request.method === "DELETE") {
    await store.delete();
    return jsonResponse(request, null, 204);
  }

  const now = Date.now();
  let record = await store.read();
  if (record && record.expiresAt <= now) {
    await store.delete();
    record = undefined;
  }

  if (request.method === "GET") {
    const role = new URL(request.url).searchParams.get("role");
    if (role !== "sender" && role !== "receiver") {
      return jsonResponse(request, { error: "Invalid role." }, 400);
    }
    const signal = role === "sender" ? record?.receiver : record?.sender;
    return signal ? jsonResponse(request, { signal }) : jsonResponse(request, null, 204);
  }

  if (request.method === "PUT") {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_SIGNAL_CHARACTERS + 256) {
      return jsonResponse(request, { error: "Signal too large." }, 413);
    }
    let body: { role?: unknown; signal?: unknown };
    try {
      body = (await request.json()) as { role?: unknown; signal?: unknown };
    } catch {
      return jsonResponse(request, { error: "Invalid signal." }, 400);
    }
    if (
      (body.role !== "sender" && body.role !== "receiver") ||
      typeof body.signal !== "string" ||
      !body.signal ||
      body.signal.length > MAX_SIGNAL_CHARACTERS ||
      !SIGNAL_PATTERN.test(body.signal)
    ) {
      return jsonResponse(request, { error: "Invalid signal." }, 400);
    }
    const expiresAt = now + WEBRTC_HANDOFF_ROOM_TTL_MS;
    await store.write({
      ...(record ?? { expiresAt }),
      [body.role]: body.signal,
      expiresAt,
    });
    await store.scheduleExpiry(expiresAt);
    return jsonResponse(request, null, 204);
  }

  return new Response("Method not allowed.", {
    status: 405,
    headers: {
      ...Object.fromEntries(responseHeaders(request)),
      Allow: "GET, PUT, DELETE, OPTIONS",
    },
  });
}
