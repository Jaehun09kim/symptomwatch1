import { expect, type Page } from "@playwright/test";

export const PASSWORD = "SymptomWatch-Demo-2026";
export const USERS = {
  physician: "physician@harborview.demo.test",
  staff: "frontdesk@harborview.demo.test",
  admin: "admin@harborview.demo.test",
  otherPhysician: "physician@orangegrove.demo.test",
} as const;

export async function signIn(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app/);
}

export async function signOut(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in/);
}

export async function openPatient(page: Page, lastName: string, firstName: string): Promise<void> {
  await page.goto(`/app/patients?q=${encodeURIComponent(lastName)}`);
  await page.getByRole("link", { name: `${lastName}, ${firstName}` }).click();
  await expect(page.getByRole("heading", { level: 1, name: `${firstName} ${lastName}` })).toBeVisible();
}
