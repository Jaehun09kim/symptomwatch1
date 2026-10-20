import { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { JoinAccountForm } from "@/components/auth/join-forms";
import { peekJoin } from "@/lib/auth/joining";
import { roleLabel } from "@/lib/labels";

export const metadata: Metadata = { title: "Join your clinic", robots: { index: false, follow: false } };

async function Confirm() {
  await connection();
  const token = (await cookies()).get("sw_join")?.value;
  const join = token ? await peekJoin(token) : null;
  if (!join) redirect("/join?expired=1");
  return (
    <>
      <div className="mt-6 rounded-lg border border-border bg-surface px-4 py-3">
        <p className="font-medium text-navy">{join.clinicName}</p>
        <p className="text-sm text-slate-600">Joining as {roleLabel[join.role]}</p>
      </div>
      <div className="mt-8"><JoinAccountForm /></div>
    </>
  );
}

export default function JoinConfirmPage() {
  return (
    <div>
      <h1 className="display-heading text-[2.25rem]">Confirm who you are</h1>
      <p className="mt-2 text-body">Create your account or use the one you have. You have 15 minutes to finish.</p>
      <Suspense fallback={<div className="mt-8 h-72 animate-pulse rounded-xl bg-surface" />}><Confirm /></Suspense>
    </div>
  );
}
