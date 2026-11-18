# SIGNUM MOTORVEN • ESPECIFICACIÓN TÉCNICA: MÓDULO INVENTARIO Y STOCK CONSOLIDADO (ANTIGRAVITY)

## 1. Resumen Ejecutivo del Módulo
- **Módulo**: Inventario & Stock Físico Consolidado (`Alm 01 Fiscal SENIAT`, `Alm 02 Bóveda N/E` y `Consolidado Total`).
- **Entorno**: Grupo Motorven C.A. / OILSTONE ® por KEYSTONE, C.A.
- **Integración Backend**: Datos sincronizados en vivo desde Supabase PostgreSQL (`articulos`, `stock_almacen` / `products` realtime).
- **Modo de Operación**: **Solo Lectura (Read-Only / Consulta y Auditoría)**. Sin mutaciones de stock, compras ni generación de pedidos desde esta vista.
- **Exportación Oficial**: Descarga directa del Reporte Oficial PDF (`generateInventoryPDF`) con exclusión automática de SKUs en cero (`BR-INV-001`) y datos fiscales reales de la empresa (`config` / `currentUser`).

## 2. Reglas de Negocio
- **BR-INV-001 (Filtro Existencia Activa > 0)**: Todo artículo cuya suma `(stock01 + stock02) <= 0` queda excluido tanto de las tarjetas en pantalla como del PDF descargable.
- **BR-INV-002 (Matriz Tripartita & Presentación)**: Desglose obligatorio por `Alm 01 (SENIAT Fiscal)`, `Alm 02 (Bóveda N/E)` y `Consolidado Total (01+02)` con conversión en Litros y filtros por presentación (`Caja 12x1L`, `Paila 19L`, `Tambor 208L`, etc.).
- **BR-INV-003 (Reporte Oficial PDF)**: Botones de generación oficial PDF con firma y sello corporativo excluyendo ítems agotados.
