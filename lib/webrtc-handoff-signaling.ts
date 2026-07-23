const INVITATION_PREFIX = "PCV3.";
const LEGACY_INVITATION_PREFIX = "PCV2.";
const SIGNALING_PATH = "/api/handoff/signal";
const TURN_CREDENTIALS_PATH = "/api/handoff/ice";
const MAX_ENCRYPTED_SIGNAL_CHARACTERS = 100_000;
const PAIRING_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const PAIRING_CODE_CHARACTERS = 16;
const PAIRING_SECRET_BYTES = 10;

export type WebRTCHandoffInvitation = {
  roomId: string;
  key: Uint8Array;
  pairingCode?: string;
};

type SignalingRole = "sender" | "receiver";

export const WEBRTC_HANDOFF_FALLBACK_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.cloudflare.com:3478" },
];

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlToBytes(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function pairingSecretToCode(secret: Uint8Array) {
  let bits = 0;
  let value = 0;
  let code = "";
  for (const byte of secret) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      code += PAIRING_ALPHABET[(value >>> bits) & 31];
    }
  }
  return code;
}

function pairingCodeToSecret(code: string) {
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const character of code) {
    const index = PAIRING_ALPHABET.indexOf(character);
    if (index < 0) throw new Error("Invalid pairing code");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 255);
    }
  }
  if (bytes.length !== PAIRING_SECRET_BYTES) throw new Error("Invalid pairing code");
  return Uint8Array.from(bytes);
}

function normalizePairingCode(value: string) {
  const withoutPrefix = value
    .trim()
    .toUpperCase()
    .replace(/^PCV3[.\s:-]*/u, "");
  return withoutPrefix
    .replaceAll("O", "0")
    .replaceAll("I", "1")
    .replaceAll("L", "1")
    .replace(/[\s-]/gu, "");
}

export function formatWebRTCHandoffPairingCode(value: string) {
  const normalized = normalizePairingCode(value).slice(0, PAIRING_CODE_CHARACTERS);
  return normalized.match(/.{1,4}/gu)?.join("-") ?? "";
}

async function invitationFromPairingSecret(secret: Uint8Array): Promise<WebRTCHandoffInvitation> {
  const source = new Uint8Array(secret.byteLength);
  source.set(secret);
  const material = await crypto.subtle.importKey("raw", source.buffer, "HKDF", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new TextEncoder().encode("privacv-device-handoff-v3"),
      info: new TextEncoder().encode("room-and-signal-key"),
    },
    material,
    384,
  );
  const derived = new Uint8Array(bits);
  const compactCode = pairingSecretToCode(secret);
  return {
    roomId: bytesToBase64Url(derived.slice(0, 16)),
    key: derived.slice(16, 48),
    pairingCode: formatWebRTCHandoffPairingCode(compactCode),
  };
}

export async function createWebRTCHandoffInvitation(): Promise<WebRTCHandoffInvitation> {
  const secret = crypto.getRandomValues(new Uint8Array(PAIRING_SECRET_BYTES));
  return invitationFromPairingSecret(secret);
}

export function encodeWebRTCHandoffInvitation(invitation: WebRTCHandoffInvitation) {
  if (invitation.pairingCode) {
    return `${INVITATION_PREFIX}${normalizePairingCode(invitation.pairingCode)}`;
  }
  return `${LEGACY_INVITATION_PREFIX}${invitation.roomId}.${bytesToBase64Url(invitation.key)}`;
}

function parseLegacyInvitation(value: string): WebRTCHandoffInvitation {
  const [prefix, roomId, encodedKey, ...extra] = value.trim().split(".");

  if (
    prefix !== LEGACY_INVITATION_PREFIX.slice(0, -1) ||
    extra.length ||
    !roomId ||
    !/^[A-Za-z\d_-]{22}$/u.test(roomId) ||
    !encodedKey ||
    !/^[A-Za-z\d_-]{43}$/u.test(encodedKey)
  ) {
    throw new Error("This private transfer link is damaged or incomplete.");
  }

  const key = base64UrlToBytes(encodedKey);
  if (key.byteLength !== 32) throw new Error("This private transfer link is not supported.");
  return { roomId, key };
}

export async function parseWebRTCHandoffInvitation(
  value: string,
): Promise<WebRTCHandoffInvitation> {
  if (value.trim().startsWith(LEGACY_INVITATION_PREFIX)) return parseLegacyInvitation(value);
  const code = normalizePairingCode(value);
  if (
    code.length !== PAIRING_CODE_CHARACTERS ||
    [...code].some((character) => !PAIRING_ALPHABET.includes(character))
  ) {
    throw new Error("This pairing code is damaged or incomplete.");
  }
  try {
    return await invitationFromPairingSecret(pairingCodeToSecret(code));
  } catch {
    throw new Error("This pairing code is damaged or incomplete.");
  }
}

export function createWebRTCHandoffUrl(invitation: WebRTCHandoffInvitation, origin: string) {
  const url = new URL("/", origin);
  url.hash = new URLSearchParams({ handoff: encodeWebRTCHandoffInvitation(invitation) }).toString();
  return url.toString();
}

