"use client";

import type { Dispatch, SetStateAction } from "react";
import {
  blankEntry,
  clampTextScale,
  getSectionEntries,
  isBuiltinSection,
  normalizeHeaderLinks,
  normalizeTagGroups,
  parseTagGroups,
  tagGroupsToText,
  SECTION_LABELS,
  type CustomSection,
  type HeaderLink,
  type ResumeEntry,
  type ResumeState,
  type ResumeTheme,
  type SectionFormat,
  type SectionKey,
  type TagGroup,
} from "@/lib/resume";
import type { ToastState } from "@/lib/resume-workspace";

export type UndoableResumeChange =
  | { kind: "entry"; toastId: number; section: string; index: number; entry: ResumeEntry }
  | {
      kind: "custom-section";
      toastId: number;
      section: CustomSection;
      sectionOrderIndex: number;
      format: SectionFormat;
      tagGroups: TagGroup[];
      text: string;
    }
  | {
      kind: "builtin-section";
      toastId: number;
      section: SectionKey;
      title: string;
      entries: ResumeEntry[];
      skills: string;
      sectionOrderIndex: number;
      format: SectionFormat;
      tagGroups: TagGroup[];
      text: string;
    }
  | { kind: "layout"; toastId: number; density: ResumeTheme["density"]; textScale: number };

type Options = {
  state: ResumeState;
  setState: Dispatch<SetStateAction<ResumeState>>;
  undoableRemoval: UndoableResumeChange | null;
  setUndoableRemoval: Dispatch<SetStateAction<UndoableResumeChange | null>>;
  checkpointBeforeDestructiveEdit: (description: string) => void;
  flash: (message: string, action?: ToastState["action"]) => number;
};

