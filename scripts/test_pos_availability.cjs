const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    await page.evaluateOnNewDocument(() => {
      localStorage.setItem('signum_active_user', JSON.stringify({
        id: 'usr-admin-master',
        username: 'edson designer',
        nombre: 'Edson Designer',
        rol: 'ADMINISTRADOR MASTER',
        modulos: ['dashboard', 'pedidos', 'inventario', 'ventas', 'vendedores', 'rentabilidad', 'compras', 'caja', 'cxc', 'cxp', 'reportes', 'auditoria', 'bases-datos', 'usuarios', 'notificaciones', 'configuracion']
      }));
    });

    console.log('Navigating to http://localhost:5180 ...');
    await page.goto('http://localhost:5180', { waitUntil: 'networkidle2', timeout: 30000 });

    // Click on the sidebar item with text "Ventas & POS"
    const clicked = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('*'));
      for (const el of items) {
        if (el.children.length === 0 && el.textContent.includes('Ventas & POS')) {
          el.click();
          return true;
        }
      }
      return false;
    });

    console.log('Clicked sidebar item:', clicked);
    await new Promise(r => setTimeout(r, 2000));

    const screenshotPath = path.join(__dirname, '..', 'dist', 'pos_availability_kpi_test.png');
    await page.screenshot({ path: screenshotPath });
    console.log('Screenshot saved to:', screenshotPath);

  } catch (err) {
    console.error('Error running test:', err);
  } finally {
    if (browser) await browser.close();
  }
})();
