import { compressSync, decompressSync, strFromU8, strToU8 } from "fflate";
import {
  JOB_PIPELINE_BACKUP_FORMAT,
  JOB_PIPELINE_BACKUP_VERSION,
  parseJobPipelineBackup,
} from "@/lib/job-application-db";
import type { JobPipelineData } from "@/lib/job-applications";
import { normalizeResume, type ResumeState } from "@/lib/resume";

export const WEBRTC_HANDOFF_SIGNAL_PREFIX = "PCV1.";
export const WEBRTC_HANDOFF_CHANNEL = "privacv-resume-handoff-v1";
export const WEBRTC_HANDOFF_CHUNK_SIZE = 16 * 1024;
export const WEBRTC_HANDOFF_MAX_PAYLOAD_BYTES = 10 * 1024 * 1024;

const MAX_SIGNAL_CHARACTERS = 100_000;

const SIGNAL_FORMAT = "privacv-webrtc-signal";
const SIGNAL_VERSION = 1;
const LEGACY_TRANSFER_FORMAT = "privacv-webrtc-resume-transfer";
const LEGACY_TRANSFER_VERSION = 1;
const TRANSFER_FORMAT = "privacv-webrtc-device-transfer";
const TRANSFER_VERSION = 2;
const MESSAGE_PROTOCOL = "privacv-webrtc-transfer-v1";

export type WebRTCHandoffSignal = {
  format: typeof SIGNAL_FORMAT;
  version: typeof SIGNAL_VERSION;
  kind: "offer" | "answer";
  createdAt: string;
  description: RTCSessionDescriptionInit & { sdp: string };
};

export type WebRTCHandoffTransfer = {
  format: typeof TRANSFER_FORMAT;
  version: typeof TRANSFER_VERSION;
  sentAt: string;
  resume?: ResumeState;
  jobPipeline?: JobPipelineData;
};

export type WebRTCHandoffPayloadInput = {
  resume?: ResumeState | null;
  jobPipeline?: JobPipelineData | null;
};

type TransferStartMessage = {
  protocol: typeof MESSAGE_PROTOCOL;
  type: "start";
  byteLength: number;
  digest: string;
};

type TransferEndMessage = {
  protocol: typeof MESSAGE_PROTOCOL;
  type: "end";
};

type TransferAcknowledgedMessage = {
  protocol: typeof MESSAGE_PROTOCOL;
  type: "received";
};

type TransferControlMessage =
  | TransferStartMessage
  | TransferEndMessage
  | TransferAcknowledgedMessage;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

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

export function encodeWebRTCHandoffSignal(
  kind: WebRTCHandoffSignal["kind"],
  description: RTCSessionDescriptionInit,
) {
  if (!description.sdp || description.type !== kind) {
    throw new Error(`The WebRTC ${kind} is incomplete.`);
  }
  const signal: WebRTCHandoffSignal = {
    format: SIGNAL_FORMAT,
    version: SIGNAL_VERSION,
    kind,
    createdAt: new Date().toISOString(),
    description: { type: description.type, sdp: description.sdp },
  };
  return `${WEBRTC_HANDOFF_SIGNAL_PREFIX}${bytesToBase64Url(
    compressSync(strToU8(JSON.stringify(signal))),
  )}`;
}

export function parseWebRTCHandoffSignal(
  value: string,
  expectedKind?: WebRTCHandoffSignal["kind"],
): WebRTCHandoffSignal {
  const clean = value.trim();
  if (!clean.startsWith(WEBRTC_HANDOFF_SIGNAL_PREFIX)) {
    throw new Error("This is not a PrivaCV device handoff code.");
  }
  if (clean.length > MAX_SIGNAL_CHARACTERS) {
    throw new Error("This device handoff code is too large.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(
      strFromU8(decompressSync(base64UrlToBytes(clean.slice(WEBRTC_HANDOFF_SIGNAL_PREFIX.length)))),
    );
  } catch {
    throw new Error("This device handoff code is damaged or incomplete.");
  }

  if (
    !isRecord(parsed) ||
    parsed.format !== SIGNAL_FORMAT ||
    parsed.version !== SIGNAL_VERSION ||
    (parsed.kind !== "offer" && parsed.kind !== "answer") ||
    typeof parsed.createdAt !== "string" ||
    !isRecord(parsed.description) ||
    parsed.description.type !== parsed.kind ||
    typeof parsed.description.sdp !== "string" ||
    !parsed.description.sdp
  ) {
    throw new Error("This device handoff code is not supported.");
  }
  if (expectedKind && parsed.kind !== expectedKind) {
    throw new Error(
      expectedKind === "offer"
        ? "Paste the invite code from the sending device."
        : "Paste the response code from the receiving device.",
    );
  }

  return parsed as WebRTCHandoffSignal;
}

