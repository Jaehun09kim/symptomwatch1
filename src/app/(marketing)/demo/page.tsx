import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck, ListChecks, ShieldCheck, Stethoscope, UserCog, Users } from "lucide-react";
import { startTryDemoAction } from "@/app/(auth)/actions";
import { SubmitButton } from "@/components/forms/fields";
import type { MemberRole } from "@/lib/labels";

export const metadata: Metadata = {
  title: "Try the demo",
  description: "Explore SymptomWatch in a private sandbox clinic with fictional patients. No installation, no real data.",
};

const roles: { role: MemberRole; title: string; persona: string; icon: typeof Stethoscope; can: string[] }[] = [
  {
    role: "physician",
    title: "Physician",
    persona: "Dr. Maya Rivera (fictional)",
    icon: Stethoscope,
    can: ["Review explainable follow-up flags", "Inspect patient timelines and evidence", "Confirm or dismiss gaps and leave feedback"],
  },
  {
    role: "staff",
    title: "Front desk",
    persona: "Daniel Okafor (fictional)",
    icon: ListChecks,
    can: ["Work calls, confirmations, and records requests", "Assign tasks and record outcomes", "Sees administrative detail only — not clinical notes"],
  },
  {
    role: "clinic_admin",
    title: "Clinic admin",
    persona: "Priya Shah (fictional)",
    icon: UserCog,
    can: ["Oversee follow-up throughput", "Invite staff and manage roles", "Review the audit log and reset demo data"],
  },
];

const errors: Record<string, string> = {
  rate: "Too many demo workspaces were started from your network recently. Please try again in a little while.",
  role: "Please choose one of the roles below.",
};

async function ErrorNotice({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const error = (await searchParams).error;
  const message = typeof error === "string" ? errors[error] : undefined;
  return message ? <p role="alert" className="mt-6 rounded-[10px] border border-destructive/30 bg-red-50 px-4 py-3 text-sm text-destructive">{message}</p> : null;
}

export default function DemoPage(props: PageProps<"/demo">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold text-brand">Try the demo</p>
        <h1 className="mt-2 text-4xl font-semibold">Pick a seat in the clinic</h1>
        <p className="mt-4 text-lg text-body">
          We&rsquo;ll spin up a private sandbox of <strong className="text-navy">Harbor View Family Medicine</strong> — 30
          fictional patients, a live follow-up queue, and explainable flags. Switch roles any time from inside the app.
          Sandboxes are deleted after 7 days.
        </p>
      </div>
      <Suspense fallback={null}>
        <ErrorNotice searchParams={props.searchParams} />
      </Suspense>
      <ul className="mt-10 grid gap-6 md:grid-cols-3">
        {roles.map(({ role, title, persona, icon: Icon, can }) => (
          <li key={role} className="flex flex-col rounded-2xl border border-border bg-white p-6 shadow-soft">
            <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand">
              <Icon className="size-5" aria-hidden />
            </span>
            <h2 className="mt-5 text-xl font-semibold">{title}</h2>
            <p className="text-sm text-slate-500">{persona}</p>
            <ul className="mt-4 flex-1 space-y-2 text-sm text-body">
              {can.map((item) => (
                <li key={item} className="flex gap-2">
                  <ClipboardCheck className="mt-0.5 size-4 shrink-0 text-teal" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
            <form action={startTryDemoAction} className="mt-6">
              <input type="hidden" name="role" value={role} />
              <SubmitButton className="w-full" pendingLabel="Preparing your sandbox…">Start as {title}</SubmitButton>
            </form>
          </li>
        ))}
      </ul>
      <div className="mt-10 grid gap-4 rounded-2xl border border-border bg-surface p-6 text-sm text-body sm:grid-cols-3">
        <p className="flex gap-2"><ShieldCheck className="size-5 shrink-0 text-teal" aria-hidden /> Fictional data only — please don&rsquo;t enter anything real.</p>
        <p className="flex gap-2"><Users className="size-5 shrink-0 text-teal" aria-hidden /> Your sandbox is private to your browser session.</p>
        <p className="flex gap-2"><UserCog className="size-5 shrink-0 text-teal" aria-hidden /> Want to keep it and invite colleagues? <Link href="/sign-up" className="font-medium text-brand hover:underline">Create an account</Link>.</p>
      </div>
    </div>
  );
}
