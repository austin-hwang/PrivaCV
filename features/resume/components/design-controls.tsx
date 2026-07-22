import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <ToggleGroup
        aria-label={label}
        variant="outline"
        size="default"
        spacing={0}
        selectionMode="single"
        selectedKeys={[value]}
        onSelectionChange={(keys) => {
          const selected = [...keys][0];
          if (selected != null) onChange(String(selected) as T);
        }}
        className="grid w-full grid-cols-4"
      >
        {options.map((option) => (
          <ToggleGroupItem key={option.value} id={option.value} className="w-full min-w-0">
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </Field>
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
    <FieldGroup className="gap-4">
      <FieldGroup className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel>Preset</FieldLabel>
          <Select
            selectedKey={state.template}
            onSelectionChange={(key) => onTemplateChange(String(key) as ResumeTemplateId)}
            aria-label="Resume preset"
            className="w-full"
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {RESUME_TEMPLATES.map((template) => (
                  <SelectItem key={template.id} id={template.id}>
                    {template.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>Font</FieldLabel>
          <Select
            selectedKey={state.theme.font}
            onSelectionChange={(key) => onThemeChange({ font: String(key) })}
            aria-label="Resume font"
            className="w-full"
          >
            <SelectTrigger style={{ fontFamily: resolveFontStack(state.theme.font) }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {RESUME_FONTS.map((font) => (
                  <SelectItem key={font.id} id={font.id} textValue={`${font.label} · ${font.kind}`}>
                    {font.label} · {font.kind}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      </FieldGroup>

      <FieldSet>
        <FieldLegend id="accent-color-legend" variant="label">
          Accent color
        </FieldLegend>
        <FieldGroup className="flex-row flex-wrap items-center gap-2">
          <ToggleGroup
            aria-labelledby="accent-color-legend"
            spacing={2}
            selectionMode="single"
            selectedKeys={ACCENT_PRESETS.filter(
              (accent) =>
                normalizeAccent(state.theme.accent).toLowerCase() === accent.value.toLowerCase(),
            ).map((accent) => accent.id)}
            onSelectionChange={(keys) => {
              const selected = [...keys][0];
              const accent = ACCENT_PRESETS.find((option) => option.id === selected);
              if (accent) onThemeChange({ accent: accent.value });
            }}
            className="flex-wrap"
          >
            {ACCENT_PRESETS.map((accent) => {
              return (
                <ToggleGroupItem
                  key={accent.id}
                  id={accent.id}
                  aria-label={accent.label}
                  className="size-7 min-w-0 rounded-full border p-0 transition-transform hover:scale-110 data-selected:ring-2 data-selected:ring-ring data-selected:ring-inset"
                  style={{ backgroundColor: accent.value, borderColor: "rgb(0 0 0 / 12%)" }}
                />
              );
            })}
          </ToggleGroup>
          <Field orientation="horizontal" className="w-fit rounded-full border px-2 py-1">
            <FieldLabel htmlFor="custom-accent-color" className="text-[11px] text-muted-foreground">
              Custom
            </FieldLabel>
            <input
              id="custom-accent-color"
              type="color"
              value={normalizeAccent(state.theme.accent)}
              onChange={(event) => onThemeChange({ accent: event.target.value })}
              className="size-5 cursor-pointer rounded-sm border-0 bg-transparent p-0"
              aria-label="Custom accent color"
            />
          </Field>
        </FieldGroup>
      </FieldSet>

      <Button
        variant="ghost"
        size="sm"
        aria-expanded={advancedOpen}
        onPress={() => onAdvancedOpenChange(!advancedOpen)}
        className="w-full justify-start"
      >
        <ChevronRight
          data-icon="inline-start"
          className={cn("transition-transform", advancedOpen && "rotate-90")}
        />
        Advanced
        <span className="font-normal">header, density, headings, bullets, divider</span>
      </Button>

      {advancedOpen ? (
        <div className="grid gap-4 rounded-md border bg-muted/20 p-3">
          <div className="grid gap-4">
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
              options={DENSITIES.map((density) => ({
                value: density as Density,
                label: DENSITY_LABELS[density],
              }))}
              onChange={(density) => onThemeChange({ density })}
            />
          </div>

          <ThemeSegment
            label="Section headings"
            value={state.theme.headingStyle}
            options={HEADING_STYLES.map((style) => ({
              value: style as HeadingStyle,
              label: HEADING_STYLE_LABELS[style],
            }))}
            onChange={(headingStyle) => onThemeChange({ headingStyle })}
          />

          <ThemeSegment
            label="Bullet style"
            value={state.theme.bulletStyle}
            options={BULLET_STYLES.map((style) => ({
              value: style as BulletStyle,
              label: BULLET_STYLE_LABELS[style],
            }))}
            onChange={(bulletStyle) => onThemeChange({ bulletStyle })}
          />

          <div className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2">
            <span className="text-xs font-medium">Divider under header</span>
            <Checkbox
              isSelected={state.theme.headerDivider}
              onChange={(headerDivider) => onThemeChange({ headerDivider })}
              aria-label="Divider under header"
            />
          </div>
        </div>
      ) : null}
    </FieldGroup>
  );
}
