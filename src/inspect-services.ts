import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto("https://authorized-partner.vercel.app/register", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.locator('button[role="checkbox"]').click();
  await page.locator('button:has-text("Continue")').click();
  await page.waitForTimeout(2000);

  // Quick signup to get to step 3
  const ts = Date.now();
  await page.locator('input[name="firstName"]').fill("John");
  await page.locator('input[name="lastName"]').fill("Doe");
  await page.locator('input[name="email"]').fill(`john.${ts}@example.com`);
  await page.locator('input[name="phoneNumber"]').fill(`98${ts.toString().slice(-8)}`);
  await page.locator('input[name="password"]').fill("TestPass123!");
  await page.locator('input[name="confirmPassword"]').fill("TestPass123!");
  await page.locator('button:has-text("🇳🇵")').click();
  await page.waitForTimeout(300);
  await page.locator('[role="option"]').filter({ hasText: "+977" }).first().click();
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(3000);

  // Just inspect the services section HTML
  const html = await page.evaluate(() => {
    // Look for the services section
    const text = document.body.innerText;
    const idx = text.indexOf("Services Provided");
    if (idx >= 0) return text.substring(idx, idx + 500);
    return text.substring(0, 3000);
  });
  console.log("Page text around Services:");
  console.log(html);
  
  // Find the service checkbox HTML structure
  const serviceHtml = await page.evaluate(() => {
    // Find elements near "Services Provided"
    const all = Array.from(document.querySelectorAll('*'));
    for (const el of all) {
      if (el.textContent?.includes("Services Provided") && el.children.length > 0) {
        return el.innerHTML.substring(0, 2000);
      }
    }
    // Alternative: find all buttons with role checkbox
    const buttons = Array.from(document.querySelectorAll('button[role="checkbox"]'));
    return buttons.map(b => ({
      id: b.id,
      "aria-checked": b.getAttribute("aria-checked"),
      "data-state": b.getAttribute("data-state"),
      outerHTML: b.outerHTML.substring(0, 300),
      parentHTML: b.parentElement?.outerHTML?.substring(0, 300),
    }));
  });
  console.log("\nService checkboxes structure:");
  console.log(JSON.stringify(serviceHtml, null, 2));

  await browser.close();
})();
