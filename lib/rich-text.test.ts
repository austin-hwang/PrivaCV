// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  commitRichContent,
  inlineHtmlToMarkdown,
  richContentToPlainMarkdown,
  sanitizeRichContent,
} from "@/lib/rich-text";

describe("AI edit markdown round-trip", () => {
  it("shows the model bold/italic as markdown and drops underline (not carried through AI)", () => {
    const stored =
      "<ul><li>Led <strong>growth</strong> team</li><li>Cut <em>costs</em> now</li></ul><p>Shipped <u>v2</u>.</p>";
    expect(richContentToPlainMarkdown(stored)).toBe("- Led **growth** team\n- Cut *costs* now\nShipped v2.");
  });

  it("round-trips bold/italic losslessly through apply", () => {
    const stored = "<ul><li>Led <strong>growth</strong> team</li></ul><p>Shipped <em>v2</em>.</p>";
    expect(sanitizeRichContent(richContentToPlainMarkdown(stored))).toBe(stored);
  });

  it("rebuilds bullet vs paragraph structure from markers", () => {
    const reply = "- First **bold** point\n- Second point\nA closing paragraph.";
    expect(sanitizeRichContent(reply)).toBe(
      "<ul><li>First <strong>bold</strong> point</li><li>Second point</li></ul><p>A closing paragraph.</p>",
    );
  });

  it("does not mangle literal asterisks, snake_case, or arithmetic", () => {
    expect(sanitizeRichContent("Scaled to 5* uptime and 3* redundancy")).toBe(
      "<p>Scaled to 5* uptime and 3* redundancy</p>",
    );
    expect(sanitizeRichContent("Built data_sync and user_auth services")).toBe(
      "<p>Built data_sync and user_auth services</p>",
    );
    expect(sanitizeRichContent("Cut cost ** not scope ** further")).toBe(
      "<p>Cut cost ** not scope ** further</p>",
    );
  });
});

describe("inlineHtmlToMarkdown keeps underline for Markdown export by default", () => {
  it("emits <u> by default but omits it when keepUnderline is false", () => {
    const html = "Shipped <u>v2</u> on time";
    expect(inlineHtmlToMarkdown(html)).toBe("Shipped <u>v2</u> on time");
    expect(inlineHtmlToMarkdown(html, false)).toBe("Shipped v2 on time");
  });
});

describe("commitRichContent recurses into browser-nested blocks", () => {
  it("keeps a list the browser nested inside a paragraph div", () => {
    // Simulates: type a line, press Enter (creates a <div>), then bullet it.
    const el = document.createElement("div");
    el.innerHTML = "line one<div><ul><li>line two</li></ul></div>";
    expect(commitRichContent(el)).toBe("<p>line one</p><ul><li>line two</li></ul>");
  });
});
