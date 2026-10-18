import type { MetadataRoute } from "next";
import { getEnv } from "@/lib/env";

/** Public, indexable pages only. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getEnv().APP_BASE_URL;
  return [
    { url: `${base}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/product`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/how-it-works`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/demo`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/safety`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/contact`, changeFrequency: "yearly", priority: 0.6 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.4 },
  ];
}
