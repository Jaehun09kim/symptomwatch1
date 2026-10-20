import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ClinicalAccessNotice } from "@/components/app/clinical-access-notice";

afterEach(cleanup);

describe("ClinicalAccessNotice", () => {
  it("lists every clinical-access grant in the window, not just the newest five", () => {
    const grants = Array.from({ length: 7 }, (_, index) => ({
      userName: `Grantee ${index + 1}`, role: "physician" as const, grantedByName: "Priya Shah",
      via: "role_change" as const, createdAt: new Date(Date.UTC(2026, 9, 19 - index)).toISOString(),
    }));
    render(<ClinicalAccessNotice grants={grants} />);
    for (const grant of grants) expect(screen.getByText(grant.userName)).toBeInTheDocument();
    expect(screen.getByText("Show 2 more")).toBeInTheDocument();
  });

  it("renders nothing without grants", () => {
    const { container } = render(<ClinicalAccessNotice grants={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
