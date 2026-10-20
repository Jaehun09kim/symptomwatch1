import { Suspense } from "react";
import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false, follow: false } };

async function ResetContent({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ResetPasswordForm token={token} />;
}

export default function ResetPasswordPage(props: PageProps<"/reset-password/[token]">) {
  return (
    <div>
      <h1 className="display-heading text-4xl">Choose a new password</h1>
      <p className="mt-2 text-body">For security, this signs you out of every other device.</p>
      <div className="mt-8">
        <Suspense fallback={<div className="h-56 animate-pulse rounded-xl bg-surface" />}>
          <ResetContent params={props.params} />
        </Suspense>
      </div>
    </div>
  );
}
