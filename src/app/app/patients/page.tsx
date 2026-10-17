import { Suspense } from "react";
import type { Metadata } from "next";
import { PatientsPanel } from "@/components/app/patients/patients-panel";
import { PageHeader } from "@/components/app/primitives/layout";
import { requirePermission } from "@/lib/auth/current";

export const metadata: Metadata = { title: "Patients" };

async function Patients({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ ctx }, params] = await Promise.all([requirePermission("patient.read_demographics"), searchParams]);
  return <PatientsPanel ctx={ctx} params={params} basePath="/app/patients" />;
}

export default function PatientsPage(props: PageProps<"/app/patients">) {
  return (
    <div className="space-y-6">
      <PageHeader title="Patients" description="Fictional demo patients. Select a patient to open their longitudinal timeline." />
      <Suspense fallback={<div className="h-[32rem] animate-pulse rounded-xl bg-surface" />}>
        <Patients searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
