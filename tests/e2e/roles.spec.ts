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
    await expect(page.getByText("Rule-inferred · needs review").first()).toBeVisible();
  });

  test("clinics are isolated: another clinic's patients are not visible", async ({ page }) => {
    await signIn(page, USERS.otherPhysician);
    await page.goto("/app/patients?q=Foster");
    await expect(page.getByText("No patients match these filters")).toBeVisible();
    await page.goto("/app/patients");
    await expect(page.getByRole("heading", { name: /Patients/ }).last()).toContainText("6");
  });
});
