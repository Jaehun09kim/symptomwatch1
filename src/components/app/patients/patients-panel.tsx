import Link from "next/link";
import { ChevronLeft, ChevronRight, ScanSearch, UsersRound } from "lucide-react";
import { FictionalTag } from "@/components/app/primitives/badges";
import { EmptyState } from "@/components/app/primitives/layout";
import { formatTimelineDate } from "@/components/app/primitives/timeline-item";
import type { AppContext } from "@/lib/authz/context";
import { can } from "@/lib/authz/permissions";
import { listMembers } from "@/lib/services/members";
import { listPatients, type PatientListQuery, type PatientSort, type PatientStatusFilter } from "@/lib/services/patients";
import { cn } from "@/lib/utils";
import { PatientFilters } from "./patient-filters";

type SearchParams = Record<string, string | string[] | undefined>;

const STATUS = new Set<PatientStatusFilter>(["all", "needs_review", "open_tasks", "clear"]);
const SORTS = new Set<PatientSort>(["name", "mrn", "open_tasks", "flags", "next_due"]);
const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

export function parsePatientQuery(params: SearchParams): PatientListQuery {
  const status = one(params.status) as PatientStatusFilter | undefined;
  const sort = one(params.sort) as PatientSort | undefined;
  const physician = one(params.physician);
  return {
    q: one(params.q)?.slice(0, 80),
    status: status && STATUS.has(status) ? status : "all",
    sort: sort && SORTS.has(sort) ? sort : "name",
    physicianId: physician && /^[0-9a-f-]{36}$/.test(physician) ? physician : undefined,
    page: Math.max(1, Number(one(params.page)) || 1),
  };
}

export function ageFrom(dateOfBirth: string, now = new Date()): number {
  const dob = new Date(`${dateOfBirth}T00:00:00Z`);
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday = now.getUTCMonth() < dob.getUTCMonth() || (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

function pageHref(basePath: string, params: SearchParams, page: number): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (typeof value === "string" && key !== "page") next.set(key, value);
  if (page > 1) next.set("page", String(page));
  const query = next.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export async function PatientsPanel({ ctx, params, basePath }: { ctx: AppContext; params: SearchParams; basePath: string }) {
  const query = parsePatientQuery(params);
  const clinical = can(ctx.role, "flag.read");
  const [{ rows, total, page, pageSize }, members] = await Promise.all([listPatients(ctx, query), listMembers(ctx)]);
  const physicians = members.filter((member) => member.role === "physician").map((member) => ({ id: member.userId, name: member.displayName }));
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const now = new Date();

  return (
    <section aria-labelledby="patients-heading" className="rounded-xl border border-border bg-white shadow-soft">
      <div className="space-y-3 border-b border-border p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="patients-heading" className="text-base font-semibold">Patients <span className="font-normal text-slate-500">({total})</span></h2>
          <p className="text-xs text-slate-500">All records fictional</p>
        </div>
        <PatientFilters physicians={physicians} showReviewFilter={clinical} />
      </div>
      {rows.length === 0 ? (
        <EmptyState className="m-4 border-0" icon={UsersRound} title="No patients match these filters" description="Try clearing the search or choosing a different status." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <caption className="sr-only">Fictional patients and follow-up status</caption>
            <thead className="bg-surface text-xs text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Patient</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Demo MRN</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Primary physician</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Open tasks</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Next due</th>
                {clinical ? <th scope="col" className="px-4 py-2.5 font-medium">Review</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => {
                const overdue = row.nextDue !== null && new Date(row.nextDue) < now;
                return (
                  <tr key={row.id} className="group relative hover:bg-surface/70">
                    <td className="px-4 py-3">
                      <Link href={`/app/patients/${row.id}`} className="font-medium text-navy after:absolute after:inset-0 group-hover:text-brand">
                        {row.lastName}, {row.firstName}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {ageFrom(row.dateOfBirth, now)} y · {row.sex === "female" ? "F" : "M"}
                        {row.careStatus === "transferred_out" ? " · Care transferred" : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-body"><span className="flex items-center gap-2">{row.demoMrn}<FictionalTag /></span></td>
                    <td className="px-4 py-3 text-body">{row.physicianName ?? "—"}</td>
                    <td className="px-4 py-3 tabular-nums text-body">{row.openTasks}</td>
                    <td className={cn("px-4 py-3 tabular-nums", overdue ? "font-medium text-attention" : "text-body")}>
                      {row.nextDue ? `${formatTimelineDate(row.nextDue)}${overdue ? " · overdue" : ""}` : "—"}
                    </td>
                    {clinical ? (
                      <td className="px-4 py-3">
                        {row.openFlags ? (
                          <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-brand/30 bg-brand-soft px-2.5 text-xs font-medium text-brand-hover">
                            <ScanSearch className="size-3.5" aria-hidden /> {row.openFlags} possible gap{row.openFlags === 1 ? "" : "s"}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">—</span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 ? (
        <nav aria-label="Patient list pages" className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
          <span className="text-slate-500">Page {page} of {pages}</span>
          <div className="flex gap-2">
            <Link aria-disabled={page <= 1} tabIndex={page <= 1 ? -1 : undefined} href={pageHref(basePath, params, page - 1)}
              className={cn("inline-flex h-9 items-center gap-1 rounded-[10px] border border-slate-300 px-3 font-medium text-navy hover:bg-surface", page <= 1 && "pointer-events-none opacity-40")}>
              <ChevronLeft className="size-4" aria-hidden /> Previous
            </Link>
            <Link aria-disabled={page >= pages} tabIndex={page >= pages ? -1 : undefined} href={pageHref(basePath, params, page + 1)}
              className={cn("inline-flex h-9 items-center gap-1 rounded-[10px] border border-slate-300 px-3 font-medium text-navy hover:bg-surface", page >= pages && "pointer-events-none opacity-40")}>
              Next <ChevronRight className="size-4" aria-hidden />
            </Link>
          </div>
        </nav>
      ) : null}
    </section>
  );
}
