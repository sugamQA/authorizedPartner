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

  // Fill step 1 with valid data - use random phone number
  await page.locator('input[name="firstName"]').fill("John");
  await page.locator('input[name="lastName"]').fill("Doe");
  const email = `john.doe.${Date.now()}@example.com`;
  await page.locator('input[name="email"]').fill(email);
  const phone = `${Date.now()}`.slice(-10);
  await page.locator('input[name="phoneNumber"]').fill(phone);
  console.log("Phone:", phone);
  await page.locator('input[name="password"]').fill("TestPass123!");
  await page.locator('input[name="confirmPassword"]').fill("TestPass123!");

  // Select country code
  await page.locator('select').first().selectOption("+977");
  await page.waitForTimeout(500);

  // Click Next
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(5000);

  console.log("URL:", page.url());

  // Check if there are errors or if we advanced
  const text = await page.locator('body').innerText();
  
  // Check for "Agency Details" or step 2 content
  if (text.includes("Agency Details") || text.includes("Agency")) {
    console.log("✓ Advanced to step 2!");
    
    // Show form fields for step 2
    const inputs = await page.locator('input:visible, select:visible').all();
    for (const inp of inputs) {
      const name = await inp.getAttribute("name").catch(() => "");
      const placeholder = await inp.getAttribute("placeholder").catch(() => "");
      console.log(`  Input: name="${name}" placeholder="${placeholder}"`);
    }
  } else {
    console.log("Still on same step or error");
    // Show error messages
    const errs = await page.locator('[class*="error"], [role="alert"], .text-red, .text-destructive').all();
    for (const e of errs) {
      const t = await e.textContent().catch(() => "");
      if (t?.trim()) console.log("  Error:", t.trim());
    }
  }

  await browser.close();
})();
