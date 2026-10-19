import type { Viewport } from "next";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

export const viewport: Viewport = { themeColor: "#08090a" };

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="dark marketing-root flex flex-1 flex-col bg-background text-body">
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
