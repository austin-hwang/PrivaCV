import { describe, expect, it } from "vitest";
import { emptyState } from "@/lib/resume";
import {
  WEBRTC_HANDOFF_SIGNAL_PREFIX,
  createWebRTCHandoffPayload,
  encodeWebRTCHandoffSignal,
  parseWebRTCHandoffPayload,
  parseWebRTCHandoffSignal,
} from "@/lib/webrtc-handoff";

describe("WebRTC device handoff", () => {
  it("round-trips compact offer and answer codes", () => {
    const offer = encodeWebRTCHandoffSignal("offer", { type: "offer", sdp: "offer-sdp" });
    const answer = encodeWebRTCHandoffSignal("answer", { type: "answer", sdp: "answer-sdp" });

    expect(offer).toMatch(new RegExp(`^${WEBRTC_HANDOFF_SIGNAL_PREFIX.replace(".", "\\.")}`));
    expect(parseWebRTCHandoffSignal(offer, "offer").description).toEqual({
      type: "offer",
      sdp: "offer-sdp",
    });
    expect(parseWebRTCHandoffSignal(answer, "answer").description).toEqual({
      type: "answer",
      sdp: "answer-sdp",
    });
  });

  it("rejects the wrong signal direction with a useful message", () => {
    const offer = encodeWebRTCHandoffSignal("offer", { type: "offer", sdp: "offer-sdp" });
    expect(() => parseWebRTCHandoffSignal(offer, "answer")).toThrow(
      "Paste the response code from the receiving device.",
    );
  });

  it("round-trips a normalized compressed resume payload", () => {
    const state = { ...emptyState(), name: "Ada Lovelace", title: "Mathematician" };
    const transfer = parseWebRTCHandoffPayload(createWebRTCHandoffPayload(state));

    expect(transfer.state.name).toBe("Ada Lovelace");
    expect(transfer.state.title).toBe("Mathematician");
    expect(transfer.format).toBe("privacv-webrtc-resume-transfer");
  });

  it("rejects damaged signal and resume payloads", () => {
    expect(() => parseWebRTCHandoffSignal("not-a-code")).toThrow(
      "This is not a PrivaCV device handoff code.",
    );
    expect(() => parseWebRTCHandoffPayload(new Uint8Array([1, 2, 3]))).toThrow(
      "The transferred resume is damaged or incomplete.",
    );
    expect(() => parseWebRTCHandoffSignal(`PCV1.${"a".repeat(100_001)}`)).toThrow(
      "This device handoff code is too large.",
    );
  });
});
