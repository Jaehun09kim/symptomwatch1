import { cn } from "@/lib/utils";

/** Shield mark: a pulse line that resolves into a check — a follow-up loop closed. */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-8 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path
        d="M16 2.5 5 6.6v8.6c0 7 4.6 12.4 11 14.3 6.4-1.9 11-7.3 11-14.3V6.6L16 2.5Z"
        fill="var(--sw-logo)"
      />
      <path
        d="M8.5 16.2h3.4l2-4.4 2.6 8.2 1.9-3.8h1.3l1.7 1.9 3.6-4.3"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={markClassName} />
      <span className="text-[1.05rem] font-semibold tracking-[-0.02em] text-navy">SymptomWatch</span>
    </span>
  );
}
