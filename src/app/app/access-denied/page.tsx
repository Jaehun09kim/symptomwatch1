import type { Metadata } from "next";
import Link from "next/link";
import { Lock } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Access restricted" };

export default function AccessDeniedPage() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-surface text-slate-500"><Lock className="size-5" aria-hidden /></span>
      <h1 className="mt-4 text-2xl font-semibold">That page isn&rsquo;t available for your role</h1>
      <p className="mt-2 text-body">SymptomWatch shows each role only what it needs. Ask your clinic administrator if you believe you should have access.</p>
      <Link href="/app" className={buttonVariants({ className: "mt-6" })}>Back to dashboard</Link>
    </div>
  );
}
