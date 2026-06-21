import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";

const STATE_FILE = path.join(__dirname, "..", "session.json");

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
  const browser = await chromium.launch({ headless: false });

  const context = await browser.newContext();
  const page = await context.newPage();

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

  // Go to register page
  await page.goto("https://authorized-partner.vercel.app/register", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // Check current step
  let step = new URL(page.url()).searchParams.get("step");
  console.log("Current step:", step);

  if (!step) {
    // === STEP 0: Terms ===
    await page.locator('button[role="checkbox"]').click();
    await page.locator('button:has-text("Continue")').click();
    await page.waitForTimeout(2000);

    step = new URL(page.url()).searchParams.get("step");
    console.log("Step after terms:", step);
  }

  if (step === "setup") {
    // Check if we need to do OTP or just fill account info
    const hasOtpInput = await page.locator('input[autocomplete="one-time-code"]').isVisible().catch(() => false);

    if (hasOtpInput) {
      // We already submitted step 1 and need OTP
      console.log("\n=== OTP Verification ===");
      // Try to get OTP automatically
      // For now, ask user to enter OTP
      console.log("Please enter the OTP code from your email...");
      // Wait for manual OTP input
      // We'll wait for URL change
      const currentUrl = page.url();
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const newUrl = page.url();
        if (newUrl !== currentUrl) {
          step = new URL(newUrl).searchParams.get("step");
          console.log("OTP verified! New step:", step);
          break;
        }
        // Check if invalid OTP
        if (await page.locator('text=Invalid OTP').isVisible().catch(() => false)) {
          // Let user correct it
        }
      }
    } else {
      // Need to fill account setup
      console.log("\n=== Step 1: Account Setup ===");
      let inbox;
      try {
        inbox = await createTempInbox();
        console.log("Temp email:", inbox.email);
      } catch {
        inbox = null;
      }

      await page.locator('input[name="firstName"]').fill("John");
      await page.locator('input[name="lastName"]').fill("Doe");
      const email = inbox?.email || `john.doe.${Date.now()}@outlook.com`;
      await page.locator('input[name="email"]').fill(email);
      const phone = `98${Date.now().toString().slice(-8)}`;
      await page.locator('input[name="phoneNumber"]').fill(phone);
      await page.locator('input[name="password"]').fill("TestPass123!");
      await page.locator('input[name="confirmPassword"]').fill("TestPass123!");
      await page.locator('button:has-text("🇳🇵")').click();
      await page.waitForTimeout(300);
      await page.locator('[role="option"]').filter({ hasText: "+977" }).first().click();
      await page.locator('button[type="submit"]').click();
      await page.waitForTimeout(3000);

      if (inbox) {
        console.log("Waiting for OTP...");
        const otp = await waitForOtp(inbox.token);
        console.log("OTP:", otp);
        await page.locator('input[autocomplete="one-time-code"]').fill(otp);
        await page.locator('button:has-text("Verify")').click();
        await page.waitForTimeout(4000);
      }

      // Save state
      await context.storageState({ path: STATE_FILE });
      step = new URL(page.url()).searchParams.get("step");
      console.log("Step after OTP:", step);
    }
  }

  // === STEP 2: Agency Details ===
  if (step === "details") {
    console.log("\n=== Step 2: Agency Details ===");
    await page.locator('input[name="agency_name"]').fill("Global Education Services");
    await page.locator('input[name="role_in_agency"]').fill("Director");
    await page.locator('input[name="agency_email"]').fill(`agency${Date.now()}@example.com`);
    await page.locator('input[name="agency_website"]').fill("www.globaledu.com");
    await page.locator('input[name="agency_address"]').fill("Kathmandu, Nepal");

    // Select regions
    const regionTrigger = page.locator('button:has-text("Select Your Region of Operation")');
    await regionTrigger.click();
    await page.waitForTimeout(500);

    for (const region of ["Nepal", "India", "Australia"]) {
      const opt = page.locator(`[role="option"]:has-text("${region}")`).first();
      if (await opt.isVisible().catch(() => false)) {
        await opt.click();
        await page.waitForTimeout(200);
      }
    }

    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    if (await page.locator('button[type="submit"]').isVisible().catch(() => false)) {
      await page.locator('button[type="submit"]').click();
      await page.waitForTimeout(5000);
    } else {
      // Try "Next" button
      await page.locator('button:has-text("Next")').click();
      await page.waitForTimeout(5000);
    }

    await context.storageState({ path: STATE_FILE });
    step = new URL(page.url()).searchParams.get("step");
    console.log("Step after details:", step);
  }

  // Show current page
  const pageText = await page.locator('body').innerText();
  console.log("\n=== Current page content ===");
  console.log(pageText.substring(0, 3000));

  const inputs = await page.locator('input:visible, select:visible, textarea:visible').all();
  console.log(`\nInputs (${inputs.length}):`);
  for (const inp of inputs) {
    const name = await inp.getAttribute("name").catch(() => "");
    const placeholder = await inp.getAttribute("placeholder").catch(() => "");
    const type = await inp.getAttribute("type").catch(() => "");
    console.log(`  name="${name}" type="${type}" placeholder="${placeholder}"`);
  }

  const btns = await page.locator('button:visible').all();
  console.log(`\nButtons:`);
  for (const btn of btns) {
    const t = await btn.textContent().catch(() => "");
    if (t?.trim()) console.log(`  "${t.trim()}"`);
  }

  console.log("\n=== API Calls ===");
  apiCalls.forEach((c, i) => {
    console.log(`${i + 1}. ${c.url}`);
    if (c.body) console.log(`   Body: ${c.body.substring(0, 200)}`);
    if (c.response) console.log(`   Response: ${c.response.substring(0, 300)}`);
  });

  // await browser.close();
})();
