import { describe, expect, it } from "vitest";
import { safeFilename } from "@/lib/browser-files";

describe("safeFilename", () => {
  it("normalizes user-provided names while preserving useful filename characters", () => {
    expect(safeFilename("  Jane Doe - Product.pdf  ")).toBe("Jane_Doe_-_Product.pdf");
  });

  it("uses the requested fallback when a name has no safe characters", () => {
    expect(safeFilename("///", "resume")).toBe("resume");
  });
});
