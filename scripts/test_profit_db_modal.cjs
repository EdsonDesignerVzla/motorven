const puppeteer = require('puppeteer');

(async () => {
  let browser;
  try {
    console.log('--- Iniciando prueba de Modal Gestor Base de Datos Profit en Dashboard ---');
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

    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
        console.error('Browser error:', msg.text());
      }
    });
    page.on('pageerror', err => {
      errors.push(err.message);
      console.error('Page error:', err.message);
    });

    await page.goto('http://localhost:5180', { waitUntil: 'networkidle0', timeout: 30000 });
    console.log('Página cargada correctamente.');

    // Verificar que el botón de Gestionar BD Profit existe en el Dashboard
    await page.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some(b => b.innerText.includes('GESTIONAR BASE DE DATOS PROFIT') || b.innerText.includes('CRUD & Copia de Seguridad'));
    }, { timeout: 10000 });

    console.log('✅ Botón de "GESTIONAR BASE DE DATOS PROFIT" encontrado en el Dashboard.');

    // Hacer clic en el botón para abrir el modal
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.innerText.includes('GESTIONAR BASE DE DATOS PROFIT'));
      if (btn) btn.click();
    });

    // Esperar a que el modal se abra
    await page.waitForFunction(() => {
      return document.body.innerText.includes('GESTIÓN Y CONTROL DE BASE DE DATOS PROFIT PLUS 2K8');
    }, { timeout: 10000 });

    console.log('✅ Modal "GESTIÓN Y CONTROL DE BASE DE DATOS PROFIT PLUS 2K8" abierto con éxito.');

    // Verificar las pestañas dentro del modal
    const hasTabs = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        crudTab: text.includes('EXPLORADOR Y REGISTROS (CRUD)'),
        createTab: text.includes('CREAR NUEVO REGISTRO'),
        backupTab: text.includes('COPIA DE SEGURIDAD (BACKUP)'),
        sqlTab: text.includes('CONSOLA SQL INTERACTIVA')
      };
    });

    console.log('Pestañas detectadas en el modal:', hasTabs);

    if (!hasTabs.crudTab || !hasTabs.createTab || !hasTabs.backupTab) {
      throw new Error('Faltan pestañas requeridas en el modal.');
    }

    // Probar clic en la pestaña de Copia de Seguridad
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const backupBtn = btns.find(b => b.innerText.includes('COPIA DE SEGURIDAD'));
      if (backupBtn) backupBtn.click();
    });

    await page.waitForFunction(() => {
      return document.body.innerText.includes('GENERADOR DE COPIA DE SEGURIDAD PARA') || document.body.innerText.includes('RESPALDO NATIVO SQL (.BAK)');
    }, { timeout: 8000 });

    console.log('✅ Pestaña de Copia de Seguridad cargada con opciones .BAK y Snapshot .JSON.');

    // Probar clic en la pestaña de Crear Nuevo Registro
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const createBtn = btns.find(b => b.innerText.includes('CREAR NUEVO REGISTRO'));
      if (createBtn) createBtn.click();
    });

    await page.waitForFunction(() => {
      return document.body.innerText.includes('GUARDAR EN PROFIT PLUS (SQL SERVER)');
    }, { timeout: 8000 });

    console.log('✅ Pestaña de Formulario Crear/Modificar y botón GUARDAR EN PROFIT PLUS cargados.');

    await page.screenshot({ path: 'dist/profit_db_modal_test.png' });
    console.log('✅ Captura de pantalla guardada en dist/profit_db_modal_test.png');

    console.log(`\nPrueba completada con éxito. Total errores de consola: ${errors.length}`);
  } catch (err) {
    console.error('❌ Error durante la prueba:', err);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
})();
