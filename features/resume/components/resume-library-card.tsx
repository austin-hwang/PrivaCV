"use client";

import { useMemo, useState } from "react";
import { Copy, FileStack, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResumePreview } from "@/features/resume/components/resume-preview";
import {
  formatCheckpointTime,
  versionHeadline,
  type ResumeLibraryItem,
} from "@/lib/resume-workspace";

const THUMBNAIL_SCALE = 0.22;
const LETTER_WIDTH = 8.5 * 96;
const LETTER_HEIGHT = 11 * 96;

function ResumeThumbnail({ item }: { item: ResumeLibraryItem }) {
  return (
    <div
      aria-hidden="true"
      className="relative h-[232px] overflow-hidden rounded-md border bg-muted/50 shadow-inner"
    >
      <div
        className="pointer-events-none absolute left-1/2 top-0 origin-top"
        style={{
          width: `${LETTER_WIDTH}px`,
          height: `${LETTER_HEIGHT}px`,
          transform: `translateX(-50%) scale(${THUMBNAIL_SCALE})`,
        }}
      >
        <ResumePreview state={item.state} />
      </div>
    </div>
  );
}

export function ResumeLibraryCard({
  open,
  onOpenChange,
  items,
  activeResumeId,
  onCreate,
  onOpen,
  onDuplicate,
  onRename,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: ResumeLibraryItem[];
  activeResumeId: string | null;
  onCreate: () => void;
  onOpen: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRename: (id: string, label: string) => void;
  onDelete: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const visibleItems = useMemo(() => {
    const clean = query.trim().toLocaleLowerCase();
    if (!clean) return items;
    return items.filter((item) =>
      [item.label, item.state.name, item.state.title].some((value) =>
        value.toLocaleLowerCase().includes(clean),
      ),
    );
  }, [items, query]);

  const finishRename = (item: ResumeLibraryItem) => {
    const clean = renameDraft.trim();
    if (clean && clean !== item.label) onRename(item.id, clean);
    setRenamingId(null);
    setRenameDraft("");
  };

  return (
    <Dialog
      isOpen={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setQuery("");
          setRenamingId(null);
          setDeletingId(null);
        }
        onOpenChange(nextOpen);
      }}
      className="flex h-[min(900px,calc(100dvh-2rem))] max-w-6xl flex-col gap-0 overflow-hidden p-0"
    >
      <DialogHeader className="border-b px-5 py-5 pr-12">
        <DialogTitle>Resume library</DialogTitle>
      </DialogHeader>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 px-5 py-3">
        <p className="text-sm text-muted-foreground">
          {items.length} {items.length === 1 ? "resume" : "resumes"} saved in this browser
        </p>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            onCreate();
            onOpenChange(false);
          }}
        >
          <Plus data-icon="inline-start" /> New resume
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1 p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Field className="min-w-0 flex-1 sm:max-w-sm">
            <FieldLabel className="sr-only" htmlFor="resume-library-search">
              Find a resume
            </FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <Search aria-hidden="true" />
              </InputGroupAddon>
              <InputGroupInput
                id="resume-library-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find by resume name or role"
              />
              {query ? (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    aria-label="Clear resume search"
                    onClick={() => setQuery("")}
                  >
                    <X data-icon="inline-start" />
                  </InputGroupButton>
                </InputGroupAddon>
              ) : null}
            </InputGroup>
          </Field>
        </div>

        {visibleItems.length ? (
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {visibleItems.map((item) => {
              const active = item.id === activeResumeId;
              const renaming = item.id === renamingId;
              return (
                <li key={item.id} className="rounded-lg border bg-card p-3 shadow-xs">
                  <ResumeThumbnail item={item} />
                  <div className="mt-3 flex items-start gap-2">
                    <FileStack
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {renaming ? (
                          <Field>
                            <FieldLabel className="sr-only" htmlFor={`rename-resume-${item.id}`}>
                              Rename {item.label}
                            </FieldLabel>
                            <Input
                              id={`rename-resume-${item.id}`}
                              autoFocus
                              value={renameDraft}
                              aria-label={`Rename ${item.label}`}
                              className="h-8 min-w-0"
                              onChange={(event) => setRenameDraft(event.target.value)}
                              onBlur={() => finishRename(item)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") event.currentTarget.blur();
                                if (event.key === "Escape") {
                                  setRenamingId(null);
                                  setRenameDraft("");
                                }
                              }}
                            />
                          </Field>
                        ) : (
                          <p className="truncate text-sm font-semibold">{item.label}</p>
                        )}
                        {active ? (
                          <Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[10px]">
                            Current
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Edited {formatCheckpointTime(item.updatedAt)} ·{" "}
                        {versionHeadline(item.state)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      variant={active ? "secondary" : "outline"}
                      size="sm"
                      isDisabled={active}
                      onClick={() => {
                        onOpen(item.id);
                        onOpenChange(false);
                      }}
                    >
                      {active ? "Open now" : "Open"}
                    </Button>
                    <TooltipTrigger>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Duplicate ${item.label}`}
                        onClick={() => {
                          onDuplicate(item.id);
                          onOpenChange(false);
                        }}
                      >
                        <Copy data-icon="inline-start" />
                      </Button>
                      <Tooltip>Duplicate resume</Tooltip>
                    </TooltipTrigger>
                    <TooltipTrigger>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Rename ${item.label}`}
                        onClick={() => {
                          setRenamingId(item.id);
                          setRenameDraft(item.label);
                        }}
                      >
                        <Pencil data-icon="inline-start" />
                      </Button>
                      <Tooltip>Rename resume</Tooltip>
                    </TooltipTrigger>
                    <TooltipTrigger>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon-sm"
                        aria-label={`Delete ${item.label}`}
                        onClick={() => setDeletingId(item.id)}
                      >
                        <Trash2 data-icon="inline-start" />
                      </Button>
                      <Tooltip>Delete resume</Tooltip>
                    </TooltipTrigger>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty className="min-h-56">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Search />
              </EmptyMedia>
              <EmptyTitle>No resumes match “{query.trim()}”</EmptyTitle>
              <EmptyDescription>Try another search or show every saved resume.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button type="button" variant="outline" size="sm" onClick={() => setQuery("")}>
                Clear search
              </Button>
            </EmptyContent>
          </Empty>
        )}
      </ScrollArea>
      <AlertDialog
        isOpen={deletingId !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDeletingId(null);
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this resume?</AlertDialogTitle>
          <AlertDialogDescription>
            This resume and all of its saved checkpoints will be permanently removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onPress={() => {
              if (deletingId) onDelete(deletingId);
              setDeletingId(null);
            }}
          >
            Delete resume
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialog>
    </Dialog>
  );
}
