import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { MailWarning } from "lucide-react";
import { AcceptInvitationForm, SignUpForm } from "@/components/auth/auth-forms";
import { getInvitationPreview } from "@/lib/auth/accounts";
import { getCurrentSession } from "@/lib/auth/current";
import { roleLabel } from "@/lib/labels";

export const metadata: Metadata = { title: "Join a demo clinic", robots: { index: false, follow: false } };

async function InviteContent({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await connection(); // invitation expiry is checked against the clock: request time only
  const [invitation, session] = await Promise.all([getInvitationPreview(token), getCurrentSession()]);
  if (!invitation) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-center">
        <MailWarning className="mx-auto size-8 text-slate-500" aria-hidden />
        <h1 className="mt-3 text-2xl font-semibold">This invitation can&rsquo;t be used</h1>
        <p className="mt-2 text-body">It may have expired, been revoked, or already been accepted. Ask your clinic administrator for a new link.</p>
        <Link href="/sign-in" className="mt-4 inline-block font-medium text-brand hover:underline">Go to sign in</Link>
      </div>
    );
  }
  return (
    <div>
      <h1 className="display-heading text-4xl">Join {invitation.clinicName}</h1>
      <p className="mt-2 text-body">
        {invitation.inviterName} invited <strong className="text-navy">{invitation.email}</strong> to join as{" "}
        <strong className="text-navy">{roleLabel[invitation.role]}</strong>.
      </p>
      <div className="mt-8">
        {session ? (
          session.email.toLowerCase() === invitation.email.toLowerCase() ? (
            <AcceptInvitationForm token={token} />
          ) : (
            <p className="rounded-xl border border-border bg-surface p-4 text-sm text-body">
              You&rsquo;re signed in as {session.email}. Sign out and sign in as {invitation.email} to accept this invitation.
            </p>
          )
        ) : (
          <div className="space-y-6">
            <SignUpForm inviteToken={token} invitedEmail={invitation.email} />
            <p className="text-sm text-body">
              Already have an account for {invitation.email}?{" "}
              <Link href={`/sign-in?next=${encodeURIComponent(`/invite/${token}`)}`} className="font-medium text-brand hover:underline">Sign in first</Link>, then reopen this link.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function InvitePage(props: PageProps<"/invite/[token]">) {
  return (
    <Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-surface" />}>
      <InviteContent params={props.params} />
    </Suspense>
  );
}
