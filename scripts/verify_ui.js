import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  console.log("Navigating to http://localhost:5174/...");
  await page.goto('http://localhost:5174/', { waitUntil: 'networkidle2', timeout: 30000 });

  // Esperar a que el splash se complete
  await new Promise(r => setTimeout(r, 4500));

  const screenshotPath = 'C:\\Users\\edson\\.gemini\\antigravity\\brain\\6dd024ef-8877-4de2-9669-02250d99b263\\screenshot_app_online.png';
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
