const { chromium, devices } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT_DIR = 'C:/Users/lewan/.gemini/antigravity/brain/b5f3447b-f153-4f6b-81cd-27d1335594dd/scratch/screenshots';

async function main() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({
    ...devices['iPhone 13'],
    locale: 'es-AR',
    colorScheme: 'light',
  });

  const page = await context.newPage();

  console.log('Navigating to login...');
  await page.goto('http://localhost:3000/login');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(OUT_DIR, '01_login.png') });

  console.log('Logging in...');
  await page.fill('input[name="email"]', 'owner@barber-bills.local');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');

  await page.waitForNavigation();
  await page.waitForLoadState('networkidle');

  console.log('Captured dashboard');
  await page.screenshot({ path: path.join(OUT_DIR, '02_dashboard.png'), fullPage: true });

  const routes = [
    { name: '03_sales', url: '/sales' },
    { name: '04_expenses', url: '/expenses' },
    { name: '05_barbers', url: '/barbers' },
    { name: '06_branches', url: '/branches' },
    { name: '07_services', url: '/services' },
    { name: '08_terminals', url: '/terminals' },
    { name: '09_reports', url: '/reports' },
    { name: '10_pos', url: '/pos' },
  ];

  for (const route of routes) {
    console.log(`Navigating to ${route.url}...`);
    await page.goto(`http://localhost:3000${route.url}`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(OUT_DIR, `${route.name}.png`), fullPage: true });
  }

  await browser.close();
  console.log('Done.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
