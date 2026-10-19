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
    await row.getByRole("button", { name: /^Update follow-up for/ }).click();
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
    const card = page.getByRole("region", { name: "Selected flag", exact: true });
    await expect(card.getByText("Rule-inferred · needs review", { exact: true })).toBeVisible();
    const flagId = new URL(page.url()).searchParams.get("flag")!;
    const flagTitle = await card.locator("h3").innerText();
    await card.getByRole("button", { name: "Confirm gap" }).click();
    await expect(page.getByRole("dialog").getByLabel("Task type")).toHaveValue("lab_follow_up");
    await expect(page.getByRole("dialog").getByLabel("Task title (optional)")).toHaveValue(/Check lab status/);
    await expect(page.getByRole("dialog").getByLabel("Assign to")).not.toHaveValue("");
    await page.getByLabel("Review note (optional)").fill("Confirmed in e2e");
    await page.getByLabel("Task title (optional)").fill("Review confirmation follow-up (fictional)");
    await page.getByRole("dialog").getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(page.getByText("Gap confirmed.")).toBeVisible();
    await page.goto(`/app/review?status=confirmed&flag=${flagId}`);
    await expect(card.getByRole("heading", { name: flagTitle, exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Flag status" }).getByRole("link", { name: "Gap confirmed", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(card.getByText("Gap confirmed", { exact: true })).toHaveCount(0);
    await expect(card.getByRole("button", { name: "Add task", exact: true })).toBeVisible();
    await page.goto("/app/queue");
    await expect(page.getByRole("row", { name: /Review confirmation follow-up \(fictional\)/ })).toBeVisible();

    const staff = await browser.newPage();
    await signIn(staff, USERS.staff);
    await openPatient(staff, "Wright", "Samuel");
    await staff.getByRole("button", { name: "Update status" }).click();
    await staff.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(staff.getByText("Referral updated.")).toBeVisible();

    await page.goto("/app/review?status=resolved_by_data");
    await page.getByRole("navigation", { name: "Flags", exact: true }).getByRole("link", { name: /Ophthalmology referral/ }).click();
    await expect(card.getByRole("heading", { name: /Ophthalmology referral/ })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Flag status" }).getByRole("link", { name: "Resolved by new data", exact: true })).toHaveAttribute("aria-current", "page");
    await staff.close();
  });

  test("evidence links jump to the supporting timeline entry", async ({ page }) => {
    await signIn(page, USERS.physician);
    await page.goto("/app/review?rule=persistent-symptom-unresolved");
    await page.getByRole("region", { name: "Selected flag", exact: true }).getByRole("region", { name: "Supporting record entries" }).getByRole("link").first().click();
    await expect(page).toHaveURL(/patients\/.+#ev-/);
    await expect(page.locator("li .ring-2")).toHaveCount(1);
  });

  test("physician submits feedback and dismisses a flag with a structured reason", async ({ page }) => {
    await page.goto("/demo");
    await page.getByRole("button", { name: "Start as Physician" }).click();
    await expect(page).toHaveURL(/\/app\?welcome=demo/);
    await page.goto("/app/review");
    const detail = page.getByRole("region", { name: "Selected flag", exact: true });
    await expect(detail.getByText("Rule-inferred · needs review", { exact: true })).toBeVisible();
    const flagId = new URL(page.url()).searchParams.get("flag")!;
    const flagTitle = await detail.getByRole("heading", { level: 3 }).innerText();
    await detail.getByRole("button", { name: "Feedback", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Verdict").selectOption("already_addressed");
    await dialog.getByLabel("Comment (optional)").fill("Documented in a fictional outside record.");
    await dialog.getByRole("button", { name: "Send feedback" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("complementary", { name: "About detection" })).toContainText("already addressed: 1");

    await detail.getByRole("button", { name: "Dismiss", exact: true }).click();
    await dialog.getByLabel("Reason", { exact: true }).selectOption("other");
    await dialog.getByRole("button", { name: "Dismiss", exact: true }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("textbox", { name: /Note/ })).toHaveAttribute("aria-invalid", "true");
    await dialog.getByRole("textbox", { name: /Note/ }).fill("Outcome documented in a fictional outside record.");
    await dialog.getByRole("button", { name: "Dismiss", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Flags", exact: true }).locator(`a[href*="flag=${flagId}"]`)).toHaveCount(0);
    await page.getByRole("navigation", { name: "Flag status" }).getByRole("link", { name: "Dismissed", exact: true }).click();
    await page.getByRole("navigation", { name: "Flags", exact: true }).locator(`a[href*="flag=${flagId}"]`).click();
    await expect(detail.getByRole("heading", { name: flagTitle, exact: true })).toBeVisible();
    await expect(detail).toContainText("Dismissed: Other — Outcome documented in a fictional outside record.");
    await expect(detail.getByText("Rule-inferred · needs review", { exact: true })).toBeVisible();
    await detail.getByText(/Review history \(/).click();
    await expect(detail.getByRole("list").last()).toContainText("Dismissed");
  });

  test("physician snoozes a flag, finds it under Snoozed, and wakes it", async ({ page }) => {
    await page.goto("/demo");
    await page.getByRole("button", { name: "Start as Physician" }).click();
    await expect(page).toHaveURL(/\/app\?welcome=demo/);
    await page.goto("/app/review?rule=lab-result-missing");
    const detail = page.getByRole("region", { name: "Selected flag", exact: true });
    await expect(detail.getByRole("button", { name: "Snooze", exact: true })).toBeVisible();
    const flagId = new URL(page.url()).searchParams.get("flag")!;
    const flagTitle = await detail.getByRole("heading", { level: 3 }).innerText();
    await detail.getByRole("button", { name: "Snooze", exact: true }).click();
    const dialog = page.getByRole("dialog");
    const until = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
    await dialog.getByLabel("Return to the queue on").fill(until);
    await dialog.getByLabel("Why wait? (optional)").fill("Fictional lab result expected next week.");
    await dialog.getByRole("button", { name: "Snooze", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const rows = page.getByRole("navigation", { name: "Flags", exact: true });
    await expect(rows.locator(`a[href*="flag=${flagId}"]`)).toHaveCount(0);
    await page.getByRole("navigation", { name: "Flag status" }).getByRole("link", { name: "Snoozed", exact: true }).click();
    await expect(page).toHaveURL(/status=snoozed/);
    expect(new URL(page.url()).searchParams.get("rule")).toBe("lab-result-missing");
    await rows.locator(`a[href*="flag=${flagId}"]`).click();
    const returnDate = new Date(`${until}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
    await expect(rows.locator('[aria-current="true"]')).toContainText(`Snoozed until ${returnDate}`);
    await expect(detail.getByRole("heading", { name: flagTitle, exact: true })).toBeVisible();
    await expect(detail).toContainText(`Snoozed until ${returnDate}`);
    await expect(detail).toContainText("Fictional lab result expected next week.");
    await expect(detail.getByRole("button", { name: "Snooze", exact: true })).toHaveCount(0);
    await detail.getByRole("button", { name: "Wake now" }).click();
    await expect(page.getByText("No flags match these filters")).toBeVisible();
    await page.getByRole("navigation", { name: "Flag status" }).getByRole("link", { name: "Awaiting review", exact: true }).click();
    await rows.locator(`a[href*="flag=${flagId}"]`).click();
    await expect(detail.getByRole("button", { name: "Snooze", exact: true })).toBeVisible();
    await expect(detail.getByRole("button", { name: "Wake now" })).toHaveCount(0);
    await expect(detail.getByText("Awaiting review", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Flag status" }).getByRole("link", { name: "Awaiting review", exact: true })).toHaveAttribute("aria-current", "page");
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
