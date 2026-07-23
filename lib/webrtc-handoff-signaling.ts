const INVITATION_PREFIX = "PCV2.";
const SIGNALING_PATH = "/api/handoff/signal";
const MAX_ENCRYPTED_SIGNAL_CHARACTERS = 100_000;

export type WebRTCHandoffInvitation = {
  roomId: string;
  key: Uint8Array;
};

type SignalingRole = "sender" | "receiver";

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

export function createWebRTCHandoffInvitation(): WebRTCHandoffInvitation {
  const room = crypto.getRandomValues(new Uint8Array(16));
  const key = crypto.getRandomValues(new Uint8Array(32));
  return { roomId: bytesToBase64Url(room), key };
}

export function encodeWebRTCHandoffInvitation(invitation: WebRTCHandoffInvitation) {
  return `${INVITATION_PREFIX}${invitation.roomId}.${bytesToBase64Url(invitation.key)}`;
}

export function parseWebRTCHandoffInvitation(value: string): WebRTCHandoffInvitation {
  const [prefix, roomId, encodedKey, ...extra] = value.trim().split(".");

  if (
    prefix !== INVITATION_PREFIX.slice(0, -1) ||
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
