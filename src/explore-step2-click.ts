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
  console.log("Step 1 done, URL:", page.url());

  // Step 2
  await page.locator('input[name="agency_name"]').fill("Global Education Services");
  await page.locator('input[name="role_in_agency"]').fill("Director");
  await page.locator('input[name="agency_email"]').fill(`agency${Date.now()}@example.com`);
  await page.locator('input[name="agency_website"]').fill("www.globaledu.com");
  await page.locator('input[name="agency_address"]').fill("Kathmandu, Nepal");

  // Click region trigger
  await page.locator('button:has-text("Select Your Region of Operation")').click();
  await page.waitForTimeout(1500);

  // Use evaluate to find all clickable elements in the page that might be dropdown options
  const regionTexts = await page.evaluate(() => {
    // Find all elements that could be options
    const all = Array.from(document.querySelectorAll('div, span, button, li'));
    return all
      .filter(el => {
        const text = el.textContent?.trim() || "";
        const isRegion = ["Australia", "Canada", "France", "India", "Nepal", "New Zealand", "Pakistan", "United Kingdom", "United States"].includes(text);
        return isRegion && el.children.length === 0; // leaf node
      })
      .map(el => ({
        text: el.textContent?.trim(),
        tag: el.tagName,
        class: el.className?.substring(0, 60),
        rect: el.getBoundingClientRect(),
      }));
  });

  console.log(`\nFound ${regionTexts.length} region elements`);
  for (const r of regionTexts) {
    console.log(`  "${r.text}" tag=${r.tag} class=${r.class} rect=(${r.rect.x}, ${r.rect.y}, ${r.rect.width}x${r.rect.height})`);
    // Try clicking by coordinates
    if (["Nepal", "India", "Australia"].includes(r.text || "")) {
      await page.mouse.click(r.rect.x + 5, r.rect.y + 5);
      await page.waitForTimeout(300);
      console.log(`  → Clicked ${r.text}`);
    }
  }

  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);

  // Submit step 2
  if (await page.locator('button[type="submit"]').isVisible().catch(() => false)) {
    await page.locator('button[type="submit"]').click();
  } else {
    await page.locator('button:has-text("Next")').click();
  }
  await page.waitForTimeout(5000);
  console.log("Step 2 done, URL:", page.url());

  // Show result
  const text = await page.locator('body').innerText();
  console.log("\n=== Content ===");
  console.log(text.substring(0, 3000));

  const inputs = await page.locator('input:visible, select:visible, textarea:visible').all();
  console.log(`\nInputs (${inputs.length}):`);
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

  console.log("\n=== API ===");
  apiCalls.forEach((c, i) => {
    console.log(`${i + 1}. ${c.url.split('/').pop()}`);
    if (c.body && c.body.length < 300) console.log(`   ${c.body}`);
    if (c.response) console.log(`   → ${c.response.substring(0, 200)}`);
  });

  await browser.close();
})();
