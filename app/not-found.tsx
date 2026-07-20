import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <section className="w-full max-w-md rounded-xl border bg-card p-8 shadow-xs">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          PrivaCV
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">That page is not here.</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Your resume stays in this browser. Return to the editor to keep working on it.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Return to editor
        </Link>
      </section>
    </main>
  );
}
