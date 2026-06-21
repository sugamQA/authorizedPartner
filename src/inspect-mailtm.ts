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

  // ========== MAIL.TM SETUP ==========
  // Create temp inbox
  const mailDomain = await fetch("https://api.mail.tm/domains").then(r => r.json());
  const domain = mailDomain["hydra:member"][0].domain;
  console.log("Using domain:", domain);

  const inboxRes = await fetch("https://api.mail.tm/accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      address: `test${Date.now()}@${domain}`,
      password: "TestPass123!",
    }),
  });
  const inbox = await inboxRes.json();
  const emailAddr = inbox.address;
  const emailPw = "TestPass123!";
  console.log("Temp email:", emailAddr);

  // Get auth token
  const tokenRes = await fetch("https://api.mail.tm/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: emailAddr, password: emailPw }),
  });
  const tokenData = await tokenRes.json();
  const token = tokenData.token;

  // ========== REGISTRATION ==========
  await page.goto("https://authorized-partner.vercel.app/register", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // Accept terms
  await page.locator('button[role="checkbox"]').click();
  await page.locator('button:has-text("Continue")').click();
  await page.waitForTimeout(2000);

  // Fill step 1
  await page.locator('input[name="firstName"]').fill("John");
  await page.locator('input[name="lastName"]').fill("Doe");
  await page.locator('input[name="email"]').fill(emailAddr);
  const phone = `98${Date.now().toString().slice(-8)}`;
  await page.locator('input[name="phoneNumber"]').fill(phone);
  await page.locator('input[name="password"]').fill("TestPass123!");
  await page.locator('input[name="confirmPassword"]').fill("TestPass123!");

  // Country code
  const countryBtn = page.locator('button:has-text("🇳🇵")');
  await countryBtn.click();
  await page.waitForTimeout(300);
  const option = page.locator('[role="option"]').filter({ hasText: "+977" }).first();
  if (await option.isVisible().catch(() => false)) await option.click();

  // Submit
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(3000);

  console.log("\nCurrent URL:", page.url());

  // ========== WAIT FOR OTP EMAIL ==========
  console.log("\nWaiting for OTP email...");
  let otpCode = "";
  for (let i = 0; i < 30; i++) {
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
      console.log("Email subject:", msg.subject);
      
      // Try to get the HTML content
      if (msg.html && msg.html.length > 0) {
        // Extract 6-digit OTP from HTML
        const otpMatch = msg.html.match(/\b(\d{6})\b/);
        if (otpMatch) {
          otpCode = otpMatch[1];
          console.log("OTP found:", otpCode);
          break;
        }
      }
    }
    console.log(`  Waiting... (${i + 1}/30)`);
  }

  if (otpCode) {
    // Enter OTP
    const codeInput = page.locator('input[autocomplete="one-time-code"]');
    await codeInput.fill(otpCode);
    await page.locator('button:has-text("Verify")').click();
    await page.waitForTimeout(3000);
    console.log("\nURL after verification:", page.url());
    
    // Check what's on the next page
    const text = await page.locator('body').innerText();
    console.log("\n=== Page content after verification ===");
    console.log(text.substring(0, 2000));
  } else {
    console.log("Could not find OTP code");
  }

  console.log("\n=== All API calls ===");
  apiCalls.forEach((c, i) => {
    console.log(`${i + 1}. ${c.url}`);
    if (c.body) console.log(`   Body: ${c.body.substring(0, 200)}`);
    if (c.response) console.log(`   Response: ${c.response.substring(0, 200)}`);
  });

  await browser.close();
})();
