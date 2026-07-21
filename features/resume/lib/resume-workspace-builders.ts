import {
  entryFieldSchema,
  entryMetaLine,
  getSectionEntries,
  getSectionFormat,
  getSectionTagGroups,
  getSectionText,
  getSectionTitle,
  SECTION_FORMAT_LABELS,
  type ResumeCheck,
  type ResumeState,
} from "@/lib/resume";
import { stripRichMarks } from "@/lib/rich-text";
import { buildImportCoverage, type ImportReviewState } from "@/lib/resume-workspace";
import type { GuidedReviewStep } from "@/features/resume/components/guided-review";
import type { ResumeNavigatorItem } from "@/features/resume/components/resume-navigator";
import type { SectionNavItem } from "@/features/resume/components/section-nav";

export function reviewTourTargetId(targetId: string) {
  return targetId === "field-skills" ? "review-region-skills" : targetId;
}

export function buildSectionNavItems(
  state: ResumeState,
  workspaceHasStarted: boolean,
): SectionNavItem[] {
  if (!workspaceHasStarted) return [];
  return [
    { id: "edit-header", label: "Header" },
    { id: "edit-summary", label: "Summary" },
    ...state.sectionOrder.map((section) => ({
      id: `edit-section-${section}`,
      label: getSectionTitle(state, section).trim() || "Untitled section",
    })),
  ];
}

export function buildNavigatorItems(
  state: ResumeState,
  workspaceHasStarted: boolean,
): ResumeNavigatorItem[] {
  if (!workspaceHasStarted) return [];
  const items: ResumeNavigatorItem[] = [
    { id: "field-name", label: "Full name", context: "Header", keywords: state.name },
    { id: "field-title", label: "Title / role", context: "Header", keywords: state.title },
    { id: "field-email", label: "Email", context: "Header", keywords: state.email },
    { id: "field-phone", label: "Phone", context: "Header", keywords: state.phone },
    { id: "field-location", label: "Location", context: "Header", keywords: state.location },
    ...state.headerLinks.map((link) => ({
      id: `field-header-link-${link.id}-url`,
      label: link.label || "Website",
      context: "Header link",
      keywords: link.url,
    })),
    {
      id: "field-summary",
      label: "Professional summary",
      context: "Summary",
      keywords: stripRichMarks(state.summary),
    },
  ];

  for (const section of state.sectionOrder) {
    const sectionTitle = getSectionTitle(state, section).trim() || "Untitled section";
    const format = getSectionFormat(state, section);
    items.push({
      id: `section-title-${section}`,
      label: `${sectionTitle} section title`,
      context: "Section heading",
    });
    if (format === "tag-groups") {
      getSectionTagGroups(state, section).forEach((group, index) => {
        items.push({
          id: `field-${section}-group-${group.id}`,
          label: group.label.trim() || `Group ${index + 1}`,
          context: `${sectionTitle} · Group`,
          keywords: group.tags.join(" "),
        });
      });
      continue;
    }
    if (format !== "entries") {
      items.push({
        id: `field-${section}-content`,
        label: `${sectionTitle} content`,
        context: `${sectionTitle} · ${SECTION_FORMAT_LABELS[format]}`,
        keywords: stripRichMarks(getSectionText(state, section)),
      });
      continue;
    }
    const schema = entryFieldSchema(section, sectionTitle);
    getSectionEntries(state, section).forEach((entry, index) => {
      const entryLabel = entry.title.trim() || entry.subtitle.trim() || `Entry ${index + 1}`;
      const context = `${sectionTitle} · ${entryLabel}`;
      const keywords = `${entry.title} ${entry.subtitle} ${entryMetaLine(entry)} ${stripRichMarks(entry.details)}`;
      (Object.keys(schema) as (keyof typeof schema)[]).forEach((field) => {
        items.push({
          id: `field-${section}-${index}-${field}`,
          label: schema[field],
          context,
          keywords,
        });
      });
    });
  }
  return items;
}

type ImportCoverage = ReturnType<typeof buildImportCoverage>[number];

export function buildImportTourSteps({
  importReview,
  skippedCoverage,
  onToggleItem,
  onFocusTarget,
}: {
  importReview: ImportReviewState | null;
  skippedCoverage: ImportCoverage[];
  onToggleItem: (itemId: string) => void;
  onFocusTarget: (targetId: string) => void;
}): GuidedReviewStep[] {
  if (!importReview) return [];
  return [
    ...importReview.items.map((item, itemIndex) => {
      const confirmed = Boolean(importReview.reviewedItemIds?.includes(item.id));
      return {
        id: `item-${item.id}`,
        targetId: reviewTourTargetId(item.targetId),
        eyebrow: `Imported field ${itemIndex + 1} of ${importReview.items.length}`,
        title: item.label,
        description: item.detail,
        excerpt: item.sourceExcerpt,
        tone: confirmed ? "ok" : "warn",
        done: confirmed,
        action: {
          label: confirmed ? "Confirmed" : "Confirm this field",
          run: () => onToggleItem(item.id),
        },
      } satisfies GuidedReviewStep;
    }),
    ...skippedCoverage.map(
      (item) =>
        ({
          id: `coverage-${item.id}`,
          targetId: reviewTourTargetId(item.targetId),
          eyebrow: "Possible skipped section",
          title: item.label,
          description: item.detail,
          excerpt: item.sourceExcerpt,
          tone: "warn",
          action: {
            label: "Go to this section",
            run: () => onFocusTarget(reviewTourTargetId(item.targetId)),
          },
        }) satisfies GuidedReviewStep,
    ),
  ];
}

export function buildCheckTourSteps(
  checks: ResumeCheck[],
  onFocusTarget: (targetId: string) => void,
): GuidedReviewStep[] {
  return checks.map(
    (check) =>
      ({
        id: check.id,
        targetId: check.targetId,
        eyebrow: "Resume review",
        title: check.label,
        description:
          check.ok && !check.advisory ? check.detail : `${check.detail} ${check.guidance}`,
        tone: check.advisory ? "info" : check.ok ? "ok" : "warn",
        done: check.ok && !check.advisory,
        action:
          check.ok && !check.advisory
            ? undefined
            : {
                label: check.actionLabel,
                run: () => onFocusTarget(check.targetId),
              },
      }) satisfies GuidedReviewStep,
  );
}
