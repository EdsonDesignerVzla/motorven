/**
 * ==============================================================================
 * 🚀 SIGNUM MOTORVEN ERP & POS - GOOGLE APPS SCRIPT BACKEND COMPLETO (Code.gs)
 * ==============================================================================
 * Versión: 4.8.0 Enterprise
 * Razón Social: SIGNUM MOTORVEN, C.A. / GRUPO MOTORVEN
 * RIF: J-30401927-4
 * Marca Oficial: OILSTONE ® por KEYSTONE, C.A.
 * Integración: Profit Plus 2K8 (SQL Server GRUMOTOR) + Supabase Realtime + Google Workspace
 * ==============================================================================
 */

// Configuración Global y Nombres de Hojas
var DB_CONFIG = {
  APP_NAME: "SIGNUM MOTORVEN ERP",
  VERSION: "4.8.0 Enterprise",
  SHEET_TABS: {
    CONFIG: "CONFIGURACION",
    PRODUCTOS: "PRODUCTOS_LUBRICANTES",
    CLIENTES: "CLIENTES_CARTERA",
    VENTAS: "VENTAS_POS",
    COMPRAS: "COMPRAS_PROVEEDORES",
    CAJA: "MOVIMIENTOS_CAJA",
    COBROS: "COBROS_CXC",
    PAGOS: "PAGOS_CXP",
    KARDEX: "INVENTARIO_KARDEX",
    AUDITORIA: "PISTAS_AUDITORIA",
    USUARIOS: "USUARIOS_ROLES"
  }
};

/**
 * ==============================================================================
 * 1. ENTRADA PRINCIPAL HTTP GET (doGet) - SERVICIO DE LA APLICACIÓN WEB
 * ==============================================================================
 */
