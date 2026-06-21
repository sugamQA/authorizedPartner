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
  const phone = `${Date.now()}`.slice(-10);
  await page.locator('input[name="phoneNumber"]').fill(phone);
  console.log("Phone:", phone);
  await page.locator('input[name="password"]').fill("TestPass123!");
  await page.locator('input[name="confirmPassword"]').fill("TestPass123!");

  // Click the country code button to open dropdown
  const countryBtn = page.locator('button:has-text("🇳🇵")');
  await countryBtn.click();
  await page.waitForTimeout(500);

  // Select option from the dropdown - click on an option with value "+977"
  const option = page.locator('[role="option"], [class*="option"], .select-item').filter({ hasText: "+977" }).first();
  if (await option.isVisible().catch(() => false)) {
    await option.click();
    console.log("✓ Selected country code +977");
  } else {
    // Try typing to search
    await page.keyboard.type("+977");
    await page.waitForTimeout(300);
    await page.keyboard.press("Enter");
    console.log("✓ Selected via keyboard");
  }

  await page.waitForTimeout(500);

  // Click Next
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(5000);

  console.log("URL:", page.url());

  // Check page content
  const text = await page.locator('body').innerText();
  
  if (text.includes("Agency")) {
    console.log("✓ Advanced to step 2!");
    
    // Show full text
    console.log("\n=== Page content ===");
    console.log(text.substring(0, 2000));
    
    const inputs = await page.locator('input:visible, select:visible').all();
    console.log("\n=== Visible form elements ===");
    for (const inp of inputs) {
      const name = await inp.getAttribute("name").catch(() => "");
      const placeholder = await inp.getAttribute("placeholder").catch(() => "");
      const id = await inp.getAttribute("id").catch(() => "");
      console.log(`  name="${name}" placeholder="${placeholder}" id="${id}"`);
    }
    const buttons = await page.locator('button:visible').all();
    console.log("\n=== Buttons ===");
    for (const btn of buttons) {
      const t = await btn.textContent().catch(() => "");
      if (t?.trim()) console.log(`  "${t.trim()}"`);
    }
  } else {
    console.log("Still on same step or error");
    const errs = await page.locator('[class*="error"], [role="alert"], .text-red, .text-destructive').all();
    for (const e of errs) {
      const t = await e.textContent().catch(() => "");
      if (t?.trim()) console.log("  Error:", t.trim());
    }
    console.log("Page starts with:", text.substring(0, 500));
  }

  await browser.close();
})();
