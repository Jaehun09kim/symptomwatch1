"use client";

import { useEffect, useRef, useState } from "react";

/** What a screen reader hears: only when crossing 60, 30, 10 seconds and expiry — never every second. */
function announcementFor(remaining: number): string {
  if (remaining <= 0) return "Code expired";
  if (remaining <= 10) return "10 seconds left";
  if (remaining <= 30) return "30 seconds left";
  if (remaining <= 60) return "1 minute left";
  return "";
}

/**
 * A ticking ring and m:ss timer to a server-issued expiry. The server enforces
 * the expiry; this only shows it.
 */
export function Countdown({ expiresAt, totalSeconds = 90, onExpire }: { expiresAt: string; totalSeconds?: number; onExpire?: () => void }) {
  const end = new Date(expiresAt).getTime();
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef(false);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);
  const remaining = Math.max(0, Math.ceil((end - now) / 1000));
  useEffect(() => {
    if (remaining === 0 && !fired.current) {
      fired.current = true;
      onExpire?.();
    }
  }, [remaining, onExpire]);

  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const fraction = Math.min(1, remaining / totalSeconds);
  const urgent = remaining <= 10;
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 52 52" className="size-12 -rotate-90" aria-hidden>
        <circle cx="26" cy="26" r={radius} fill="none" stroke="var(--border)" strokeWidth="4" />
        <circle cx="26" cy="26" r={radius} fill="none" strokeWidth="4" strokeLinecap="round"
          stroke={urgent ? "var(--sw-attention)" : "var(--sw-blue)"}
          strokeDasharray={circumference} strokeDashoffset={circumference * (1 - fraction)}
          className="transition-[stroke-dashoffset] duration-300 ease-linear motion-reduce:transition-none" />
      </svg>
      <span role="timer" aria-label="Time left on this code" className={`font-mono text-2xl tabular-nums ${urgent ? "text-attention" : "text-navy"}`}>
        {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
      </span>
      <span data-testid="countdown-announcement" aria-live="polite" className="sr-only">{announcementFor(remaining)}</span>
    </div>
  );
}
