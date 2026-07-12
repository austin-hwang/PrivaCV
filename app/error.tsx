"use client";

import { useEffect } from "react";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Keep diagnostics available to the hosting platform without showing internals to users.
    console.error("PrivaCV route error", error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <section className="w-full max-w-md rounded-xl border bg-card p-8 shadow-sm" aria-labelledby="error-title">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">PrivaCV</p>
        <h1 id="error-title" className="mt-3 text-2xl font-semibold tracking-tight">The editor needs a refresh.</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Something unexpected interrupted this page. Your saved resume data stays in this browser. Try again to continue.
        </p>
        <button
          type="button"
          className="mt-6 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          onClick={reset}
        >
          Try again
        </button>
      </section>
    </main>
  );
}
