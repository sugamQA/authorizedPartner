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
  return { email: addr, password: pw, token };
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
      console.log("Email text:", text);
      const match = text.match(/\b(\d{6})\b/);
      if (match) return match[1];
    }
  }
  throw new Error("OTP not found");
}

(async () => {
  const inbox = await createTempInbox();
  console.log("Email:", inbox.email);

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
  const countryBtn = page.locator('button:has-text("🇳🇵")');
  await countryBtn.click();
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

  console.log("\n=== URL:", page.url());

  let step = 2;
  while (step <= 5) {
    const text = await page.locator('body').innerText();
    console.log(`\n=== Step ${step} content ===`);
    console.log(text.substring(0, 1500));

    // List all inputs
    const inputs = await page.locator('input:visible, select:visible, textarea:visible').all();
    console.log(`\n  Inputs (${inputs.length}):`);
    for (const inp of inputs) {
      const name = await inp.getAttribute("name").catch(() => "");
      const placeholder = await inp.getAttribute("placeholder").catch(() => "");
      const type = await inp.getAttribute("type").catch(() => "");
      console.log(`    name="${name}" type="${type}" placeholder="${placeholder}"`);
    }

    // List all buttons
    const btns = await page.locator('button:visible').all();
    console.log(`\n  Buttons:`);
    for (const btn of btns) {
      const t = await btn.textContent().catch(() => "");
      if (t?.trim()) console.log(`    "${t.trim()}"`);
    }

    // Check for submit button
    const submitBtn = page.locator('button[type="submit"]:visible, button:has-text("Next"):visible, button:has-text("Submit"):visible, button:has-text("Create"):visible').first();
    if (await submitBtn.isVisible().catch(() => false)) {
      const btnText = await submitBtn.textContent().catch(() => "");
      console.log(`\n  → Clicking "${btnText?.trim()}"...`);
      await submitBtn.click();
      await page.waitForTimeout(4000);
      console.log("  URL:", page.url());
      step++;
    } else {
      console.log("\n  → No submit button found - ending walkthrough");
      break;
    }
  }

  console.log("\n\n=== Final content ===");
  console.log((await page.locator('body').innerText()).substring(0, 2000));

  await browser.close();
})();
