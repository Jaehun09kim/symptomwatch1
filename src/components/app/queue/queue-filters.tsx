"use client";

import { useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { controlClass } from "@/components/forms/fields";
import { cn } from "@/lib/utils";
import { activeQueueQuickView, QUEUE_QUICK_VIEWS, queueQuickViewParams, type QueueQuickView } from "@/lib/queue-filters";

export function QueueFilters({ assignees }: { assignees: Array<{ userId: string; displayName: string }> }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const update = (key: string, value: string, fallback: string) => {
    const next = new URLSearchParams(params.toString());
    if (value && value !== fallback) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };
  const active = activeQueueQuickView(Object.fromEntries(params));
  const select = cn(controlClass, "h-11 min-w-0 w-full max-w-full rounded-sm bg-card pr-8 text-sm sm:w-auto");
  return (
    <div className="w-full min-w-0 space-y-3">
      <nav aria-label="Quick task views" className="flex flex-wrap gap-2">
        {(Object.keys(QUEUE_QUICK_VIEWS) as QueueQuickView[]).map((view) => (
          <Link key={view} href={`/app/queue?${queueQuickViewParams(view)}`} aria-current={active === view ? "page" : undefined}
            className={cn("inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm font-medium", active === view ? "bg-brand-soft text-brand-hover" : "bg-card text-body hover:bg-surface")}>
            {QUEUE_QUICK_VIEWS[view]}
          </Link>
        ))}
        {params.size ? <Link href="/app/queue" className="inline-flex min-h-11 items-center px-2 text-sm text-brand underline">Clear filters</Link> : null}
      </nav>
      <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto" role="group" aria-label="Filter tasks">
        <label className="sr-only" htmlFor="queue-status">Status</label>
        <select id="queue-status" className={select} value={params.get("status") ?? "open"} onChange={(event) => update("status", event.target.value, "open")}>
          <option value="open">Open (not completed)</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In progress</option>
          <option value="needs_review">Needs review</option>
          <option value="completed">Completed</option>
          <option value="any">All statuses</option>
        </select>
        <label className="sr-only" htmlFor="queue-assignee">Assignee</label>
        <select id="queue-assignee" className={select} value={params.get("assignee") ?? ""} onChange={(event) => update("assignee", event.target.value, "")}>
          <option value="">Anyone</option>
          <option value="me">Assigned to me</option>
          <option value="unassigned">Unassigned</option>
          {assignees.map((person) => <option key={person.userId} value={person.userId}>{person.displayName}</option>)}
        </select>
        <label className="sr-only" htmlFor="queue-due">Due</label>
        <select id="queue-due" className={select} value={params.get("due") ?? "all"} onChange={(event) => update("due", event.target.value, "all")}>
          <option value="all">Any due date</option>
          <option value="overdue">Overdue</option>
          <option value="today">Due today</option>
          <option value="week">Due within 7 days</option>
        </select>
        {pending ? <Loader2 className="size-4 animate-spin text-body" aria-label="Updating" /> : null}
      </div>
    </div>
  );
}