export function useResumeContentActions({
  state,
  setState,
  undoableRemoval,
  setUndoableRemoval,
  checkpointBeforeDestructiveEdit,
  flash,
}: Options) {
  const updateField = <K extends keyof ResumeState>(key: K, value: ResumeState[K]) => {
    setState((current) => {
      if (key === "skills") {
        const skills = String(value);
        return {
          ...current,
          skills,
          sectionTagGroups: {
            ...current.sectionTagGroups,
            skills: parseTagGroups(skills, "skills"),
          },
        };
      }
      if (key === "headerLinks") {
        const headerLinks = normalizeHeaderLinks(value as HeaderLink[], true);
        return {
          ...current,
          headerLinks,
          website: headerLinks.find((link) => link.url.trim())?.url ?? "",
        };
      }
      return { ...current, [key]: value };
    });
  };

  const updateEntry = (section: string, index: number, key: keyof ResumeEntry, value: string) => {
    setState((current) => {
      if (section === "skills") {
        return {
          ...current,
          skillEntries: current.skillEntries.map((entry, entryIndex) =>
            entryIndex === index ? { ...entry, [key]: value } : entry,
          ),
        };
      }
      if (isBuiltinSection(section) && section !== "skills") {
        return {
          ...current,
          [section]: current[section].map((entry, entryIndex) =>
            entryIndex === index ? { ...entry, [key]: value } : entry,
          ),
        };
      }
      return {
        ...current,
        customSections: current.customSections.map((custom) =>
          custom.id === section
            ? {
                ...custom,
                entries: custom.entries.map((entry, entryIndex) =>
                  entryIndex === index ? { ...entry, [key]: value } : entry,
                ),
              }
            : custom,
        ),
      };
    });
  };

  const swapExperienceTitleAndCompany = (index: number) => {
    setState((current) => ({
      ...current,
      experience: current.experience.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, title: entry.subtitle, subtitle: entry.title } : entry,
      ),
    }));
  };

  const addEntry = (section: string) => {
    setState((current) => {
      if (section === "skills")
        return { ...current, skillEntries: [...current.skillEntries, blankEntry()] };
      if (isBuiltinSection(section) && section !== "skills") {
        return { ...current, [section]: [...current[section], blankEntry()] };
      }
      return {
        ...current,
        customSections: current.customSections.map((custom) =>
          custom.id === section
            ? { ...custom, entries: [...custom.entries, blankEntry()] }
            : custom,
        ),
      };
    });
  };

  const removeEntry = (section: string, index: number) => {
    const entry = getSectionEntries(state, section)[index];
    if (!entry) return;
    const sectionTitle = isBuiltinSection(section)
      ? state.sectionTitles[section]
      : (state.customSections.find((custom) => custom.id === section)?.title ?? "Custom section");
    checkpointBeforeDestructiveEdit(`removing an entry from ${sectionTitle || "a section"}`);
    setState((current) => {
      if (section === "skills") {
        return {
          ...current,
          skillEntries: current.skillEntries.filter((_, entryIndex) => entryIndex !== index),
        };
      }
      if (isBuiltinSection(section) && section !== "skills") {
        return {
          ...current,
          [section]: current[section].filter((_, entryIndex) => entryIndex !== index),
        };
      }
      return {
        ...current,
        customSections: current.customSections.map((custom) =>
          custom.id === section
            ? { ...custom, entries: custom.entries.filter((_, entryIndex) => entryIndex !== index) }
            : custom,
        ),
      };
    });
    const toastId = flash(`Removed ${sectionTitle || "custom"} entry`, "undo");
    setUndoableRemoval({ kind: "entry", toastId, section, index, entry });
  };

  const reorderEntry = (section: string, index: number, target: number) => {
    setState((current) => {
      const next = [...getSectionEntries(current, section)];
      if (target < 0 || target >= next.length) return current;
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      if (section === "skills") return { ...current, skillEntries: next };
      if (isBuiltinSection(section) && section !== "skills") return { ...current, [section]: next };
      return {
        ...current,
        customSections: current.customSections.map((custom) =>
          custom.id === section ? { ...custom, entries: next } : custom,
        ),
      };
    });
  };

  const moveEntry = (section: string, index: number, direction: -1 | 1) =>
    reorderEntry(section, index, index + direction);

  const reorderSection = (section: string, target: number) => {
    setState((current) => {
      const next = [...current.sectionOrder];
      const index = next.indexOf(section);
      if (index < 0 || target < 0 || target >= next.length) return current;
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return { ...current, sectionOrder: next };
    });
  };

  const moveSection = (section: string, direction: -1 | 1) => {
    setState((current) => {
      const next = [...current.sectionOrder];
      const index = next.indexOf(section);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...current, sectionOrder: next };
    });
  };

  const tightenLayout = () => {
    const previousDensity = state.theme.density;
    const previousTextScale = state.textScale;
    const nextTextScale =
      previousDensity === "compact" ? clampTextScale(previousTextScale - 0.02) : previousTextScale;
    if (previousDensity === "compact" && nextTextScale === previousTextScale) {
      flash("The tightest layout is already active");
      return;
    }
    setState((current) => ({
      ...current,
      theme: { ...current.theme, density: "compact" },
      textScale:
        current.theme.density === "compact"
          ? clampTextScale(current.textScale - 0.02)
          : current.textScale,
    }));
    const toastId = flash(
      previousDensity === "compact"
        ? `Reduced text size to ${Math.round(nextTextScale * 100)}%`
        : "Applied compact spacing",
      "undo",
    );
    setUndoableRemoval({
      kind: "layout",
      toastId,
      density: previousDensity,
      textScale: previousTextScale,
    });
  };

  const updateSectionTitle = (section: string, title: string) => {
    setState((current) =>
      isBuiltinSection(section)
        ? { ...current, sectionTitles: { ...current.sectionTitles, [section]: title } }
        : {
            ...current,
            customSections: current.customSections.map((custom) =>
              custom.id === section ? { ...custom, title } : custom,
            ),
          },
    );
  };

  const updateSectionFormat = (section: string, format: SectionFormat) => {
    setState((current) => ({
      ...current,
      sectionFormats: { ...current.sectionFormats, [section]: format },
    }));
  };

  const updateSectionTagGroups = (section: string, groups: TagGroup[]) => {
    const nextGroupIds = new Set(groups.map((group) => group.id));
    const removedGroup = (state.sectionTagGroups[section] ?? []).find(
      (group) => !nextGroupIds.has(group.id),
    );
    if (removedGroup) {
      const sectionTitle = isBuiltinSection(section)
        ? state.sectionTitles[section]
        : (state.customSections.find((custom) => custom.id === section)?.title ?? "a section");
      checkpointBeforeDestructiveEdit(
        `removing ${removedGroup.label.trim() ? `the ${removedGroup.label.trim()} group` : "a tag group"} from ${sectionTitle || "a section"}`,
      );
    }
    setState((current) => {
      const normalized = normalizeTagGroups(groups, section, true);
      return {
        ...current,
        sectionTagGroups: { ...current.sectionTagGroups, [section]: normalized },
        ...(section === "skills" ? { skills: tagGroupsToText(normalized) } : {}),
      };
    });
  };

  const updateSectionText = (section: string, text: string) => {
    setState((current) => ({
      ...current,
      sectionText: { ...current.sectionText, [section]: text },
    }));
  };

  const addCustomSection = (title = "New Section", format: SectionFormat = "entries") => {
    const id = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const tagGroups = format === "tag-groups" ? [{ id: `${id}-group-1`, label: "", tags: [] }] : [];
    setState((current) => ({
      ...current,
      customSections: [...current.customSections, { id, title, entries: [blankEntry()] }],
      sectionFormats: { ...current.sectionFormats, [id]: format },
      sectionTagGroups: { ...current.sectionTagGroups, [id]: tagGroups },
      sectionText: { ...current.sectionText, [id]: "" },
      sectionOrder: [...current.sectionOrder, id],
    }));
    return id;
  };

  const addBuiltinSection = (section: SectionKey) => {
    setState((current) => {
      if (current.sectionOrder.includes(section)) return current;
      const next = {
        ...current,
        sectionOrder: [...current.sectionOrder, section],
        hiddenSections: current.hiddenSections.filter((id) => id !== section),
        sectionTitles: { ...current.sectionTitles, [section]: SECTION_LABELS[section] },
      };
      if (section === "skills") {
        return {
          ...next,
          skills: "",
          skillEntries: [],
          sectionFormats: { ...next.sectionFormats, skills: "tag-groups" as const },
          sectionTagGroups: { ...next.sectionTagGroups, skills: [] },
        };
      }
      return { ...next, [section]: [blankEntry()] };
    });
    flash(`Added ${SECTION_LABELS[section]} section`);
  };

  const toggleSectionHidden = (section: string) => {
    setState((current) => {
      const hidden = new Set(current.hiddenSections);
      if (hidden.has(section)) hidden.delete(section);
      else hidden.add(section);
      return { ...current, hiddenSections: [...hidden] };
    });
  };

  const removeCustomSection = (section: string) => {
    const removedSection = state.customSections.find((custom) => custom.id === section);
    if (!removedSection) return;
    const sectionOrderIndex = state.sectionOrder.indexOf(section);
    checkpointBeforeDestructiveEdit(`removing the ${removedSection.title || "custom"} section`);
    setState((current) => ({
      ...current,
      customSections: current.customSections.filter((custom) => custom.id !== section),
      sectionOrder: current.sectionOrder.filter((id) => id !== section),
      hiddenSections: current.hiddenSections.filter((id) => id !== section),
      sectionFormats: Object.fromEntries(
        Object.entries(current.sectionFormats).filter(([id]) => id !== section),
      ),
      sectionTagGroups: Object.fromEntries(
        Object.entries(current.sectionTagGroups).filter(([id]) => id !== section),
      ),
      sectionText: Object.fromEntries(
        Object.entries(current.sectionText).filter(([id]) => id !== section),
      ),
    }));
    const toastId = flash(`Removed ${removedSection.title || "custom"} section`, "undo");
    setUndoableRemoval({
      kind: "custom-section",
      toastId,
      section: removedSection,
      sectionOrderIndex,
      format: state.sectionFormats[section] ?? "entries",
      tagGroups: state.sectionTagGroups[section] ?? [],
      text: state.sectionText[section] ?? "",
    });
  };

  const removeBuiltinSection = (section: SectionKey) => {
    if (!state.sectionOrder.includes(section)) return;
    const sectionOrderIndex = state.sectionOrder.indexOf(section);
    const title = state.sectionTitles[section];
    const entries = getSectionEntries(state, section);
    const skills = section === "skills" ? state.skills : "";
    const format =
      state.sectionFormats[section] ?? (section === "skills" ? "tag-groups" : "entries");
    const tagGroups = state.sectionTagGroups[section] ?? [];
    const text = state.sectionText[section] ?? "";
    checkpointBeforeDestructiveEdit(`removing the ${title || SECTION_LABELS[section]} section`);
    setState((current) => {
      if (!current.sectionOrder.includes(section)) return current;
      const next = {
        ...current,
        sectionOrder: current.sectionOrder.filter((id) => id !== section),
        hiddenSections: current.hiddenSections.filter((id) => id !== section),
        sectionTitles: { ...current.sectionTitles, [section]: SECTION_LABELS[section] },
      };
      if (section === "skills") {
        return {
          ...next,
          skills: "",
          skillEntries: [],
          sectionFormats: { ...next.sectionFormats, skills: "tag-groups" as const },
          sectionTagGroups: { ...next.sectionTagGroups, skills: [] },
        };
      }
      return { ...next, [section]: [] };
    });
    const toastId = flash(`Removed ${title || SECTION_LABELS[section]} section`, "undo");
    setUndoableRemoval({
      kind: "builtin-section",
      toastId,
      section,
      title,
      entries,
      skills,
      sectionOrderIndex,
      format,
      tagGroups,
      text,
    });
  };

  const undoRemoval = () => {
    if (!undoableRemoval) return;
    setState((current) => {
      if (undoableRemoval.kind === "layout") {
        return {
          ...current,
          theme: { ...current.theme, density: undoableRemoval.density },
          textScale: undoableRemoval.textScale,
        };
      }
      if (undoableRemoval.kind === "entry") {
        const { section, index, entry } = undoableRemoval;
        if (section === "skills") {
          const skillEntries = [...current.skillEntries];
          skillEntries.splice(Math.min(index, skillEntries.length), 0, entry);
          return { ...current, skillEntries };
        }
        if (isBuiltinSection(section) && section !== "skills") {
          const entries = [...current[section]];
          entries.splice(Math.min(index, entries.length), 0, entry);
          return { ...current, [section]: entries };
        }
        const customSection = current.customSections.find((item) => item.id === section);
        if (!customSection) return current;
        const entries = [...customSection.entries];
        entries.splice(Math.min(index, entries.length), 0, entry);
        return {
          ...current,
          customSections: current.customSections.map((item) =>
            item.id === section ? { ...item, entries } : item,
          ),
        };
      }
      if (undoableRemoval.kind === "custom-section") {
        if (current.customSections.some((item) => item.id === undoableRemoval.section.id))
          return current;
        const sectionOrder = [...current.sectionOrder];
        sectionOrder.splice(
          Math.min(undoableRemoval.sectionOrderIndex, sectionOrder.length),
          0,
          undoableRemoval.section.id,
        );
        return {
          ...current,
          customSections: [...current.customSections, undoableRemoval.section],
          sectionOrder,
          sectionFormats: {
            ...current.sectionFormats,
            [undoableRemoval.section.id]: undoableRemoval.format,
          },
          sectionTagGroups: {
            ...current.sectionTagGroups,
            [undoableRemoval.section.id]: undoableRemoval.tagGroups,
          },
          sectionText: {
            ...current.sectionText,
            [undoableRemoval.section.id]: undoableRemoval.text,
          },
        };
      }
      if (current.sectionOrder.includes(undoableRemoval.section)) return current;
      const sectionOrder = [...current.sectionOrder];
      sectionOrder.splice(
        Math.min(undoableRemoval.sectionOrderIndex, sectionOrder.length),
        0,
        undoableRemoval.section,
      );
      const next = {
        ...current,
        sectionOrder,
        sectionTitles: {
          ...current.sectionTitles,
          [undoableRemoval.section]: undoableRemoval.title,
        },
      };
      if (undoableRemoval.section === "skills") {
        return {
          ...next,
          skills: undoableRemoval.skills,
          skillEntries: undoableRemoval.entries,
          sectionFormats: { ...next.sectionFormats, skills: undoableRemoval.format },
          sectionTagGroups: { ...next.sectionTagGroups, skills: undoableRemoval.tagGroups },
          sectionText: { ...next.sectionText, skills: undoableRemoval.text },
        };
      }
      return {
        ...next,
        [undoableRemoval.section]: undoableRemoval.entries,
        sectionFormats: {
          ...next.sectionFormats,
          [undoableRemoval.section]: undoableRemoval.format,
        },
        sectionTagGroups: {
          ...next.sectionTagGroups,
          [undoableRemoval.section]: undoableRemoval.tagGroups,
        },
        sectionText: { ...next.sectionText, [undoableRemoval.section]: undoableRemoval.text },
      };
    });
    setUndoableRemoval(null);
    flash(
      undoableRemoval.kind === "layout"
        ? "Restored layout"
        : undoableRemoval.kind === "entry"
          ? "Restored entry"
          : "Restored section",
    );
  };

  return {
    addBuiltinSection,
    addCustomSection,
    addEntry,
    moveEntry,
    moveSection,
    removeBuiltinSection,
    removeCustomSection,
    removeEntry,
    reorderEntry,
    reorderSection,
    swapExperienceTitleAndCompany,
    tightenLayout,
    toggleSectionHidden,
    undoRemoval,
    updateEntry,
    updateField,
    updateSectionFormat,
    updateSectionTagGroups,
    updateSectionText,
    updateSectionTitle,
  };
}