function doGet(e) {
  var output;
  try {
    // Intenta evaluar la plantilla index.html compilada
    var template = HtmlService.createTemplateFromFile('index');
    output = template.evaluate();
  } catch (err) {
    // Modo Contenedor Seguro Responsivo para localhost o servidor remoto
    var appUrl = "http://localhost:5175";
    var containerHtml = 
      '<!DOCTYPE html>' +
      '<html lang="es">' +
      '<head>' +
      '  <meta charset="UTF-8">' +
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">' +
      '  <title>SIGNUM MOTORVEN ERP & POS</title>' +
      '  <link rel="icon" type="image/png" href="https://img.icons8.com/color/48/oil-industry.png">' +
      '  <style>' +
      '    * { margin:0; padding:0; box-sizing:border-box; }' +
      '    body, html { width:100%; height:100%; overflow:hidden; background-color:#060913; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }' +
      '    iframe { width:100%; height:100%; border:none; display:block; }' +
      '    #loading-box { position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); text-align:center; color:#00f0ff; z-index:10; }' +
      '    .spinner { width:44px; height:44px; border:3px solid rgba(0,240,255,0.2); border-top-color:#00f0ff; border-radius:50%; animation:spin 0.8s linear infinite; margin:0 auto 12px; }' +
      '    @keyframes spin { to { transform:rotate(360deg); } }' +
      '  </style>' +
      '</head>' +
      '<body>' +
      '  <iframe src="' + appUrl + '" allow="clipboard-read; clipboard-write; microphone; camera; display-capture; autoplay" onload="document.getElementById(\'loading-box\').style.display=\'none\';"></iframe>' +
      '  <div id="loading-box"><div class="spinner"></div><div style="font-weight:700; font-size:14px; letter-spacing:1px;">CARGANDO SIGNUM MOTORVEN ERP...</div></div>' +
      '</body>' +
      '</html>';
    output = HtmlService.createHtmlOutput(containerHtml);
  }

  return output
    .setTitle('SIGNUM MOTORVEN - ERP & POS Corporativo')
    .setFaviconUrl('https://img.icons8.com/color/48/oil-industry.png')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Función auxiliar para incluir archivos modulares .html en la plantilla
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * ==============================================================================
 * 2. ENTRADA PRINCIPAL HTTP POST (doPost) - API WEBHOOK Y SINCRONIZACIÓN
 * ==============================================================================
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // Bloqueo de concurrencia de 10s
    var raw = e.postData ? e.postData.contents : "{}";
    var body = JSON.parse(raw);
    var action = body.action || "ping";
    var result = { success: true, timestamp: new Date().toISOString() };

    switch (action) {
      case "ping":
        result.message = "SIGNUM MOTORVEN Apps Script Engine En Línea";
        result.version = DB_CONFIG.VERSION;
        break;

      case "sync_profit":
        result.data = handleSyncProfitData(body.payload);
        break;

      case "save_sale":
        result.data = handleSaveSale(body.sale);
        break;

      case "update_bcv_rate":
        result.data = handleUpdateBcvRate(body.rate);
        break;

      case "log_audit":
        result.data = handleLogAudit(body.audit);
        break;

      case "get_all_data":
        result.data = handleGetAllData();
        break;

      default:
        result.warning = "Acción no reconocida: " + action;
        break;
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString(),
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

/**
 * ==============================================================================
 * 3. CONTROLADORES DE BASE DE DATOS Y SINCRONIZACIÓN
 * ==============================================================================
 */

/**
 * Procesa y almacena una venta realizada en el POS
 */
function handleSaveSale(saleData) {
  if (!saleData) throw new Error("Datos de venta inválidos");
  var ss = getOrCreateSpreadsheet();
  var sheet = getOrCreateSheet(ss, DB_CONFIG.SHEET_TABS.VENTAS, [
    "ID_VENTA", "FECHA", "CLIENTE_RIF", "CLIENTE_NOMBRE", "TOTAL_USD", "TOTAL_BS", "TASA_BCV", "CONDICION", "METODO_PAGO", "ESTADO", "ITEMS_JSON", "OPERADOR"
  ]);

  var row = [
    saleData.id || ("VEN-" + Date.now()),
    saleData.fecha || Utilities.formatDate(new Date(), "GMT-4", "yyyy-MM-dd HH:mm:ss"),
    saleData.clienteRif || (saleData.cliente ? saleData.cliente.rif : ""),
    saleData.clienteNombre || (saleData.cliente ? saleData.cliente.nombre : "CLIENTE CONTADO"),
    saleData.totalUsd || 0,
    saleData.totalBs || 0,
    saleData.tasaBcv || 0,
    saleData.condicion || "CONTADO",
    saleData.metodoPago || "DIVISA_EFECTIVO",
    saleData.estado || "FACTURADO",
    JSON.stringify(saleData.items || []),
    saleData.operador || "SISTEMA"
  ];

  sheet.appendRow(row);
  return { id: row[0], saved: true };
}

/**
 * Sincroniza datos consolidados desde el daemon Profit Bridge (GRUMOTOR)
 */
function handleSyncProfitData(payload) {
  if (!payload) return { synced: false, message: "Payload vacío" };
  var ss = getOrCreateSpreadsheet();
  
  // Registrar log de sincronización
  var sheetAudit = getOrCreateSheet(ss, DB_CONFIG.SHEET_TABS.AUDITORIA, [
    "FECHA", "USUARIO", "ACCION", "MODULO", "DETALLES"
  ]);

  sheetAudit.appendRow([
    Utilities.formatDate(new Date(), "GMT-4", "yyyy-MM-dd HH:mm:ss"),
    "PROFIT_BRIDGE_DAEMON",
    "SYNC_PROFIT_2K8",
    "INTEGRACION_SQL",
    "Sincronizados: " + (payload.productsCount || 0) + " lubricantes, " + (payload.clientsCount || 0) + " clientes."
  ]);

  return { synced: true, timestamp: new Date().toISOString() };
}

/**
 * Actualiza la Tasa Oficial BCV en la hoja de configuración
 */
function handleUpdateBcvRate(rate) {
  if (!rate || isNaN(rate)) throw new Error("Tasa inválida");
  var ss = getOrCreateSpreadsheet();
  var sheet = getOrCreateSheet(ss, DB_CONFIG.SHEET_TABS.CONFIG, ["PARAMETRO", "VALOR", "ACTUALIZADO"]);
  
  var data = sheet.getDataRange().getValues();
  var found = false;
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === "TASA_BCV_USD") {
      sheet.getRange(i + 1, 2).setValue(rate);
      sheet.getRange(i + 1, 3).setValue(Utilities.formatDate(new Date(), "GMT-4", "yyyy-MM-dd HH:mm:ss"));
      found = true;
      break;
    }
  }

  if (!found) {
    sheet.appendRow(["TASA_BCV_USD", rate, Utilities.formatDate(new Date(), "GMT-4", "yyyy-MM-dd HH:mm:ss")]);
  }

  return { tasaDolar: rate, updated: true };
}

/**
 * Registra una pista de auditoría de seguridad
 */
