import { chromium } from "playwright";

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

async function clickDropdownOption(page: any, optionText: string) {
  const pos = await page.evaluate((text: string) => {
    const all = Array.from(document.querySelectorAll("span, div, li"));
    for (const el of all) {
      if (el.textContent?.trim() === text && el.children.length === 0) {
        const r = el.getBoundingClientRect();
        return { x: r.x + 5, y: r.y + 5 };
      }
    }
    return null;
  }, optionText);
  if (pos) {
    await page.mouse.click(pos.x, pos.y);
    return true;
  }
  return false;
}

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);

  const registerEmail = ""; // will be set during registration
  const registerPassword = "TestPass123!";

  // === STEP 0: Terms ===
  console.log("Step 0: Accepting terms...");
  await page.goto("https://authorized-partner.vercel.app/register", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.locator('button[role="checkbox"]').click();
  await page.locator('button:has-text("Continue")').click();
  await page.waitForTimeout(2000);

  // === STEP 1: Account Setup ===
  console.log("Step 1: Account Setup...");
  const inbox = await createTempInbox();
  console.log("  Email:", inbox.email);
  await page.locator('input[name="firstName"]').fill("John");
  await page.locator('input[name="lastName"]').fill("Doe");
  await page.locator('input[name="email"]').fill(inbox.email);
  const phone = `98${Date.now().toString().slice(-8)}`;
  await page.locator('input[name="phoneNumber"]').fill(phone);
  await page.locator('input[name="password"]').fill(registerPassword);
  await page.locator('input[name="confirmPassword"]').fill(registerPassword);
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
  console.log("  → URL:", page.url());

  // === STEP 2: Agency Details ===
  console.log("\nStep 2: Agency Details...");
  await page.locator('input[name="agency_name"]').fill("Global Education Services");
  await page.locator('input[name="role_in_agency"]').fill("Director");
  await page.locator('input[name="agency_email"]').fill(`agency${Date.now()}@example.com`);
  await page.locator('input[name="agency_website"]').fill("www.globaledu.com");
  await page.locator('input[name="agency_address"]').fill("Kathmandu, Nepal");
  await page.locator('button:has-text("Select Your Region of Operation")').click();
  await page.waitForTimeout(1000);
  for (const r of ["Australia", "India", "Nepal"]) {
    await clickDropdownOption(page, r);
    await page.waitForTimeout(200);
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(5000);
  console.log("  → URL:", page.url());

  // === STEP 3: Professional Experience ===
  console.log("\nStep 3: Professional Experience...");
  await page.locator('button:has-text("Select Your Experience Level")').click();
  await page.waitForTimeout(800);
  await clickDropdownOption(page, "5 years");
  await page.waitForTimeout(500);
  await page.locator('input[name="number_of_students_recruited_annually"]').fill("150");
  await page.locator('input[name="focus_area"]').fill("Undergraduate admissions to Canada and Australia");
  await page.locator('input[name="success_metrics"]').fill("92");

  for (const svc of ["Career Counseling", "Admission Applications", "Visa Processing"]) {
    const label = page.locator("label").filter({ hasText: svc }).first();
    const forId = await label.getAttribute("for");
    if (forId) {
      await page.locator(`button[id="${forId}"]`).click();
      console.log(`  Checked: ${svc}`);
    }
    await page.waitForTimeout(200);
  }

  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(5000);
  console.log("  → URL:", page.url());

  // === STEP 4: Verification and Preferences ===
  console.log("\nStep 4: Verification and Preferences...");
  await page.locator('input[name="business_registration_number"]').fill("BRN-2024-78901");

  const countryTrigger = page.locator('button:has-text("Select Your Preferred Countries")');
  if (await countryTrigger.isVisible().catch(() => false)) {
    await countryTrigger.click();
    await page.waitForTimeout(1000);
    for (const c of ["Australia", "Canada", "United Kingdom"]) {
      await clickDropdownOption(page, c);
      await page.waitForTimeout(200);
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  }

  // Upload test.docx
  console.log("  Uploading documents...");
  const fileInputs = page.locator('input[type="file"]');
  const fileCount = await fileInputs.count();
  console.log(`  Found ${fileCount} file inputs`);
  if (fileCount > 0) {
    await fileInputs.nth(0).setInputFiles("C:\\Users\\DELL\\Desktop\\test.docx");
    console.log("  Uploaded test.docx");
    await page.waitForTimeout(1000);
  }

  for (const inst of ["Universities", "Colleges"]) {
    const label = page.locator("label").filter({ hasText: inst }).first();
    const forId = await label.getAttribute("for").catch(() => null);
    if (forId) {
      await page.locator(`button[id="${forId}"]`).click();
      console.log(`  Selected institution: ${inst}`);
    }
    await page.waitForTimeout(200);
  }

  const submitBtn = page.locator('button[type="submit"], button:has-text("Submit")').first();
  if (await submitBtn.isVisible().catch(() => false)) {
    await submitBtn.click();
    console.log("  Submitted step 4");
  }
  await page.waitForTimeout(5000);
  console.log("  → URL:", page.url());

  // ============ LOGIN ============
  console.log("\n\n=== LOGIN ===");
  console.log("  Email:", inbox.email);
  console.log("  Password:", registerPassword);

  // Navigate to login page
  await page.goto("https://authorized-partner.vercel.app/login", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  const loginText = await page.locator("body").innerText();
  console.log("\n  Login page:", loginText.substring(0, 500));

  // Find login form fields
  const loginInputs = await page.locator("input:visible").all();
  console.log(`\n  Login inputs (${loginInputs.length}):`);
  for (const inp of loginInputs) {
    const name = await inp.getAttribute("name").catch(() => "");
    const type = await inp.getAttribute("type").catch(() => "");
    const placeholder = await inp.getAttribute("placeholder").catch(() => "");
    console.log(`    name="${name}" type="${type}" placeholder="${placeholder}"`);
  }

  const loginBtns = await page.locator("button:visible").all();
  console.log(`\n  Login buttons:`);
  for (const btn of loginBtns) {
    const t = await btn.textContent().catch(() => "");
    if (t?.trim()) console.log(`    "${t.trim()}"`);
  }

  // Fill login form
  const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
  const passwordInput = page.locator('input[type="password"], input[name="password"], input[placeholder*="password" i]').first();

  if (await emailInput.isVisible().catch(() => false)) {
    await emailInput.fill(inbox.email);
    console.log("  Filled email");
  }
  if (await passwordInput.isVisible().catch(() => false)) {
    await passwordInput.fill(registerPassword);
    console.log("  Filled password");
  }

  // Click login/submit button
  const loginSubmit = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")').first();
  if (await loginSubmit.isVisible().catch(() => false)) {
    await loginSubmit.click();
    console.log("  Clicked login");
  }

  await page.waitForTimeout(5000);
  console.log("\n  After login URL:", page.url());
  const afterLogin = await page.locator("body").innerText();
  console.log("  Content:", afterLogin.substring(0, 1000));

  await browser.close();
})();
