import { ChevronRight } from "lucide-react";
import { Select } from "@/components/ui/select";
import {
  ACCENT_PRESETS,
  BULLET_STYLE_LABELS,
  BULLET_STYLES,
  DENSITIES,
  DENSITY_LABELS,
  HEADING_STYLE_LABELS,
  HEADING_STYLES,
  normalizeAccent,
  RESUME_FONTS,
  RESUME_TEMPLATES,
  resolveFontStack,
  type BulletStyle,
  type Density,
  type HeadingStyle,
  type ResumeState,
  type ResumeTemplateId,
  type ResumeTheme,
} from "@/lib/resume";
import { cn } from "@/lib/utils";

function ThemeSegment<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1 rounded-md border bg-muted/40 p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 whitespace-nowrap rounded px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              value === option.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ResumeDesignControls({
  state,
  advancedOpen,
  onAdvancedOpenChange,
  onTemplateChange,
  onThemeChange,
}: {
  state: ResumeState;
  advancedOpen: boolean;
  onAdvancedOpenChange: (open: boolean) => void;
  onTemplateChange: (template: ResumeTemplateId) => void;
  onThemeChange: (patch: Partial<ResumeTheme>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Preset</span>
          <Select
            value={state.template}
            onChange={(event) => onTemplateChange(event.target.value as ResumeTemplateId)}
            aria-label="Resume preset"
          >
            {RESUME_TEMPLATES.map((template) => (
              <option key={template.id} value={template.id}>
                {template.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="grid gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Font</span>
          <Select
            value={state.theme.font}
            onChange={(event) => onThemeChange({ font: event.target.value })}
            style={{ fontFamily: resolveFontStack(state.theme.font) }}
            aria-label="Resume font"
          >
            {RESUME_FONTS.map((font) => (
              <option key={font.id} value={font.id}>
                {font.label} · {font.kind}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <div className="grid gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Accent color</span>
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Accent color">
          {ACCENT_PRESETS.map((accent) => {
            const selected = normalizeAccent(state.theme.accent).toLowerCase() === accent.value.toLowerCase();
            return (
              <button
                key={accent.id}
                type="button"
                aria-pressed={selected}
                aria-label={accent.label}
                title={accent.label}
                onClick={() => onThemeChange({ accent: accent.value })}
                className={cn(
                  "size-7 rounded-full border transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                  selected ? "ring-2 ring-ring ring-offset-1" : "hover:scale-110",
                )}
                style={{ backgroundColor: accent.value, borderColor: "rgb(0 0 0 / 12%)" }}
              />
            );
          })}
          <label className="ml-1 inline-flex items-center gap-1.5 rounded-full border bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground">
            Custom
            <input
              type="color"
              value={normalizeAccent(state.theme.accent)}
              onChange={(event) => onThemeChange({ accent: event.target.value })}
              className="size-5 cursor-pointer rounded border-0 bg-transparent p-0"
              aria-label="Custom accent color"
            />
          </label>
        </div>
      </div>

      <button
        type="button"
        aria-expanded={advancedOpen}
        onClick={() => onAdvancedOpenChange(!advancedOpen)}
        className="flex w-full items-center gap-1.5 rounded-md text-left text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronRight className={cn("size-3.5 transition-transform", advancedOpen && "rotate-90")} />
        Advanced
        <span className="font-normal">header, density, headings, bullets, divider</span>
      </button>

      {advancedOpen ? (
        <div className="grid gap-4 rounded-md border bg-muted/20 p-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <ThemeSegment
              label="Header"
              value={state.theme.headerAlign}
              options={[
                { value: "left", label: "Left" },
                { value: "center", label: "Center" },
              ]}
              onChange={(headerAlign) => onThemeChange({ headerAlign })}
            />
            <ThemeSegment
              label="Density"
              value={state.theme.density}
              options={DENSITIES.map((density) => ({ value: density as Density, label: DENSITY_LABELS[density] }))}
              onChange={(density) => onThemeChange({ density })}
            />
          </div>

          <ThemeSegment
            label="Section headings"
            value={state.theme.headingStyle}
            options={HEADING_STYLES.map((style) => ({ value: style as HeadingStyle, label: HEADING_STYLE_LABELS[style] }))}
            onChange={(headingStyle) => onThemeChange({ headingStyle })}
          />

          <ThemeSegment
            label="Bullet style"
            value={state.theme.bulletStyle}
            options={BULLET_STYLES.map((style) => ({ value: style as BulletStyle, label: BULLET_STYLE_LABELS[style] }))}
            onChange={(bulletStyle) => onThemeChange({ bulletStyle })}
          />

          <label className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2">
            <span className="text-xs font-medium">Divider under header</span>
            <input
              type="checkbox"
              checked={state.theme.headerDivider}
              onChange={(event) => onThemeChange({ headerDivider: event.target.checked })}
              className="size-4 accent-foreground"
              aria-label="Divider under header"
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
