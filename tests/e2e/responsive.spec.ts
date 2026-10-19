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
    await mobile.getByRole("button", { name: /^Product/ }).click();
    await mobile.getByRole("link", { name: "Record import" }).click();
    await expect(page).toHaveURL(/\/product#import$/);
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
});
