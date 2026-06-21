import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Monitor network requests
  const apiCalls: {url: string; method: string; body?: string; response?: string}[] = [];
  page.on("request", (req) => {
    if (req.url().includes("api") || req.url().includes("vercel") || req.method() === "POST") {
      apiCalls.push({
        url: req.url(),
        method: req.method(),
        body: req.postData() || "",
      });
    }
  });
  page.on("response", async (res) => {
    if (res.url().includes("api") || res.request().method() === "POST") {
      try {
        const json = await res.json().catch(() => null);
        if (json) {
          const entry = apiCalls.find(e => e.url === res.url() && !e.response);
          if (entry) entry.response = JSON.stringify(json).substring(0, 300);
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
  const email = `john.doe.${Date.now()}@example.com`;
  await page.locator('input[name="email"]').fill(email);
  const phone = `${Date.now()}`.slice(-10);
  await page.locator('input[name="phoneNumber"]').fill(phone);
  await page.locator('input[name="password"]').fill("TestPass123!");
  await page.locator('input[name="confirmPassword"]').fill("TestPass123!");

  // Country code
  const countryBtn = page.locator('button:has-text("🇳🇵")');
  await countryBtn.click();
  await page.waitForTimeout(300);
  const option = page.locator('[role="option"]').filter({ hasText: "+977" }).first();
  if (await option.isVisible().catch(() => false)) {
    await option.click();
  }

  // Submit
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(3000);

  console.log("=== API calls:");
  apiCalls.forEach((c, i) => {
    console.log(`${i + 1}. ${c.method} ${c.url}`);
    if (c.body) console.log(`   Body: ${c.body}`);
    if (c.response) console.log(`   Response: ${c.response}`);
  });

  await browser.close();
})();
