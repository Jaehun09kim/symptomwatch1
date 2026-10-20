import { expect, test } from "@playwright/test";
import { signIn, USERS } from "./helpers";

const CODE = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

test.describe("joining with a code", () => {
  test("manager generates a 90-second code and sees it tick", async ({ page }) => {
    await signIn(page, USERS.admin);
    await page.goto("/app/staff");
    const panel = page.getByRole("region", { name: "Invite with a code" });
    await panel.getByLabel("Role for this code").selectOption("physician");
    await expect(panel.getByRole("radio", { name: "I approve each person" })).toBeChecked();
    await panel.getByRole("button", { name: "Generate code" }).click();
    await expect(panel.getByTestId("join-code")).toHaveText(CODE);
    await expect(panel.getByRole("timer")).toHaveText(/^1:(2\d|30)$/);
    await page.waitForTimeout(3_000);
    await expect(panel.getByRole("timer")).toHaveText(/^1:2\d$/);
    await panel.getByRole("button", { name: "Cancel code" }).click();
    await expect(panel.getByText("Code cancelled.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Join requests" })).toBeVisible();
  });
});
