import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Clock3 } from "lucide-react";
import { EnterClinicForm, WithdrawJoinForm } from "@/components/auth/join-forms";
import { SESSION_COOKIE } from "@/lib/auth/current";
import { getPendingJoins } from "@/lib/auth/joining";

export const metadata: Metadata = { title: "Waiting for approval", robots: { index: false, follow: false } };

async function Status() {
  await connection();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const joins = token ? await getPendingJoins(token) : [];
  const latest = joins.at(-1);
  if (!latest) redirect("/sign-in");
  if (latest.status === "approved") {
    return (
      <>
        <h1 className="display-heading text-[2.25rem]">You&rsquo;re approved</h1>
        <p className="mt-2 text-body">{latest.clinicName} approved your request.</p>
        <div className="mt-8"><EnterClinicForm clinicId={latest.clinicId} /></div>
      </>
    );
  }
  if (latest.status === "pending") {
    return (
      <>
        <Clock3 className="size-8 text-brand" aria-hidden />
        <h1 className="display-heading mt-4 text-[2.25rem]">Waiting for {latest.clinicName} to approve you</h1>
        <p className="mt-2 text-body">Your email is confirmed. A manager at the clinic will approve your access, usually while you&rsquo;re together or on a call.</p>
        <div className="mt-8 flex flex-wrap items-start gap-3">
          <Link href="/join/waiting" className="inline-flex min-h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-brand-hover">Check again</Link>
          <WithdrawJoinForm requestId={latest.requestId} />
        </div>
      </>
    );
  }
  return (
    <>
      <h1 className="display-heading text-[2.25rem]">{latest.status === "declined" ? "Request declined" : "Request withdrawn"}</h1>
      <p className="mt-2 text-body">You don&rsquo;t have access to {latest.clinicName}. If this is a mistake, ask the clinic&rsquo;s manager for a new code.</p>
      <p className="mt-6"><Link href="/join" className="font-medium text-brand hover:underline">Enter a new code</Link></p>
    </>
  );
}

export default function WaitingPage() {
  return (
    <div>
      <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-surface" />}><Status /></Suspense>
    </div>
  );
}
