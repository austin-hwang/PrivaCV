export const WEBRTC_TURN_CREDENTIALS_PATH = "/api/handoff/ice/";
export const WEBRTC_TURN_CREDENTIAL_TTL_SECONDS = 10 * 60;

const ROOM_PATTERN = /^[A-Za-z\d_-]{22}$/u;
const TURN_API_ORIGIN = "https://rtc.live.cloudflare.com";
const DESKTOP_ORIGIN = "http://127.0.0.1:47837";

export type WebRTCTurnEnv = {
  TURN_KEY_ID?: string;
  TURN_KEY_API_TOKEN?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function responseHeaders(request: Request) {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  });
  const origin = request.headers.get("origin");
  if (origin === DESKTOP_ORIGIN) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
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

function isIceServer(value: unknown): value is RTCIceServer {
  if (!isRecord(value)) return false;
  const urlsValid =
    typeof value.urls === "string" ||
    (Array.isArray(value.urls) &&
      value.urls.length > 0 &&
      value.urls.every((url) => typeof url === "string"));
  return (
    urlsValid &&
    (value.username === undefined || typeof value.username === "string") &&
    (value.credential === undefined || typeof value.credential === "string")
  );
}

export async function handleWebRTCTurnCredentials(
  request: Request,
  roomId: string,
  env: WebRTCTurnEnv,
  fetchUpstream: typeof fetch = fetch,
) {
  if (!ROOM_PATTERN.test(roomId)) return jsonResponse(request, { error: "Room not found." }, 404);
  if (!requestAllowed(request)) return jsonResponse(request, { error: "Forbidden." }, 403);
  if (request.method === "OPTIONS") return jsonResponse(request, null, 204);
  if (request.method !== "POST") {
    return new Response("Method not allowed.", {
      status: 405,
      headers: { ...Object.fromEntries(responseHeaders(request)), Allow: "POST, OPTIONS" },
    });
  }
  if (!env.TURN_KEY_ID || !env.TURN_KEY_API_TOKEN) {
    return jsonResponse(request, { error: "TURN fallback is not configured." }, 503);
  }

  const upstream = await fetchUpstream(
    `${TURN_API_ORIGIN}/v1/turn/keys/${encodeURIComponent(env.TURN_KEY_ID)}/credentials/generate-ice-servers`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.TURN_KEY_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ttl: WEBRTC_TURN_CREDENTIAL_TTL_SECONDS }),
    },
  ).catch(() => null);
  if (!upstream?.ok) {
    return jsonResponse(request, { error: "TURN credentials are temporarily unavailable." }, 502);
  }

  let body: unknown;
  try {
    body = await upstream.json();
  } catch {
    return jsonResponse(request, { error: "TURN credentials are temporarily unavailable." }, 502);
  }
  const iceServers = isRecord(body) && Array.isArray(body.iceServers) ? body.iceServers : null;
  if (!iceServers?.length || !iceServers.every(isIceServer)) {
    return jsonResponse(request, { error: "TURN credentials are temporarily unavailable." }, 502);
  }
  return jsonResponse(request, { iceServers });
}
