import { chromium } from "playwright";

// Helper: Create temp inbox via mail.tm
async function createTempInbox() {
  const domainsRes = await fetch("https://api.mail.tm/domains").then(r => r.json());
  const domain = domainsRes["hydra:member"][0].domain;

  const addr = `test${Date.now()}@${domain}`;
  const pw = "TestPass123!";

  await fetch("https://api.mail.tm/accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: addr, password: pw }),
  });

  const tokenRes = await fetch("https://api.mail.tm/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: addr, password: pw }),
  });
  const { token } = await tokenRes.json();

  return { email: addr, password: pw, token };
}

// Helper: Wait for OTP from mail.tm inbox
async function waitForOtp(token: string, timeoutMs = 60000): Promise<string> {
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
      console.log("Email received:", msg.subject);

      // Try HTML first, then plain text
      const content = String(msg.html || msg.text || "");
      const match = content.match(/>(\d{6})</) || content.match(/\b(\d{6})\b/);
      console.log("Email content preview:", content.substring(0, 500));
      if (match) return match[1];
    }
  }
  throw new Error("OTP not found in mailbox");
}

(async () => {
  console.log("1. Creating temp email...");
  const inbox = await createTempInbox();
  console.log("   Email:", inbox.email);

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Monitor API calls
  type ApiEntry = { url: string; body?: string; response?: string };
  const apiCalls: ApiEntry[] = [];
  page.on("request", (req) => {
    if (req.url().includes("cloudedu") || req.url().includes("tempuser")) {
      apiCalls.push({ url: req.url(), body: req.postData() || "" });
    }
  });
  page.on("response", async (res) => {
    if (res.url().includes("cloudedu") || res.url().includes("tempuser")) {
      try {
        const json = await res.json().catch(() => null);
        if (json) {
          const entry = apiCalls.find(e => e.url === res.url() && !e.response);
          if (entry) entry.response = JSON.stringify(json).substring(0, 500);
        }
      } catch {}
    }
  });

  console.log("2. Opening registration page...");
  await page.goto("https://authorized-partner.vercel.app/register", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // Step 0: Accept terms
  await page.locator('button[role="checkbox"]').click();
  await page.locator('button:has-text("Continue")').click();
  await page.waitForTimeout(2000);

  // Step 1: Account Setup
  console.log("3. Filling step 1 (Account Setup)...");
  await page.locator('input[name="firstName"]').fill("John");
  await page.locator('input[name="lastName"]').fill("Doe");
  await page.locator('input[name="email"]').fill(inbox.email);
  const phone = `98${Date.now().toString().slice(-8)}`;
  await page.locator('input[name="phoneNumber"]').fill(phone);
  await page.locator('input[name="password"]').fill("TestPass123!");
  await page.locator('input[name="confirmPassword"]').fill("TestPass123!");

  // Select country code for Nepal
  const countryBtn = page.locator('button:has-text("🇳🇵")');
  await countryBtn.click();
  await page.waitForTimeout(300);
  const npOption = page.locator('[role="option"]').filter({ hasText: "+977" }).first();
  if (await npOption.isVisible().catch(() => false)) await npOption.click();

  // Submit step 1
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(3000);

  // Wait for OTP from email
  console.log("4. Waiting for OTP email...");
  const otp = await waitForOtp(inbox.token);
  console.log("   OTP:", otp);

  // Enter OTP
  const codeInput = page.locator('input[autocomplete="one-time-code"]');
  await codeInput.fill(otp);
  await page.locator('button:has-text("Verify")').click();
  await page.waitForTimeout(4000);

  console.log("5. URL after verification:", page.url());

  // Show current page to understand step 2
  const text = await page.locator('body').innerText();
  console.log("   Content:", text.substring(0, 2000));

  const inputs = await page.locator('input:visible, select:visible, textarea:visible').all();
  console.log("\n   Form fields:");
  for (const inp of inputs) {
    const name = await inp.getAttribute("name").catch(() => "");
    const placeholder = await inp.getAttribute("placeholder").catch(() => "");
    console.log(`     name="${name}" placeholder="${placeholder}"`);
  }

  const btns = await page.locator('button:visible').all();
  console.log("\n   Buttons:");
  for (const btn of btns) {
    const t = await btn.textContent().catch(() => "");
    if (t?.trim()) console.log(`     "${t.trim()}"`);
  }

  console.log("\n=== API Calls ===");
  apiCalls.forEach((c, i) => {
    console.log(`${i + 1}. ${c.url}`);
    if (c.body) console.log(`   Body: ${c.body.substring(0, 200)}`);
    if (c.response) console.log(`   Response: ${c.response.substring(0, 300)}`);
  });

  await browser.close();
})();
