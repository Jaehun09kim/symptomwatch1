"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SelectField } from "@/components/forms/fields";

export function MobileReviewFilters({ status, rule, statuses, rules }: {
  status: string; rule: string;
  statuses: Array<{ value: string; label: string }>;
  rules: Array<{ value: string; label: string }>;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    next.delete("flag");
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.push(`/app/review?${next}`, { scroll: false }));
  };
  return (
    <div role="group" aria-label="Filter flags" aria-busy={pending} className="grid grid-cols-2 gap-2 md:hidden [&>div]:min-w-0">
      <SelectField label="Status" value={status} onChange={(event) => update("status", event.target.value)}>
        {statuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </SelectField>
      <SelectField label="Rule" value={rule} onChange={(event) => update("rule", event.target.value)}>
        <option value="">All rules</option>
        {rules.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </SelectField>
    </div>
  );
}