function handleLogAudit(auditData) {
  if (!auditData) return { logged: false };
  var ss = getOrCreateSpreadsheet();
  var sheet = getOrCreateSheet(ss, DB_CONFIG.SHEET_TABS.AUDITORIA, [
    "FECHA", "USUARIO", "ACCION", "MODULO", "DETALLES"
  ]);

  sheet.appendRow([
    Utilities.formatDate(new Date(), "GMT-4", "yyyy-MM-dd HH:mm:ss"),
    auditData.usuarioNombre || auditData.usuario || "USUARIO",
    auditData.accion || "ACCION",
    auditData.modulo || "SISTEMA",
    auditData.detalles || ""
  ]);

  return { logged: true };
}

/**
 * Recupera todos los datos consolidados para arranque inicial
 */
function handleGetAllData() {
  var ss = getOrCreateSpreadsheet();
  var result = {};
  for (var key in DB_CONFIG.SHEET_TABS) {
    var tabName = DB_CONFIG.SHEET_TABS[key];
    var sheet = ss.getSheetByName(tabName);
    if (sheet) {
      var values = sheet.getDataRange().getValues();
      if (values.length > 1) {
        var headers = values[0];
        var rows = [];
        for (var r = 1; r < values.length; r++) {
          var item = {};
          for (var c = 0; c < headers.length; c++) {
            item[headers[c]] = values[r][c];
          }
          rows.push(item);
        }
        result[key.toLowerCase()] = rows;
      } else {
        result[key.toLowerCase()] = [];
      }
    }
  }
  return result;
}

/**
 * ==============================================================================
 * 4. FUNCIONES AUXILIARES DE ESTRUCTURA Y HOJAS DE CÁLCULO
 * ==============================================================================
 */

/**
 * Obtiene o crea la hoja de cálculo principal vinculada al script
 */
function getOrCreateSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    // Si no está vinculada, busca o crea en Google Drive
    var files = DriveApp.getFilesByName("DB_SIGNUM_MOTORVEN_ERP");
    if (files.hasNext()) {
      ss = SpreadsheetApp.open(files.next());
    } else {
      ss = SpreadsheetApp.create("DB_SIGNUM_MOTORVEN_ERP");
    }
  }
  return ss;
}

/**
 * Obtiene una pestaña específica o la crea con sus encabezados oficiales
 */
function getOrCreateSheet(ss, sheetName, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground("#002b7a");
      headerRange.setFontColor("#ffffff");
      headerRange.setFontWeight("bold");
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

/**
 * Inicializador global de toda la base de datos (Ejecutar una sola vez manualmente si se desea)
 */
function setupSpreadsheetDatabase() {
  var ss = getOrCreateSpreadsheet();
  
  // 1. Configuración
  getOrCreateSheet(ss, DB_CONFIG.SHEET_TABS.CONFIG, ["PARAMETRO", "VALOR", "ACTUALIZADO"]);
  
  // 2. Productos / Lubricantes
  getOrCreateSheet(ss, DB_CONFIG.SHEET_TABS.PRODUCTOS, [
    "CODIGO", "DESCRIPCION", "VISCOSIDAD", "TIPO", "STOCK_UNIDADES", "STOCK_LITROS", "PRECIO_USD", "COSTO_USD", "ROP", "ESTADO"
  ]);

  // 3. Clientes
  getOrCreateSheet(ss, DB_CONFIG.SHEET_TABS.CLIENTES, [
    "CODIGO_PROFIT", "RIF", "NOMBRE", "ZONA", "TELEFONO", "DIRECCION", "DIAS_CREDITO", "LIMITE_CREDITO_USD", "SALDO_DEUDOR_USD", "SCORE_CREDITO"
  ]);

  // 4. Ventas POS
  getOrCreateSheet(ss, DB_CONFIG.SHEET_TABS.VENTAS, [
    "ID_VENTA", "FECHA", "CLIENTE_RIF", "CLIENTE_NOMBRE", "TOTAL_USD", "TOTAL_BS", "TASA_BCV", "CONDICION", "METODO_PAGO", "ESTADO", "ITEMS_JSON", "OPERADOR"
  ]);

  // 5. Pistas de Auditoría
  getOrCreateSheet(ss, DB_CONFIG.SHEET_TABS.AUDITORIA, [
    "FECHA", "USUARIO", "ACCION", "MODULO", "DETALLES"
  ]);

  Logger.log("¡Base de datos Google Sheets para SIGNUM MOTORVEN configurada con éxito!");
}
