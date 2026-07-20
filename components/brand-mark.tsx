import { cn } from "@/lib/utils";

/** Compact resume document and padlock mark for the app chrome and product surfaces. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={cn("shrink-0", className)}>
      <rect
        data-brand-surface
        width="62"
        height="62"
        x="1"
        y="1"
        rx="15"
        strokeWidth="2"
        className="fill-[#f1f5f9] stroke-[#cbd5e1] dark:fill-[#151b27] dark:stroke-[#151b27]"
      />
      <path
        data-brand-document
        d="M15 10h23l10 10v33H15z"
        className="fill-[#0f172a] dark:fill-[#f8fafc]"
      />
      <path d="M38 10v10h10" fill="#dbeafe" />
      <path
        d="M22 24h17M22 30h12M22 36h14"
        fill="none"
        stroke="#60a5fa"
        strokeLinecap="round"
        strokeWidth="3.5"
      />
      <path
        d="M35 43v-3a5 5 0 0 1 10 0v3"
        fill="none"
        stroke="#2563eb"
        strokeLinecap="round"
        strokeWidth="3.5"
      />
      <rect x="30" y="42" width="20" height="14" rx="3.5" fill="#2563eb" />
      <circle cx="40" cy="48.5" r="2" fill="#f8fafc" />
      <path d="M40 50.5v2" stroke="#f8fafc" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}
