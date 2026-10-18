import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { DemoBanner } from "@/components/app/primitives/layout";
import { Toaster } from "@/components/ui/sonner";
import { getEnv } from "@/lib/env";
import localFont from "next/font/local";
import "./globals.css";

const sourceSerif = localFont({
  src: "../../node_modules/@fontsource-variable/source-serif-4/files/source-serif-4-latin-standard-normal.woff2",
  variable: "--font-source-serif",
  weight: "200 900",
  display: "swap",
});

const description =
  "Follow-up coordination for independent primary-care clinics: track open follow-ups, outstanding labs, and missing specialist records with explainable, clinician-reviewed flags. Demonstration prototype with fictional data.";

export const metadata: Metadata = {
  metadataBase: new URL(getEnv().APP_BASE_URL),
  title: { default: "SymptomWatch — Follow-up coordination for small clinics", template: "%s · SymptomWatch" },
  description,
  applicationName: "SymptomWatch",
  openGraph: {
    type: "website",
    siteName: "SymptomWatch",
    title: "SymptomWatch — follow-up coordination for small primary-care clinics",
    description,
  },
  twitter: { card: "summary_large_image", title: "SymptomWatch", description },
};

export const viewport: Viewport = { themeColor: "#fbfaf7", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} ${sourceSerif.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-body">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-12 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow-card"
        >
          Skip to content
        </a>
        <DemoBanner />
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
