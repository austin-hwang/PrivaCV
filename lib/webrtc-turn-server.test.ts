import { describe, expect, it, vi } from "vitest";
import {
  WEBRTC_TURN_CREDENTIAL_TTL_SECONDS,
  handleWebRTCTurnCredentials,
} from "@/lib/webrtc-turn-server";

const roomId = "a".repeat(22);
const request = (origin = "https://privacv.app") =>
  new Request(`https://privacv.app/api/handoff/ice/${roomId}`, {
    method: "POST",
    headers: { Origin: origin },
  });

describe("short-lived TURN credentials", () => {
  it("keeps the TURN key server-side and returns only temporary ICE credentials", async () => {
    const fetchUpstream = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.headers).toEqual({
        Authorization: "Bearer server-secret",
        "Content-Type": "application/json",
      });
      expect(JSON.parse(String(init?.body))).toEqual({ ttl: WEBRTC_TURN_CREDENTIAL_TTL_SECONDS });
      return Response.json(
        {
          iceServers: [
            { urls: ["stun:stun.cloudflare.com:3478"] },
            {
              urls: ["turns:turn.cloudflare.com:443?transport=tcp"],
              username: "temporary-user",
              credential: "temporary-password",
            },
          ],
        },
        { status: 201 },
      );
    });
    const response = await handleWebRTCTurnCredentials(
      request(),
      roomId,
      { TURN_KEY_ID: "turn-key", TURN_KEY_API_TOKEN: "server-secret" },
      fetchUpstream as typeof fetch,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      iceServers: [
        { urls: ["stun:stun.cloudflare.com:3478"] },
        {
          urls: ["turns:turn.cloudflare.com:443?transport=tcp"],
          username: "temporary-user",
          credential: "temporary-password",
        },
      ],
    });
    expect(JSON.stringify(body)).not.toContain("server-secret");
  });

  it("fails closed when secrets are missing or the request is cross-origin", async () => {
    expect((await handleWebRTCTurnCredentials(request(), roomId, {})).status).toBe(503);
    expect(
      (
        await handleWebRTCTurnCredentials(request("https://attacker.example"), roomId, {
          TURN_KEY_ID: "turn-key",
          TURN_KEY_API_TOKEN: "server-secret",
        })
      ).status,
    ).toBe(403);
  });
});
