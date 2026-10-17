"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { controlClass } from "@/components/forms/fields";
import { cn } from "@/lib/utils";

/** Filter controls write to the URL; the server component re-renders with the new query. */
export function PatientFilters({ physicians, showReviewFilter }: { physicians: Array<{ id: string; name: string }>; showReviewFilter: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");

  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("page");
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  useEffect(() => {
    if (q === (params.get("q") ?? "")) return;
    const timer = setTimeout(() => update({ q }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce on the text only
  }, [q]);

  const select = cn(controlClass, "h-10 w-auto min-w-0 pr-8 text-sm");
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center" role="search" aria-label="Filter patients">
      <div className="relative md:w-72">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <label htmlFor="patient-search" className="sr-only">Search patients by name or demo MRN</label>
        <input
          id="patient-search"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search name or DEMO-MRN"
          className={cn(controlClass, "h-10 pl-9 pr-9 text-sm")}
        />
        {q ? (
          <button type="button" onClick={() => setQ("")} className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-slate-400 hover:text-navy" aria-label="Clear search">
            <X className="size-4" />
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="patient-status">Status</label>
        <select id="patient-status" className={select} value={params.get("status") ?? "all"} onChange={(event) => update({ status: event.target.value === "all" ? "" : event.target.value })}>
          <option value="all">All patients</option>
          {showReviewFilter ? <option value="needs_review">Needs review</option> : null}
          <option value="open_tasks">Has open tasks</option>
          <option value="clear">No open items</option>
        </select>
        <label className="sr-only" htmlFor="patient-physician">Primary physician</label>
        <select id="patient-physician" className={select} value={params.get("physician") ?? ""} onChange={(event) => update({ physician: event.target.value })}>
          <option value="">All physicians</option>
          {physicians.map((physician) => <option key={physician.id} value={physician.id}>{physician.name}</option>)}
        </select>
        <label className="sr-only" htmlFor="patient-sort">Sort by</label>
        <select id="patient-sort" className={select} value={params.get("sort") ?? "name"} onChange={(event) => update({ sort: event.target.value === "name" ? "" : event.target.value })}>
          <option value="name">Sort: name</option>
          <option value="mrn">Sort: demo MRN</option>
          <option value="next_due">Sort: next task due</option>
          <option value="open_tasks">Sort: most open tasks</option>
          {showReviewFilter ? <option value="flags">Sort: most flags</option> : null}
        </select>
        {pending ? <Loader2 className="size-4 animate-spin text-slate-400" aria-label="Updating" /> : null}
      </div>
    </div>
  );
}
