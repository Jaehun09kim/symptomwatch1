import { ShieldCheck } from "lucide-react";
import { formatTimelineDate } from "@/components/app/primitives/timeline-item";
import { roleLabel, type MemberRole } from "@/lib/labels";

export interface ClinicalGrant {
  userName: string;
  role: MemberRole;
  grantedByName: string | null;
  via: "role_change" | "join";
  createdAt: string;
}

function GrantLine({ grant }: { grant: ClinicalGrant }) {
  const how = grant.via === "join"
    ? (grant.grantedByName ? `when ${grant.grantedByName} approved their join request` : "by joining with an instant code")
    : `by ${grant.grantedByName ?? "a manager"}`;
  return (
    <li><strong className="font-medium text-navy">{grant.userName}</strong> was given {roleLabel[grant.role]} access {how} · {formatTimelineDate(grant.createdAt)}</li>
  );
}

/**
 * Physicians see every clinical-access grant from the last 14 days — newest five
 * up front, the rest one click away — so no grant can be buried (Codex review).
 */
export function ClinicalAccessNotice({ grants }: { grants: ClinicalGrant[] }) {
  if (!grants.length) return null;
  const [first, rest] = [grants.slice(0, 5), grants.slice(5)];
  return (
    <section aria-labelledby="new-clinical-access" className="rounded-lg border border-brand/25 bg-brand-soft px-4 py-3 text-sm text-body">
      <h2 id="new-clinical-access" className="flex items-center gap-2 font-semibold text-navy"><ShieldCheck className="size-4 text-brand" aria-hidden />New clinical access</h2>
      <ul className="mt-1.5 space-y-1">{first.map((grant, index) => <GrantLine key={index} grant={grant} />)}</ul>
      {rest.length ? (
        <details className="mt-1.5">
          <summary className="min-h-9 cursor-pointer content-center font-medium text-brand-hover">Show {rest.length} more</summary>
          <ul className="mt-1 space-y-1">{rest.map((grant, index) => <GrantLine key={index} grant={grant} />)}</ul>
        </details>
      ) : null}
      <p className="mt-1.5 text-xs text-slate-600">Shown to physicians for 14 days. If you don&rsquo;t recognize someone, tell your clinic&rsquo;s manager.</p>
    </section>
  );
}
