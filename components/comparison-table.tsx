import { Check, Minus } from "lucide-react";
import { COMPARATORS, FEATURE_ROWS, type Cell } from "@/lib/competitors";
import { cn } from "@/lib/utils";

function CellContent({ value }: { value: Cell }) {
  if (value === true) {
    return (
      <>
        <Check className="mx-auto size-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        <span className="sr-only">Yes</span>
      </>
    );
  }
  if (value === false) {
    return (
      <>
        <Minus className="mx-auto size-4 text-muted-foreground/50" aria-hidden="true" />
        <span className="sr-only">No</span>
      </>
    );
  }
  if (value === "partial") {
    return <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Limited</span>;
  }
  if (value === "paid") {
    return <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Paid</span>;
  }
  return <span className="text-xs font-medium text-foreground">{value}</span>;
}

/**
 * Feature/pricing matrix comparing PrivaCV to named resume builders. The first
 * column (feature names) is sticky and the table scrolls horizontally on narrow
 * screens so all vendor columns stay readable. The PrivaCV column is emphasized.
 */
export function ComparisonTable() {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <caption className="sr-only">Resume builder feature and pricing comparison</caption>
        <thead>
          <tr className="border-b bg-muted/30">
            <th scope="col" className="sticky left-0 z-10 bg-muted/30 p-3 text-left align-bottom font-semibold">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Feature</span>
            </th>
            {COMPARATORS.map((c) => (
              <th
                key={c.name}
                scope="col"
                className={cn(
                  "p-3 text-center align-bottom",
                  c.isUs && "bg-primary/5",
                )}
              >
                <div className={cn("font-semibold", c.isUs && "text-primary")}>{c.name}</div>
                <div className="mt-1 text-sm font-semibold">{c.price}</div>
                {c.priceNote ? (
                  <div className="mx-auto mt-1 max-w-[9rem] text-[11px] font-normal leading-tight text-muted-foreground">
                    {c.priceNote}
                  </div>
                ) : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FEATURE_ROWS.map((row) => (
            <tr key={row.label} className="border-b last:border-0">
              <th scope="row" className="sticky left-0 z-10 bg-background p-3 text-left font-medium">
                {row.label}
                {row.hint ? <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{row.hint}</span> : null}
              </th>
              {row.values.map((value, i) => (
                <td
                  key={COMPARATORS[i].name}
                  className={cn("p-3 text-center", COMPARATORS[i].isUs && "bg-primary/5")}
                >
                  <CellContent value={value} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
