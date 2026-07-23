import { describe, expect, it } from "vitest";
import { emptyState } from "@/lib/resume";
import { createSampleJobPipeline } from "@/lib/job-application-sample";
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
    const transfer = parseWebRTCHandoffPayload(createWebRTCHandoffPayload({ resume: state }));

    expect(transfer.resume?.name).toBe("Ada Lovelace");
    expect(transfer.resume?.title).toBe("Mathematician");
    expect(transfer.format).toBe("privacv-webrtc-device-transfer");
  });

  it("round-trips a resume and complete application pipeline", () => {
    const jobPipeline = createSampleJobPipeline(new Date("2026-07-22T12:00:00-07:00"));
    const transfer = parseWebRTCHandoffPayload(
      createWebRTCHandoffPayload({ resume: emptyState(), jobPipeline }),
    );

    expect(transfer.jobPipeline?.applications).toHaveLength(13);
    expect(transfer.jobPipeline?.events.some((event) => event.type === "interview")).toBe(true);
    expect(transfer.jobPipeline?.jobSnapshots).toHaveLength(13);
  });

  it("accepts legacy resume-only payloads", async () => {
    const { compressSync, strToU8 } = await import("fflate");
    const legacy = compressSync(
      strToU8(
        JSON.stringify({
          format: "privacv-webrtc-resume-transfer",
          version: 1,
          sentAt: "2026-07-22T12:00:00.000Z",
          state: { ...emptyState(), name: "Legacy Resume" },
        }),
      ),
    );

    expect(parseWebRTCHandoffPayload(legacy).resume?.name).toBe("Legacy Resume");
  });

  it("rejects damaged signal and transfer payloads", () => {
    expect(() => parseWebRTCHandoffSignal("not-a-code")).toThrow(
      "This is not a PrivaCV device handoff code.",
    );
    expect(() => parseWebRTCHandoffPayload(new Uint8Array([1, 2, 3]))).toThrow(
      "The transferred data is damaged or incomplete.",
    );
    expect(() => parseWebRTCHandoffSignal(`PCV1.${"a".repeat(100_001)}`)).toThrow(
      "This device handoff code is too large.",
    );
  });
});
