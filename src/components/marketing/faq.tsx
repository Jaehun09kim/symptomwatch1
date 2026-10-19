import type { ReactNode } from "react";
import { Plus } from "lucide-react";

export interface FaqItem {
  q: string;
  a: ReactNode;
}

/** Native disclosure list: keyboard and screen-reader support for free, no script. */
export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <div className="divide-y divide-border border-y border-border">
      {items.map((item) => (
        <details key={item.q} className="group">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 py-4 text-[1rem] font-medium text-navy transition-colors duration-150 hover:text-brand-hover [&::-webkit-details-marker]:hidden">
            {item.q}
            <Plus className="size-4 shrink-0 text-slate-500 transition-transform duration-200 group-open:rotate-45" aria-hidden />
          </summary>
          <div className="max-w-2xl space-y-3 pb-6 leading-relaxed text-body">{item.a}</div>
        </details>
      ))}
    </div>
  );
}
