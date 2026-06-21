import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto("https://authorized-partner.vercel.app/register", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // Accept terms and continue
  await page.locator('button[role="checkbox"]').click();
  await page.locator('button:has-text("Continue")').click();
  await page.waitForTimeout(2000);

  // Dump full page text content to understand structure
  const text = await page.locator('body').innerText();
  console.log("=== Page text content ===");
  console.log(text);

  // Look for any navigation/step indicators
  const steps = await page.locator('[class*="step"], [class*="tab"], [class*="progress"]').all();
  console.log("\n=== Step indicators ===");
  for (const s of steps) {
    const t = await s.textContent().catch(() => "");
    const c = await s.getAttribute("class").catch(() => "");
    console.log(`  class="${c}" text="${t?.trim()}"`);
  }

  // Get all headings
  const headings = await page.locator("h1, h2, h3, h4, h5, h6").all();
  console.log("\n=== Headings ===");
  for (const h of headings) {
    const t = await h.textContent().catch(() => "");
    console.log(`  ${await h.evaluate(el => el.tagName)}: "${t?.trim()}"`);
  }

  await browser.close();
})();
