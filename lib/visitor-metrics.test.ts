// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dailyVisitor, trackDailyVisitor, VISITOR_STORAGE_KEY } from "@/lib/visitor-metrics";
import { trackResumeExport } from "@/lib/export-metrics";
import { trackJobApplicationCreated } from "@/lib/job-application-metrics";

describe("daily visitor identity", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete document.documentElement.dataset.desktopApp;
  });
  it("keeps the same browser ID across UTC days", () => {
    const first = dailyVisitor(localStorage, new Date("2026-09-05T00:00:00Z"));
    expect(dailyVisitor(localStorage, new Date("2026-09-05T23:59:59Z"))).toEqual(first);
    const next = dailyVisitor(localStorage, new Date("2026-09-06T00:00:00Z"));
    expect(next.visitorId).toBe(first.visitorId);
    expect(JSON.parse(localStorage.getItem(VISITOR_STORAGE_KEY)!)).toEqual({
      visitorId: first.visitorId,
    });
  });
  it("replaces malformed data without transmitting it", async () => {
    localStorage.setItem(VISITOR_STORAGE_KEY, '{"day":"bad","visitorId":"resume content"}');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    expect(await trackDailyVisitor("resume")).toBe(true);
    const [, options] = fetchMock.mock.calls[0];
    expect(Object.keys(JSON.parse(options.body)).sort()).toEqual(["day", "visitorId", "workspace"]);
    expect(options.body).not.toContain("resume content");
    expect(options).toMatchObject({ credentials: "omit", referrerPolicy: "no-referrer" });
  });
  it("attaches the same ID to exports and application creation, and resets after deletion", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    await trackDailyVisitor("resume");
    trackResumeExport("pdf");
    trackJobApplicationCreated();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const bodies = fetchMock.mock.calls.map(([, options]) => JSON.parse(options.body));
    expect(new Set(bodies.map((body) => body.visitorId)).size).toBe(1);
    expect(bodies[1]).toEqual({ format: "pdf", visitorId: bodies[0].visitorId });
    expect(bodies[2]).toEqual({ event: "job_application_created", visitorId: bodies[0].visitorId });
    localStorage.removeItem(VISITOR_STORAGE_KEY);
    await trackDailyVisitor("resume");
    expect(JSON.parse(fetchMock.mock.calls[3][1].body).visitorId).not.toBe(bodies[0].visitorId);
  });
  it("skips blocked storage and desktop builds", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(await trackDailyVisitor("resume")).toBe(false);
    vi.restoreAllMocks();
    document.documentElement.dataset.desktopApp = "true";
    expect(await trackDailyVisitor("resume")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["doNotTrack", "globalPrivacyControl"])(
    "honors %s without creating an ID",
    async (signal) => {
      vi.stubGlobal("navigator", { [signal]: signal === "doNotTrack" ? "1" : true });
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      expect(await trackDailyVisitor("resume")).toBe(false);
      expect(localStorage.getItem(VISITOR_STORAGE_KEY)).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
});
