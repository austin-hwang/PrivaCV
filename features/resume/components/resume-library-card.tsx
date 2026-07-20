"use client";

import { useMemo, useState } from "react";
import { Copy, FileStack, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setQuery("");
          setRenamingId(null);
          setDeletingId(null);
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="flex h-[min(900px,calc(100dvh-2rem))] max-w-6xl flex-col gap-0 overflow-hidden p-0">
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
            <Plus /> New resume
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="relative min-w-0 flex-1 sm:max-w-sm">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Find a resume"
                placeholder="Find by resume name or role"
                className="pl-9 pr-9"
              />
              {query ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 size-9"
                  aria-label="Clear resume search"
                  onClick={() => setQuery("")}
                >
                  <X />
                </Button>
              ) : null}
            </div>
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
                            <Input
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
                    {deletingId === item.id ? (
                      <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-2.5">
                        <p className="text-xs text-foreground">
                          Delete this resume and its checkpoints?
                        </p>
                        <div className="mt-2 flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setDeletingId(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              onDelete(item.id);
                              setDeletingId(null);
                            }}
                          >
                            Delete resume
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <Button
                          type="button"
                          variant={active ? "secondary" : "outline"}
                          size="sm"
                          disabled={active}
                          onClick={() => {
                            onOpen(item.id);
                            onOpenChange(false);
                          }}
                        >
                          {active ? "Open now" : "Open"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Duplicate ${item.label}`}
                          title="Duplicate resume"
                          onClick={() => {
                            onDuplicate(item.id);
                            onOpenChange(false);
                          }}
                        >
                          <Copy />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Rename ${item.label}`}
                          title="Rename resume"
                          onClick={() => {
                            setRenamingId(item.id);
                            setRenameDraft(item.label);
                          }}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          aria-label={`Delete ${item.label}`}
                          title="Delete resume"
                          onClick={() => setDeletingId(item.id)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="grid min-h-56 place-items-center rounded-lg border border-dashed bg-muted/30 p-6 text-center">
              <div>
                <Search className="mx-auto mb-3 size-6 text-muted-foreground" />
                <p className="font-semibold">No resumes match “{query.trim()}”</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setQuery("")}
                >
                  Clear search
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
