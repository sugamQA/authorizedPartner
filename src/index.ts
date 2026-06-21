import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";

const CRED_FILE = path.join(__dirname, "..", "credentials.json");

async function createTempInbox() {
  const r = await fetch("https://api.mail.tm/domains").then(r => r.json());
  const domain = r["hydra:member"][0].domain;
  const addr = `test${Date.now()}@${domain}`;
  const pw = "TestPass123!";
  await fetch("https://api.mail.tm/accounts", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: addr, password: pw }),
  });
  const t = await fetch("https://api.mail.tm/token", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: addr, password: pw }),
  }).then(r => r.json());
  return { email: addr, token: t.token };
}

async function waitForOtp(token: string, timeoutMs = 120000): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, 2000));
    const msgs = await fetch("https://api.mail.tm/messages", {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json());
    if (msgs["hydra:member"]?.length > 0) {
      const msg = await fetch(`https://api.mail.tm/messages/${msgs["hydra:member"][0].id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json());
      const m = String(msg.text || "").match(/\b(\d{6})\b/);
      if (m) return m[1];
    }
  }
  throw new Error("OTP not found");
}

async function clickOption(page: any, text: string) {
  const pos = await page.evaluate((t: string) => {
    const all = Array.from(document.querySelectorAll("span, div, li"));
    for (const el of all) {
      if (el.textContent?.trim() === t && el.children.length === 0) {
        const r = el.getBoundingClientRect();
        return { x: r.x + 5, y: r.y + 5 };
      }
    }
    return null;
  }, text);
  if (pos) { await page.mouse.click(pos.x, pos.y); return true; }
  return false;
}

async function checkCheckbox(page: any, labelText: string) {
  const label = page.locator("label").filter({ hasText: labelText }).first();
  const forId = await label.getAttribute("for").catch(() => null);
  if (forId) {
    await page.locator(`button[id="${forId}"]`).click();
    return true;
  }
  return false;
}

async function signup() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);

  const password = "TestPass123!";

  console.log("=== SIGNUP ===");
  console.log("Step 0: Accepting terms...");
  await page.goto("https://authorized-partner.vercel.app/register", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.locator('button[role="checkbox"]').click();
  await page.locator('button:has-text("Continue")').click();
  await page.waitForTimeout(2000);

  console.log("Step 1: Account Setup...");
  const inbox = await createTempInbox();
  console.log("  Email:", inbox.email);
  await page.locator('input[name="firstName"]').fill("John");
  await page.locator('input[name="lastName"]').fill("Doe");
  await page.locator('input[name="email"]').fill(inbox.email);
  await page.locator('input[name="phoneNumber"]').fill(`98${Date.now().toString().slice(-8)}`);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('input[name="confirmPassword"]').fill(password);
  await page.locator('button:has-text("🇳🇵")').click();
  await page.waitForTimeout(300);
  await page.locator('[role="option"]').filter({ hasText: "+977" }).first().click();
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(3000);

  console.log("  Waiting for OTP...");
  const otp = await waitForOtp(inbox.token);
  console.log("  OTP:", otp);
  await page.locator('input[autocomplete="one-time-code"]').fill(otp);
  await page.locator('button:has-text("Verify")').click();
  await page.waitForTimeout(4000);

  console.log("Step 2: Agency Details...");
  await page.locator('input[name="agency_name"]').fill("Global Education Services");
  await page.locator('input[name="role_in_agency"]').fill("Director");
  await page.locator('input[name="agency_email"]').fill(`agency${Date.now()}@example.com`);
  await page.locator('input[name="agency_website"]').fill("www.globaledu.com");
  await page.locator('input[name="agency_address"]').fill("Kathmandu, Nepal");
  await page.locator('button:has-text("Select Your Region of Operation")').click();
  await page.waitForTimeout(1000);
  for (const r of ["Australia", "India", "Nepal"]) { await clickOption(page, r); await page.waitForTimeout(200); }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(5000);

  console.log("Step 3: Professional Experience...");
  await page.locator('button:has-text("Select Your Experience Level")').click();
  await page.waitForTimeout(800);
  await clickOption(page, "5 years");
  await page.waitForTimeout(500);
  await page.locator('input[name="number_of_students_recruited_annually"]').fill("150");
  await page.locator('input[name="focus_area"]').fill("Undergraduate admissions to Canada and Australia");
  await page.locator('input[name="success_metrics"]').fill("92");
  for (const s of ["Career Counseling", "Admission Applications", "Visa Processing"]) {
    await checkCheckbox(page, s);
    await page.waitForTimeout(200);
  }
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(5000);

  console.log("Step 4: Verification and Preferences...");
  await page.locator('input[name="business_registration_number"]').fill("BRN-2024-78901");
  const ct = page.locator('button:has-text("Select Your Preferred Countries")');
  if (await ct.isVisible().catch(() => false)) {
    await ct.click();
    await page.waitForTimeout(1000);
    for (const c of ["Australia", "Canada", "United Kingdom"]) { await clickOption(page, c); await page.waitForTimeout(200); }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  }

  const fileInputs = page.locator('input[type="file"]');
  let fileCount = await fileInputs.count();
  console.log(`  Found ${fileCount} file inputs`);

  for (let i = 0; i < fileCount; i++) {
    const accept = await fileInputs.nth(i).getAttribute("accept").catch(() => null);
    console.log(`  Input ${i} accept="${accept}"`);
    // Remove accept restriction so any file type can be uploaded
    await page.evaluate((idx: number) => {
      const inputs = document.querySelectorAll('input[type="file"]');
      if (inputs[idx]) inputs[idx].removeAttribute("accept");
    }, i);
  }

  if (fileCount > 0) {
    await fileInputs.nth(0).setInputFiles("test-assets\\test.pdf");
    console.log("  Uploaded test.pdf to input 0");
    await page.waitForTimeout(500);
  }
  if (fileCount > 1) {
    await fileInputs.nth(1).setInputFiles("test-assets\\test.docx");
    console.log("  Uploaded test.docx to input 1");
    await page.waitForTimeout(500);
  }

  for (const inst of ["Universities", "Colleges"]) { await checkCheckbox(page, inst); await page.waitForTimeout(200); }

  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(5000);

  // Save credentials
  fs.writeFileSync(CRED_FILE, JSON.stringify({ email: inbox.email, password }, null, 2));
  console.log("\n✓ Registration complete! Credentials saved.");
  console.log("  Email:", inbox.email);
  console.log("  Password:", password);

  await browser.close();
  return { email: inbox.email, password };
}

async function login(email: string, password: string) {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);

  console.log("\n=== LOGIN ===");
  console.log("  Email:", email);
  await page.goto("https://authorized-partner.vercel.app/login", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);

  // If already on the dashboard (auto-login after signup), skip filling
  if (!page.url().includes("login") && !page.url().includes("register")) {
    console.log("  Already logged in (redirected to dashboard)");
  } else {
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();

    if (await emailInput.isVisible().catch(() => false)) {
      await emailInput.fill(email);
    }
    if (await passwordInput.isVisible().catch(() => false)) {
      await passwordInput.fill(password);
    }

    const loginBtn = page.locator('button[type="submit"]').first();
    if (await loginBtn.isVisible().catch(() => false)) {
      await loginBtn.click();
      console.log("  Submitted login form");
    }

    await page.waitForURL("**/dashboard**", { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);
  }

  const url = page.url();
  const text = await page.locator("body").innerText();
  console.log("\nDashboard URL:", url);
  console.log("Logged in as:", text.includes("John") ? "John Doe" : "Unknown");

  // await browser.close();
}

(async () => {
  const creds = fs.existsSync(CRED_FILE) ? JSON.parse(fs.readFileSync(CRED_FILE, "utf-8")) : null;

  if (creds) {
    console.log("Found saved credentials. Logging in...");
    await login(creds.email, creds.password);
  } else {
    console.log("No saved credentials found. Starting signup...");
    const newCreds = await signup();
    await login(newCreds.email, newCreds.password);
  }
})();
