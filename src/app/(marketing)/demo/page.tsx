import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { startTryDemoAction } from "@/app/(auth)/actions";
import { SubmitButton } from "@/components/forms/fields";
import type { MemberRole } from "@/lib/labels";

export const metadata: Metadata = {
  title: "Try the demo",
  description: "Explore SymptomWatch in a private sandbox clinic with fictional patients. No installation, no real data.",
};

const roles: { role: MemberRole; title: string; persona: string; can: string[] }[] = [
  {
    role: "physician",
    title: "Physician",
    persona: "Dr. Maya Rivera (fictional)",
    can: ["Review explainable follow-up flags", "Inspect patient timelines and evidence", "Confirm or dismiss gaps and leave feedback"],
  },
  {
    role: "staff",
    title: "Front desk",
    persona: "Daniel Okafor (fictional)",
    can: ["Work calls, confirmations, and records requests", "Assign tasks and record outcomes", "Sees administrative detail only; clinical notes are restricted"],
  },
  {
    role: "clinic_admin",
    title: "Practice admin",
    persona: "Priya Shah (fictional)",
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
  return message ? <p role="alert" className="mt-6 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{message}</p> : null;
}

export default function DemoPage(props: PageProps<"/demo">) {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:px-8">
      <div className="max-w-2xl">
        <h1 className="display-heading text-[2.6rem] sm:text-6xl">Choose a role to try</h1>
        <p className="lead mt-6">
          Explore a private sandbox of <strong className="font-medium text-navy">Harbor View Family Medicine</strong> with 30
          fictional patients, a live follow-up queue, and explainable flags. Switch roles any time from inside the app.
          Sandboxes are deleted after 7 days.
        </p>
      </div>
      <Suspense fallback={null}>
        <ErrorNotice searchParams={props.searchParams} />
      </Suspense>
      <ul className="mt-14 divide-y divide-border border-y border-border">
        {roles.map(({ role, title, persona, can }) => (
          <li key={role} className="grid gap-5 py-8 md:grid-cols-[1fr_1.5fr_13rem] md:items-start">
            <div><h2 className="text-[1.15rem] font-medium tracking-[-0.015em]">{title}</h2>
            <p className="meta-label mt-1.5">{persona}</p></div>
            <ul className="space-y-2 text-[0.9375rem] text-body">
              {can.map((item) => (
                <li key={item} className="leading-relaxed">
                  {item}
                </li>
              ))}
            </ul>
            <form action={startTryDemoAction} className="md:pt-1">
              <input type="hidden" name="role" value={role} />
              <SubmitButton className="h-10 w-full" pendingLabel="Preparing your sandbox…">Start as {title}</SubmitButton>
            </form>
          </li>
        ))}
      </ul>
      <div className="mt-8 max-w-2xl space-y-3 text-sm leading-relaxed text-muted-foreground">
        <p>Fictional data only. Do not enter real patient information. Your sandbox is private to your browser session.</p>
        <p>Want to keep it and invite colleagues? <Link href="/sign-up" className="font-medium text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand">Create an account</Link>.</p>
      </div>
    </div>
  );
}
