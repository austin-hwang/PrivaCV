"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BriefcaseBusiness,
  CalendarDays,
  Camera,
  ChevronRight,
  CircleDotDashed,
  CircleSlash2,
  Component,
  ContactRound,
  GitBranch,
  GitFork,
  Globe2,
  Link as LinkIcon,
  MessageCircle,
  NotebookPen,
  Plus,
  SquareCode,
  Trash2,
  Video,
} from "lucide-react";
import { FieldGroup, TextField } from "@/features/resume/components/editor-fields";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { Toggle } from "@/components/ui/toggle";
import {
  HEADER_LINK_ICON_OPTIONS,
  personNameParts,
  type HeaderLink,
  type HeaderLinkIconId,
  type ResumeState,
} from "@/lib/resume";
import { cn } from "@/lib/utils";

const HEADER_LINK_ICONS: Record<Exclude<HeaderLinkIconId, "none">, typeof Globe2> = {
  website: Globe2,
  linkedin: ContactRound,
  github: GitBranch,
  gitlab: GitFork,
  twitter: MessageCircle,
  instagram: Camera,
  youtube: Video,
  dribbble: CircleDotDashed,
  figma: Component,
  portfolio: BriefcaseBusiness,
  blog: NotebookPen,
  calendar: CalendarDays,
  code: SquareCode,
  link: LinkIcon,
};

function HeaderLinkIcon({
  icon,
  "data-icon": dataIcon,
}: {
  icon: HeaderLinkIconId;
  "data-icon"?: "inline-start" | "inline-end";
}) {
  if (icon === "none") {
    return <CircleSlash2 aria-hidden="true" data-icon={dataIcon} className="lucide-none" />;
  }
  const Icon = HEADER_LINK_ICONS[icon] ?? Globe2;
  return <Icon aria-hidden="true" data-icon={dataIcon} className={`lucide-${icon}`} />;
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
        variant="secondary"
        size="icon"
        id={id}
        aria-label={`${label} icon — ${currentLabel}`}
        className="shrink-0"
      >
        <HeaderLinkIcon icon={value} data-icon="inline-start" />
      </Button>
      <Popover
        className="grid w-auto grid-cols-4 gap-1 p-1.5"
        placement="bottom start"
        aria-label={`${label} icon options`}
      >
        {HEADER_LINK_ICON_OPTIONS.map((option) => (
          <Toggle
            key={option.id}
            title={option.label}
            aria-label={option.label}
            isSelected={option.id === value}
            variant="outline"
            onChange={() => {
              onChange(option.id);
              setOpen(false);
            }}
            className="size-9 p-0"
          >
            <HeaderLinkIcon icon={option.id} />
          </Toggle>
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
  const [open, setOpen] = useState(false);
  return (
    <Collapsible
      isExpanded={open}
      onExpandedChange={setOpen}
      className="rounded-md border bg-muted/10"
    >
      <Button
        slot="trigger"
        variant="ghost"
        size="sm"
        className="w-full justify-between rounded-md px-3 text-muted-foreground"
      >
        Name parts — used for application forms
        <ChevronRight
          data-icon="inline-end"
          className={cn("transition-transform", open && "rotate-90")}
        />
      </Button>
      <CollapsibleContent className="editor-pane-grid grid gap-3 px-3 pb-3 pt-1 [&[hidden]]:p-0">
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
      </CollapsibleContent>
    </Collapsible>
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
      className={cn(active && "border-l-2 border-l-muted-foreground/40 pl-3")}
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
            <Plus data-icon="inline-start" /> Add link
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
                  <Field className="min-w-0 flex-1">
                    <FieldLabel className="sr-only" htmlFor={`field-header-link-${link.id}-url`}>
                      {fieldLabel} URL
                    </FieldLabel>
                    <Input
                      id={`field-header-link-${link.id}-url`}
                      type="url"
                      inputMode="url"
                      autoComplete="url"
                      spellCheck={false}
                      value={link.url}
                      placeholder="github.com/janedoe"
                      onChange={(event) => onUpdateLink(link.id, { url: event.target.value })}
                    />
                  </Field>
                  <div className="flex shrink-0 items-center">
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="size-7"
                      isDisabled={index === 0}
                      aria-label={`Move ${fieldLabel} up`}
                      onClick={() => onMoveLink(index, -1)}
                    >
                      <ArrowUp data-icon="inline-start" />
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
                      <ArrowDown data-icon="inline-start" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label={`Remove ${fieldLabel}`}
                      onClick={() => onRemoveLink(link.id)}
                    >
                      <Trash2 data-icon="inline-start" />
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
