"use client";

import { m, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Enter transition for a route segment; rendered from a template.tsx so it replays on navigation. */
export function PageTransition({ children, distance = 10, duration = 0.32 }: { children: ReactNode; distance?: number; duration?: number }) {
  const reduce = useReducedMotion();
  return (
    <m.div
      initial={reduce ? false : { opacity: 0, y: distance }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, ease: EASE }}
      className="flex flex-1 flex-col"
    >
      {children}
    </m.div>
  );
}