export function readWebRTCHandoffInvitationFromHash(hash: string) {
  const invitation = new URLSearchParams(hash.replace(/^#/u, "")).get("handoff");
  return invitation?.trim() || null;
}

async function importInvitationKey(rawKey: Uint8Array) {
  const key = new Uint8Array(rawKey.byteLength);
  key.set(rawKey);
  return crypto.subtle.importKey("raw", key.buffer, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptWebRTCHandoffSignal(value: string, rawKey: Uint8Array) {
  const key = await importInvitationKey(rawKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(value);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  const envelope = new Uint8Array(iv.byteLength + encrypted.byteLength);
  envelope.set(iv);
  envelope.set(new Uint8Array(encrypted), iv.byteLength);
  return bytesToBase64Url(envelope);
}

export async function decryptWebRTCHandoffSignal(value: string, rawKey: Uint8Array) {
  if (!value || value.length > MAX_ENCRYPTED_SIGNAL_CHARACTERS) {
    throw new Error("The private connection response is invalid.");
  }
  try {
    const envelope = base64UrlToBytes(value);
    if (envelope.byteLength < 29) throw new Error("Invalid encrypted signal");
    const key = await importInvitationKey(rawKey);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: envelope.slice(0, 12) },
      key,
      envelope.slice(12),
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    throw new Error("The private connection response could not be verified.");
  }
}

function signalingOrigin() {
  return document.documentElement.dataset.desktopApp === "true"
    ? "https://privacv.app"
    : window.location.origin;
}

function roomUrl(roomId: string, role?: SignalingRole) {
  const url = new URL(`${SIGNALING_PATH}/${roomId}`, signalingOrigin());
  if (role) url.searchParams.set("role", role);
  return url;
}

function turnCredentialsUrl(roomId: string) {
  return new URL(`${TURN_CREDENTIALS_PATH}/${roomId}`, signalingOrigin());
}

function isIceServer(value: unknown): value is RTCIceServer {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const server = value as Record<string, unknown>;
  const urlsValid =
    typeof server.urls === "string" ||
    (Array.isArray(server.urls) &&
      server.urls.length > 0 &&
      server.urls.every((url) => typeof url === "string"));
  return (
    urlsValid &&
    (server.username === undefined || typeof server.username === "string") &&
    (server.credential === undefined || typeof server.credential === "string")
  );
}

export async function loadWebRTCHandoffIceServers(invitation?: WebRTCHandoffInvitation) {
  if (!invitation) return WEBRTC_HANDOFF_FALLBACK_ICE_SERVERS;
  try {
    const response = await fetch(turnCredentialsUrl(invitation.roomId), {
      method: "POST",
      cache: "no-store",
    });
    if (!response.ok) return WEBRTC_HANDOFF_FALLBACK_ICE_SERVERS;
    const body = (await response.json()) as { iceServers?: unknown };
    if (!Array.isArray(body.iceServers) || !body.iceServers.length) {
      return WEBRTC_HANDOFF_FALLBACK_ICE_SERVERS;
    }
    return body.iceServers.every(isIceServer)
      ? body.iceServers
      : WEBRTC_HANDOFF_FALLBACK_ICE_SERVERS;
  } catch {
    return WEBRTC_HANDOFF_FALLBACK_ICE_SERVERS;
  }
}

export async function publishWebRTCHandoffSignal(
  invitation: WebRTCHandoffInvitation,
  role: SignalingRole,
  signal: string,
) {
  const response = await fetch(roomUrl(invitation.roomId), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, signal }),
  });
  if (!response.ok) throw new Error("The temporary connection room is unavailable.");
}

export function reserveWebRTCHandoffRoom(invitation: WebRTCHandoffInvitation) {
  return publishWebRTCHandoffSignal(invitation, "sender", "reservation");
}

export async function waitForWebRTCHandoffSignal(
  invitation: WebRTCHandoffInvitation,
  role: SignalingRole,
  signal?: AbortSignal,
) {
  const deadline = Date.now() + 5 * 60_000;
  while (Date.now() < deadline) {
    const response = await fetch(roomUrl(invitation.roomId, role), {
      cache: "no-store",
      signal,
    });
    if (response.status === 200) {
      const body = (await response.json()) as { signal?: unknown };
      if (typeof body.signal === "string") return body.signal;
    } else if (response.status !== 204 && response.status !== 404) {
      throw new Error("The temporary connection room is unavailable.");
    }
    await new Promise<void>((resolve, reject) => {
      const finish = () => {
        signal?.removeEventListener("abort", cancel);
        resolve();
      };
      const timeout = window.setTimeout(finish, 600);
      const cancel = () => {
        window.clearTimeout(timeout);
        reject(new DOMException("The handoff was cancelled.", "AbortError"));
      };
      if (signal?.aborted) cancel();
      else signal?.addEventListener("abort", cancel, { once: true });
    });
  }
  throw new Error("The private transfer link expired. Create a new one and try again.");
}

export async function closeWebRTCHandoffRoom(invitation: WebRTCHandoffInvitation) {
  await fetch(roomUrl(invitation.roomId), { method: "DELETE", keepalive: true }).catch(() => {});
}
