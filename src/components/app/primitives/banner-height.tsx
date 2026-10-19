"use client";

import { useEffect, useRef } from "react";

/**
 * Publishes the demo banner's real height as `--banner-h`, so sticky headers
 * sit directly below it even when text is enlarged or the notice wraps.
 * Without JavaScript the CSS fallback (2rem) applies.
 */
export function BannerHeight() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const banner = ref.current?.parentElement;
    if (!banner) return;
    const root = document.documentElement;
    const update = () => root.style.setProperty("--banner-h", `${banner.getBoundingClientRect().height}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(banner);
    return () => observer.disconnect();
  }, []);
  return <span ref={ref} hidden />;
}
