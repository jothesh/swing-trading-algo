const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  await page.goto('http://localhost:5175', { waitUntil: 'domcontentloaded', timeout: 8000 });
  await page.waitForTimeout(1200);
  await page.getByText('Signals (CSV, offline)').click();
  await page.waitForTimeout(1200);
  await page.locator('button:has-text("Why?")').first().hover();
  await page.waitForTimeout(600);
  await page.screenshot({ path: '/tmp/final_csv.png' });
  await browser.close();
})();
