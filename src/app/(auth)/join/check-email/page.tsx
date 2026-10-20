import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { MailCheck } from "lucide-react";
import { ContinueJoinForm } from "@/components/auth/join-forms";
import { getEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Check your email", robots: { index: false, follow: false } };

async function Details({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const params = await searchParams;
  const email = params.email;
  if (params.confirmed) {
    return (
      <p role="status" className="mt-2 text-body">
        Email confirmed. Return to the window where you entered your code and press &ldquo;I&rsquo;ve confirmed my email — continue&rdquo; to finish joining.
      </p>
    );
  }
  return (
    <>
      <p className="mt-2 text-body">
        We sent a confirmation link{typeof email === "string" ? <> to <strong className="font-medium text-navy">{email}</strong></> : null}. Open it within 30 minutes. If you open it on another device, come back here and continue.
      </p>
      <div className="mt-8"><ContinueJoinForm /></div>
      {getEnv().DEV_OUTBOX_ENABLED ? (
        <p className="mt-6 rounded-md border border-border bg-surface px-4 py-3 text-sm text-body">
          This prototype doesn&rsquo;t send real email. Messages appear in the <Link href="/dev/outbox" className="font-medium text-brand hover:underline">developer outbox</Link>.
        </p>
      ) : null}
    </>
  );
}

export default function CheckEmailPage(props: PageProps<"/join/check-email">) {
  return (
    <div>
      <MailCheck className="size-8 text-brand" aria-hidden />
      <h1 className="display-heading mt-4 text-[2.25rem]">Check your email</h1>
      <Suspense fallback={null}><Details searchParams={props.searchParams} /></Suspense>
    </div>
  );
}
