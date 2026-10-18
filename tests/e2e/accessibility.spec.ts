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
    for (const path of ["/app", "/app/queue", "/app/review", "/app/rules", "/app/patients", "/app/settings"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expectNoSeriousViolations(page, path);
    }
    await openPatient(page, "Kim", "Rachel");
    await expectNoSeriousViolations(page, "patient timeline");
  });

  test("review selection supports keyboard, refresh, and back/forward with filters intact", async ({ page }) => {
    await signIn(page, USERS.physician);
    await page.goto("/app/review?status=all&rule=lab-result-missing&flag=unknown");
    const rows = page.getByRole("navigation", { name: "Flags", exact: true }).getByRole("link");
    const detail = page.getByRole("region", { name: "Selected flag", exact: true });
    await expect(rows.first()).toHaveAttribute("aria-current", "true");
    const listBox = await page.getByRole("navigation", { name: "Flags", exact: true }).boundingBox();
    const detailBox = await detail.boundingBox();
    expect(listBox!.x + listBox!.width).toBeLessThanOrEqual(detailBox!.x);
    const firstId = new URL(page.url()).searchParams.get("flag");
    expect(firstId).toBeTruthy();
    expect(firstId).not.toBe("unknown");
    const secondHref = await rows.nth(1).getAttribute("href");
    const secondId = new URL(secondHref!, page.url()).searchParams.get("flag");
    await rows.first().focus();
    await page.keyboard.press("Tab");
    await expect(rows.nth(1)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(rows.nth(1)).toHaveAttribute("aria-current", "true");
    expect(new URL(page.url()).searchParams.get("flag")).toBe(secondId);
    expect(new URL(page.url()).searchParams.get("status")).toBe("all");
    expect(new URL(page.url()).searchParams.get("rule")).toBe("lab-result-missing");
    const title = await detail.getByRole("heading", { level: 3 }).innerText();
    await expect(rows.nth(1)).toContainText(title);
    await expect(detail.getByText("Rule-inferred · needs review", { exact: true })).toHaveCount(1);
    await page.reload();
    await expect(rows.nth(1)).toHaveAttribute("aria-current", "true");
    await expect(detail.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await page.goBack();
    await expect(rows.first()).toHaveAttribute("aria-current", "true");
    expect(new URL(page.url()).searchParams.get("flag")).toBe(firstId);
    await page.goForward();
    await expect(rows.nth(1)).toHaveAttribute("aria-current", "true");
    await expect(detail.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expectNoSeriousViolations(page, "selected review detail");
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
