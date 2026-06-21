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

  // Fill step 1 (setup)
  console.log("=== Step 1: Setup ===");
  await page.locator('input[name="firstName"]').fill("John");
  await page.locator('input[name="lastName"]').fill("Doe");
  await page.locator('input[name="email"]').fill(`john.doe.${Date.now()}@example.com`);
  await page.locator('input[name="phoneNumber"]').fill("1234567890");
  await page.locator('input[name="password"]').fill("TestPass123!");
  await page.locator('input[name="confirmPassword"]').fill("TestPass123!");
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(3000);
  console.log("  URL:", page.url());

  // Step 2
  console.log("\n=== Step 2 ===");
  const inputs2 = await page.locator('input:visible, select:visible').all();
  for (const inp of inputs2) {
    const name = await inp.getAttribute("name").catch(() => "");
    const id = await inp.getAttribute("id").catch(() => "");
    const placeholder = await inp.getAttribute("placeholder").catch(() => "");
    console.log(`  Input: name="${name}" id="${id}" placeholder="${placeholder}"`);
  }
  const btns2 = await page.locator('button:visible').all();
  for (const btn of btns2) {
    const text = await btn.textContent().catch(() => "");
    console.log(`  Button: "${text?.trim()}"`);
  }

  await page.locator('button[type="submit"]').click().catch(async () => {
    // Try clicking any visible button with text Next/Submit
    for (const btn of btns2) {
      const text = (await btn.textContent().catch(() => ""))?.trim();
      if (["Next", "Submit", "Continue", "Create", "Register"].includes(text || "")) {
        await btn.click();
        break;
      }
    }
  });

  await page.waitForTimeout(3000);
  if (page.url() !== "about:blank") {
    console.log("  URL:", page.url());

    // Step 3
    console.log("\n=== Step 3 ===");
    const inputs3 = await page.locator('input:visible, select:visible').all();
    for (const inp of inputs3) {
      const name = await inp.getAttribute("name").catch(() => "");
      const id = await inp.getAttribute("id").catch(() => "");
      const placeholder = await inp.getAttribute("placeholder").catch(() => "");
      console.log(`  Input: name="${name}" id="${id}" placeholder="${placeholder}"`);
    }
    const btns3 = await page.locator('button:visible').all();
    for (const btn of btns3) {
      const text = await btn.textContent().catch(() => "");
      console.log(`  Button: "${text?.trim()}"`);
    }

    await page.locator('button[type="submit"]').click().catch(() => {});
    await page.waitForTimeout(3000);
    if (page.url() !== "about:blank") {
      console.log("  URL:", page.url());

      // Step 4
      console.log("\n=== Step 4 ===");
      const inputs4 = await page.locator('input:visible, select:visible').all();
      for (const inp of inputs4) {
        const name = await inp.getAttribute("name").catch(() => "");
        const id = await inp.getAttribute("id").catch(() => "");
        const placeholder = await inp.getAttribute("placeholder").catch(() => "");
        console.log(`  Input: name="${name}" id="${id}" placeholder="${placeholder}"`);
      }
      const btns4 = await page.locator('button:visible').all();
      for (const btn of btns4) {
        const text = await btn.textContent().catch(() => "");
        console.log(`  Button: "${text?.trim()}"`);
      }
    }
  }

  await browser.close();
})();
