import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/primitives/layout";
import { requirePermission } from "@/lib/auth/current";
import { AUDIT_PAGE_SIZE, listAuditLog } from "@/lib/services/audit";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Audit log" };

type Params = Record<string, string | string[] | undefined>;

const ACTION_GROUPS = [
  { value: "", label: "All actions" },
  { value: "auth.", label: "Sign-in & accounts" },
  { value: "patient.", label: "Record access" },
  { value: "task.", label: "Tasks" },
  { value: "flag.", label: "Flag reviews" },
  { value: "detection.", label: "Detection runs" },
  { value: "invite.", label: "Invitations" },
  { value: "membership.", label: "Roles & access" },
  { value: "demo.", label: "Demo actions" },
];

async function Audit({ searchParams }: { searchParams: Promise<Params> }) {
  const [{ ctx }, params] = await Promise.all([requirePermission("audit.read"), searchParams]);
  const action = typeof params.action === "string" && ACTION_GROUPS.some((group) => group.value === params.action) ? params.action : "";
  const page = Math.max(1, Number(params.page) || 1);
  const { entries, total } = await listAuditLog(ctx, { action: action || undefined, page });
  const pages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
  const href = (next: { action?: string; page?: number }) => {
    const query = new URLSearchParams();
    const a = next.action ?? action;
    if (a) query.set("action", a);
    if ((next.page ?? 1) > 1) query.set("page", String(next.page));
    return `/app/audit${query.size ? `?${query}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Audit log" description="Append-only record of sign-ins, record access, and changes in this clinic. Metadata never includes clinical free text." />
      <nav aria-label="Filter by action" className="-mx-1 overflow-x-auto">
        <ul className="flex min-w-max gap-1 px-1">
          {ACTION_GROUPS.map((group) => (
            <li key={group.value}>
              <Link href={href({ action: group.value, page: 1 })} aria-current={action === group.value ? "page" : undefined}
                className={cn("inline-flex h-8 items-center rounded-md px-3 text-sm font-medium", action === group.value ? "bg-navy text-white" : "text-slate-600 hover:bg-surface")}>
                {group.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <section tabIndex={0} aria-label="Audit table" className="overflow-x-auto rounded-xl border border-border bg-white shadow-soft">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <caption className="sr-only">Audit events</caption>
          <thead className="bg-surface text-xs text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">When</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Action</th>
              <th scope="col" className="px-4 py-2.5 font-medium">By</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Entity</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.map((entry) => (
              <tr key={entry.id} className="align-top">
                <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-body">{new Date(entry.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</td>
                <td className="px-4 py-2.5"><code className="rounded bg-surface px-1.5 py-0.5 text-xs text-navy">{entry.action}</code></td>
                <td className="px-4 py-2.5 text-body">
                  {entry.actorName ?? "—"}
                  {entry.effectiveName && entry.effectiveName !== entry.actorName ? <span className="block text-xs text-slate-500">as {entry.effectiveName}</span> : null}
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-500">{entry.entityType}{entry.entityId ? ` · ${entry.entityId.slice(0, 8)}` : ""}</td>
                <td className="px-4 py-2.5 text-xs text-slate-600">
                  {Object.keys(entry.metadata).length ? Object.entries(entry.metadata).map(([key, value]) => `${key}: ${String(value)}`).join(" · ") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {entries.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">No events for this filter.</p> : null}
      </section>
      {pages > 1 ? (
        <nav aria-label="Audit pages" className="flex items-center justify-between text-sm">
          <span className="text-slate-500">Page {page} of {pages} · {total} events</span>
          <div className="flex gap-2">
            {page > 1 ? <Link className="rounded-[10px] border border-slate-300 px-3 py-1.5 font-medium text-navy hover:bg-surface" href={href({ page: page - 1 })}>Previous</Link> : null}
            {page < pages ? <Link className="rounded-[10px] border border-slate-300 px-3 py-1.5 font-medium text-navy hover:bg-surface" href={href({ page: page + 1 })}>Next</Link> : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}

export default function AuditPage(props: PageProps<"/app/audit">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-surface" />}>
      <Audit searchParams={props.searchParams} />
    </Suspense>
  );
}
