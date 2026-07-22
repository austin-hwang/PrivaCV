import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <section className="w-full max-w-md rounded-xl border bg-card p-8 shadow-xs">
        <p className="text-sm font-medium text-primary">PrivaCV navigation</p>
        <h1 className="mt-4 font-serif text-2xl font-bold">That page is not here.</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Your resume stays in this browser. Return to the editor to keep working on it.
        </p>
        <Link href="/" className={cn(buttonVariants({ size: "lg" }), "mt-6")}>
          Return to editor
        </Link>
      </section>
    </main>
  );
}
