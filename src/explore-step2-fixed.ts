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

  // === STEP 0: Terms ===
  let step = new URL(page.url()).searchParams.get("step");
  if (!step) {
    await page.locator('button[role="checkbox"]').click();
    await page.locator('button:has-text("Continue")').click();
    await page.waitForTimeout(2000);
    step = new URL(page.url()).searchParams.get("step");
  }

  // === STEP 1: Account Setup ===
  if (step === "setup") {
    const hasOtpInput = await page.locator('input[autocomplete="one-time-code"]').isVisible().catch(() => false);
    if (!hasOtpInput) {
      console.log("\n=== Step 1: Account Setup ===");
      const inbox = await createTempInbox();
      console.log("Email:", inbox.email);

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

      const otp = await waitForOtp(inbox.token);
      console.log("OTP:", otp);
      await page.locator('input[autocomplete="one-time-code"]').fill(otp);
      await page.locator('button:has-text("Verify")').click();
      await page.waitForTimeout(4000);
      await context.storageState({ path: STATE_FILE });
      console.log("Step 1 complete");
    } else {
      console.log("OTP input visible - need OTP");
      return;
    }
    step = new URL(page.url()).searchParams.get("step");
  }

  // === STEP 2: Agency Details ===
  if (step === "details") {
    console.log("\n=== Step 2: Agency Details ===");
    await page.locator('input[name="agency_name"]').fill("Global Education Services");
    await page.locator('input[name="role_in_agency"]').fill("Director");
    await page.locator('input[name="agency_email"]').fill(`agency${Date.now()}@example.com`);
    await page.locator('input[name="agency_website"]').fill("www.globaledu.com");
    await page.locator('input[name="agency_address"]').fill("Kathmandu, Nepal");

    // Region selection - try clicking and selecting
    const regionTrigger = page.locator('button:has-text("Select Your Region of Operation")');
    await regionTrigger.click();
    await page.waitForTimeout(1000);

    // Log what's in the dropdown
    const options = await page.locator('[role="option"]').all();
    console.log(`Dropdown options: ${options.length}`);
    for (const opt of options) {
      const text = await opt.textContent().catch(() => "");
      const visible = await opt.isVisible().catch(() => false);
      console.log(`  "${text?.trim()}" visible=${visible}`);
    }

    // Try clicking on each region option
    for (const region of ["Nepal", "India", "Australia"]) {
      // Find the option by text content
      const opt = page.locator(`[role="option"]:has-text("${region}")`).first();
      if (await opt.isVisible().catch(() => false)) {
        await opt.click();
        console.log(`Clicked: ${region}`);
        await page.waitForTimeout(300);
      }
    }

    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    // Check if regions were added
    const selectedTags = await page.locator('[class*="badge"], [class*="tag"], [class*="selected"]').all();
    console.log(`Selected regions tags: ${selectedTags.length}`);
    for (const t of selectedTags) {
      console.log(`  "${await t.textContent().catch(() => "")}"`);
    }

    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(5000);
    await context.storageState({ path: STATE_FILE });
    step = new URL(page.url()).searchParams.get("step");
    console.log("Step after details:", step);
  }

  // Show current state
  const pageText = await page.locator('body').innerText();
  console.log("\n=== Content ===");
  console.log(pageText.substring(0, 2000));

  console.log("\n=== API Calls ===");
  apiCalls.forEach((c, i) => {
    console.log(`${i + 1}. ${c.url}`);
    if (c.body) console.log(`   Body: ${c.body.substring(0, 200)}`);
    if (c.response) console.log(`   Response: ${c.response.substring(0, 300)}`);
  });

  // await browser.close();
})();
