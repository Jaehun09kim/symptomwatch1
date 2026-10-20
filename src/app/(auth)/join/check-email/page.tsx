import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { MailCheck } from "lucide-react";
import { getEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Check your email", robots: { index: false, follow: false } };

async function Details({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const email = (await searchParams).email;
  return (
    <>
      <p className="mt-2 text-body">
        We sent a confirmation link{typeof email === "string" ? <> to <strong className="font-medium text-navy">{email}</strong></> : null}. Open it within 30 minutes to finish joining.
      </p>
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
