"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDown,
  ArrowUp,
  BriefcaseBusiness,
  Calendar,
  Code,
  Dribbble,
  Figma,
  Github,
  Gitlab,
  Globe2,
  Instagram,
  Linkedin,
  Link as LinkIcon,
  Newspaper,
  Plus,
  Trash2,
  Twitter,
  Youtube,
} from "lucide-react";
import { FieldGroup, TextField } from "@/components/resume-editor/editor-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  HEADER_LINK_ICON_OPTIONS,
  type HeaderLink,
  type HeaderLinkIconId,
  type ResumeState,
} from "@/lib/resume";
import { cn } from "@/lib/utils";

const HEADER_LINK_ICONS: Record<HeaderLinkIconId, typeof Globe2> = {
  website: Globe2,
  linkedin: Linkedin,
  github: Github,
  gitlab: Gitlab,
  twitter: Twitter,
  instagram: Instagram,
  youtube: Youtube,
  dribbble: Dribbble,
  figma: Figma,
  portfolio: BriefcaseBusiness,
  blog: Newspaper,
  calendar: Calendar,
  code: Code,
  link: LinkIcon,
};

function HeaderLinkIcon({ icon }: { icon: HeaderLinkIconId }) {
  const Icon = HEADER_LINK_ICONS[icon] ?? Globe2;
  return <Icon aria-hidden="true" className="size-4" />;
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
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const button = rootRef.current?.querySelector("button");
    const rect = button?.getBoundingClientRect();
    if (rect) setPosition({ top: rect.bottom + 4, left: rect.left });

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const close = () => setOpen(false);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const currentLabel = HEADER_LINK_ICON_OPTIONS.find((option) => option.id === value)?.label ?? "Website";

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        id={id}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label} icon — ${currentLabel}`}
        title="Choose an icon"
        className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <HeaderLinkIcon icon={value} />
      </button>
      {open && position
        ? createPortal(
            <div
              ref={panelRef}
              role="menu"
              aria-label={`${label} icon options`}
              style={{ top: position.top, left: position.left }}
              className="fixed z-50 grid grid-cols-4 gap-1 rounded-md border bg-popover p-1.5 text-popover-foreground shadow-lg"
            >
              {HEADER_LINK_ICON_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                  aria-current={option.id === value}
                  aria-label={option.label}
                  title={option.label}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground",
                    option.id === value && "bg-muted text-foreground ring-1 ring-ring",
                  )}
                >
                  <HeaderLinkIcon icon={option.id} />
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

type HeaderTextField = "name" | "title" | "email" | "phone" | "location";

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
      <TextField id="field-name" label="Full Name" value={state.name} placeholder="Jane Doe" autoComplete="name" spellCheck={false} onChange={(value) => onUpdateField("name", value)} />
      <TextField id="field-title" label="Title / Role" value={state.title} placeholder="Senior Software Engineer" autoComplete="organization-title" spellCheck onChange={(value) => onUpdateField("title", value)} />
      <div className="editor-pane-grid grid gap-3">
        <TextField id="field-email" label="Email" value={state.email} placeholder="jane@example.com" type="email" autoComplete="email" inputMode="email" spellCheck={false} onChange={(value) => onUpdateField("email", value)} />
        <TextField id="field-phone" label="Phone" value={state.phone} placeholder="(555) 123-4567" type="tel" autoComplete="tel" inputMode="tel" spellCheck={false} onChange={(value) => onUpdateField("phone", value)} />
      </div>
      <TextField id="field-location" label="Location" value={state.location} placeholder="San Francisco, CA" autoComplete="address-level2" spellCheck={false} onChange={(value) => onUpdateField("location", value)} />
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Links</p>
            <p className="text-[11px] text-muted-foreground">Website, LinkedIn, GitHub, portfolio, or another profile.</p>
          </div>
          <Button id="add-header-link" type="button" variant="outline" size="sm" className="h-8" onClick={onAddLink}>
            <Plus /> Add link
          </Button>
        </div>
        {state.headerLinks.length ? (
          <div className="overflow-hidden rounded-md border bg-muted/10">
            {state.headerLinks.map((link, index) => {
              const fieldLabel = link.label.trim() || `Link ${index + 1}`;
              return (
                <div key={link.id} data-header-link={link.id} className="flex items-center gap-2 border-b p-2 last:border-b-0">
                  <HeaderLinkIconPicker id={`field-header-link-${link.id}-icon`} value={link.icon} label={fieldLabel} onChange={(icon) => onUpdateLink(link.id, { icon })} />
                  <div className="min-w-0 flex-1">
                    <label className="sr-only" htmlFor={`field-header-link-${link.id}-url`}>{fieldLabel} URL</label>
                    <Input id={`field-header-link-${link.id}-url`} type="url" inputMode="url" autoComplete="url" spellCheck={false} value={link.url} placeholder="github.com/janedoe" aria-label={`${fieldLabel} URL`} onChange={(event) => onUpdateLink(link.id, { url: event.target.value })} />
                  </div>
                  <div className="flex shrink-0 items-center">
                    <Button type="button" variant="ghost" size="icon" className="size-7" disabled={index === 0} aria-label={`Move ${fieldLabel} up`} onClick={() => onMoveLink(index, -1)}><ArrowUp /></Button>
                    <Button type="button" variant="ghost" size="icon" className="size-7" disabled={index === state.headerLinks.length - 1} aria-label={`Move ${fieldLabel} down`} onClick={() => onMoveLink(index, 1)}><ArrowDown /></Button>
                    <Button type="button" variant="ghost" size="icon" className="size-7 text-destructive hover:bg-destructive/10 hover:text-destructive" aria-label={`Remove ${fieldLabel}`} onClick={() => onRemoveLink(link.id)}><Trash2 /></Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">No profile links added.</p>
        )}
      </div>
    </FieldGroup>
  );
}
