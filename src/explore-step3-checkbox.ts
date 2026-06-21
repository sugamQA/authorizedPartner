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

  // === Step 0: Terms ===
  console.log("Step 0: Accepting terms...");
  await page.goto("https://authorized-partner.vercel.app/register", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.locator('button[role="checkbox"]').click();
  await page.locator('button:has-text("Continue")').click();
  await page.waitForTimeout(2000);

  // === Step 1: Account Setup ===
  console.log("Step 1: Account Setup...");
  const inbox = await createTempInbox();
  console.log("  Email:", inbox.email);
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
  console.log("  Waiting for OTP...");
  const otp = await waitForOtp(inbox.token);
  console.log("  OTP:", otp);
  await page.locator('input[autocomplete="one-time-code"]').fill(otp);
  await page.locator('button:has-text("Verify")').click();
  await page.waitForTimeout(4000);
  console.log("  → URL:", page.url());

  // === Step 2: Agency Details ===
  console.log("\nStep 2: Agency Details...");
  await page.locator('input[name="agency_name"]').fill("Global Education Services");
  await page.locator('input[name="role_in_agency"]').fill("Director");
  await page.locator('input[name="agency_email"]').fill(`agency${Date.now()}@example.com`);
  await page.locator('input[name="agency_website"]').fill("www.globaledu.com");
  await page.locator('input[name="agency_address"]').fill("Kathmandu, Nepal");

  // Regions
  await page.locator('button:has-text("Select Your Region of Operation")').click();
  await page.waitForTimeout(1000);
  for (const r of ["Australia", "India", "Nepal"]) {
    await clickDropdownOption(page, r);
    await page.waitForTimeout(200);
    console.log(`  Selected region: ${r}`);
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(5000);
  console.log("  → URL:", page.url());

  // === Step 3: Professional Experience ===
  console.log("\nStep 3: Professional Experience...");
  
  // Years of experience
  await page.locator('button:has-text("Select Your Experience Level")').click();
  await page.waitForTimeout(800);
  await clickDropdownOption(page, "5 years");
  console.log("  Selected: 5 years");
  await page.waitForTimeout(500);

  await page.locator('input[name="number_of_students_recruited_annually"]').fill("150");
  await page.locator('input[name="focus_area"]').fill("Undergraduate admissions to Canada and Australia");
  await page.locator('input[name="success_metrics"]').fill("92");

  // Click service checkboxes via label->for->button
  const services = ["Career Counseling", "Admission Applications", "Visa Processing"];
  for (const svc of services) {
    try {
      // Find label, get for attribute, click corresponding button
      const label = page.locator(`label:has-text("${svc}")`).first();
      const forId = await label.getAttribute("for");
      if (forId) {
        await page.locator(`button[id="${forId}"]`).click();
        console.log(`  Checked: ${svc}`);
      }
    } catch {
      // Fallback: click button[role="checkbox"] by index
      console.log(`  Trying fallback for: ${svc}`);
    }
    await page.waitForTimeout(200);
  }

  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(5000);
  console.log("  → URL:", page.url());

  // Show result
  const text = await page.locator('body').innerText();
  console.log("\n=== Current Content ===");
  console.log(text.substring(0, 3000));

  const inputs = await page.locator('input:visible, select:visible, textarea:visible').all();
  console.log(`\nInputs:`);
  for (const inp of inputs) {
    const name = await inp.getAttribute("name").catch(() => "");
    const placeholder = await inp.getAttribute("placeholder").catch(() => "");
    console.log(`  name="${name}" placeholder="${placeholder}"`);
  }
  const btns = await page.locator('button:visible').all();
  console.log(`\nButtons:`);
  for (const btn of btns) {
    const t = await btn.textContent().catch(() => "");
    if (t?.trim()) console.log(`  "${t.trim()}"`);
  }

  await browser.close();
})();
