import type { ReactNode } from "react";
import Link from "next/link";

/** Title block for marketing sub-pages. */
export function PageIntro({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <header className="grid gap-8 border-b border-border py-14 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-end lg:py-20">
      <div>
        <h1 className="display-heading text-4xl sm:text-5xl">{title}</h1>
        <div className="mt-5 max-w-2xl space-y-4 text-lg leading-relaxed text-body">{children}</div>
      </div>
      {aside ? <div className="lg:justify-self-end">{aside}</div> : null}
    </header>
  );
}

/** A two-column feature section with an anchor id for deep links from the nav. */
export function FeatureSection({ id, title, children, visual, flip }: { id: string; title: string; children: ReactNode; visual: ReactNode; flip?: boolean }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 grid items-center gap-10 border-b border-border py-14 lg:grid-cols-2 lg:gap-16 lg:py-20 [&>*]:min-w-0">
      <div className={flip ? "lg:order-2" : undefined}>
        <h2 id={`${id}-title`} className="display-heading text-3xl">{title}</h2>
        <div className="mt-4 space-y-4 leading-relaxed text-body">{children}</div>
      </div>
      <div className={flip ? "lg:order-1" : undefined}>{visual}</div>
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
    <section className="my-14 rounded-2xl bg-navy px-6 py-10 text-white sm:px-10 lg:my-20 lg:flex lg:items-center lg:justify-between lg:gap-10">
      <div className="max-w-2xl">
        <h2 className="display-heading text-2xl text-white sm:text-3xl">{title}</h2>
        <p className="mt-3 leading-relaxed text-[#d5e1ef]">{body}</p>
      </div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:mt-0 lg:shrink-0">
        <Link href={primary.href} className="inline-flex h-12 items-center justify-center rounded-md bg-white px-6 text-base font-medium text-navy transition-[transform,background-color] duration-150 hover:bg-[#e7effa] active:scale-[0.97]">{primary.label}</Link>
        {secondary ? <Link href={secondary.href} className="inline-flex h-12 items-center justify-center rounded-md border border-white/40 px-6 text-base font-medium text-white transition-[transform,background-color] duration-150 hover:bg-white/10 active:scale-[0.97]">{secondary.label}</Link> : null}
      </div>
    </section>
  );
}
