import { expect, test, type Browser, type Page } from "@playwright/test";
import { signIn, USERS } from "./helpers";

const CODE = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;
const CLINIC = "Harbor View Family Medicine — DEMO";

async function generateCode(page: Page, role: "physician" | "staff", mode: "I approve each person" | "Let them in right away"): Promise<string> {
  await page.goto("/app/staff");
  const panel = page.getByRole("region", { name: "Invite with a code" });
  await panel.getByLabel("Role for this code").selectOption(role);
  await panel.getByRole("radio", { name: mode }).check();
  await panel.getByRole("button", { name: /Generate (new )?code/ }).click();
  await expect(panel.getByTestId("join-code")).toHaveText(CODE);
  return (await panel.getByTestId("join-code").innerText()).trim();
}

/** Sign-in page → "Join with a code" → code → new account → confirmation link from the dev outbox. */
async function joinAsNewPerson(browser: Browser, code: string, name: string, roleLabel: string): Promise<Page> {
  const page = await browser.newPage();
  await page.goto("/sign-in");
  await page.getByRole("link", { name: "Join with a code" }).click();
  await expect(page).toHaveURL(/\/join$/);
  await page.getByLabel("Your code").fill(code);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText(CLINIC)).toBeVisible();
  await expect(page.getByText(`Joining as ${roleLabel}`)).toBeVisible();
  const email = `${name.toLowerCase().replace(/\s+/g, ".")}.${Date.now()}@example.test`;
  // Next.js keeps the visited sign-in page mounted but hidden, so scope to the join form.
  const form = page.locator("form", { has: page.getByLabel("Your name") });
  await form.getByLabel("Your name").fill(name);
  await form.getByLabel("Email", { exact: true }).fill(email);
  await form.getByLabel("Password", { exact: true }).fill("a-long-joiner-password");
  await form.getByLabel(/I understand this is a demo/).check();
  await form.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await page.goto("/dev/outbox");
  const link = page.getByRole("listitem").filter({ hasText: email }).getByRole("link", { name: /verify-email/ }).first();
  await page.goto(await link.getAttribute("href") ?? "");
  await page.getByRole("button", { name: "Confirm my email" }).click();
  return page;
}

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

  test("instant code: a new colleague joins after confirming email", async ({ page, browser }) => {
    await signIn(page, USERS.admin);
    const code = await generateCode(page, "staff", "Let them in right away");
    const joiner = await joinAsNewPerson(browser, code, "Instant Joiner", "Front desk");
    await expect(joiner).toHaveURL(/\/app\/queue/);
    const nav = joiner.getByRole("navigation", { name: "Application" });
    await expect(nav.getByRole("link", { name: "Follow-up queue" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Review flags" })).toHaveCount(0);
  });

  test("approval code: waiting screen until approved", async ({ page, browser }) => {
    await signIn(page, USERS.admin);
    const code = await generateCode(page, "physician", "I approve each person");
    const joiner = await joinAsNewPerson(browser, code, "Waiting Doctor", "Physician");
    await expect(joiner.getByRole("heading", { name: `Waiting for ${CLINIC} to approve you` })).toBeVisible();

    await page.goto("/app/staff");
    const requests = page.getByRole("region", { name: /Join requests/ });
    await requests.getByRole("button", { name: "Approve Waiting Doctor" }).click();
    await expect(page.getByText("Approved — they can enter the clinic now.").first()).toBeVisible();

    await joiner.reload();
    await joiner.getByRole("button", { name: "Enter clinic" }).click();
    await expect(joiner).toHaveURL(/\/app/);
    await expect(joiner.getByRole("navigation", { name: "Application" }).getByRole("link", { name: "Review flags" })).toBeVisible();

    const doctor = await browser.newPage();
    await signIn(doctor, USERS.physician);
    await expect(doctor.getByRole("region", { name: "New clinical access" })).toContainText("Waiting Doctor");
  });

  test("cancelled codes are refused with the generic message", async ({ page, browser }) => {
    await signIn(page, USERS.admin);
    const code = await generateCode(page, "staff", "Let them in right away");
    const panel = page.getByRole("region", { name: "Invite with a code" });
    await panel.getByRole("button", { name: "Cancel code" }).click();
    await expect(panel.getByText("Code cancelled.")).toBeVisible();
    const joiner = await browser.newPage();
    await joiner.goto("/join");
    await joiner.getByLabel("Your code").fill(code);
    await joiner.getByRole("button", { name: "Continue" }).click();
    await expect(joiner.getByText(/That code isn't valid\. Codes expire 90 seconds after they're created/)).toBeVisible();
  });

  test("cancelling one code doesn't mark the next one cancelled", async ({ page }) => {
    await signIn(page, USERS.admin);
    await generateCode(page, "staff", "Let them in right away");
    const panel = page.getByRole("region", { name: "Invite with a code" });
    await panel.getByRole("button", { name: "Cancel code" }).click();
    await expect(panel.getByText("Code cancelled.")).toBeVisible();
    await panel.getByRole("button", { name: "Generate new code" }).click();
    await expect(panel.getByRole("timer")).toBeVisible();
    await expect(panel.getByText("Code cancelled.")).toHaveCount(0);
    await expect(panel.getByRole("button", { name: "Cancel code" })).toBeVisible();
  });

  test("a link opened on another device confirms the email; the original window finishes", async ({ page, browser }) => {
    await signIn(page, USERS.admin);
    const code = await generateCode(page, "staff", "Let them in right away");
    const joiner = await browser.newPage();
    await joiner.goto("/join");
    await joiner.getByLabel("Your code").fill(code);
    await joiner.getByRole("button", { name: "Continue" }).click();
    const form = joiner.locator("form", { has: joiner.getByLabel("Your name") });
    const email = `two.devices.${Date.now()}@example.test`;
    await form.getByLabel("Your name").fill("Two Devices");
    await form.getByLabel("Email", { exact: true }).fill(email);
    await form.getByLabel("Password", { exact: true }).fill("a-long-joiner-password");
    await form.getByLabel(/I understand this is a demo/).check();
    await form.getByRole("button", { name: "Continue" }).click();
    await expect(joiner.getByRole("heading", { name: "Check your email" })).toBeVisible();

    // "Another device": a fresh browser context without the join cookie.
    const phone = await (await browser.newContext()).newPage();
    await phone.goto("/dev/outbox");
    const link = await phone.getByRole("listitem").filter({ hasText: email }).getByRole("link", { name: /verify-email/ }).first().getAttribute("href");
    await phone.goto(link ?? "");
    await phone.getByRole("button", { name: "Confirm my email" }).click();
    await expect(phone.getByText(/Email confirmed\. Return to the window where you entered your code/)).toBeVisible();
    await expect(phone).not.toHaveURL(/\/app/);

    await joiner.getByRole("button", { name: /confirmed my email — continue/ }).click();
    await expect(joiner).toHaveURL(/\/app\/queue/);
  });
});
