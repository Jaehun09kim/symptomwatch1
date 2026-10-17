import { expect, test } from "@playwright/test";
import { signIn, USERS } from "./helpers";

test.describe("mobile layout", () => {
  for (const path of ["/", "/demo", "/sign-in"]) {
    test(`${path} has no horizontal scroll`, async ({ page }) => {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    });
  }

  test("app navigation opens from the menu button", async ({ page }) => {
    await signIn(page, USERS.physician);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("link", { name: "Follow-up queue" }).click();
    await expect(page).toHaveURL(/\/app\/queue/);
  });
});
