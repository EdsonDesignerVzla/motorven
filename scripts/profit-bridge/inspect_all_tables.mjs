import sql from 'mssql';
import { config } from './config.js';

async function inspectAllTables() {
  console.log('Connecting to', config.sql.server, config.sql.database);
  const pool = await sql.connect(config.sql);

  // Query all base tables with row count
  const tablesQuery = `
    SELECT 
      t.name AS TableName,
      p.rows AS RowCounts
    FROM sys.tables t
    INNER JOIN sys.partitions p ON t.object_id = p.object_id
    WHERE p.index_id IN (0, 1)
    AND p.rows > 0
    ORDER BY p.rows DESC;
  `;
  const res = await pool.request().query(tablesQuery);
  console.log('--- TABLAS CON DATOS EN PROFIT PLUS (GRUMOTOR) ---');
  console.table(res.recordset);

  // Let's check specific interesting tables
  const candidateTables = [
    'tras_alm', 'reng_tra', // Transferencias entre almacenes / sucursales
    'ajuste', 'reng_aju',   // Ajustes de inventario (mermas, entradas, salidas)
    'pedidos', 'reng_ped',  // Pedidos de venta oficiales
    'ordenes', 'reng_ord',  // Órdenes de compra a proveedores
    'nota_ent', 'reng_nde', // Notas de entrega / guías de despacho
    'nota_rec', 'reng_ndr', // Notas de recepción de mercancía
    'devol_cli', 'reng_dvc',// Devoluciones de clientes (RMA / garantías)
    'devol_pro', 'reng_dvp',// Devoluciones a proveedores
    'zona',                 // Zonas geográficas de distribución / rutas de entrega
    'transpor',             // Transportistas / Choferes / Camiones de reparto
    'tipo_cli',             // Tipos de cliente (Mayoristas, Detal, Talleres, Lubricentros)
    'tipo_pro',             // Tipos de proveedores
    'condicio',             // Condiciones de pago (Contado, Crédito 7d, 15d, 30d)
    'sub_lin',              // Sub-líneas de lubricantes
    'almacen',              // Almacenes / Depósitos (Principal, Secundario, Tránsito)
    'tabulador'             // Tabulador de fletes / comisiones
  ];

  console.log('\n--- VERIFICANDO ENTIDADES ADICIONALES DE VALOR ---');
  for (const tbl of candidateTables) {
    try {
      const check = await pool.request().query(`SELECT COUNT(*) as count FROM [${tbl}]`);
      const count = check.recordset[0].count;
      console.log(`Tabla [${tbl}]: ${count} registros`);
    } catch (e) {
      // Table doesn't exist
    }
  }

  pool.close();
}

inspectAllTables().catch(console.error);
