import { describe, expect, it } from "vitest";
import { DEFAULT_RULE_SETTINGS as defaults } from "@/lib/detection/clinic-config";
import { ruleChangePreview } from "@/lib/rule-change-preview";

describe("rule change preview", () => {
  it("shows nothing for unchanged settings or temporarily empty numeric inputs", () => {
    expect(ruleChangePreview(defaults, { ...defaults })).toEqual([]);
    expect(ruleChangePreview(defaults, { ...defaults, labGraceDays: NaN })).toEqual([]);
  });

  it("counts open, snoozed, and confirmed flags when disabling without counting dismissed ones", () => {
    const preview = ruleChangePreview(defaults, { ...defaults, disabledRules: ["lab-result-missing"] }, { "lab-result-missing": { open: 4, snoozed: 2, confirmed: 1 } });
    expect(preview).toHaveLength(1);
    expect(preview[0].effect).toContain("parks 7 open or confirmed flags");
    expect(preview[0].effect).toContain("records still meet the rule");
    expect(ruleChangePreview(defaults, { ...defaults, disabledRules: ["lab-result-missing"] })[0].effect).toContain("parks its open and confirmed flags");
  });

  it("explains re-enabling and changes to a rule that stays off", () => {
    const off = { ...defaults, disabledRules: ["lab-result-missing" as const] };
    expect(ruleChangePreview(off, defaults)[0].effect).toContain("Parked flags that still meet these settings return");
    expect(ruleChangePreview(off, { ...off, labGraceDays: 20 })[0].effect).toContain("This rule stays off");
  });

  it("distinguishes longer, shorter, mixed, and symptom thresholds", () => {
    expect(ruleChangePreview(defaults, { ...defaults, labGraceDays: 30 })[0].effect).toContain("will be resolved on the next run");
    expect(ruleChangePreview(defaults, { ...defaults, overdueGraceDays: 0 })[0].effect).toContain("reopen resolved flags sooner");
    expect(ruleChangePreview(defaults, { ...defaults, referralSentGraceDays: 30, referralRecordsDays: 0 })[0].effect).toContain("different directions");
    expect(ruleChangePreview(defaults, { ...defaults, symptomMinEncounters: 6 })[0].effect).toContain("Higher visit/span threshold");
  });
});
