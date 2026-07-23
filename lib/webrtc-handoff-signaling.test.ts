import { describe, expect, it } from "vitest";
import {
  createWebRTCHandoffInvitation,
  createWebRTCHandoffUrl,
  decryptWebRTCHandoffSignal,
  encodeWebRTCHandoffInvitation,
  encryptWebRTCHandoffSignal,
  parseWebRTCHandoffInvitation,
  readWebRTCHandoffInvitationFromHash,
  waitForWebRTCHandoffIceGathering,
} from "@/lib/webrtc-handoff-signaling";

type IceCandidateListener = (event: Pick<RTCPeerConnectionIceEvent, "candidate">) => void;

function createGatheringPeer(sdp = "v=0\r\n") {
  const candidateListeners = new Set<IceCandidateListener>();
  const stateListeners = new Set<() => void>();
  let localDescription: RTCSessionDescriptionInit = { type: "offer", sdp };
  const peer = {
    iceGatheringState: "gathering",
    get localDescription() {
      return localDescription;
    },
    addEventListener(type: string, listener: IceCandidateListener | (() => void)) {
      if (type === "icecandidate") candidateListeners.add(listener as IceCandidateListener);
      else stateListeners.add(listener as () => void);
    },
    removeEventListener(type: string, listener: IceCandidateListener | (() => void)) {
      if (type === "icecandidate") candidateListeners.delete(listener as IceCandidateListener);
      else stateListeners.delete(listener as () => void);
    },
  } as Pick<
    RTCPeerConnection,
    "addEventListener" | "iceGatheringState" | "localDescription" | "removeEventListener"
  >;
  return {
    peer,
    addCandidate(type: RTCIceCandidateType) {
      localDescription = {
        type: "offer",
        sdp: `${localDescription.sdp}a=candidate:1 1 udp 1 192.0.2.1 5000 typ ${type}\r\n`,
      };
      for (const listener of candidateListeners) {
        listener({
          candidate: { candidate: `candidate:1 1 udp 1 192.0.2.1 5000 typ ${type}`, type },
        } as Pick<RTCPeerConnectionIceEvent, "candidate">);
      }
    },
  };
}

describe("WebRTC handoff invitations", () => {
  it("round-trips a short pairing code through a URL fragment", async () => {
    const invitation = await createWebRTCHandoffInvitation();
    const encoded = encodeWebRTCHandoffInvitation(invitation);
    const url = new URL(createWebRTCHandoffUrl(invitation, "https://privacv.app"));
    const parsed = await parseWebRTCHandoffInvitation(
      readWebRTCHandoffInvitationFromHash(url.hash)!,
    );

    expect(encoded).toMatch(/^PCV3\.[0-9A-HJKMNP-TV-Z]{16}$/u);
    expect(invitation.pairingCode).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(?:-[0-9A-HJKMNP-TV-Z]{4}){3}$/u);
    expect(parsed.roomId).toBe(invitation.roomId);
    expect(parsed.key).toEqual(invitation.key);
    expect(url.search).toBe("");
  });

  it("encrypts signaling so the relay cannot read it", async () => {
    const invitation = await createWebRTCHandoffInvitation();
    const encrypted = await encryptWebRTCHandoffSignal("PCV1.private-offer", invitation.key);

    expect(encrypted).not.toContain("private-offer");
    await expect(decryptWebRTCHandoffSignal(encrypted, invitation.key)).resolves.toBe(
      "PCV1.private-offer",
    );
  });

  it("continues to accept existing PCV2 private links", async () => {
    const legacy = {
      roomId: "a".repeat(22),
      key: new Uint8Array(32).fill(7),
    };
    const encoded = encodeWebRTCHandoffInvitation(legacy);
    const parsed = await parseWebRTCHandoffInvitation(encoded);

    expect(encoded).toMatch(/^PCV2\./u);
    expect(parsed).toEqual(legacy);
  });

  it("rejects malformed and unauthenticated invitations", async () => {
    await expect(parseWebRTCHandoffInvitation("PCV2.bad.bad")).rejects.toThrow(
      "This private transfer link is damaged or incomplete.",
    );
    await expect(parseWebRTCHandoffInvitation("1234-5678")).rejects.toThrow(
      "This pairing code is damaged or incomplete.",
    );
    const first = await createWebRTCHandoffInvitation();
    const second = await createWebRTCHandoffInvitation();
    const encrypted = await encryptWebRTCHandoffSignal("PCV1.offer", first.key);
    await expect(decryptWebRTCHandoffSignal(encrypted, second.key)).rejects.toThrow(
      "could not be verified",
    );
  });

  it("finishes ICE gathering as soon as a relay candidate is usable", async () => {
    const { peer, addCandidate } = createGatheringPeer();
    const gathering = waitForWebRTCHandoffIceGathering(peer, 1_000);

    addCandidate("relay");

    await expect(gathering).resolves.toBeUndefined();
  });

  it("uses gathered direct candidates when a TURN transport does not finish", async () => {
    const { peer } = createGatheringPeer(
      "v=0\r\na=candidate:1 1 udp 1 192.0.2.1 5000 typ srflx\r\n",
    );

    await expect(waitForWebRTCHandoffIceGathering(peer, 1)).resolves.toBeUndefined();
  });

  it("fails ICE gathering when the browser finds no candidate", async () => {
    const { peer } = createGatheringPeer();

    await expect(waitForWebRTCHandoffIceGathering(peer, 1)).rejects.toThrow(
      "Could not prepare a device connection",
    );
  });
});
