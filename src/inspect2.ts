import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto("https://authorized-partner.vercel.app/register", { waitUntil: "networkidle" });

  await page.waitForTimeout(3000);

  // Step 0: Accept terms
  const termsCheckbox = page.locator('button[role="checkbox"]');
  if (await termsCheckbox.isVisible()) {
    await termsCheckbox.click();
    console.log("✓ Accepted terms");
  }

  // Click Continue
  const continueBtn = page.locator('button:has-text("Continue")');
  if (await continueBtn.isVisible()) {
    await continueBtn.click();
    console.log("✓ Clicked Continue");
  }

  await page.waitForTimeout(3000);

  let step = 1;

  while (true) {
    console.log(`\n=== STEP ${step} | URL: ${page.url()}`);

    // Dump form fields
    const fields = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll("input, select, button, textarea"));
      return inputs.map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          tag: el.tagName,
          type: (el as HTMLInputElement).type || "",
          name: (el as HTMLInputElement).name || "",
          id: el.id || "",
          placeholder: (el as HTMLInputElement).placeholder || "",
          text: el.textContent?.trim().substring(0, 60) || "",
          visible: rect.width > 0 && rect.height > 0 && (el as HTMLElement).offsetParent !== null,
        };
      }).filter(f => f.visible || f.tag === "BUTTON");
    });

    console.log("Visible form fields:");
    fields.forEach((el, i) => {
      console.log(`  ${i + 1}. <${el.tag}${el.type ? ` type="${el.type}"` : ""}> name="${el.name}" placeholder="${el.placeholder}" text="${el.text}"`);
    });

    // Check for "Next"/"Submit"/"Create" buttons
    const nextBtn = page.locator('button[type="submit"]:has-text("Next"), button:has-text("Next"), button[type="submit"]:has-text("Submit"), button:has-text("Submit"), button[type="submit"]:has-text("Create"), button:has-text("Create"), button[type="submit"]:has-text("Register"), button:has-text("Register"), button:has-text("Continue")');
    const nextBtnVisible = await nextBtn.first().isVisible().catch(() => false);

    if (!nextBtnVisible) {
      console.log("✓ No more Next/Submit buttons found - flow complete");
      break;
    }

    const btnText = await nextBtn.first().textContent();
    console.log(`  → Next button found: "${btnText?.trim()}"`);
    console.log("  → Aborting inspection at this step");
    break; // Stop here to avoid submitting incomplete data
  }

  await browser.close();
})();
