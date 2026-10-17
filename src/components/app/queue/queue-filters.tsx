"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { controlClass } from "@/components/forms/fields";
import { cn } from "@/lib/utils";

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
  const select = cn(controlClass, "h-10 w-auto pr-8 text-sm");
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter tasks">
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
      {pending ? <Loader2 className="size-4 animate-spin text-slate-400" aria-label="Updating" /> : null}
    </div>
  );
}
