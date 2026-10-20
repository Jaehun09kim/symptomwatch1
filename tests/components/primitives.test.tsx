import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ProvenanceBadge, StatusBadge } from "@/components/app/primitives/badges";
import { StatCard } from "@/components/app/primitives/stat-card";
import { TimelineItem } from "@/components/app/primitives/timeline-item";

afterEach(cleanup);

describe("product primitives", () => {
  it("labels provenance with text, not color alone", () => {
    render(<><ProvenanceBadge kind="documented" /><ProvenanceBadge kind="not_documented" /><ProvenanceBadge kind="rule_inferred" /></>);
    expect(screen.getByText("Documented")).toBeInTheDocument();
    expect(screen.getByText("Not documented")).toBeInTheDocument();
    expect(screen.getByText(/Rule-inferred/)).toBeInTheDocument();
  });

  it("renders task status text", () => {
    render(<StatusBadge status="needs_review" />);
    expect(screen.getByText("Needs review")).toBeInTheDocument();
  });

  it("hides the value of a locked stat card", () => {
    render(<StatCard label="Patients needing review" value={7} locked="Requires clinical access" />);
    expect(screen.getByText("Requires clinical access")).toBeInTheDocument();
    expect(screen.queryByText("7")).not.toBeInTheDocument();
  });

  it("shows a no-show outcome independently of neutral documentation provenance", () => {
    render(<ul><TimelineItem kind="missed_appointment" date="2026-10-19" title="Follow-up appointment" provenance="documented" outcome={{ label: "No-show", tone: "attention" }} /></ul>);
    expect(screen.getByText("Outcome: No-show")).toHaveClass("text-attention");
    expect(screen.getByText("Documented")).toHaveClass("text-body");
    expect(screen.getByText("Documented")).not.toHaveClass("text-teal-strong");
  });
});
