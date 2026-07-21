"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BriefcaseBusiness,
  Calendar,
  Camera,
  Code,
  Code2,
  GitFork,
  Globe2,
  Link as LinkIcon,
  MessageCircle,
  Newspaper,
  Palette,
  Plus,
  Shapes,
  Trash2,
  Video,
} from "lucide-react";
import { FieldGroup, TextField } from "@/features/resume/components/editor-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import {
  HEADER_LINK_ICON_OPTIONS,
  personNameParts,
  type HeaderLink,
  type HeaderLinkIconId,
  type ResumeState,
} from "@/lib/resume";
import { cn } from "@/lib/utils";

const HEADER_LINK_ICONS: Record<HeaderLinkIconId, typeof Globe2> = {
  website: Globe2,
  linkedin: BriefcaseBusiness,
  github: Code2,
  gitlab: GitFork,
  twitter: MessageCircle,
  instagram: Camera,
  youtube: Video,
  dribbble: Palette,
  figma: Shapes,
  portfolio: BriefcaseBusiness,
  blog: Newspaper,
  calendar: Calendar,
  code: Code,
  link: LinkIcon,
};

function HeaderLinkIcon({ icon }: { icon: HeaderLinkIconId }) {
  const Icon = HEADER_LINK_ICONS[icon] ?? Globe2;
  return <Icon aria-hidden="true" className={cn("size-4", `lucide-${icon}`)} />;
}

function HeaderLinkIconPicker({
  id,
  value,
  label,
  onChange,
}: {
  id: string;
  value: HeaderLinkIconId;
  label: string;
  onChange: (icon: HeaderLinkIconId) => void;
}) {
  const [open, setOpen] = useState(false);
  const currentLabel =
    HEADER_LINK_ICON_OPTIONS.find((option) => option.id === value)?.label ?? "Website";

  return (
    <PopoverTrigger isOpen={open} onOpenChange={setOpen}>
      <Button
        unstyled
        id={id}
        aria-label={`${label} icon — ${currentLabel}`}
        className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors hover:bg-muted/70 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      >
        <HeaderLinkIcon icon={value} />
      </Button>
      <Popover
        className="grid w-auto grid-cols-4 gap-1 p-1.5"
        placement="bottom start"
        aria-label={`${label} icon options`}
      >
        {HEADER_LINK_ICON_OPTIONS.map((option) => (
          <Button
            unstyled
            key={option.id}
            aria-label={option.label}
            onPress={() => {
              onChange(option.id);
              setOpen(false);
            }}
            className={cn(
              "flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground",
              option.id === value && "bg-muted text-foreground ring-1 ring-ring",
            )}
          >
            <HeaderLinkIcon icon={option.id} />
          </Button>
        ))}
      </Popover>
    </PopoverTrigger>
  );
}

type HeaderTextField =
  | "name"
  | "firstName"
  | "middleName"
  | "lastName"
  | "title"
  | "email"
  | "phone"
  | "location";

/**
 * Optional split name for application forms. `name` stays the value the resume
 * renders; these override the best-effort split when set. Placeholders show the
 * derived split so the person sees what autofill will use before overriding it.
 */
function NameParts({
  state,
  onUpdateField,
}: {
  state: ResumeState;
  onUpdateField: (field: HeaderTextField, value: string) => void;
}) {
  const derived = personNameParts(state);
  return (
    <details className="rounded-md border bg-muted/10 px-3 py-2">
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
        Name parts — used for application forms
      </summary>
      <div className="editor-pane-grid mt-2 grid gap-3">
        <TextField
          id="field-first-name"
          label="First"
          value={state.firstName}
          placeholder={derived.first || "Jane"}
          autoComplete="given-name"
          spellCheck={false}
          onChange={(value) => onUpdateField("firstName", value)}
        />
        <TextField
          id="field-middle-name"
          label="Middle"
          value={state.middleName}
          placeholder={derived.middle || "—"}
          autoComplete="additional-name"
          spellCheck={false}
          onChange={(value) => onUpdateField("middleName", value)}
        />
        <TextField
          id="field-last-name"
          label="Last"
          value={state.lastName}
          placeholder={derived.last || "Doe"}
          autoComplete="family-name"
          spellCheck={false}
          onChange={(value) => onUpdateField("lastName", value)}
        />
      </div>
    </details>
  );
}

