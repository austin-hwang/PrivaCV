import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Hsl = readonly [number, number, number];

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function themeBlock(selector: ":root" | ".dark") {
  const escapedSelector = selector.replace(".", "\\.");
  const match = css.match(new RegExp(`${escapedSelector}\\s*{([^}]*)}`));
  if (!match) throw new Error(`Missing ${selector} theme block`);
  return match[1];
}

function token(block: string, name: string): Hsl {
  const match = block.match(new RegExp(`--${name}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%`));
  if (!match) throw new Error(`Missing --${name} color token`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function rgb([hue, saturationPercent, lightnessPercent]: Hsl) {
  const saturation = saturationPercent / 100;
  const lightness = lightnessPercent / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const secondary = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const offset = lightness - chroma / 2;
  const channels =
    hue < 60
      ? [chroma, secondary, 0]
      : hue < 120
        ? [secondary, chroma, 0]
        : hue < 180
          ? [0, chroma, secondary]
          : hue < 240
            ? [0, secondary, chroma]
            : hue < 300
              ? [secondary, 0, chroma]
              : [chroma, 0, secondary];
  return channels.map((channel) => channel + offset);
}

function luminance(color: Hsl) {
  const [red, green, blue] = rgb(color).map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function contrast(foreground: Hsl, background: Hsl) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

const textPairs = [
  ["foreground", "background"],
  ["foreground", "card"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  ["muted-foreground", "muted"],
  ["primary-foreground", "primary"],
  ["secondary-foreground", "secondary"],
  ["accent-foreground", "accent"],
  ["brand", "background"],
  ["brand", "card"],
  ["success-foreground", "success"],
  ["success", "background"],
  ["success", "card"],
  ["warning-foreground", "warning"],
  ["warning", "background"],
  ["warning", "card"],
  ["destructive-foreground", "destructive"],
  ["destructive", "background"],
  ["destructive", "card"],
] as const;

describe.each([
  ["light", themeBlock(":root")],
  ["dark", themeBlock(".dark")],
])("%s theme contrast", (_theme, block) => {
  it.each(textPairs)("keeps %s readable on %s", (foreground, background) => {
    expect(contrast(token(block, foreground), token(block, background))).toBeGreaterThanOrEqual(
      4.5,
    );
  });
});

it("keeps light-mode controls and surfaces visually distinct", () => {
  const light = themeBlock(":root");
  expect(contrast(token(light, "input"), token(light, "background"))).toBeGreaterThanOrEqual(1.45);
  expect(contrast(token(light, "border"), token(light, "card"))).toBeGreaterThanOrEqual(1.35);
  expect(contrast(token(light, "accent"), token(light, "card"))).toBeGreaterThanOrEqual(1.2);
  expect(contrast(token(light, "secondary"), token(light, "card"))).toBeGreaterThanOrEqual(1.18);
});
