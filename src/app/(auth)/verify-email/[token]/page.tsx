import { Suspense } from "react";
import type { Metadata } from "next";
import { VerifyEmailForm } from "@/components/auth/join-forms";

export const metadata: Metadata = { title: "Confirm your email", robots: { index: false, follow: false } };

async function Form({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <VerifyEmailForm token={token} />;
}

export default function VerifyEmailPage(props: PageProps<"/verify-email/[token]">) {
  return (
    <div>
      <h1 className="display-heading text-[2.25rem]">Confirm your email</h1>
      <p className="mt-2 text-body">One click confirms this address belongs to you and finishes joining your clinic.</p>
      <div className="mt-8"><Suspense fallback={null}><Form params={props.params} /></Suspense></div>
    </div>
  );
}
