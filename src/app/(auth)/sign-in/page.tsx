import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { staff } from "@/data/synthetic";
import { SignInForm, type DemoLogin } from "@/components/auth/auth-forms";
import { getEnv } from "@/lib/env";
import { roleLabel } from "@/lib/labels";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

const notices: Record<string, string> = {
  signedOut: "You've been signed out.",
  reset: "Password updated. Sign in with your new password.",
};

function demoLogins(): { logins: DemoLogin[]; password?: string } {
  const env = getEnv();
  if (!env.SEED_SHARED_DEMO_ACCOUNTS || !env.DEMO_ACCOUNT_PASSWORD) return { logins: [] };
  const picks = ["hv-dr-rivera", "hv-fd-okafor", "hv-admin-shah", "og-dr-brooks"];
  return {
    password: env.DEMO_ACCOUNT_PASSWORD,
    logins: picks.map((key) => {
      const member = staff.find((entry) => entry.key === key)!;
      const clinic = member.clinic === "harbor-view" ? "Harbor View" : "Orange Grove";
      return { email: member.email, label: `${member.displayName} · ${roleLabel[member.role]} · ${clinic}` };
    }),
  };
}

async function SignInContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const notice = Object.keys(notices).find((key) => params[key]);
  const { logins, password } = demoLogins();
  return <SignInForm next={next} demoLogins={logins} demoPassword={password} notice={notice ? notices[notice] : undefined} />;
}

export default function SignInPage(props: PageProps<"/sign-in">) {
  return (
    <div>
      <h1 className="display-heading text-[2.25rem]">Sign in</h1>
      <p className="mt-2 text-body">
        New here? <Link href="/sign-up" className="font-medium text-brand hover:underline">Create a demo account</Link> or{" "}
        <Link href="/demo" className="font-medium text-brand hover:underline">try it instantly</Link>.
      </p>
      <p className="mt-3 rounded-md border border-border bg-surface px-4 py-3 text-sm text-body">
        Have a code from your clinic? <Link href="/join" className="font-medium text-brand hover:underline">Join with a code</Link>
      </p>
      <div className="mt-8">
        <Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-surface" />}>
          <SignInContent searchParams={props.searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
