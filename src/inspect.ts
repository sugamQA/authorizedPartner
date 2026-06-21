import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto("https://authorized-partner.vercel.app/register", { waitUntil: "networkidle" });

  await page.waitForTimeout(3000);

  // Accept terms
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

  // Dump page title / URL
  console.log("\n=== Current URL:", page.url());
  console.log("=== Page Title:", await page.title());

  // Get all input fields, selects, buttons on the page
  const elements = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll("input, select, button, textarea"));
    return inputs.map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        type: (el as HTMLInputElement).type || "",
        name: (el as HTMLInputElement).name || "",
        id: el.id || "",
        placeholder: (el as HTMLInputElement).placeholder || "",
        text: el.textContent?.trim().substring(0, 50) || "",
        class: el.className?.substring(0, 80) || "",
        visible: rect.width > 0 && rect.height > 0,
        label: "",
      };
    });
  });

  console.log("\n=== All interactive elements:");
  elements.forEach((el, i) => {
    console.log(`${i + 1}. <${el.tag}${el.type ? ` type="${el.type}"` : ""}> id="${el.id}" name="${el.name}" placeholder="${el.placeholder}" text="${el.text}" visible=${el.visible}`);
  });

  // Dump full page HTML body (structured)
  console.log("\n=== Page structure (simplified):");
  const structure = await page.evaluate(() => {
    function getStructure(el: Element, depth = 0): string {
      if (depth > 5) return "";
      let result = "  ".repeat(depth) + "<" + el.tagName.toLowerCase();
      if ((el as HTMLElement).id) result += ` id="${(el as HTMLElement).id}"`;
      const cls = (el as HTMLElement).className;
      if (typeof cls === "string" && cls) result += ` class="${cls.substring(0, 40)}"`;
      result += ">\n";
      for (const child of el.children) {
        result += getStructure(child, depth + 1);
      }
      return result;
    }
    return getStructure(document.body);
  });
  console.log(structure);

  await browser.close();
})();
