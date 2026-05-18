import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';

const BASE = 'http://localhost:5173';
const OUT = './screenshots/radio';
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();

// Login
await page.goto(BASE + '/');
await page.evaluate(() => fetch('/api/auth/dev-login', { method: 'POST', credentials: 'include' }));
await page.goto(BASE + '/');
await page.waitForTimeout(1000);

// Go to existing mission (already created in previous run)
await page.waitForSelector('text=Visual Test Mission', { timeout: 5000 }).catch(() => {});
const missionExists = await page.locator('text=Visual Test Mission').isVisible().catch(() => false);

if (!missionExists) {
  await page.fill('input[placeholder="New mission name..."]', 'Test Mission');
  await page.click('button:has-text("Create Mission")');
  await page.waitForTimeout(1000);
}

await page.click('text=Visual Test Mission').catch(() => page.click('button:has-text("Test Mission")'));
await page.waitForURL('**/map/**', { timeout: 10000 });
await page.waitForSelector('canvas', { timeout: 15000 });
await page.waitForTimeout(2000);

// Click Radio Net button
console.log('Opening Radio Net panel...');
await page.click('button[title*="Radio"]').catch(async () => {
  // Try by text
  await page.click('button:has-text("Radio")');
});
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/radio-panel.png`, fullPage: true });
console.log('Radio panel screenshot taken');

// Click Multiplayer to see Discord sync
console.log('Opening Multiplayer panel...');
await page.click('button[title*="Multiplayer"]').catch(async () => {
  await page.click('button:has-text("Multiplayer")');
});
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/multiplayer-discord-sync.png`, fullPage: true });
console.log('Multiplayer (discord sync) screenshot taken');

await browser.close();
console.log('\nScreenshots saved to', OUT);
