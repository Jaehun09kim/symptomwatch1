import { expect, test } from "@playwright/test";
import { signIn, USERS } from "./helpers";

test.describe("mobile layout", () => {
  for (const path of ["/", "/product", "/how-it-works", "/safety", "/about", "/contact", "/demo", "/sign-in"]) {
    test(`${path} has no horizontal scroll`, async ({ page }) => {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    });
  }

  test("the mobile menu expands a section and navigates", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    const mobile = page.getByRole("navigation", { name: "Mobile" });
    await mobile.getByRole("button", { name: /^Company/ }).click();
    await mobile.getByRole("link", { name: "Request a walkthrough" }).click();
    await expect(page).toHaveURL(/\/contact$/);
  });

  test("review selection and detection rules fit a single mobile column", async ({ page }) => {
    await signIn(page, USERS.physician);
    await page.goto("/app/review?status=all");
    const detail = page.getByRole("region", { name: "Selected flag", exact: true });
    const list = page.getByRole("navigation", { name: "Flags", exact: true });
    await expect(detail).toBeVisible();
    const detailBox = await detail.boundingBox();
    const listBox = await list.boundingBox();
    expect(detailBox!.y + detailBox!.height).toBeLessThanOrEqual(listBox!.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await detail.getByRole("link", { name: "Browse flags" }).click();
    const row = list.getByRole("link").nth(1);
    await row.click();
    await expect(row).toHaveAttribute("aria-current", "true");
    await expect(detail.getByText("Rule-inferred · needs review", { exact: true })).toBeInViewport();
    await expect(row).toContainText(await detail.getByRole("heading", { level: 3 }).innerText());
    await page.goto("/app/rules");
    await expect(page.getByRole("heading", { name: "Detection rules", exact: true })).toBeVisible();
    await expect(page.getByRole("spinbutton").first()).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await expect(page.getByRole("region", { name: "Signal quality by rule" })).toHaveAttribute("tabindex", "0");
  });

  test("app navigation opens from the menu button", async ({ page }) => {
    await signIn(page, USERS.physician);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("link", { name: "Follow-up queue" }).click();
    await expect(page).toHaveURL(/\/app\/queue/);
  });

  test("queue cards keep the patient, owner, due date, and outcome action together", async ({ page }) => {
    await signIn(page, USERS.staff);
    const cards = page.getByRole("list", { name: "Follow-up tasks", exact: true });
    await expect(cards).toBeVisible();
    await expect(page.getByRole("region", { name: "Task table" })).toHaveCount(0);
    const card = cards.getByRole("listitem").first();
    await expect(card.getByRole("heading", { level: 3 })).toBeVisible();
    await expect(card.getByText("Owner", { exact: true })).toBeVisible();
    await expect(card.getByText("Due", { exact: true })).toBeVisible();
    const action = card.getByRole("button", { name: /^Record outcome for/ });
    expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(40);
    await action.click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Outcome", { exact: true }).selectOption("attempted");
    await dialog.getByRole("button", { name: "Save outcome" }).click();
    await expect(page.getByText("Outcome recorded.")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await page.getByRole("navigation", { name: "Quick task views" }).getByRole("link", { name: "Mine", exact: true }).click();
    await expect(page).toHaveURL(/assignee=me/);
  });

  test("review decisions stay reachable and next preserves the rule filter", async ({ page }) => {
    await signIn(page, USERS.physician);
    await page.goto("/app/review?rule=lab-result-missing");
    const detail = page.getByRole("region", { name: "Selected flag", exact: true });
    await expect(page.getByRole("group", { name: "Filter flags" })).toBeVisible();
    await expect(detail.getByRole("button", { name: "Confirm gap", exact: true })).toBeInViewport();
    const position = detail.getByRole("navigation", { name: "Review position" });
    await expect(position).toContainText(/1 of \d+/);
    const firstId = new URL(page.url()).searchParams.get("flag");
    await position.getByRole("link", { name: "Next", exact: true }).click();
    await expect(position).toContainText(/2 of \d+/);
    expect(new URL(page.url()).searchParams.get("flag")).not.toBe(firstId);
    expect(new URL(page.url()).searchParams.get("rule")).toBe("lab-result-missing");
    await expect(detail.getByRole("button", { name: "Confirm gap", exact: true })).toBeInViewport();
  });
});
