import { expect, test } from "@playwright/test";
import { openPatient, signIn, USERS } from "./helpers";

test.describe("role-based access", () => {
  test("front desk sees administrative detail only", async ({ page }) => {
    await signIn(page, USERS.staff);
    await expect(page.getByRole("link", { name: "Review flags" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Staff" })).toHaveCount(0);
    await page.goto("/app/review");
    await expect(page).toHaveURL(/access-denied/);
    await page.goto("/app");
    await expect(page.getByText("Patients needing review").locator("..")).toContainText("Visible to clinical roles");

    await openPatient(page, "Foster", "William");
    await expect(page.getByText(/Front-desk view: visits, symptoms/)).toBeVisible();
    await expect(page.getByText("Referral to Gastroenterology")).toBeVisible();
    await expect(page.getByText("Change in bowel habits")).toHaveCount(0);
    await expect(page.getByText("Possible gaps for review")).toHaveCount(0);
  });

  test("physicians see the clinical timeline and flags", async ({ page }) => {
    await signIn(page, USERS.physician);
    await openPatient(page, "Foster", "William");
    await expect(page.getByText("Office visit — Change in bowel habits")).toBeVisible();
    await expect(page.getByText("Possible gaps for review")).toBeVisible();
    const gaps = page.locator('details[name="patient-gaps"]');
    await expect(gaps.first()).not.toHaveAttribute("open", "");
    await gaps.first().locator("summary").first().click();
    await expect(page.getByText("Rule-inferred · needs review").first()).toBeVisible();
  });

  test("admin can inspect review details and rules but cannot make clinical decisions", async ({ page }) => {
    await signIn(page, USERS.admin);
    await page.goto("/app/review?status=all");
    await expect(page.getByText("You can view flags and run detection. Confirming, dismissing, and feedback are reserved for physicians.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Run detection" })).toBeVisible();
    const detail = page.getByRole("region", { name: "Selected flag", exact: true });
    await expect(detail.getByText("Rule-inferred · needs review", { exact: true })).toBeVisible();
    await expect(detail.getByRole("button", { name: /Confirm gap|Add task|Snooze|Wake now|Dismiss|Feedback/ })).toHaveCount(0);
    await page.goto("/app/rules");
    await expect(page.getByText("Only physicians can change detection rules. Changes are recorded in the audit log.")).toBeVisible();
    await expect(page.getByRole("checkbox")).toHaveCount(4);
    await expect(page.getByRole("spinbutton")).toHaveCount(6);
    for (const checkbox of await page.getByRole("checkbox").all()) await expect(checkbox).toBeDisabled();
    for (const input of await page.getByRole("spinbutton").all()) await expect(input).toBeDisabled();
    await expect(page.getByRole("button", { name: "Save and re-run detection" })).toHaveCount(0);
  });

  test("clinics are isolated: another clinic's patients are not visible", async ({ page }) => {
    await signIn(page, USERS.otherPhysician);
    await page.goto("/app/patients?q=Foster");
    await expect(page.getByText("No patients match these filters")).toBeVisible();
    await page.goto("/app/patients");
    await expect(page.getByRole("heading", { name: /Patients/ }).last()).toContainText("6");
  });
});
