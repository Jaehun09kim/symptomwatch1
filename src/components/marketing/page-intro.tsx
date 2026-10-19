import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

/** Shared page width for the public site. */
export const container = "mx-auto max-w-6xl px-4 sm:px-6 lg:px-8";

/** Title block for marketing sub-pages. */
export function PageIntro({ title, label, children, aside }: { title: string; label?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <header className="grid gap-8 pb-14 pt-12 sm:pb-16 sm:pt-20 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-end lg:pb-20">
      <div>
        {label ? <p className="meta-label mb-5">{label}</p> : null}
        <h1 className="display-heading text-[2.5rem] text-navy sm:text-[3.5rem] lg:text-6xl">{title}</h1>
        <div className="lead mt-6 max-w-2xl space-y-4">{children}</div>
      </div>
      {aside ? <div className="lg:justify-self-end">{aside}</div> : null}
    </header>
  );
}

/** A numbered feature with its index beside the copy and an anchor for nav deep links. */
export function FeatureSection({ id, index, title, children, visual, flip }: {
  id: string;
  index?: number;
  title: string;
  children: ReactNode;
  visual: ReactNode;
  flip?: boolean;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="section-space scroll-mt-28 border-t border-border">
      <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-16 [&>*]:min-w-0">
        <div className={flip ? "lg:order-2 lg:col-span-5" : "lg:col-span-5"}>
          {index !== undefined ? <p className="meta-label mb-4 tabular-nums">{String(index).padStart(2, "0")}</p> : null}
          <h2 id={`${id}-title`} className="section-heading text-[1.75rem] text-navy sm:text-[2rem]">{title}</h2>
          <div className="mt-5 space-y-4 leading-relaxed text-body">{children}</div>
        </div>
        <div className={flip ? "lg:order-1 lg:col-span-7" : "lg:col-span-7"}>{visual}</div>
      </div>
    </section>
  );
}

export function CtaBand({ title, body, primary, secondary }: {
  title: string;
  body: string;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
}) {
  return (
    <section className="section-space grid items-center gap-8 border-t border-border lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-16">
      <div className="max-w-xl">
        <h2 className="display-heading text-[2rem] text-navy sm:text-[2.5rem]">{title}</h2>
        <p className="lead mt-5">{body}</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-5">
        <Link href={primary.href} className={buttonVariants({ size: "lg" })}>{primary.label}</Link>
        {secondary ? (
          <Link href={secondary.href} className="text-link justify-center">
            {secondary.label}
            <ArrowRight aria-hidden />
          </Link>
        ) : null}
      </div>
    </section>
  );
}
