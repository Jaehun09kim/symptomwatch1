import { expect, test } from "@playwright/test";

test.describe("public website", () => {
  test("homepage says what SymptomWatch is, shows the product, and keeps every disclosure", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/SymptomWatch/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Follow-up tracking for small primary care clinics.");
    await expect(page.getByText("Demo Only — No Real Patient Data.").first()).toBeVisible();
    for (const heading of ["What SymptomWatch looks for", "How it works", "One shared list for the whole team", "Before you try it"]) {
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }
    for (const disclosure of ["not clinically validated", "not HIPAA-compliant", "fictional data only", "No patient contact.", "External AI is disabled."]) {
      await expect(page.locator("#safety")).toContainText(disclosure);
    }
    await expect(page.getByRole("figure", { name: /how one flag gets closed/ })).toBeVisible();
    await expect(page.getByRole("figure", { name: /Preview of the SymptomWatch dashboard/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Try the demo" }).first()).toHaveAttribute("href", "/demo");
    await expect(page.getByRole("link", { name: "Create a demo account" }).first()).toHaveAttribute("href", "/sign-up");
    await expect(page.getByRole("link", { name: "Sign in" }).first()).toHaveAttribute("href", "/sign-in");
  });

  test("demo request form validates, blocks patient information, and saves", async ({ page }) => {
    await page.goto("/#contact");
    const form = page.locator("#contact form");
    await form.getByRole("button", { name: "Request a walkthrough" }).click();
    await expect(form.getByText("Enter your name")).toBeVisible();

    await form.getByLabel("Your name").fill("Avery Practice");
    await form.getByLabel("Work email").fill("avery@clinic.example");
    await form.getByLabel("Clinic name").fill("Sample Family Practice");
    await form.getByLabel("Your role").selectOption("Practice manager");
    await form.getByLabel("Clinic size").selectOption("2–3 physicians");
    await form.getByLabel(/What would you like to see/).fill("Patient DOB 01/02/1960 needs a call");
    await form.getByLabel(/I will not include any patient information/).check();
    await form.getByRole("button", { name: "Request a walkthrough" }).click();
    await expect(form.getByText(/fictional data only/)).toBeVisible();

    await form.getByLabel(/What would you like to see/).fill("We track referrals on a whiteboard.");
    await form.getByRole("button", { name: "Request a walkthrough" }).click();
    await expect(page.getByRole("status")).toContainText("This prototype does not send email");
  });

  test("search engines may index public pages but not the app", async ({ page, request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /app");
    expect(robots).toContain("Allow: /");
    const appResponse = await request.get("/app", { maxRedirects: 0 });
    expect(appResponse.headers()["x-robots-tag"]).toContain("noindex");
    const home = await request.get("/");
    expect(home.headers()["x-robots-tag"]).toBeUndefined();
    expect(home.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: "Not HIPAA-compliant" })).toBeVisible();
  });
});
