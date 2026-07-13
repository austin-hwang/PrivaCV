"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
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

/**
 * Night / day toggle. The initial class is applied before paint by the inline
 * script in the root layout (defaulting to dark), so here we only read the
 * current state on mount and flip + persist it on click.
 */
export function ThemeToggle() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={() => setIsDark(toggleTheme())}
      aria-pressed={isDark}
      aria-label={isDark ? "Switch to light mode" : "Switch to night mode"}
      title={isDark ? "Switch to light mode" : "Switch to night mode"}
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  );
}
