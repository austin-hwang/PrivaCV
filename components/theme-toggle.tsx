"use client";

import { THEME_STORAGE_KEY } from "@/lib/site";

/** Flip and persist the colour theme. Returns the new "is dark" state. */
export function toggleTheme(): boolean {
  const next = !document.documentElement.classList.contains("dark");
  document.documentElement.classList.toggle("dark", next);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
  } catch {
    // A blocked localStorage just means the choice won't persist across reloads.
  }
  return next;
}
