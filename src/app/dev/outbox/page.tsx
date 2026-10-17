import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/app/primitives/layout";
import { listOutbox } from "@/lib/auth/accounts";
import { getEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Developer outbox", robots: { index: false, follow: false } };

const linkify = (text: string) =>
  text.split(/(https?:\/\/\S+)/g).map((part, index) =>
    /^https?:\/\//.test(part) ? <a key={index} href={part} className="break-all text-brand underline">{part}</a> : part,
  );

async function Messages() {
  await connection();
  if (getEnv().NODE_ENV === "production") notFound();
  const messages = await listOutbox();
  if (!messages.length) return <EmptyState icon={Inbox} title="No messages yet" description="Invitations and password resets you trigger will appear here." />;
  return (
    <ul className="space-y-4">
      {messages.map((message) => (
        <li key={message.id} className="rounded-xl border border-border bg-white p-5 shadow-soft">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-semibold text-navy">{message.subject}</p>
            <time className="text-xs text-slate-500" dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString()}</time>
          </div>
          <p className="mt-1 text-sm text-slate-600">To: {message.toEmail} · {message.kind.replace("_", " ")}</p>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-body">{linkify(message.body)}</pre>
        </li>
      ))}
    </ul>
  );
}

export default function OutboxPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold">Developer outbox</h1>
      <p className="mt-1 text-sm text-slate-600">
        Simulated emails to <strong>staff</strong> (invitations, password resets). Local development only — nothing is actually sent, and nothing is ever sent to patients.
      </p>
      <div className="mt-8">
        <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-surface" />}>
          <Messages />
        </Suspense>
      </div>
    </main>
  );
}
