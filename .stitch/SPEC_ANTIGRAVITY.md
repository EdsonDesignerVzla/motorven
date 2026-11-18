# SIGNUM MOTORVEN • ESPECIFICACIÓN TÉCNICA Y ARQUITECTURA PARA ANTIGRAVITY (PRODUCTION READY)

## 1. Resumen Ejecutivo del Módulo
- **Módulo**: Preventa Móvil & Cartera CxC Vendedor en Campo (PWA Mobile-First).
- **Entorno Operativo**: Grupo Motorven C.A. / OILSTONE ® por KEYSTONE, C.A.
- **Integración ERP Backend**: Profit Plus 2K8 / SQL Server + Conciliación Bancaria Automática (Pago Móvil / Transferencias).
- **Régimen Bimonetario**: Moneda base de fijación de precios en USD ($ REF) con liquidación en Bolívares (Bs.) calculada en tiempo real según la Tasa Oficial del Banco Central de Venezuela (BCV).

---

## 2. Pantallas y Vistas Activas Validadas
1. **Preventa Móvil Vendedor (`SCREEN_4`)**:
   - Modo de Reserva Virtual en Profit Plus 2K8 (No descuenta stock físico hasta la confirmación y facturación en almacén).
   - Selector de Comprobante: Nota de Entrega (Almacén 02 / Bóveda / Exento) vs. Pedido Fiscal SENIAT (Almacén 01 / Principal / +16% IVA).
   - Selector y Ficha de Cliente con estatus financiero (Solvente, Límite de Crédito, Saldo Actual).
   - Catálogo de Lubricantes Oilstone (Cajas 12x1L, Pailas 19L) con buscador, selector incremental (`+ / -`) y cálculo dinámico de litraje y bultos.
   - Dock de Liquidación y Envío con desglose USD / Bs. (Tasa BCV).

2. **Cartera & Deuda CxC Vendedor (`SCREEN_2`)**:
   - Sincronización en tiempo real con Profit Plus 2K8 de pagos y cobranzas recibidas.
   - Métricas en vivo: Cobrado hoy, Recaudos en línea, Último abono acreditado.
   - KPI Strip Bimonetario con semáforo: Saldo Total por Cobrar, En Mora (Rojo), Por Vencer (Ámbar), Solventes (Verde).
   - Sistema de filtros: Razón Social, RIF, Correlativo (`FAC-` / `NE-`), Tipo de Documento y Estado de Cobranza.
   - Tarjetas de Clientes auditadas con desglose de facturas y notas de entrega pendientes, notificación inmediata de pagos y enlace directo a WhatsApp.

---

## 3. Matriz de Componentes y Reglas de Negocio (Business Rules)

### Regla 1: Control de Inventario y Preventa Virtual
```json
{
  "rule_id": "BR-PRE-001",
  "name": "Reserva Virtual Sin Afectación Física",
  "condition": "El vendedor crea un pedido en Preventa Móvil",
  "action": "INSERT INTO pedidos_preventa (tipo, cliente_id, items, tasa_bcv, status) VALUES (...)",
  "erp_sync": "Se registra en Profit Plus 2K8 como estatus 'PENDIENTE_APROBACION'. NO ejecuta transacciones de egreso de inventario ni descuenta de 'almacen_stock_fisico' hasta la validación de créditos y despacho."
}
```

### Regla 2: Multi-Almacén y Régimen Fiscal
```json
{
  "rule_id": "BR-FIS-002",
  "types": [
    {
      "code": "NE",
      "label": "Nota de Entrega",
      "almacen_id": "ALM-02",
      "description": "Despacho directo / Almacén Bóveda",
      "aplica_iva": false
    },
    {
      "code": "FAC",
      "label": "Factura Fiscal SENIAT",
      "almacen_id": "ALM-01",
      "description": "Almacén Principal",
      "aplica_iva": true,
      "tasa_iva_porcentaje": 16.0
    }
  ]
}
```

### Regla 3: Sincronización CxC y Liberación de Cupo
```json
{
  "rule_id": "BR-CXC-003",
  "trigger": "Acreditación de Pago Móvil / Transferencia en Profit 2K8",
  "behavior": "Socket / Webhook notifica a PWA del vendedor",
  "ui_update": {
    "saldo_exigible": "Resta monto abonado",
    "cupo_disponible": "Suma monto abonado de forma inmediata",
    "badge": "Muestra 'ABONO EN VIVO REGISTRADO' con correlativo de recibo"
  }
}
```

---

## 4. Estructura de Datos (Data Contract / Payload JSON)

### Payload de Envío de Preventa:
```json
{
  "header": {
    "vendedor_id": "ASESOR-04",
    "zona": "Centro-Occidente",
    "cliente_rif": "J-30981234-1",
    "cliente_razon_social": "Lubricantes Centro C.A.",
    "tipo_comprobante": "NE",
    "almacen_origen": "02",
    "tasa_bcv": 911.62,
    "timestamp": "2025-02-27T10:45:00Z"
  },
  "items": [
    {
      "sku": "000308",
      "descripcion": "OILSTONE 15W-40 SEMI-SINTÉTICO",
      "presentacion": "Caja 12x1L",
      "cantidad": 3,
      "litros_unitario": 12,
      "litros_totales": 36,
      "precio_unitario_usd": 48.00,
      "subtotal_usd": 144.00,
      "subtotal_bs": 131273.28
    },
    {
      "sku": "000704",
      "descripcion": "OILSTONE 20W-50 MINERAL",
      "presentacion": "Paila 19L",
      "cantidad": 1,
      "litros_unitario": 19,
      "litros_totales": 19,
      "precio_unitario_usd": 62.50,
      "subtotal_usd": 62.50,
      "subtotal_bs": 56976.25
    }
  ],
  "totals": {
    "total_bultos": 4,
    "total_litros": 55,
    "subtotal_usd": 206.50,
    "iva_usd": 0.00,
    "total_usd": 206.50,
    "total_bs": 188249.53
  },
  "despacho": {
    "observaciones": "Entregar en almacén posterior, recibir con factura/nota original.",
    "modalidad": "Flete Incluido"
  }
}
```

---

## 5. Checklist de Verificación y Validación Antigravity
- [x] **Consistencia Visual**: Tipografías Orbitron (Headers y Monospace) e Inter (Cuerpo), paleta corporativa `#002b7a` (Azul Motorven) y `#e60012` (Rojo Motorven).
- [x] **No Afectación de Stock**: Flujo preventa etiquetado con reserva lógica sin descontar existencia física.
- [x] **Régimen Bimonetario Preciso**: Cálculo matemático exacto a tasa BCV en todos los totales y subtotales.
- [x] **Aislamiento Modular**: Barra de navegación enfocada en los 2 sub-flujos clave (Preventa y Cartera & CxC).
- [x] **Auditoría Documental**: Coexistencia de Facturas Fiscales SENIAT y Notas de Entrega Alm 02.
- [x] **Webhooks / Eventos en Vivo**: Estructura de eventos para conciliar pagos móviles y actualizar cupo en tiempo real.
