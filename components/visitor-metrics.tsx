"use client";

import { useEffect } from "react";
import { trackDailyVisitor, type VisitorWorkspace } from "@/lib/visitor-metrics";

export function VisitorMetrics({ workspace }: { workspace: VisitorWorkspace }) {
  useEffect(() => {
    let lastDay = "";
    let pending = false;
    let disposed = false;
    const record = async () => {
      const day = new Date().toISOString().slice(0, 10);
      if (disposed || document.visibilityState !== "visible" || pending || lastDay === day) return;
      pending = true;
      if (await trackDailyVisitor(workspace)) lastDay = day;
      pending = false;
    };
    void record();
    // Also count a visible workspace that stays open across UTC midnight.
    const timer = window.setInterval(() => void record(), 60_000);
    document.addEventListener("visibilitychange", record);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", record);
    };
  }, [workspace]);
  return null;
}
