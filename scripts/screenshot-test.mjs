import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';

const BASE = 'http://localhost:5173';
const OUT = './screenshots';

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();

// 1. Dev login
console.log('Step 1: Dev login...');
await page.goto(BASE + '/login');
await page.screenshot({ path: `${OUT}/00-login-page.png` });

// Call dev-login from browser context so cookie is set in browser jar
const loginRes = await page.evaluate(async () => {
  const r = await fetch('/api/auth/dev-login', { method: 'POST', credentials: 'include' });
  return r.status;
});
console.log('  dev-login status:', loginRes);

// Reload → authStore.fetchUser() picks up cookie → navigates to dashboard
await page.goto(BASE + '/');
await page.waitForURL('**/', { timeout: 10000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/01-dashboard.png`, fullPage: true });
console.log('  Dashboard screenshot taken');

// 2. Create a mission
console.log('Step 2: Create mission...');
await page.fill('input[placeholder="New mission name..."]', 'Visual Test Mission');
await page.click('button:has-text("Create Mission")');
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/02-mission-created.png`, fullPage: true });
console.log('  Mission created screenshot taken');

// 3. Navigate to map — click the mission card
console.log('Step 3: Open map...');
await page.click('text=Visual Test Mission');
await page.waitForURL('**/map/**', { timeout: 10000 });
await page.waitForTimeout(2000); // let initial data fetch complete
await page.screenshot({ path: `${OUT}/03-map-loading.png`, fullPage: true });

// 4. Wait for 3D canvas to render
console.log('Step 4: Waiting for 3D canvas...');
await page.waitForSelector('canvas', { timeout: 20000 });
await page.waitForTimeout(4000); // let Three.js finish rendering nav points
await page.screenshot({ path: `${OUT}/04-3d-map.png`, fullPage: true });
console.log('  3D map screenshot taken');

// 5. Check canvas is actually painted (not blank)
const canvasPixels = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return null;
  const ctx2d = canvas.getContext('2d');
  if (!ctx2d) return 'webgl-canvas'; // WebGL canvas, can't read pixels this way
  const data = ctx2d.getImageData(0, 0, canvas.width, canvas.height).data;
  const nonBlack = [...data].filter((v, i) => i % 4 !== 3 && v > 0).length;
  return { width: canvas.width, height: canvas.height, nonBlackPixels: nonBlack };
});
console.log('  Canvas info:', canvasPixels);

// 6. Try to create a unit via popup
console.log('Step 5: Opening create unit panel...');
// Look for a "+" or "Create Unit" button
const createUnitBtn = page.locator('button[title*="Unit"], button:has-text("Unit"), button:has-text("Create"), [data-panel="createUnit"]').first();
const hasCreateBtn = await createUnitBtn.isVisible().catch(() => false);
if (hasCreateBtn) {
  await createUnitBtn.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/05-create-unit-panel.png`, fullPage: true });
  console.log('  Create unit panel screenshot taken');
} else {
  console.log('  Create unit button not found via title/text - taking full page shot');
  await page.screenshot({ path: `${OUT}/05-map-full.png`, fullPage: true });
}

await browser.close();
console.log('\nDone! Screenshots saved to', OUT);
