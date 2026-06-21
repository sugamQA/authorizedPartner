import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Monitor API calls
  const apiCalls: {url: string; body?: string; response?: string}[] = [];
  page.on("request", (req) => {
    if (req.url().includes("cloudedu")) {
      apiCalls.push({ url: req.url(), body: req.postData() || "" });
    }
  });
  page.on("response", async (res) => {
    if (res.url().includes("cloudedu")) {
      try {
        const json = await res.json().catch(() => null);
        if (json) {
          const entry = apiCalls.find(e => e.url === res.url() && !e.response);
          if (entry) entry.response = JSON.stringify(json).substring(0, 500);
        }
      } catch {}
    }
  });

  await page.goto("https://authorized-partner.vercel.app/register", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // Accept terms
  await page.locator('button[role="checkbox"]').click();
  await page.locator('button:has-text("Continue")').click();
  await page.waitForTimeout(2000);

  // Fill step 1
  await page.locator('input[name="firstName"]').fill("John");
  await page.locator('input[name="lastName"]').fill("Doe");
  const ts = Date.now();
  const email = `john.doe.${ts}@outlook.com`;
  await page.locator('input[name="email"]').fill(email);
  const phone = `98${ts.toString().slice(-8)}`;
  await page.locator('input[name="phoneNumber"]').fill(phone);
  await page.locator('input[name="password"]').fill("TestPass123!");
  await page.locator('input[name="confirmPassword"]').fill("TestPass123!");

  // Country code
  const countryBtn = page.locator('button:has-text("🇳🇵")');
  await countryBtn.click();
  await page.waitForTimeout(300);
  const option = page.locator('[role="option"]').filter({ hasText: "+977" }).first();
  if (await option.isVisible().catch(() => false)) await option.click();

  // Submit step 1
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(3000);

  // Enter OTP manually provided by user
  const otpCode = "278749";
  console.log("Using OTP:", otpCode);
  const codeInput = page.locator('input[autocomplete="one-time-code"]');
  if (await codeInput.isVisible().catch(() => false)) {
    // Input each digit separately for autocomplete fields
    await codeInput.fill(otpCode);
    await page.waitForTimeout(500);
    await page.locator('button:has-text("Verify")').click();
    await page.waitForTimeout(5000);
  }

  console.log("\nURL after verification:", page.url());
  const text = await page.locator('body').innerText();
  console.log("\n=== Page content ===");
  console.log(text.substring(0, 3000));

  // Show visible form fields
  console.log("\n=== Visible inputs ===");
  const inputs = await page.locator('input:visible, select:visible, textarea:visible').all();
  for (const inp of inputs) {
    const name = await inp.getAttribute("name").catch(() => "");
    const placeholder = await inp.getAttribute("placeholder").catch(() => "");
    const id = await inp.getAttribute("id").catch(() => "");
    const type = await inp.getAttribute("type").catch(() => "");
    console.log(`  name="${name}" type="${type}" placeholder="${placeholder}" id="${id}"`);
  }

  console.log("\n=== Buttons ===");
  const btns = await page.locator('button:visible').all();
  for (const btn of btns) {
    const t = await btn.textContent().catch(() => "");
    if (t?.trim()) console.log(`  "${t.trim()}"`);
  }

  // Find submit/next button and click through remaining steps
  let step = 2;
  while (step <= 6) {
    const submitBtn = page.locator('button[type="submit"]:visible').first();
    if (await submitBtn.isVisible().catch(() => false)) {
      console.log(`\n=== Clicking submit for step ${step} ===`);
      await submitBtn.click();
      await page.waitForTimeout(4000);
      console.log("URL:", page.url());
      const content = await page.locator('body').innerText();
      console.log("Content preview:", content.substring(0, 500));
      step++;
    } else {
      break;
    }
  }

  console.log("\n=== Final API call log ===");
  apiCalls.forEach((c, i) => {
    console.log(`${i + 1}. ${c.url}`);
    if (c.body) console.log(`   Body: ${c.body.substring(0, 200)}`);
    if (c.response) console.log(`   Response: ${c.response.substring(0, 200)}`);
  });

  await browser.close();
})();