export function ResumeHeaderFields({
  state,
  active,
  collapsed,
  onToggleCollapsed,
  onUpdateField,
  onUpdateLink,
  onAddLink,
  onRemoveLink,
  onMoveLink,
}: {
  state: ResumeState;
  active: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onUpdateField: (field: HeaderTextField, value: string) => void;
  onUpdateLink: (id: string, patch: Partial<Pick<HeaderLink, "label" | "url" | "icon">>) => void;
  onAddLink: () => void;
  onRemoveLink: (id: string) => void;
  onMoveLink: (index: number, direction: -1 | 1) => void;
}) {
  return (
    <FieldGroup
      id="edit-header"
      title="Header"
      reviewRegion
      className={cn(active && "rounded-md bg-brand-soft/10 px-3 pt-3 ring-1 ring-brand/40")}
      groupId="header"
      collapsible
      collapsed={collapsed}
      onToggleCollapsed={onToggleCollapsed}
    >
      <TextField
        id="field-name"
        label="Full Name"
        value={state.name}
        placeholder="Jane Doe"
        autoComplete="name"
        spellCheck={false}
        onChange={(value) => onUpdateField("name", value)}
      />
      <NameParts state={state} onUpdateField={onUpdateField} />
      <TextField
        id="field-title"
        label="Title / Role"
        value={state.title}
        placeholder="Senior Software Engineer"
        autoComplete="organization-title"
        spellCheck
        onChange={(value) => onUpdateField("title", value)}
      />
      <div className="editor-pane-grid grid gap-3">
        <TextField
          id="field-email"
          label="Email"
          value={state.email}
          placeholder="jane@example.com"
          type="email"
          autoComplete="email"
          inputMode="email"
          spellCheck={false}
          onChange={(value) => onUpdateField("email", value)}
        />
        <TextField
          id="field-phone"
          label="Phone"
          value={state.phone}
          placeholder="(555) 123-4567"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          spellCheck={false}
          onChange={(value) => onUpdateField("phone", value)}
        />
      </div>
      <TextField
        id="field-location"
        label="Location"
        value={state.location}
        placeholder="San Francisco, CA"
        autoComplete="address-level2"
        spellCheck={false}
        onChange={(value) => onUpdateField("location", value)}
      />
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Links</p>
            <p className="text-[11px] text-muted-foreground">
              Website, LinkedIn, GitHub, portfolio, or another profile.
            </p>
          </div>
          <Button
            id="add-header-link"
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={onAddLink}
          >
            <Plus /> Add link
          </Button>
        </div>
        {state.headerLinks.length ? (
          <div className="overflow-hidden rounded-md border bg-muted/10">
            {state.headerLinks.map((link, index) => {
              const fieldLabel = link.label.trim() || `Link ${index + 1}`;
              return (
                <div
                  key={link.id}
                  data-header-link={link.id}
                  className="flex items-center gap-2 border-b p-2 last:border-b-0"
                >
                  <HeaderLinkIconPicker
                    id={`field-header-link-${link.id}-icon`}
                    value={link.icon}
                    label={fieldLabel}
                    onChange={(icon) => onUpdateLink(link.id, { icon })}
                  />
                  <div className="min-w-0 flex-1">
                    <label className="sr-only" htmlFor={`field-header-link-${link.id}-url`}>
                      {fieldLabel} URL
                    </label>
                    <Input
                      id={`field-header-link-${link.id}-url`}
                      type="url"
                      inputMode="url"
                      autoComplete="url"
                      spellCheck={false}
                      value={link.url}
                      placeholder="github.com/janedoe"
                      aria-label={`${fieldLabel} URL`}
                      onChange={(event) => onUpdateLink(link.id, { url: event.target.value })}
                    />
                  </div>
                  <div className="flex shrink-0 items-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      isDisabled={index === 0}
                      aria-label={`Move ${fieldLabel} up`}
                      onClick={() => onMoveLink(index, -1)}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      isDisabled={index === state.headerLinks.length - 1}
                      aria-label={`Move ${fieldLabel} down`}
                      onClick={() => onMoveLink(index, 1)}
                    >
                      <ArrowDown />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Remove ${fieldLabel}`}
                      onClick={() => onRemoveLink(link.id)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            No profile links added.
          </p>
        )}
      </div>
    </FieldGroup>
  );
}
