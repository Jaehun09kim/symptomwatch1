import { render, screen } from "@testing-library/react";
import { Users } from "lucide-react";
import { describe, expect, it } from "vitest";
import { ProvenanceBadge, StatusBadge } from "@/components/app/primitives/badges";
import { StatCard } from "@/components/app/primitives/stat-card";

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
    render(<StatCard label="Patients needing review" value={7} icon={Users} locked="Requires clinical access" />);
    expect(screen.getByText("Requires clinical access")).toBeInTheDocument();
    expect(screen.queryByText("7")).not.toBeInTheDocument();
  });
});
