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
  const inbox = await createTempInbox();
  console.log("Email:", inbox.email);

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto("https://authorized-partner.vercel.app/register", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  await page.locator('button[role="checkbox"]').click();
  await page.locator('button:has-text("Continue")').click();
  await page.waitForTimeout(2000);

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

  console.log("URL:", page.url());

  // Fill step 2 fields
  await page.locator('input[name="agency_name"]').fill("Global Education Services");
  await page.locator('input[name="role_in_agency"]').fill("Director");
  await page.locator('input[name="agency_email"]').fill(`agency${Date.now()}@example.com`);
  await page.locator('input[name="agency_website"]').fill("www.globaledu.com");
  await page.locator('input[name="agency_address"]').fill("Kathmandu, Nepal");

  // Inspect the region dropdown - find it and open it
  const regionTrigger = page.locator('button:has-text("Select Your Region of Operation")');
  console.log("Region trigger HTML:");
  console.log(await regionTrigger.evaluate(el => el.outerHTML));

  await regionTrigger.click();
  await page.waitForTimeout(1000);

  // Now dump the full page HTML to find the dropdown menu
  const html = await page.evaluate(() => document.body.innerHTML);
  // Look for any popup/dropdown content
  const popupMatch = html.match(/<div[^>]*role="listbox"[^>]*>.*?<\/div>/is) || 
                     html.match(/<div[^>]*class="[^"]*select[^"]*"[^>]*>.*?<\/div>/gis);
  
  console.log("\n\n=== Region dropdown area ===");
  // Find elements that appeared after clicking
  const allDivs = await page.evaluate(() => {
    const divs = Array.from(document.querySelectorAll('[role="listbox"], [class*="select"]'));
    return divs.map(d => ({
      class: d.className,
      id: d.id,
      role: d.getAttribute("role"),
      inner: d.innerHTML.substring(0, 500),
      tag: d.tagName,
    }));
  });
  console.log(JSON.stringify(allDivs, null, 2));

  // Also try to find options by looking at all elements that might be options
  const possibleOptions = await page.locator('[role="option"], [class*="option"], li, [class*="item"]').all();
  console.log(`\nPossible options (${possibleOptions.length}):`);
  for (const opt of possibleOptions) {
    const text = await opt.textContent().catch(() => "");
    const visible = await opt.isVisible().catch(() => false);
    if (text?.trim() && visible) {
      console.log(`  "${text.trim()}" visible=${visible}`);
    }
  }

  await browser.close();
})();
