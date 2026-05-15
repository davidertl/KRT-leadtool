import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';

const BASE = 'http://localhost:5174';
const OUT = './screenshots/warroom';
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();

// Dev login
await page.goto(BASE + '/');
await page.evaluate(() => fetch('/api/auth/dev-login', { method: 'POST', credentials: 'include' }));
await page.goto(BASE + '/');
await page.waitForTimeout(1000);

// Navigate to existing mission or create one
const missionExists = await page.locator('text=Visual Test Mission').isVisible().catch(() => false);
if (!missionExists) {
  const input = page.locator('input[placeholder="New mission name..."]');
  if (await input.isVisible()) {
    await input.fill('Visual Test Mission');
    await page.click('button:has-text("Create Mission")');
    await page.waitForTimeout(1000);
  }
}
await page.click('text=Visual Test Mission').catch(() => {});
await page.waitForURL('**/map/**', { timeout: 10000 });
await page.waitForSelector('canvas', { timeout: 15000 });
await page.waitForTimeout(2000);

// Screenshot menu bar
await page.screenshot({ path: `${OUT}/01-menubar.png` });
console.log('01-menubar taken');

// Click War Room button
console.log('Clicking War Room button...');
await page.click('button[title*="War Room"]').catch(async () => {
  await page.click('button:has-text("War Room")').catch(() => {});
});
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/02-warroom-readiness.png`, fullPage: false });
console.log('02-warroom-readiness taken');

// Click Threat Board tab
await page.click('button:has-text("Threat Board")').catch(() => {});
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/03-warroom-threats.png`, fullPage: false });
console.log('03-warroom-threats taken');

// Click Battle Roles tab
await page.click('button:has-text("Battle Roles")').catch(() => {});
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/04-warroom-roles.png`, fullPage: false });
console.log('04-warroom-roles taken');

// Click Vectors tab
await page.click('button:has-text("Vectors")').catch(() => {});
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/05-warroom-vectors.png`, fullPage: false });
console.log('05-warroom-vectors taken');

await browser.close();
console.log('\nAll screenshots saved to', OUT);
