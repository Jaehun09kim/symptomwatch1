import { expect, test } from "@playwright/test";
import { openPatient, signIn, USERS } from "./helpers";

test.describe("follow-up workflows", () => {
  test("front desk creates, works, and completes a task with a recorded outcome", async ({ page }) => {
    await signIn(page, USERS.staff);
    await page.getByRole("button", { name: "New task" }).click();
    const title = `Confirm cardiology slot ${Date.now()}`;
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Type").selectOption("confirm_appointment");
    await page.getByRole("dialog").getByRole("button", { name: "Create task" }).click();
    await expect(page.getByText("Task created.")).toBeVisible();

    const row = page.locator("tr", { hasText: title });
    await row.getByRole("button", { name: "Update" }).click();
    await page.getByRole("dialog").getByLabel("Status").selectOption("completed");
    await page.getByRole("dialog").getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("dialog").getByText("Record an outcome before marking the task completed.")).toBeVisible();
    await page.getByRole("dialog").getByLabel("Outcome").fill("Confirmed by phone (simulated).");
    await page.getByRole("dialog").getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Task updated.")).toBeVisible();

    await page.goto("/app/queue?status=completed");
    await expect(page.locator("tr", { hasText: title })).toContainText("Completed");
  });

  test("physician confirms a gap with a task; staff closing a loop resolves another flag", async ({ page, browser }) => {
    await signIn(page, USERS.physician);
    await page.goto("/app/review?rule=lab-result-missing");
    const card = page.locator("article").first();
    const flagTitle = await card.locator("h3").innerText();
    await card.getByRole("button", { name: "Confirm gap" }).click();
    await page.getByLabel("Review note (optional)").fill("Confirmed in e2e");
    await page.getByRole("dialog").getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(page.getByText("Gap confirmed.")).toBeVisible();
    await page.goto("/app/review?status=confirmed");
    await expect(page.locator("article h3", { hasText: flagTitle })).toBeVisible();

    const staff = await browser.newPage();
    await signIn(staff, USERS.staff);
    await openPatient(staff, "Wright", "Samuel");
    await staff.getByRole("button", { name: "Update status" }).click();
    await staff.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(staff.getByText("Referral updated.")).toBeVisible();

    await page.goto("/app/review?status=resolved_by_data");
    await expect(page.locator("article h3", { hasText: "Ophthalmology referral" })).toBeVisible();
  });

  test("evidence links jump to the supporting timeline entry", async ({ page }) => {
    await signIn(page, USERS.physician);
    await page.goto("/app/review?rule=persistent-symptom-unresolved");
    await page.locator("article").first().getByRole("link").first().click();
    await expect(page).toHaveURL(/patients\/.+#ev-/);
    await expect(page.locator("li .ring-2")).toHaveCount(1);
  });

  test("Try Demo provisions a sandbox and supports viewing as another role", async ({ page }) => {
    await page.goto("/demo");
    await page.getByRole("button", { name: "Start as Physician" }).click();
    await expect(page).toHaveURL(/\/app\?welcome=demo/);
    await expect(page.getByText("Private sandbox").first()).toBeVisible();
    await page.getByRole("button", { name: /View as/ }).click();
    await page.getByRole("button", { name: /Daniel Okafor/ }).click();
    await expect(page).toHaveURL(/\/app\/queue/);
    await expect(page.getByText("Front desk view")).toBeVisible();
  });

  test("admin can reset demo data", async ({ page }) => {
    await signIn(page, USERS.admin);
    await page.goto("/app/settings");
    await page.getByRole("button", { name: "Reset demo data" }).click();
    await expect(page).toHaveURL(/\/app\?reset=1/);
    await page.goto("/app/audit?action=demo.");
    await expect(page.getByText("demo.reset").first()).toBeVisible();
  });
});
