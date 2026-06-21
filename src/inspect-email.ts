import { chromium } from "playwright";

async function createTempInbox() {
  const domainsRes = await fetch("https://api.mail.tm/domains").then(r => r.json());
  const domain = domainsRes["hydra:member"][0].domain;
  const addr = `test${Date.now()}@${domain}`;
  const pw = "TestPass123!";
  await fetch("https://api.mail.tm/accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: addr, password: pw }),
  });
  const tokenRes = await fetch("https://api.mail.tm/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: addr, password: pw }),
  });
  const { token } = await tokenRes.json();
  return { email: addr, password: pw, token };
}

async function waitForFullEmail(token: string, timeoutMs = 60000) {
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
      return msg;
    }
  }
  throw new Error("No email received");
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

  const countryBtn = page.locator('button:has-text("🇳🇵")');
  await countryBtn.click();
  await page.waitForTimeout(300);
  const npOption = page.locator('[role="option"]').filter({ hasText: "+977" }).first();
  if (await npOption.isVisible().catch(() => false)) await npOption.click();

  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(3000);

  console.log("Waiting for email...");
  const email = await waitForFullEmail(inbox.token);
  console.log("Subject:", email.subject);
  console.log("\n=== Full email object keys ===");
  console.log(Object.keys(email));
  console.log("html type:", typeof email.html);
  console.log("text type:", typeof email.text);
  
  if (typeof email.html === "string") {
    console.log("\n=== Full HTML (first 5000 chars) ===");
    console.log(email.html.substring(0, 5000));
  } else if (Array.isArray(email.html)) {
    console.log("\n=== HTML parts ===");
    email.html.forEach((part: any, i: number) => {
      console.log(`Part ${i}:`, typeof part, JSON.stringify(part).substring(0, 200));
    });
  } else {
    console.log("html value:", JSON.stringify(email.html).substring(0, 500));
  }

  if (typeof email.text === "string") {
    console.log("\n=== Full Text ===");
    console.log(email.text.substring(0, 2000));
  } else {
    console.log("text value:", JSON.stringify(email.text).substring(0, 500));
  }

  await browser.close();
})();
