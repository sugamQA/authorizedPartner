import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto("https://authorized-partner.vercel.app/register", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // Step 0: Accept terms
  await page.locator('button[role="checkbox"]').click();
  await page.locator('button:has-text("Continue")').click();
  await page.waitForTimeout(2000);

  let step = 1;
  while (true) {
    console.log(`\n=== STEP ${step} | URL: ${page.url()}`);

    // Get all visible inputs
    const inputs = await page.locator('input:visible, select:visible').all();
    console.log(`Found ${inputs.length} visible inputs`);

    for (const input of inputs) {
      const name = await input.getAttribute("name").catch(() => "");
      const id = await input.getAttribute("id").catch(() => "");
      const placeholder = await input.getAttribute("placeholder").catch(() => "");
      const type = await input.getAttribute("type").catch(() => "");
      console.log(`  Input: name="${name}" id="${id}" type="${type}" placeholder="${placeholder}"`);
    }

    // Look for submit/next button
    const buttons = await page.locator('button:visible').all();
    for (const btn of buttons) {
      const text = await btn.textContent().catch(() => "");
      const type = await btn.getAttribute("type").catch(() => "");
      console.log(`  Button: type="${type}" text="${text?.trim()}"`);
    }

    // Check URL params for step info
    const url = page.url();
    const stepParam = new URL(url).searchParams.get("step");
    if (!stepParam) {
      console.log("No step param - likely at final step or done");
    }

    // Try clicking Next to advance (but we don't fill data this time)
    const nextBtn = page.locator('button[type="submit"]:visible').first();
    if (await nextBtn.isVisible().catch(() => false)) {
      const btnText = await nextBtn.textContent().catch(() => "");
      if (step >= 5) break; // safety limit
      step++;
      // Don't actually submit - we're just inspecting
      break;
    } else {
      console.log("No submit button found - flow complete?");
      break;
    }
  }

  await browser.close();
})();
