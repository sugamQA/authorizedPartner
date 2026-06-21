import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";

const CRED_FILE = path.join(__dirname, "..", "credentials.json");

async function login(email: string, password: string) {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);

  console.log("Navigating to login page...");
  await page.goto("https://authorized-partner.vercel.app/login", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  const inputs = await page.locator("input:visible").all();
  console.log(`Found ${inputs.length} inputs`);
  for (const inp of inputs) {
    const name = await inp.getAttribute("name").catch(() => "");
    const type = await inp.getAttribute("type").catch(() => "");
    const placeholder = await inp.getAttribute("placeholder").catch(() => "");
    console.log(`  name="${name}" type="${type}" placeholder="${placeholder}"`);
  }

  const btns = await page.locator("button:visible").all();
  console.log("Buttons:");
  for (const btn of btns) {
    const t = await btn.textContent().catch(() => "");
    if (t?.trim()) console.log(`  "${t.trim()}"`);
  }

  // Fill login
  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  const passwordInput = page.locator('input[type="password"], input[name="password"]').first();

  if (await emailInput.isVisible().catch(() => false)) {
    await emailInput.fill(email);
    console.log("  Filled email:", email);
  }
  if (await passwordInput.isVisible().catch(() => false)) {
    await passwordInput.fill(password);
    console.log("  Filled password");
  }

  const loginBtn = page.locator('button[type="submit"]').first();
  if (await loginBtn.isVisible().catch(() => false)) {
    await loginBtn.click();
    console.log("  Clicked login");
  }

  await page.waitForTimeout(5000);
  console.log("\nAfter login URL:", page.url());
  const text = await page.locator("body").innerText();
  console.log("Content:", text.substring(0, 1000));

  // await browser.close();
}

// Read credentials
let email = "";
let password = "TestPass123!";

if (fs.existsSync(CRED_FILE)) {
  const saved = JSON.parse(fs.readFileSync(CRED_FILE, "utf-8"));
  email = saved.email;
  console.log("Loaded saved credentials for:", email);
} else {
  console.log("No saved credentials found.");
  console.log("Usage: Set email below or run full signup first.");
  email = "test1782058918559@web-library.net"; // last known working email
}

login(email, password);