export function createWebRTCHandoffPayload({ resume, jobPipeline }: WebRTCHandoffPayloadInput) {
  if (!resume && !jobPipeline) throw new Error("Choose data to include in the device handoff.");
  const transfer: WebRTCHandoffTransfer = {
    format: TRANSFER_FORMAT,
    version: TRANSFER_VERSION,
    sentAt: new Date().toISOString(),
    ...(resume ? { resume: normalizeResume(resume) } : {}),
    ...(jobPipeline ? { jobPipeline } : {}),
  };
  return compressSync(strToU8(JSON.stringify(transfer)));
}

export function parseWebRTCHandoffPayload(payload: Uint8Array): WebRTCHandoffTransfer {
  let parsed: unknown;
  try {
    parsed = JSON.parse(strFromU8(decompressSync(payload)));
  } catch {
    throw new Error("The transferred data is damaged or incomplete.");
  }

  if (
    isRecord(parsed) &&
    parsed.format === LEGACY_TRANSFER_FORMAT &&
    parsed.version === LEGACY_TRANSFER_VERSION &&
    typeof parsed.sentAt === "string" &&
    isRecord(parsed.state)
  ) {
    return {
      format: TRANSFER_FORMAT,
      version: TRANSFER_VERSION,
      sentAt: parsed.sentAt,
      resume: normalizeResume(parsed.state),
    };
  }
  if (
    !isRecord(parsed) ||
    parsed.format !== TRANSFER_FORMAT ||
    parsed.version !== TRANSFER_VERSION ||
    typeof parsed.sentAt !== "string" ||
    (!isRecord(parsed.resume) && !isRecord(parsed.jobPipeline))
  ) {
    throw new Error("This transferred data format is not supported.");
  }

  let jobPipeline: JobPipelineData | undefined;
  if (isRecord(parsed.jobPipeline)) {
    const backup = parseJobPipelineBackup(
      JSON.stringify({
        ...parsed.jobPipeline,
        format: JOB_PIPELINE_BACKUP_FORMAT,
        version: JOB_PIPELINE_BACKUP_VERSION,
        exportedAt: parsed.sentAt,
      }),
    );
    jobPipeline = {
      applications: backup.applications,
      events: backup.events,
      jobSnapshots: backup.jobSnapshots,
      resumeSnapshots: backup.resumeSnapshots,
    };
  }

  return {
    format: TRANSFER_FORMAT,
    version: TRANSFER_VERSION,
    sentAt: parsed.sentAt,
    ...(isRecord(parsed.resume) ? { resume: normalizeResume(parsed.resume) } : {}),
    ...(jobPipeline ? { jobPipeline } : {}),
  };
}

async function sha256Hex(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy.buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function waitForBufferedAmount(channel: RTCDataChannel) {
  if (channel.bufferedAmount <= WEBRTC_HANDOFF_CHUNK_SIZE * 8) return Promise.resolve();
  channel.bufferedAmountLowThreshold = WEBRTC_HANDOFF_CHUNK_SIZE * 4;
  return new Promise<void>((resolve, reject) => {
    const onLow = () => {
      cleanup();
      resolve();
    };
    const onClose = () => {
      cleanup();
      reject(new Error("The device connection closed before the data finished sending."));
    };
    const cleanup = () => {
      channel.removeEventListener("bufferedamountlow", onLow);
      channel.removeEventListener("close", onClose);
    };
    channel.addEventListener("bufferedamountlow", onLow, { once: true });
    channel.addEventListener("close", onClose, { once: true });
  });
}

export async function sendWebRTCHandoffPayload(
  channel: RTCDataChannel,
  payload: Uint8Array,
  onProgress?: (percentage: number) => void,
) {
  if (channel.readyState !== "open") throw new Error("The device connection is not ready.");
  if (payload.byteLength > WEBRTC_HANDOFF_MAX_PAYLOAD_BYTES) {
    throw new Error("This data is too large for a direct device handoff.");
  }
  const start: TransferStartMessage = {
    protocol: MESSAGE_PROTOCOL,
    type: "start",
    byteLength: payload.byteLength,
    digest: await sha256Hex(payload),
  };
  channel.send(JSON.stringify(start));
  onProgress?.(0);

  for (let offset = 0; offset < payload.byteLength; offset += WEBRTC_HANDOFF_CHUNK_SIZE) {
    await waitForBufferedAmount(channel);
    const chunk = payload.slice(offset, offset + WEBRTC_HANDOFF_CHUNK_SIZE);
    channel.send(chunk.buffer as ArrayBuffer);
    onProgress?.(
      Math.min(100, Math.round(((offset + chunk.byteLength) / payload.byteLength) * 100)),
    );
  }

  const end: TransferEndMessage = { protocol: MESSAGE_PROTOCOL, type: "end" };
  channel.send(JSON.stringify(end));
}

function parseControlMessage(value: string): TransferControlMessage | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed) || parsed.protocol !== MESSAGE_PROTOCOL) return null;
    if (
      parsed.type === "start" &&
      typeof parsed.byteLength === "number" &&
      Number.isSafeInteger(parsed.byteLength) &&
      parsed.byteLength > 0 &&
      parsed.byteLength <= WEBRTC_HANDOFF_MAX_PAYLOAD_BYTES &&
      typeof parsed.digest === "string" &&
      /^[a-f\d]{64}$/u.test(parsed.digest)
    ) {
      return parsed as TransferStartMessage;
    }
    if (parsed.type === "end") return parsed as TransferEndMessage;
    if (parsed.type === "received") return parsed as TransferAcknowledgedMessage;
  } catch {
    // Non-protocol text is ignored so a stray message cannot break a transfer.
  }
  return null;
}

