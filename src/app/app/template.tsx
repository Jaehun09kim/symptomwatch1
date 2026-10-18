import { PageTransition } from "@/components/motion/page-transition";

/** A quick, quiet fade between app pages — this is a work tool, not a showcase. */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition distance={4} duration={0.2}>{children}</PageTransition>;
}
