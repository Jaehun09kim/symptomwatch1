import type { SyntheticClinic, SyntheticStaff } from "./types";

/** Fictional clinics. Any resemblance to real practices is coincidental. */
export const clinics: SyntheticClinic[] = [
  {
    key: "harbor-view",
    name: "Harbor View Family Medicine — DEMO",
    slug: "harbor-view-demo",
    city: "Orange County, CA (fictional)",
  },
  {
    key: "orange-grove",
    name: "Orange Grove Primary Care — DEMO",
    slug: "orange-grove-demo",
    city: "Orange County, CA (fictional)",
  },
];

/**
 * Fictional staff. Emails use the reserved `.test` TLD so they can never
 * reach a real mailbox.
 */
export const staff: SyntheticStaff[] = [
  { key: "hv-admin-shah", clinic: "harbor-view", displayName: "Priya Shah", email: "admin@harborview.demo.test", role: "clinic_admin" },
  { key: "hv-dr-rivera", clinic: "harbor-view", displayName: "Dr. Maya Rivera", email: "physician@harborview.demo.test", role: "physician", credentials: "MD" },
  { key: "hv-dr-nguyen", clinic: "harbor-view", displayName: "Dr. Thomas Nguyen", email: "nguyen@harborview.demo.test", role: "physician", credentials: "DO" },
  { key: "hv-fd-okafor", clinic: "harbor-view", displayName: "Daniel Okafor", email: "frontdesk@harborview.demo.test", role: "staff" },
  { key: "hv-fd-morales", clinic: "harbor-view", displayName: "Lena Morales", email: "morales@harborview.demo.test", role: "staff" },

  { key: "og-admin-kim", clinic: "orange-grove", displayName: "Grace Kim", email: "admin@orangegrove.demo.test", role: "clinic_admin" },
  { key: "og-dr-brooks", clinic: "orange-grove", displayName: "Dr. Alan Brooks", email: "physician@orangegrove.demo.test", role: "physician", credentials: "MD" },
  { key: "og-fd-hill", clinic: "orange-grove", displayName: "Marcus Hill", email: "frontdesk@orangegrove.demo.test", role: "staff" },
];
