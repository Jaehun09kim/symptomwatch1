/** Plain-language rule descriptions that reflect a clinic's current settings. */
import type { RuleSettingsValues } from "@/lib/detection/clinic-config";
import type { RuleId } from "@/lib/detection/types";

export function describeRule(rule: RuleId, settings: RuleSettingsValues): string {
  switch (rule) {
    case "overdue-follow-up":
      return `A time-bound return visit was requested, the due date plus ${settings.overdueGraceDays} days has passed, and no later visit or upcoming follow-up is on file.`;
    case "lab-result-missing":
      return `An order is past its expected turnaround plus ${settings.labGraceDays} days with no result, and no lab draw is booked.`;
    case "referral-outcome-missing":
      return `No specialist appointment ${settings.referralSentGraceDays} days past the expected wait, or the specialist visit passed ${settings.referralRecordsDays}+ days ago with no records received.`;
    case "persistent-symptom-unresolved":
      return `The same symptom at ${settings.symptomMinEncounters}+ visits spanning ${settings.symptomMinSpanDays}+ days, still active, with no plan, work-up, or follow-up documented.`;
  }
}
