import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { openPatient, signIn, USERS } from "./helpers";

async function expectNoSeriousViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const serious = results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
  expect(serious.map((violation) => `${label}: ${violation.id} — ${violation.help} (${violation.nodes.length})`)).toEqual([]);
}

test.describe("accessibility (axe, WCAG 2.2 AA)", () => {
  for (const path of ["/", "/demo", "/privacy", "/sign-in", "/sign-up"]) {
    test(`public page ${path}`, async ({ page }) => {
      await page.goto(path);
      await expectNoSeriousViolations(page, path);
    });
  }

  test("authenticated pages", async ({ page }) => {
    await signIn(page, USERS.physician);
    for (const path of ["/app", "/app/queue", "/app/review", "/app/patients", "/app/settings"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expectNoSeriousViolations(page, path);
    }
    await openPatient(page, "Kim", "Rachel");
    await expectNoSeriousViolations(page, "patient timeline");
  });

  test("keyboard: skip link and dialog focus", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
    await signIn(page, USERS.staff);
    await page.getByRole("button", { name: "New task" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
