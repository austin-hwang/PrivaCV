import { describe, expect, it, vi } from "vitest";
import { handleVisitorMetric } from "@/lib/visitor-metrics-server";

const now = new Date("2026-09-05T12:00:00Z");
const visitor = {
  day: "2026-09-05",
  visitorId: "01234567-89ab-4cde-8fab-0123456789ab",
  workspace: "resume",
};
function request(body: unknown = visitor, headers: Record<string, string> = {}) {
  return new Request("https://privacv.app/api/metrics/visitors", {
    method: "POST",
    headers: { Origin: "https://privacv.app", "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}
describe("visitor analytics boundary", () => {
  it("indexes repeat requests by the same daily ID and writes no request metadata", async () => {
    const writeDataPoint = vi.fn();
    const env = { VISITOR_METRICS: { writeDataPoint } };
    for (let i = 0; i < 2; i++)
      expect(
        (
          await handleVisitorMetric(
            request(visitor, {
              "CF-Connecting-IP": "192.0.2.1",
              "User-Agent": "private",
              Referer: "https://privacv.app/?secret=private",
            }),
            env,
            now,
          )
        )?.status,
      ).toBe(204);
    expect(writeDataPoint.mock.calls).toEqual(
      Array.from({ length: 2 }, () => [
        {
          blobs: ["workspace_visitor", visitor.day, visitor.workspace, visitor.visitorId],
          doubles: [1],
          indexes: [`${visitor.workspace}:${visitor.visitorId}`],
        },
      ]),
    );
  });
  it("rejects expired IDs, arbitrary content, extra fields, and oversized bodies", async () => {
    const writeDataPoint = vi.fn();
    for (const body of [
      null,
      [],
      { ...visitor, day: "2026-09-04" },
      { ...visitor, visitorId: "name@example.com" },
      { ...visitor, workspace: "about" },
      { ...visitor, workspace: undefined },
      { ...visitor, notes: "secret" },
      { ...visitor, notes: "x".repeat(500) },
    ]) {
      expect(
        (await handleVisitorMetric(request(body), { VISITOR_METRICS: { writeDataPoint } }, now))
          ?.status,
      ).toBe(400);
    }
    expect(writeDataPoint).not.toHaveBeenCalled();
  });
  it("keeps the same browser in separate workspace sampling groups", async () => {
    const writeDataPoint = vi.fn();
    const env = { VISITOR_METRICS: { writeDataPoint } };
    for (const workspace of ["resume", "job_applications"]) {
      expect(
        (await handleVisitorMetric(request({ ...visitor, workspace }), env, now))?.status,
      ).toBe(204);
    }
    expect(writeDataPoint.mock.calls.map(([point]) => point.blobs[2])).toEqual([
      "resume",
      "job_applications",
    ]);
    expect(new Set(writeDataPoint.mock.calls.map(([point]) => point.indexes[0])).size).toBe(2);
  });
  it("rejects cross-site requests and respects privacy headers", async () => {
    const writeDataPoint = vi.fn();
    const env = { VISITOR_METRICS: { writeDataPoint } };
    expect(
      (await handleVisitorMetric(request(visitor, { Origin: "https://other.example" }), env, now))
        ?.status,
    ).toBe(403);
    expect(
      (await handleVisitorMetric(request(visitor, { "Sec-Fetch-Site": "cross-site" }), env, now))
        ?.status,
    ).toBe(403);
    for (const header of ["DNT", "Sec-GPC"])
      expect(
        (await handleVisitorMetric(request(visitor, { [header]: "1" }), env, now))?.status,
      ).toBe(204);
    expect(writeDataPoint).not.toHaveBeenCalled();
  });
  it("handles routing, missing bindings, and binding errors", async () => {
    expect(await handleVisitorMetric(new Request("https://privacv.app/"), {}, now)).toBeNull();
    expect(
      (await handleVisitorMetric(new Request("https://privacv.app/api/metrics/visitors"), {}, now))
        ?.status,
    ).toBe(405);
    expect((await handleVisitorMetric(request(), {}, now))?.status).toBe(204);
    expect(
      (
        await handleVisitorMetric(
          request(),
          {
            VISITOR_METRICS: {
              writeDataPoint: () => {
                throw new Error("unavailable");
              },
            },
          },
          now,
        )
      )?.status,
    ).toBe(503);
  });
});