export function receiveWebRTCHandoffPayload(
  channel: RTCDataChannel,
  options: {
    onProgress?: (percentage: number) => void;
    onPayload: (payload: Uint8Array) => void | Promise<void>;
    onError: (error: Error) => void;
  },
) {
  channel.binaryType = "arraybuffer";
  let expectedBytes = 0;
  let expectedDigest = "";
  let receivedBytes = 0;
  let chunks: Uint8Array[] = [];

  const reset = () => {
    expectedBytes = 0;
    expectedDigest = "";
    receivedBytes = 0;
    chunks = [];
  };

  const onMessage = async (event: MessageEvent<ArrayBuffer | string>) => {
    try {
      if (typeof event.data === "string") {
        const control = parseControlMessage(event.data);
        if (!control) return;
        if (control.type === "received") return;
        if (control.type === "start") {
          reset();
          expectedBytes = control.byteLength;
          expectedDigest = control.digest;
          options.onProgress?.(0);
          return;
        }
        if (!expectedBytes || receivedBytes !== expectedBytes) {
          throw new Error("The resume transfer ended before every part arrived.");
        }
        const payload = new Uint8Array(receivedBytes);
        let offset = 0;
        for (const chunk of chunks) {
          payload.set(chunk, offset);
          offset += chunk.byteLength;
        }
        if ((await sha256Hex(payload)) !== expectedDigest) {
          throw new Error("The resume transfer failed its integrity check.");
        }
        options.onProgress?.(100);
        await options.onPayload(payload);
        const acknowledged: TransferAcknowledgedMessage = {
          protocol: MESSAGE_PROTOCOL,
          type: "received",
        };
        channel.send(JSON.stringify(acknowledged));
        reset();
        return;
      }

      if (!expectedBytes) throw new Error("The resume transfer started out of order.");
      const chunk = new Uint8Array(event.data);
      receivedBytes += chunk.byteLength;
      if (receivedBytes > expectedBytes)
        throw new Error("The resume transfer was larger than expected.");
      chunks.push(chunk);
      options.onProgress?.(Math.min(99, Math.round((receivedBytes / expectedBytes) * 100)));
    } catch (error) {
      reset();
      options.onError(error instanceof Error ? error : new Error("The resume transfer failed."));
    }
  };

  channel.addEventListener("message", onMessage);
  return () => channel.removeEventListener("message", onMessage);
}

export function waitForWebRTCHandoffAcknowledgement(channel: RTCDataChannel, timeoutMs = 15_000) {
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("The other device did not confirm the resume transfer."));
    }, timeoutMs);
    const onMessage = (event: MessageEvent) => {
      if (typeof event.data !== "string") return;
      const control = parseControlMessage(event.data);
      if (control?.type !== "received") return;
      cleanup();
      resolve();
    };
    const onClose = () => {
      cleanup();
      reject(new Error("The device connection closed before the transfer was confirmed."));
    };
    const cleanup = () => {
      window.clearTimeout(timeout);
      channel.removeEventListener("message", onMessage);
      channel.removeEventListener("close", onClose);
    };
    channel.addEventListener("message", onMessage);
    channel.addEventListener("close", onClose, { once: true });
  });
}
