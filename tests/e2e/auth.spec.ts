import { expect, test } from "@playwright/test";
import { PASSWORD, signIn, signOut, USERS } from "./helpers";

test.describe("authentication", () => {
  test("protected pages redirect anonymous visitors to sign-in", async ({ page }) => {
    await page.goto("/app/queue");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("rejects a wrong password with a generic message", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(USERS.physician);
    await page.getByLabel("Password", { exact: true }).fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("That email and password don't match an account.")).toBeVisible();
  });

  test("each role lands on its own starting page, and sign-out ends the session", async ({ page }) => {
    await signIn(page, USERS.physician);
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByText("Physician view")).toBeVisible();
    await signOut(page);
    await page.goto("/app");
    await expect(page).toHaveURL(/\/sign-in/);

    await signIn(page, USERS.staff);
    await expect(page).toHaveURL(/\/app\/queue/);
    await expect(page.getByText("Front desk view")).toBeVisible();
  });

  test("creates a demo account with a private sandbox clinic", async ({ page }) => {
    await page.goto("/sign-up");
    await page.getByLabel("Your name").fill("Jordan Tester");
    await page.getByLabel("Email").fill(`jordan.${Date.now()}@example.test`);
    await page.getByLabel("Password", { exact: true }).fill("a-long-demo-password");
    await page.getByLabel(/Demo clinic name/).fill("Coastline Clinic");
    await page.getByLabel(/I understand this is a demo/).check();
    await page.getByRole("button", { name: "Create demo account" }).click();
    await expect(page).toHaveURL(/\/app\?welcome=1/);
    await expect(page.getByText("Your private demo clinic is ready.")).toBeVisible();
    await expect(page.getByText("Coastline Clinic — DEMO").first()).toBeVisible();
    await expect(page.getByText("Total demo patients").locator("..")).toContainText("30");
  });

  test("admin-issued reset link lets a staff member choose a new password", async ({ page, browser }) => {
    // Create a real (non-placeholder) staff account through an invitation first.
    await signIn(page, USERS.admin);
    await page.goto("/app/staff");
    await page.getByRole("button", { name: "Invite staff" }).click();
    const email = `nurse.${Date.now()}@example.test`;
    await page.getByLabel("Work email").fill(email);
    await page.getByRole("button", { name: "Create invitation" }).click();
    const inviteLink = await page.locator("code").filter({ hasText: "/invite/" }).innerText();

    const invitee = await browser.newPage();
    await invitee.goto(inviteLink);
    await invitee.getByLabel("Your name").fill("New Nurse");
    await invitee.getByLabel("Password", { exact: true }).fill("first-password-123");
    await invitee.getByLabel(/I understand this is a demo/).check();
    await invitee.getByRole("button", { name: "Create account and join clinic" }).click();
    await expect(invitee).toHaveURL(/\/app\/queue/);

    await page.keyboard.press("Escape");
    await page.reload();
    const row = page.locator("li", { hasText: email });
    await row.getByRole("button", { name: "Reset link" }).click();
    await page.getByRole("button", { name: "Create link" }).click();
    const resetLink = await page.locator("code").filter({ hasText: "/reset-password/" }).innerText();

    await invitee.goto(resetLink);
    await invitee.getByLabel("New password", { exact: true }).fill("second-password-456");
    await invitee.getByLabel("Confirm new password").fill("second-password-456");
    await invitee.getByRole("button", { name: "Set new password" }).click();
    await expect(invitee).toHaveURL(/\/sign-in\?reset=1/);
    await signIn(invitee, email, "second-password-456");
    expect(PASSWORD).toBeTruthy();
  });
});
