"use client";

import { useRef, type ReactNode } from "react";
import { m, useReducedMotion, useScroll, useTransform } from "framer-motion";

/**
 * Linear-style perspective on wide screens: the frame starts gently tilted
 * back and flattens as it scrolls into reading position. Phones and tablets,
 * and reduced motion, get the flat frame.
 */
export function TiltFrame({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start 0.3"] });
  const tilt = useTransform(scrollYProgress, [0, 1], reduce ? ["0deg", "0deg"] : ["14deg", "0deg"]);
  const lift = useTransform(scrollYProgress, [0, 1], reduce ? [1, 1] : [0.96, 1]);
  return (
    <div ref={ref} className="[perspective:2400px]">
      {/* framer-motion drives CSS variables only; the transform itself applies from lg up. */}
      <m.div style={{ ["--tilt" as string]: tilt, ["--lift" as string]: lift }}
        className="origin-top lg:[transform:rotateX(var(--tilt))_scale(var(--lift))]">
        {children}
      </m.div>
    </div>
  );
}
