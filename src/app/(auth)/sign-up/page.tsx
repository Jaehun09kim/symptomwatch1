import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Create demo account", robots: { index: false, follow: false } };

export default function SignUpPage() {
  return (
    <div>
      <h1 className="display-heading text-4xl">Create your demo account</h1>
      <p className="mt-2 text-body">
        You&rsquo;ll get a private demo clinic with 30 fictional patients, and you&rsquo;ll be its administrator. Already have an
        account? <Link href="/sign-in" className="font-medium text-brand hover:underline">Sign in</Link>.
      </p>
      <div className="mt-8">
        <SignUpForm />
      </div>
    </div>
  );
}
