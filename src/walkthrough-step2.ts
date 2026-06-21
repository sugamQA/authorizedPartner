import { chromium } from "playwright";

async function createTempInbox() {
  const domainsRes = await fetch("https://api.mail.tm/domains").then(r => r.json());
  const domain = domainsRes["hydra:member"][0].domain;
  const addr = `test${Date.now()}@${domain}`;
  const pw = "TestPass123!";
  await fetch("https://api.mail.tm/accounts", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: addr, password: pw }),
  });
  const tokenRes = await fetch("https://api.mail.tm/token", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: addr, password: pw }),
  });
  const { token } = await tokenRes.json();
  return { email: addr, token };
}

async function waitForOtp(token: string, timeoutMs = 120000): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, 2000));
    const msgsRes = await fetch("https://api.mail.tm/messages", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const msgs = await msgsRes.json();
    if (msgs["hydra:member"]?.length > 0) {
      const msgId = msgs["hydra:member"][0].id;
      const msgRes = await fetch(`https://api.mail.tm/messages/${msgId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const msg = await msgRes.json();
      const text = String(msg.text || "");
      const match = text.match(/\b(\d{6})\b/);
      if (match) return match[1];
    }
  }
  throw new Error("OTP not found");
}

(async () => {
  const inbox = await createTempInbox();
  console.log("Temp email:", inbox.email);

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto("https://authorized-partner.vercel.app/register", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // Accept terms
  await page.locator('button[role="checkbox"]').click();
  await page.locator('button:has-text("Continue")').click();
  await page.waitForTimeout(2000);

  // Step 1: Account Setup
  await page.locator('input[name="firstName"]').fill("John");
  await page.locator('input[name="lastName"]').fill("Doe");
  await page.locator('input[name="email"]').fill(inbox.email);
  const phone = `98${Date.now().toString().slice(-8)}`;
  await page.locator('input[name="phoneNumber"]').fill(phone);
  await page.locator('input[name="password"]').fill("TestPass123!");
  await page.locator('input[name="confirmPassword"]').fill("TestPass123!");
  await page.locator('button:has-text("🇳🇵")').click();
  await page.waitForTimeout(300);
  await page.locator('[role="option"]').filter({ hasText: "+977" }).first().click();
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(3000);

  // OTP
  console.log("Waiting for OTP...");
  const otp = await waitForOtp(inbox.token);
  console.log("OTP:", otp);
  await page.locator('input[autocomplete="one-time-code"]').fill(otp);
  await page.locator('button:has-text("Verify")').click();
  await page.waitForTimeout(4000);

  console.log("URL:", page.url());

  // Step 2: Agency Details
  console.log("\n=== Step 2: Agency Details ===");
  await page.locator('input[name="agency_name"]').fill("Global Education Services");
  await page.locator('input[name="role_in_agency"]').fill("Director");
  await page.locator('input[name="agency_email"]').fill(`agency${Date.now()}@example.com`);
  await page.locator('input[name="agency_website"]').fill("https://globaledu.com");
  await page.locator('input[name="agency_address"]').fill("Kathmandu, Nepal");

  // Region of Operation - open dropdown
  const regionBtn = page.locator('button:has-text("Select Your Region of Operation")');
  await regionBtn.click();
  await page.waitForTimeout(500);

  // Select some regions from the dropdown
  const regionOptions = await page.locator('[role="option"], [class*="option"]').all();
  console.log(`Found ${regionOptions.length} region options`);
  for (const opt of regionOptions) {
    const text = await opt.textContent().catch(() => "");
    if (text?.trim()) console.log(`  "${text.trim()}"`);
  }

  // Select first few regions
  const firstRegions = regionOptions.slice(0, 2);
  for (const opt of firstRegions) {
    await opt.click();
    await page.waitForTimeout(200);
  }

  await page.waitForTimeout(500);
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(4000);

  console.log("URL:", page.url());

  // Step 3 or error
  const text3 = await page.locator('body').innerText();
  console.log("\n=== Step 3 content ===");
  console.log(text3.substring(0, 2000));

  const inputs3 = await page.locator('input:visible, select:visible, textarea:visible').all();
  console.log(`\nInputs (${inputs3.length}):`);
  for (const inp of inputs3) {
    const name = await inp.getAttribute("name").catch(() => "");
    const placeholder = await inp.getAttribute("placeholder").catch(() => "");
    console.log(`  name="${name}" placeholder="${placeholder}"`);
  }

  const btns3 = await page.locator('button:visible').all();
  console.log(`\nButtons:`);
  for (const btn of btns3) {
    const t = await btn.textContent().catch(() => "");
    if (t?.trim()) console.log(`  "${t.trim()}"`);
  }

  await browser.close();
})();
