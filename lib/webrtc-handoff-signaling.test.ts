import { describe, expect, it } from "vitest";
import {
  createWebRTCHandoffInvitation,
  createWebRTCHandoffUrl,
  decryptWebRTCHandoffSignal,
  encodeWebRTCHandoffInvitation,
  encryptWebRTCHandoffSignal,
  parseWebRTCHandoffInvitation,
  readWebRTCHandoffInvitationFromHash,
} from "@/lib/webrtc-handoff-signaling";

describe("WebRTC handoff invitations", () => {
  it("round-trips a compact invitation through a URL fragment", () => {
    const invitation = createWebRTCHandoffInvitation();
    const encoded = encodeWebRTCHandoffInvitation(invitation);
    const url = new URL(createWebRTCHandoffUrl(invitation, "https://privacv.app"));
    const parsed = parseWebRTCHandoffInvitation(readWebRTCHandoffInvitationFromHash(url.hash)!);

    expect(encoded).toMatch(/^PCV2\.[A-Za-z\d_-]{22}\.[A-Za-z\d_-]{43}$/u);
    expect(parsed.roomId).toBe(invitation.roomId);
    expect(parsed.key).toEqual(invitation.key);
    expect(url.search).toBe("");
  });

  it("encrypts signaling so the relay cannot read it", async () => {
    const invitation = createWebRTCHandoffInvitation();
    const encrypted = await encryptWebRTCHandoffSignal("PCV1.private-offer", invitation.key);

    expect(encrypted).not.toContain("private-offer");
    await expect(decryptWebRTCHandoffSignal(encrypted, invitation.key)).resolves.toBe(
      "PCV1.private-offer",
    );
  });

  it("rejects malformed and unauthenticated invitations", async () => {
    expect(() => parseWebRTCHandoffInvitation("PCV2.bad.bad")).toThrow(
      "This private transfer link is damaged or incomplete.",
    );
    const first = createWebRTCHandoffInvitation();
    const second = createWebRTCHandoffInvitation();
    const encrypted = await encryptWebRTCHandoffSignal("PCV1.offer", first.key);
    await expect(decryptWebRTCHandoffSignal(encrypted, second.key)).rejects.toThrow(
      "could not be verified",
    );
  });
});
