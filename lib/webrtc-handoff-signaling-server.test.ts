import { describe, expect, it, vi } from "vitest";
import {
  handleWebRTCHandoffSignaling,
  WEBRTC_HANDOFF_ROOM_TTL_MS,
  type WebRTCHandoffRoomRecord,
} from "@/lib/webrtc-handoff-signaling-server";

const roomId = "a".repeat(22);

function createStore() {
  let record: WebRTCHandoffRoomRecord | undefined;
  let alarm = 0;
  return {
    store: {
      read: async () => record,
      write: async (next: WebRTCHandoffRoomRecord) => {
        record = next;
      },
      delete: async () => {
        record = undefined;
      },
      scheduleExpiry: async (expiresAt: number) => {
        alarm = expiresAt;
      },
    },
    record: () => record,
    alarm: () => alarm,
  };
}

function request(method: string, suffix = "", body?: unknown) {
  return new Request(`https://privacv.app/api/handoff/signal/${roomId}${suffix}`, {
    method,
    headers: body ? { "Content-Type": "application/json", Origin: "https://privacv.app" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("temporary WebRTC signaling room", () => {
  it("relays only the opposite peer's opaque encrypted signal", async () => {
    const memory = createStore();
    const now = Date.now();
    vi.setSystemTime(now);

    expect(
      (
        await handleWebRTCHandoffSignaling(
          request("PUT", "", { role: "sender", signal: "encrypted_offer" }),
          roomId,
          memory.store,
        )
      ).status,
    ).toBe(204);
    expect(memory.record()?.sender).toBe("encrypted_offer");
    expect(memory.alarm()).toBe(now + WEBRTC_HANDOFF_ROOM_TTL_MS);

    const receiver = await handleWebRTCHandoffSignaling(
      request("GET", "?role=receiver"),
      roomId,
      memory.store,
    );
    await expect(receiver.json()).resolves.toEqual({ signal: "encrypted_offer" });

    const sender = await handleWebRTCHandoffSignaling(
      request("GET", "?role=sender"),
      roomId,
      memory.store,
    );
    expect(sender.status).toBe(204);
    vi.useRealTimers();
  });

  it("rejects cross-origin and oversized or malformed messages", async () => {
    const memory = createStore();
    const forbidden = new Request(`https://privacv.app/api/handoff/signal/${roomId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Origin: "https://attacker.example" },
      body: JSON.stringify({ role: "sender", signal: "opaque" }),
    });
    expect((await handleWebRTCHandoffSignaling(forbidden, roomId, memory.store)).status).toBe(403);
    expect(
      (
        await handleWebRTCHandoffSignaling(
          request("PUT", "", { role: "sender", signal: "not valid ciphertext!" }),
          roomId,
          memory.store,
        )
      ).status,
    ).toBe(400);
  });
});
