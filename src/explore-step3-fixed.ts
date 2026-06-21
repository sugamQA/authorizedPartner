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
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

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
  await page.locator('button[role="checkbox"]').click();
  await page.locator('button:has-text("Continue")').click();
  await page.waitForTimeout(2000);

  // Step 1
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

  // Step 2
  await page.locator('input[name="agency_name"]').fill("Global Education Services");
  await page.locator('input[name="role_in_agency"]').fill("Director");
  await page.locator('input[name="agency_email"]').fill(`agency${Date.now()}@example.com`);
  await page.locator('input[name="agency_website"]').fill("www.globaledu.com");
  await page.locator('input[name="agency_address"]').fill("Kathmandu, Nepal");
  await page.locator('button:has-text("Select Your Region of Operation")').click();
  await page.waitForTimeout(1000);

  for (const name of ["Australia", "India", "Nepal"]) {
    const found = await page.evaluate((n) => {
      const all = Array.from(document.querySelectorAll('span, div, li'));
      for (const el of all) {
        if (el.textContent?.trim() === n && el.children.length === 0) {
          const rect = el.getBoundingClientRect();
          return { x: rect.x + 5, y: rect.y + 5 };
        }
      }
      return null;
    }, name);
    if (found) {
      await page.mouse.click(found.x, found.y);
      await page.waitForTimeout(200);
    }
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(5000);

  // Step 3: Professional Experience
  console.log("\n=== Step 3: Professional Experience ===");
  const expTrigger = page.locator('button:has-text("Select Your Experience Level")');
  await expTrigger.click();
  await page.waitForTimeout(800);

  const expOption = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('span, div, li'));
    for (const el of all) {
      if (el.textContent?.trim() === "5 years" && el.children.length === 0) {
        const rect = el.getBoundingClientRect();
        return { x: rect.x + 5, y: rect.y + 5 };
      }
    }
    return null;
  });
  if (expOption) {
    await page.mouse.click(expOption.x, expOption.y);
    console.log("Selected: 5 years");
  }
  await page.waitForTimeout(500);

  await page.locator('input[name="number_of_students_recruited_annually"]').fill("150");
  await page.locator('input[name="focus_area"]').fill("Undergraduate admissions to Canada and Australia");
  await page.locator('input[name="success_metrics"]').fill("92");

  // Click checkboxes by index (they are input[type="checkbox"])
  const checkboxes = page.locator('input[type="checkbox"]');
  const count = await checkboxes.count();
  console.log(`Found ${count} checkboxes`);
  for (let i = 0; i < count; i++) {
    // Check the first 3 services
    if (i < 3) {
      // Click the actual visible checkbox button (not the hidden input)
      await checkboxes.nth(i).click({ force: true });
      console.log(`Checked checkbox ${i}`);
    }
  }

  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(5000);
  console.log("URL after step 3:", page.url());

  // Display current step content
  const text = await page.locator('body').innerText();
  console.log("\n=== Current Content ===");
  console.log(text.substring(0, 3000));

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

  console.log("\n=== Recent API ===");
  apiCalls.slice(-10).forEach((c, i) => {
    const short = (c.url.split('cloudedu.com.au').pop() || c.url.split('/').pop() || "").substring(0, 40);
    console.log(`${i + 1}. ${short}`);
    if (c.body && c.body.length < 500) console.log(`   ${c.body}`);
    if (c.response) console.log(`   → ${c.response.substring(0, 300)}`);
  });

  await browser.close();
})();
