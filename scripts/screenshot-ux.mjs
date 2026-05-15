import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';

const BASE = 'http://localhost:5174';
const OUT = './screenshots/ux';
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();

// Dev login + navigate
await page.goto(BASE + '/');
await page.evaluate(() => fetch('/api/auth/dev-login', { method: 'POST', credentials: 'include' }));
await page.goto(BASE + '/');
await page.waitForTimeout(800);
await page.click('text=Visual Test Mission').catch(() => {});
await page.waitForURL('**/map/**', { timeout: 10000 });
await page.waitForSelector('canvas', { timeout: 15000 });
await page.waitForTimeout(1500);

// Units panel — empty state
await page.click('button[title*="Units"]').catch(() => page.click('button:has-text("Units")'));
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/units-empty.png` });
console.log('units-empty');

// Groups panel — empty state
await page.click('button[title*="Groups"]').catch(() => page.click('button:has-text("Groups")'));
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/groups-empty.png` });
console.log('groups-empty');

// SPOTREP panel — empty state
await page.click('button[title*="SPOTREP"]').catch(() => page.click('button:has-text("SPOTREP")'));
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/contacts-empty.png` });
console.log('contacts-empty');

// Tasks panel — empty state
await page.click('button[title*="Tasks"]').catch(() => page.click('button:has-text("Tasks")'));
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/tasks-empty.png` });
console.log('tasks-empty');

// Operations panel — empty state
await page.click('button[title*="Operations"]').catch(() => page.click('button:has-text("Operations")'));
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/ops-empty.png` });
console.log('ops-empty');

// War Room — vectors tab
await page.click('button[title*="War Room"]').catch(() => page.click('button:has-text("War Room")'));
await page.waitForTimeout(600);
await page.click('button:has-text("Attack Vectors")').catch(() => {});
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/warroom-vectors.png` });
console.log('warroom-vectors');

// Radio Net — empty state
await page.click('button[title*="Radio Net"]').catch(() => page.click('button:has-text("Radio Net")'));
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/radio-empty.png` });
console.log('radio-empty');

await browser.close();
console.log('\nDone —', OUT);
