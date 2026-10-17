import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";
import { FormMessage } from "@/components/forms/fields";
import { selfServiceResetAvailable } from "@/lib/auth/accounts";

export const metadata: Metadata = { title: "Reset password", robots: { index: false, follow: false } };

export default function ForgotPasswordPage() {
  const available = selfServiceResetAvailable();
  return (
    <div>
      <h1 className="text-3xl font-semibold">Reset your password</h1>
      <p className="mt-2 text-body">
        {available
          ? "Enter your account email and we'll send a single-use link that expires in 30 minutes."
          : "This demo deployment can't send email."}
      </p>
      <div className="mt-8 space-y-6">
        {available ? (
          <ForgotPasswordForm />
        ) : (
          <FormMessage status="success" message="Ask your clinic administrator to issue a reset link from the Staff page." />
        )}
        <p className="text-sm text-body">
          <Link href="/sign-in" className="font-medium text-brand hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
