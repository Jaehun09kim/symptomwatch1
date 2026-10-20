import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { JoinCodeForm } from "@/components/auth/join-forms";

export const metadata: Metadata = { title: "Join your clinic", robots: { index: false, follow: false } };

async function ExpiredNotice({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return params.expired ? (
    <p role="status" className="mt-6 rounded-md border border-attention-line bg-attention-soft px-4 py-3 text-sm text-attention">
      That join expired. Ask your clinic&rsquo;s manager for a new code.
    </p>
  ) : null;
}

export default function JoinPage(props: PageProps<"/join">) {
  return (
    <div>
      <h1 className="display-heading text-[2.25rem]">Join your clinic</h1>
      <p className="mt-2 text-body">Enter the code your clinic&rsquo;s manager gave you. You&rsquo;ll confirm your email next.</p>
      <Suspense fallback={null}><ExpiredNotice searchParams={props.searchParams} /></Suspense>
      <div className="mt-8"><JoinCodeForm /></div>
      <p className="mt-6 text-sm text-slate-600">No code? <Link href="/sign-in" className="font-medium text-brand hover:underline">Sign in</Link> or <Link href="/demo" className="font-medium text-brand hover:underline">try the demo</Link>.</p>
    </div>
  );
}
