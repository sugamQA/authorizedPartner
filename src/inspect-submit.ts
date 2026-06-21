import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto("https://authorized-partner.vercel.app/register", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // Accept terms
  await page.locator('button[role="checkbox"]').click();
  await page.locator('button:has-text("Continue")').click();
  await page.waitForTimeout(2000);

  // Fill step 1 with valid data
  await page.locator('input[name="firstName"]').fill("John");
  await page.locator('input[name="lastName"]').fill("Doe");
  const email = `john.doe.${Date.now()}@example.com`;
  await page.locator('input[name="email"]').fill(email);
  console.log("Using email:", email);
  await page.locator('input[name="phoneNumber"]').fill("1234567890");
  await page.locator('input[name="password"]').fill("TestPass123!");
  await page.locator('input[name="confirmPassword"]').fill("TestPass123!");

  // Try clicking Next
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(5000);

  console.log("\nURL after submit:", page.url());

  // Check for any errors
  const errors = await page.locator('[class*="error"], [class*="Error"], [role="alert"]').all();
  for (const e of errors) {
    console.log("Error:", await e.textContent().catch(() => ""));
  }

  // Check if the page content changed
  const text = await page.locator('body').innerText();
  console.log("\n=== Page content after submit ===");
  // Show first 1500 chars only
  console.log(text.substring(0, 500));
  console.log("... (truncated)");

  await browser.close();
})();
