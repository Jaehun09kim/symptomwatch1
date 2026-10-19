import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FlagCard } from "@/components/app/primitives/flag-card";
import { DataFreshness } from "@/components/app/primitives/data-freshness";
import { RuleSettingsForm } from "@/components/app/rules/rule-settings-form";
import { DEFAULT_RULE_SETTINGS } from "@/lib/detection/clinic-config";

vi.mock("@/app/app/actions", () => ({ updateRuleSettingsAction: vi.fn() }));
afterEach(cleanup);

describe("app polish", () => {
  it("keeps one provenance label, source links, and actions visible while rationale remains in the DOM", () => {
    render(<FlagCard title="Missing fictional lab result" rationale="The full rule explanation."
      status="open" ruleLabel="Lab result" ruleVersion="1" expectedBy="2026-10-01"
      missing={[{ description: "No result on file", certainty: "not_documented" }]}
      evidence={[{ label: "Fictional order", date: "2026-09-24", href: "/app/patients/demo#lab" }]}
      footer={<button>Confirm gap</button>} />);
    expect(screen.getAllByText("Rule-inferred · needs review", { exact: true })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Missing fictional lab result");
    const rationale = screen.getByText("The full rule explanation.");
    expect(rationale).toBeInTheDocument();
    expect(rationale.closest("details")).not.toHaveAttribute("open");
    expect(rationale).not.toBeVisible();
    expect(screen.getByText("Why this was flagged").tagName).toBe("SUMMARY");
    expect(screen.getByRole("link", { name: "Fictional order" })).toHaveAttribute("href", "/app/patients/demo#lab");
    expect(screen.getByRole("button", { name: "Confirm gap" })).toBeVisible();
    expect(screen.getByText("Expected by:")).toBeVisible();
  });

  it("makes missing import and run coverage explicit", () => {
    render(<DataFreshness lastImport={null} lastRun={null} />);
    expect(screen.getByText("No records have been imported into this clinic yet.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Import records" })).toHaveAttribute("href", "/app/import");
    expect(screen.getByText("Detection has not run yet.")).toBeVisible();
  });

  it("shows import kind, actor, counts and a separate detection timestamp", () => {
    render(<DataFreshness lastImport={{ id: "batch", kind: "referrals", filename: "fictional.csv", createdAt: "2026-10-01T10:00:00Z", createdByName: "Demo reviewer", rowCount: 10, createdCount: 3, updatedCount: 2, unchangedCount: 4, errorCount: 1 }} lastRun={{ createdAt: "2026-10-02T10:00:00Z", patientsEvaluated: 2, findingsCount: 1 }} />);
    expect(screen.getByText(/Referrals ·/)).toHaveTextContent("by Demo reviewer");
    expect(screen.getByText(/10 rows/)).toHaveTextContent("3 added · 2 updated · 4 already current · 1 skipped");
    expect(screen.getByText(/2 patients checked/)).toHaveTextContent("1 finding");
  });

  it("shows the rule effect as inputs change before saving", () => {
    render(<RuleSettingsForm values={DEFAULT_RULE_SETTINGS} editable impactCounts={{ "lab-result-missing": { open: 2, snoozed: 1, confirmed: 1 } }} rows={[{ rule: "lab-result-missing", description: "Fictional rule", fields: [{ key: "labGraceDays", label: "Grace", unit: "days", min: 0, max: 60, defaultValue: 7 }] }]} />);
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "30" } });
    expect(screen.getByText(/Longer grace or waiting period/)).toHaveTextContent("resolved on the next run");
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByText(/Turning this rule off parks/)).toHaveTextContent("parks 4 open or confirmed flags");
    expect(screen.getByRole("button", { name: "Save and re-run detection" })).toBeVisible();
  });
});
