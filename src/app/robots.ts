import type { MetadataRoute } from "next";
import { getEnv } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/privacy", "/demo"],
      disallow: ["/app", "/api", "/dev", "/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/invite"],
    },
    sitemap: `${getEnv().APP_BASE_URL}/sitemap.xml`,
  };
}
