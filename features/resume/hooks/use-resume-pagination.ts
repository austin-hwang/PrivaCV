"use client";

import { useEffect, useRef, useState } from "react";
import type { ResumeState } from "@/lib/resume";

export type ResumePageGuide = { page: number; label?: string };
export type ResumePrintBreak = { targetId: string; spacer: number };

export function useResumePagination(state: ResumeState) {
  const [pageCount, setPageCount] = useState(1);
  const [pageGuides, setPageGuides] = useState<ResumePageGuide[]>([]);
  const [printBreaks, setPrintBreaks] = useState<ResumePrintBreak[]>([]);
  const resumeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let measureFrame: number | null = null;
    let disposed = false;

    const measure = () => {
      if (disposed) return;
      const sheet = resumeRef.current;
      if (!sheet) return;
      const pageHeightPx = 11 * 96;
      const roundingTolerancePx = 2;
      const contentHeight = Array.from(sheet.children).reduce((max, child) => {
        const element = child as HTMLElement;
        if (
          element.classList.contains("resume-page-frame") ||
          element.classList.contains("resume-page-guide")
        )
          return max;
        return Math.max(max, element.offsetTop + element.offsetHeight);
      }, 0);
      const nextPageCount = Math.max(
        1,
        Math.ceil((contentHeight - roundingTolerancePx) / pageHeightPx),
      );
      setPageCount(nextPageCount);

      const guideTargets = Array.from(
        sheet.querySelectorAll<HTMLElement>("[data-resume-guide-label]"),
      );
      const nextPageGuides = Array.from({ length: Math.max(0, nextPageCount - 1) }, (_, index) => {
        const page = index + 2;
        const boundary = (page - 1) * pageHeightPx;
        const nextTarget = guideTargets.find(
          (target) => target.offsetTop + target.offsetHeight > boundary + roundingTolerancePx,
        );
        return { page, label: nextTarget?.dataset.resumeGuideLabel };
      });
      setPageGuides((current) =>
        current.length === nextPageGuides.length &&
        current.every(
          (guide, index) =>
            guide.page === nextPageGuides[index].page &&
            guide.label === nextPageGuides[index].label,
        )
          ? current
          : nextPageGuides,
      );

      const sheetStyle = window.getComputedStyle(sheet);
      const existingBreaks = new Map(printBreaks.map((item) => [item.targetId, item.spacer]));
      const printableUnits: Array<{ targetId: string; element: HTMLElement; end: number }> = [];
      Array.from(sheet.querySelectorAll<HTMLElement>("[data-resume-print-section]")).forEach(
        (section) => {
          const sectionId = section.dataset.resumePrintSection;
          if (!sectionId) return;
          const entries = Array.from(
            section.querySelectorAll<HTMLElement>("[data-resume-print-entry]"),
          );
          if (!entries.length) {
            printableUnits.push({
              targetId: `section:${sectionId}`,
              element: section,
              end: section.offsetTop + section.offsetHeight,
            });
            return;
          }

          const firstEntry = entries[0];
          if (section.dataset.resumeSectionHasHeading === "true") {
            printableUnits.push({
              targetId: `section:${sectionId}`,
              element: section,
              end: firstEntry.offsetTop + firstEntry.offsetHeight,
            });
          } else {
            printableUnits.push({
              targetId: `entry:${firstEntry.dataset.resumePrintEntry}`,
              element: firstEntry,
              end: firstEntry.offsetTop + firstEntry.offsetHeight,
            });
          }
          entries.slice(1).forEach((entry) => {
            printableUnits.push({
              targetId: `entry:${entry.dataset.resumePrintEntry}`,
              element: entry,
              end: entry.offsetTop + entry.offsetHeight,
            });
          });
        },
      );

      const desiredBreaks: ResumePrintBreak[] = [];
      let existingSpacerBeforeUnit = 0;
      let simulatedSpacer = 0;
      printableUnits.forEach((unit) => {
        const existingSpacerAtUnit = existingBreaks.get(unit.targetId) ?? 0;
        const baseStart = unit.element.offsetTop - existingSpacerBeforeUnit;
        const baseEnd = unit.end - existingSpacerBeforeUnit - existingSpacerAtUnit;
        const start = baseStart + simulatedSpacer;
        const end = baseEnd + simulatedSpacer;
        const currentPage = Math.max(0, Math.floor(start / pageHeightPx));
        const pageContentEnd =
          (currentPage + 1) * pageHeightPx - Number.parseFloat(sheetStyle.paddingBottom);
        if (end > pageContentEnd + roundingTolerancePx) {
          const spacer =
            (currentPage + 1) * pageHeightPx + Number.parseFloat(sheetStyle.paddingTop) - start;
          desiredBreaks.push({ targetId: unit.targetId, spacer });
          simulatedSpacer += spacer;
        }
        existingSpacerBeforeUnit += existingSpacerAtUnit;
      });
      setPrintBreaks((current) =>
        current.length === desiredBreaks.length &&
        current.every(
          (item, index) =>
            item.targetId === desiredBreaks[index].targetId &&
            Math.abs(item.spacer - desiredBreaks[index].spacer) < 0.5,
        )
          ? current
          : desiredBreaks,
      );
    };

    const scheduleMeasure = () => {
      if (measureFrame !== null) window.cancelAnimationFrame(measureFrame);
      measureFrame = window.requestAnimationFrame(() => {
        measureFrame = null;
        measure();
      });
    };

    measure();
    document.fonts?.ready.then(scheduleMeasure).catch(() => undefined);
    window.addEventListener("resize", scheduleMeasure);

    const sheet = resumeRef.current;
    sheet?.addEventListener("input", scheduleMeasure);

    return () => {
      disposed = true;
      if (measureFrame !== null) window.cancelAnimationFrame(measureFrame);
      window.removeEventListener("resize", scheduleMeasure);
      sheet?.removeEventListener("input", scheduleMeasure);
    };
  }, [printBreaks, state]);

  return { pageCount, pageGuides, printBreaks, resumeRef };
}
