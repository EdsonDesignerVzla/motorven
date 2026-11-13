import puppeteer from 'puppeteer';
import os from 'os';
import path from 'path';

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const targetUrl = process.env.VITE_URL || 'http://localhost:5180/';
  console.log(`Navigating to ${targetUrl}...`);
  await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });

  // Esperar a que el splash se complete
  await new Promise(r => setTimeout(r, 4500));

  const screenshotPath = process.env.SCREENSHOT_PATH || path.join(os.tmpdir(), 'signum_app_online.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`Screenshot saved to ${screenshotPath}`);

  // Verificar si el badge de conectividad existe
  const badgeText = await page.evaluate(() => {
    const el = document.querySelector('.sync-connectivity-badge');
    return el ? el.innerText : 'BADGE_NOT_FOUND';
  });
  console.log(`Sync Badge Text: ${badgeText}`);

  await browser.close();
})();
