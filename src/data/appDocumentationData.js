// ==============================================================================
// 📖 MANUAL DE USUARIO & DOCUMENTACIÓN CENTRALIZADA DE SIGNUM MOTORVEN
// Actualizado: Noviembre 2026 — Documentación integral y exhaustiva de todos
// los módulos comerciales, logísticos, CxC, CxP, Caja/Bancos, SENIAT y
// Contabilidad en Partida Doble (Plan de Cuentas Oficial Pro Motorven C.A.).
// ==============================================================================

export const SYSTEM_METADATA = {
  appName: "SIGNUM MOTORVEN ERP & POS",
  version: "5.5.0 Enterprise Multi-Device",
  company: "SIGNUM MOTORVEN, C.A. / GRUPO MOTORVEN",
  rif: "J-50478166-0",
  databaseSync: "Servidor Central PostgreSQL / Local DB (api.signummotorven.com) + Profit Plus GRUMOTOR",
  lastUpdated: "Noviembre 2026",
  author: "Equipo de Arquitectura, Finanzas y Sistemas SIGNUM MOTORVEN",
  recentMilestones: [
    "Plan de Cuentas Oficial Pro Motorven C.A. integrado al 100%: catálogo jerárquico de 156 cuentas en 6 grupos (Activo, Pasivo, Patrimonio, Ingresos, Costos, Egresos) con 99 cuentas imputables.",
    "Motor Contable Automático de Partida Doble (accountingService.js): asientos balanceados en tiempo real (Debe === Haber) para Ventas, Cobranzas, Compras SENIAT, Pagos a Proveedores y Caja Chica.",
    "Ciclo Contable Completo en Auditoría & Contable: Libro Diario, Libro Mayor General Analítico con naturaleza deudora/acreedora, Balance de Comprobación de Sumas y Saldos y Estados Financieros Básicos BA VEN-NIF 2 (Estado de Resultados Integral y Balance General con ecuación patrimonial cuadrada).",
    "Impresión Formal en PDF para Contabilidad: generadores dedicados tamaño Carta con firmas oficiales para Balance de Comprobación, Mayor General por cuenta y Estados Financieros BA VEN-NIF 2.",
    "Cuentas por Cobrar (CxC) Unificado con Registro de Cobros Parte A: separación Facturas Fiscales (Almacén 01) vs. Notas de Entrega (Almacén 02), actualización simultánea de documento, recibo COB-XXXXXX, Banco/Caja receptora, saldo del cliente y asiento contable.",
    "Integración Compras ➔ Retenciones SENIAT ➔ Cuentas por Pagar (CxP): cálculo automático de IVA, Retención de IVA (comprobante 14 dígitos), Retención de ISLR y Neto a Pagar, con tramos de mora, Notas de Crédito y Parte A de pagos a proveedores.",
    "Mapeo Inteligente de Proveedores y Tesorería: clasificación contable automática para Keyton (2.02.02.002), Kontigo (2.02.02.003) y Proveedores Comerciales (2.02.02.001), así como Cajas (1.01.01.001/.002/.004) y 10 Cuentas Bancarias (1.01.02.001-.008).",
    "Preventa Móvil y Flujo Comercial con Reserva ATP de 72 Horas: fórmula D = max(0, Stock Físico - Comprometido 72h - En Carrito), expiración automática de reservas vencidas y bloqueo estricto con stock 0 en Almacén 01 / Almacén 02.",
    "Alta y Aprobación de Clientes con Validación SENIAT Módulo 11: flujo controlado PENDIENTE ➔ APROBADO/RECHAZADO en Preventa, Ventas POS y CxC.",
    "Respaldo Automático y Despliegue Blindado: script de backup completo (npm run backup -> supabase/backups/) y despliegue automatizado verificado hacia signummotorven.com."
  ]
};

export const MODULES_DOCUMENTATION = [
  // ─────────────────────────────────────────────────────────
  // 1. DASHBOARD EJECUTIVO
  // ─────────────────────────────────────────────────────────
  {
    id: "dashboard",
    title: "Dashboard & Resumen Ejecutivo",
    icon: "LayoutDashboard",
    category: "Dirección & Gestión",
    badge: "Principal",
    roleRequired: "Master, TI, Gerencia, Administración",
    summary: "Centro de comando gerencial con KPIs en tiempo real de facturación, volumen en litros, cobranzas efectivas normalizadas, cuentas por cobrar/pagar, tasa BCV, filtro mensual/anual, acceso directo al Centro de Notificaciones & Alertas y rendimiento detallado de los 10 asesores comerciales.",
    components: [
      {
        name: "KPIs Gerenciales en Tiempo Real",
        description: "Tarjetas ejecutivas con Ventas Netas Facturadas (USD y Bs.), Litros Vendidos, Cobranza Efectiva Real (normalizada ante inconsistencias históricas de moneda), Cuentas por Cobrar pendientes y Cuentas por Pagar vigentes."
      },
      {
        name: "Barra de Filtro Mensual & Cierre Anual",
        description: "Selector interactivo que permite alternar entre el Cierre Anual Acumulado y cada mes individual (Enero a Diciembre). Al elegir un mes, todos los indicadores, rankings, gráficos y tacómetro se recalculan únicamente para ese período."
      },
      {
        name: "Tarjeta 'Meta Comercial Acumulada' & 'Meta de este Mes'",
        description: "Muestra la cuota consolidada proyectada para el período frente a la meta mensual vigente configurada en Fuerza de Ventas, con barra de progreso y porcentaje de cumplimiento."
      },
      {
        name: "Tacómetro de Cumplimiento & Rejilla de Asesores",
        description: "Visualizador radial del % total de cumplimiento comercial y desglose de los asesores en rejilla compacta con litros aportados, ventas, cobranza y ponderación individual."
      },
      {
        name: "Gráfico de Evolución Mensual / Ventas vs. Meta",
        description: "Gráfica interactiva comparativa mensual (Facturado vs. Cobrado vs. Meta) con código semáforo para detectar meses por debajo de cuota."
      },
      {
        name: "Top 5 Lubricantes Más Vendidos & Resumen de Cartera",
        description: "Ranking por volumen real en litros y resumen ejecutivo de salud de cartera CxC (Al Día vs. Vencida) y alertas operativas."
      }
    ],
    modals: [
      {
        name: "Resumen Ejecutivo Gerencial (ExecutiveSummaryModal)",
        buttonTrigger: "Botón 'Imprimir Resumen' / 'Resumen Ejecutivo' en cabecera del Dashboard",
        purpose: "Compila un informe gerencial completo con rentabilidad bruta, volumen en litros, cobranzas, cartera y cumplimiento comercial.",
        keyFeatures: [
          "Desglose de ingresos por línea de lubricantes",
          "Comparativa de efectividad de cobranza vs. facturación emitida",
          "Generación en PDF con membrete oficial y firmas de dirección"
        ]
      },
      {
        name: "Centro de Notificaciones & Alertas (NotificationsCenterModal)",
        buttonTrigger: "Botón 'Notificaciones & Alertas' en la barra de control del Dashboard",
        purpose: "Supervisión consolidada de quiebres ROP de inventario, moras >30 días en CxC/CxP, libros fiscales pendientes y estado de sincronización.",
        keyFeatures: [
          "Filtrado por categoría y severidad (Crítica, Advertencia, Información, Éxito)",
          "Navegación contextual 'Ir al Módulo' para resolver cada alerta",
          "Exportación de reporte oficial de alertas en PDF"
        ]
      }
    ],
    buttons: [
      {
        name: "Notificaciones & Alertas",
        color: "Dorado / Ámbar / Rojo",
        icon: "Bell",
        action: "Abre el Centro de Notificaciones & Alertas con el contador en tiempo real."
      },
      {
        name: "Selector Mensual (Ene - Dic / Anual)",
        color: "Cyan / Azul Motorven",
        icon: "Calendar",
        action: "Filtra todas las métricas del Dashboard al mes seleccionado o al acumulado anual."
      },
      {
        name: "Imprimir Reporte Dashboard PDF",
        color: "Rojo SIGNUM / Índigo",
        icon: "Printer",
        action: "Genera el PDF ejecutivo multipágina consolidado (Comercial, Financiero, Clientes y Operaciones)."
      },
      {
        name: "Sincronizar Datos / Recargar",
        color: "Verde Esmeralda",
        icon: "RefreshCw",
        action: "Refresca en vivo facturas, cobros, inventario, clientes, compras y cuentas bancarias."
      }
    ],
    bestPractices: [
      "Revisar el Dashboard al inicio de cada jornada validando la Tasa BCV vigente y el total de alertas críticas.",
      "Usar el filtro mensual en comités semanales para comparar el avance de litros vs. la meta mensual asignada.",
      "Contrastar la tarjeta de Cobranzas del Dashboard con el saldo real en Caja Chica & Bancos."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 2. CENTRO DE NOTIFICACIONES & ALERTAS
  // ─────────────────────────────────────────────────────────
  {
    id: "notificaciones",
    title: "Centro de Notificaciones & Alertas",
    icon: "Bell",
    category: "Dirección & Supervisión",
    badge: "En Tiempo Real",
    roleRequired: "Todos los Roles (Acceso Global)",
    summary: "Bandeja centralizada de monitoreo preventivo que detecta automáticamente quiebres de inventario bajo punto de reorden (ROP), clientes con mora crítica, facturas CxP por vencer, cierres fiscales pendientes y eventos de sistema.",
    components: [
      {
        name: "Semáforo de Severidad",
        description: "Clasificación visual inmediata: Crítica (rojo, atención urgente), Advertencia (ámbar, seguimiento preventivo), Información (azul) y Éxito (verde)."
      },
      {
        name: "Pestañas por Categoría & Estado",
        description: "Separa alertas de Inventario, Cuentas por Cobrar, Cuentas por Pagar, Fiscal SENIAT y Sistema, con alternancia entre Pendientes y Leídas."
      },
      {
        name: "Buscador Instantáneo & Botón 'Ir al Módulo'",
        description: "Permite localizar alertas por palabra clave y saltar directamente al módulo responsable para corregir el problema desde la raíz."
      }
    ],
    modals: [
      {
        name: "Visor / Modal Centro de Notificaciones (NotificationsCenterModal)",
        buttonTrigger: "Botón campana en barra superior, menú lateral 'Notificaciones & Alertas' o tarjeta en Dashboard",
        purpose: "Gestionar masivamente alertas operativas, marcarlas como leídas o generar el informe oficial de auditoría.",
        keyFeatures: [
          "Botón 'Marcar Todas como Leídas' y limpieza de leídas",
          "Enlace directo al módulo causante de la alerta",
          "Impresión en PDF oficial de todas las alertas del sistema"
        ]
      }
    ],
    buttons: [
      {
        name: "Marcar Todas como Leídas",
        color: "Azul Motorven",
        icon: "CheckCircle2",
        action: "Limpia el contador de notificaciones no leídas tras validar los eventos."
      },
      {
        name: "Ir al Módulo",
        color: "Cyan",
        icon: "ExternalLink",
        action: "Navega automáticamente al módulo afectado (Inventario, CxC, CxP, Reportes, etc.)."
      },
      {
        name: "Imprimir Reporte PDF",
        color: "Rojo SIGNUM",
        icon: "Printer",
        action: "Genera el PDF certificado de notificaciones y alertas operativas."
      }
    ],
    bestPractices: [
      "No marcar una alerta crítica como leída sin antes haber ingresado al módulo afectado a verificarla.",
      "Exportar el Reporte PDF de Alertas semanalmente para seguimiento de comité gerencial."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 3. PREVENTA MÓVIL (VENDEDOR)
  // ─────────────────────────────────────────────────────────
  {
    id: "preventa",
    title: "Preventa Móvil (Vendedor) & Reserva ATP 72h",
    icon: "Smartphone",
    category: "Comercial & Ventas",
    badge: "ATP 72h",
    roleRequired: "Master, Gerencia, Administración, Ventas",
    summary: "Herramienta ágil diseñada para asesores comerciales en la calle y preventa. Calcula en tiempo real la disponibilidad ATP (Available-To-Promise) con reservas de 72 horas, separa estrictamente Facturas Fiscales (Almacén 01) de Notas de Entrega (Almacén 02) y envía órdenes directas a Caja.",
    components: [
      {
        name: "Motor de Disponibilidad ATP (Available-To-Promise)",
        description: "Fórmula estricta en vivo: Disponible ATP = max(0, Stock Físico del Almacén - Stock Comprometido en Pedidos Vigentes <72h - Unidades en Carrito). Evita sobreventa del mismo lote por múltiples vendedores simultáneos."
      },
      {
        name: "Segregación Estricta de Almacenes (01 vs 02)",
        description: "El vendedor elige el tipo de documento antes o durante el pedido: Almacén 01 para Facturas Fiscales (con IVA 16% / IGTF) o Almacén 02 para Notas de Entrega. El sistema valida el stock exacto de ese almacén."
      },
      {
        name: "Bloqueo Automático por Stock 0",
        description: "Impide estrictamente emitir pedidos o agregar renglones cuando algún SKU seleccionado tiene existencia disponible igual a 0 en el almacén correspondiente."
      },
      {
        name: "Reserva Temporal de 72 Horas",
        description: "Todo pedido enviado queda reservando el stock por 72 horas exactas. Si Caja no lo factura dentro de ese lapso, la rutina de expiración automática libera los litros para otros clientes."
      },
      {
        name: "Gestión Rápida de Clientes desde Calle",
        description: "Acceso integrado para postular nuevos clientes (con validación SENIAT de RIF) que quedan en cola de aprobación gerencial antes de despachar a crédito."
      }
    ],
    modals: [
      {
        name: "Registro de Nuevo Cliente (ClientRegistrationModal)",
        buttonTrigger: "Botón '+ Nuevo Cliente' en Preventa",
        purpose: "Registrar prospectos desde la calle validando RIF (J, V, E, G, P) con algoritmo Módulo 11 SENIAT.",
        keyFeatures: [
          "Validación automática de dígito verificador del RIF",
          "Estado inicial PENDIENTE DE APROBACIÓN para resguardo crediticio",
          "Asignación de zona comercial, dirección de entrega y vendedor"
        ]
      },
      {
        name: "Aprobación de Clientes (ClientApprovalsModal)",
        buttonTrigger: "Botón 'Aprobaciones' (para roles autorizados)",
        purpose: "Aprobar o rechazar altas de clientes enviadas por vendedores."
      }
    ],
    buttons: [
      {
        name: "Almacén 01 (Factura Fiscal) / Almacén 02 (Nota Entrega)",
        color: "Azul Motorven / Ámbar",
        icon: "Layers",
        action: "Alterna el almacén origen y el régimen fiscal aplicable al pedido."
      },
      {
        name: "Emitir Orden / Nota de Pedido",
        color: "Verde Esmeralda",
        icon: "CheckCircle2",
        action: "Envía el pedido al Pipeline de Caja, descuenta temporalmente el ATP por 72h y dispara alerta sonora en Caja."
      },
      {
        name: "Descargar Nota de Pedido PDF",
        color: "Rojo SIGNUM",
        icon: "Printer",
        action: "Genera el comprobante formal de Nota de Pedido con vigencia de reserva de 72 horas para enviar al cliente."
      }
    ],
    bestPractices: [
      "Verificar siempre que el cliente esté en estado APROBADO y dentro de su límite de crédito antes de prometer despacho a crédito.",
      "Seleccionar desde el inicio si el cliente requiere Factura Fiscal (Alm. 01) o Nota de Entrega (Alm. 02) para consultar el stock real de ese almacén.",
      "Hacer seguimiento a sus órdenes antes de las 72 horas para evitar que caduque la reserva ATP."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 4. FLUJO COMERCIAL & PEDIDOS
  // ─────────────────────────────────────────────────────────
  {
    id: "pedidos",
    title: "Flujo Comercial & Pipeline de Pedidos",
    icon: "Truck",
    category: "Comercial & Operaciones",
    badge: "Tiempo Real",
    roleRequired: "Master, Gerencia, Admin, Ventas, Almacén, Caja, Cobranza",
    summary: "Tablero central de seguimiento desde que el vendedor emite la orden en Preventa hasta que Caja la factura en POS y Almacén imprime la Guía de Despacho. Separa órdenes fiscales (Alm. 01) de notas de entrega (Alm. 02) con alertas sonoras y control de caducidad a 72 horas.",
    components: [
      {
        name: "Separación Visual Almacén 01 vs. Almacén 02",
        description: "Identifica con insignias claras cada orden como 'Factura Fiscal · Almacén 01' o 'Nota de Entrega · Almacén 02' evitando cruces de inventario o impuestos."
      },
      {
        name: "Campana Sonora Automática en Caja",
        description: "Cuando un asesor envía un nuevo pedido desde Preventa, el módulo activa una notificación sonora en el puesto de Caja para agilizar la atención y facturación."
      },
      {
        name: "Control de Vigencia & Expiración 72h",
        description: "Muestra el tiempo transcurrido desde la creación. Órdenes vencidas (>72h sin facturar) expiran automáticamente liberando el inventario comprometido en ATP."
      },
      {
        name: "Bloqueo de Auditoría en Facturación POS",
        description: "Al enviar una orden al POS Mostrador, los renglones, precios y almacén quedan vinculados y auditados contra el pedido original."
      }
    ],
    modals: [
      {
        name: "Modal Unificado de Pedidos & Ventas (OrdersSalesModal)",
        buttonTrigger: "Menú de 3 puntos ➔ 'PEDIDOS Y PREVENTAS' o creación rápida",
        purpose: "Permite crear, revisar pipeline, facturar o imprimir notas de pedido desde cualquier pantalla."
      },
      {
        name: "Guía de Despacho de Almacén (PDF)",
        buttonTrigger: "Botón 'Guía Despacho' en pedidos facturados",
        purpose: "Genera el documento formal de entrega física para Almacén y Transporte con firmas ancladas sobre el pie de página."
      }
    ],
    buttons: [
      {
        name: "Procesar / Facturar en POS",
        color: "Verde Esmeralda",
        icon: "ShoppingCart",
        action: "Carga el pedido automáticamente en Ventas & POS Mostrador para validar pago/crédito y emitir factura o nota de entrega."
      },
      {
        name: "Imprimir Nota de Pedido PDF",
        color: "Azul Índigo",
        icon: "Printer",
        action: "Genera el PDF de Nota de Pedido Vendedor con detalle de litros y vigencia de reserva 72h."
      },
      {
        name: "Imprimir Guía de Despacho PDF",
        color: "Ámbar / Gris",
        icon: "Truck",
        action: "Emite la orden de despacho oficial de almacén una vez facturado el pedido."
      }
    ],
    bestPractices: [
      "En Caja, atender prioritariamente los pedidos con más horas de antigüedad antes de que cumplan las 72 horas.",
      "Almacén nunca debe despachar mercancía física basada solo en Nota de Pedido; debe exigir la Factura o Nota de Entrega emitida."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 5. INVENTARIO DE LUBRICANTES
  // ─────────────────────────────────────────────────────────
  {
    id: "inventario",
    title: "Inventario de Lubricantes, Multialmacén & Kardex",
    icon: "Package",
    category: "Logística & Almacén",
    badge: "Crítico",
    roleRequired: "Master, TI, Gerencia, Admin, Almacén, Compras, Ventas",
    summary: "Control maestro de existencias de lubricantes en cajas y litros totales segregados entre Almacén 01 (Principal / Facturas Fiscales) y Almacén 02 (Central / Notas de Entrega), con valorización bimoneda, Kardex cronológico, matriz de reorden ROP y hojas de toma física.",
    components: [
      {
        name: "Segregación Física Almacén 01 vs. Almacén 02",
        description: "Muestra y filtra existencias independientes por almacén (Almacén 01 Fiscal y Almacén 02 Notas de Entrega) más el consolidado global en litros y cajas."
      },
      {
        name: "KPIs de Bodega & Valorización",
        description: "Volumen total en litros disponibles, valorización del stock al costo y al precio de venta en USD y Bs. BCV, y conteo por semáforo ROP."
      },
      {
        name: "Tabla Técnica con Semáforo ROP",
        description: "Listado con fotografía Oilstone ®, código SKU, viscosidad, litros por caja, stock Alm. 01, stock Alm. 02, costo, precio detal/mayor y margen %."
      },
      {
        name: "Filtros por Familia y Estado de Stock",
        description: "Filtros instantáneos por familia (Gasolina, Semisintético, Diésel, Motos, Transmisiones, Hidráulicos) y estado (Crítico 🔴, Reorden 🟡, Óptimo 🟢)."
      }
    ],
    modals: [
      {
        name: "Matriz de Reorden Inteligente (SmartReorderMatrixModal)",
        buttonTrigger: "Botón 'Matriz Reorden & Quiebres'",
        purpose: "Calcula Punto de Reorden (ROP) y Días de Inventario Restante (DOI) para sugerir compras exactas en cajas antes del agotamiento."
      },
      {
        name: "Kardex Físico y Mermas (InventoryKardexModal)",
        buttonTrigger: "Botón 'Kardex & Mermas'",
        purpose: "Historial detallado de entradas por compra, salidas por factura/nota de entrega y ajustes."
      }
    ],
    buttons: [
      {
        name: "Imprimir Inventario PDF (General / Alm. 01 / Alm. 02)",
        color: "Rojo SIGNUM",
        icon: "Printer",
        action: "Genera el PDF oficial valorizado general o filtrado estrictamente para Almacén 01 o Almacén 02."
      },
      {
        name: "Hoja de Toma Física PDF",
        color: "Gris Pizarra",
        icon: "FileText",
        action: "Emite formato para auditoría física en bodega (general o por almacén) con columnas de conteo y firmas."
      },
      {
        name: "Matriz Reorden & Quiebres",
        color: "Azul Índigo",
        icon: "Sliders",
        action: "Abre el simulador de reposición y cálculo de presupuesto de compra."
      },
      {
        name: "Exportar CSV",
        color: "Azul Cyan",
        icon: "FileSpreadsheet",
        action: "Descarga el inventario valorizado y existencias por almacén en Excel/CSV."
      }
    ],
    bestPractices: [
      "Revisar por separado Almacén 01 y Almacén 02 antes de ejecutar traslados o compras de reposición.",
      "Realizar Toma Física mensual por almacén y conciliar cualquier diferencia en el Kardex antes del cierre contable."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 6. VENTAS & POS MOSTRADOR
  // ─────────────────────────────────────────────────────────
  {
    id: "ventas",
    title: "Ventas & POS Mostrador (Facturación & Notas de Entrega)",
    icon: "ShoppingCart",
    category: "Comercial & Caja",
    badge: "Operativo",
    roleRequired: "Master, Gerencia, Admin, Ventas, Caja, Cobranza",
    summary: "Terminal de facturación fiscal (Almacén 01) y emisión de Notas de Entrega (Almacén 02) en mostrador. Valida stock disponible en tiempo real con bloqueo de stock 0, aplica IVA 16% + IGTF 3% en divisas, evalúa Score de Crédito, procesa devoluciones y actualiza automáticamente CxC, Caja y Libro Diario.",
    components: [
      {
        name: "Selector de Tipo de Documento & Almacén",
        description: "Permite emitir Factura Fiscal (descuenta de Almacén 01, calcula Base + IVA 16% + IGTF 3% si hay pago en divisas) o Nota de Entrega (descuenta de Almacén 02, sin recargo IVA)."
      },
      {
        name: "Bloqueo Estricto de Emisión sin Existencias",
        description: "Si algún SKU del pedido o carrito posee stock 0 en el almacén seleccionado (01 o 02), el sistema bloquea el cobro y notifica exactamente el faltante."
      },
      {
        name: "Condición Contado vs. Crédito",
        description: "Las ventas de Contado ingresan directamente a Caja/Banco y generan asiento de venta + cobro; las ventas a Crédito alimentan automáticamente la cartera CxC con su fecha de vencimiento."
      },
      {
        name: "Validación de Clientes & Aprobaciones",
        description: "Integra alta de clientes (con validación Módulo 11 SENIAT), directorio y panel de aprobaciones sin salir de Ventas."
      }
    ],
    modals: [
      {
        name: "Factura SENIAT Carta / Nota de Entrega PDF",
        buttonTrigger: "Al completar venta o desde el historial de ventas",
        purpose: "Emite Factura Carta SENIAT o Nota de Entrega tamaño Carta con QR estático de cuentas bancarias receptoras y dirección real del cliente."
      },
      {
        name: "Score de Crédito (CreditScoreEngineModal)",
        buttonTrigger: "Botón 'Score Crédito'",
        purpose: "Audita mora, uso de cupo y calificación (AAA a D) antes de autorizar ventas a crédito."
      },
      {
        name: "Devoluciones de Clientes (CustomerReturnsModal)",
        buttonTrigger: "Botón 'Devoluciones'",
        purpose: "Gestiona notas de crédito comerciales y reintegro físico de mercancía."
      }
    ],
    buttons: [
      {
        name: "Procesar Venta / Facturar",
        color: "Verde Esmeralda",
        icon: "CreditCard",
        action: "Valida stock, impuestos y crédito; descuenta inventario del almacén correspondiente y genera factura o nota."
      },
      {
        name: "Imprimir Factura SENIAT / NE PDF",
        color: "Rojo SIGNUM",
        icon: "Printer",
        action: "Genera el PDF legal o nota de entrega lista para entregar al cliente o imprimir."
      },
      {
        name: "Ticket Fiscal 80mm",
        color: "Gris Pizarra",
        icon: "FileText",
        action: "Abre la vista de ticket térmico 80mm para impresora de mostrador."
      }
    ],
    bestPractices: [
      "Confirmar siempre la forma de pago (Bs. vs. Divisas/Zelle) porque el pago en divisas activa el IGTF 3% en facturas fiscales.",
      "Verificar el Score de Crédito y saldo vencido antes de otorgar nuevos plazos a crédito."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 7. FUERZA DE VENTAS
  // ─────────────────────────────────────────────────────────
  {
    id: "vendedores",
    title: "Fuerza de Ventas, Zonas Comerciales & Comisiones",
    icon: "Award",
    category: "Comercial & RRHH",
    badge: "Gerencial",
    roleRequired: "Master, Gerencia, Administración, Ventas",
    summary: "Supervisión de los asesores comerciales con métricas de volumen vendido en litros, facturación neta, cobranza efectiva por asesor, asignación y reasignación de zonas comerciales, configuración de metas globales/individuales y liquidación formal de comisiones.",
    components: [
      {
        name: "Ranking de Asesores por Litros & Efectividad",
        description: "Tabla comparativa con zona asignada, clientes atendidos, litros vendidos, cajas, % cumplimiento de meta, facturación ($) y cobros efectivos ($)."
      },
      {
        name: "Gestión y Reasignación de Zonas Comerciales",
        description: "Permite editar el circuito o estado asignado a cada asesor actualizando en tiempo real Preventa, Pipeline y Cartera de Clientes."
      },
      {
        name: "Cobranzas por Asesor & Liquidación de Comisiones",
        description: "Calcula incentivos por facturación, cobranza efectiva y bonos sobre meta, generando comprobantes imprimibles con firmas."
      }
    ],
    modals: [
      {
        name: "Ficha Técnica de Asesor (SellerDetailModal)",
        buttonTrigger: "Botón 'Ver Ficha' en fila de vendedor",
        purpose: "Consulta detallada de facturas, cobros, clientes y zona del asesor."
      },
      {
        name: "Liquidación de Comisiones (SellerCommissionModal)",
        buttonTrigger: "Botón 'Liquidar'",
        purpose: "Registra el pago de comisiones con método, referencia bancaria y recibo PDF."
      }
    ],
    buttons: [
      {
        name: "Editar Zona Asignada",
        color: "Cyan / Azul",
        icon: "MapPin",
        action: "Reasigna territorio comercial al vendedor seleccionado."
      },
      {
        name: "Configurar Meta Mensual",
        color: "Azul Índigo",
        icon: "Sliders",
        action: "Define la cuota global en litros del mes y permite ajustes individuales por asesor."
      },
      {
        name: "Imprimir Reporte Vendedores PDF",
        color: "Rojo SIGNUM",
        icon: "Printer",
        action: "Genera el reporte consolidado oficial de fuerza de ventas."
      }
    ],
    bestPractices: [
      "Fijar la Meta Mensual en litros los primeros 3 días de cada mes para seguimiento diario.",
      "Liquidar comisiones únicamente sobre cobranzas efectivamente conciliadas en Banco/Caja."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 8. COMPRAS & PROVEEDORES (CON INTEGRACIÓN CXP)
  // ─────────────────────────────────────────────────────────
  {
    id: "compras",
    title: "Compras, Proveedores & Registro Fiscal SENIAT",
    icon: "ShoppingBag",
    category: "Finanzas & Procura",
    badge: "Integrado CxP",
    roleRequired: "Master, Gerencia, Administración, Compras, Almacén",
    summary: "Módulo de ingreso de compras a proveedores (lubricantes, envases, servicios y fletes). Calcula automáticamente IVA (16%/8%/0%), Retención de IVA (75%/100%) con comprobante oficial de 14 dígitos, Retención de ISLR SENIAT, suma inventario y crea la obligación neta en Cuentas por Pagar (CxP) y en el Libro Diario.",
    components: [
      {
        name: "Pestaña Historial de Compras Profit",
        description: "Listado consolidado de facturas de compra recibidas con proveedor, RIF, número de factura, control fiscal, base, IVA, costos adicionales y estatus."
      },
      {
        name: "Pestaña Registro Compra SENIAT (Motor Fiscal + CxP)",
        description: "Formulario integral para cargar nuevas facturas de proveedor: selecciona proveedor, alícuota (16%, 8% o Exento 0%), % Retención IVA (por defecto 75%), concepto y % Retención ISLR (ej. 2%). Calcula en vivo Total Factura, Retenciones y Monto Neto a Pagar."
      },
      {
        name: "Integración Automática Compras ➔ Inventario ➔ CxP ➔ Contabilidad",
        description: "Al registrar una compra fiscal: (1) Suma stock al inventario; (2) Genera Comprobante de Retención de 14 dígitos (AAAAMM + 8 dígitos); (3) Crea el documento en Cuentas por Pagar por el Neto a Pagar (Total - Ret. IVA - Ret. ISLR); (4) Asienta Débito a Inventario (1.04.01.001), Crédito Fiscal (1.05.01.005) y Costos por Servicios (5.01.01.002 si aplica flete) contra Retenciones y CxP del proveedor."
      }
    ],
    modals: [
      {
        name: "Retenciones ISLR SENIAT (IslrWithholdingModal)",
        buttonTrigger: "Botón 'Retenciones ISLR SENIAT' en cabecera de Compras",
        purpose: "Consulta y emisión de comprobantes oficiales de retención de ISLR por concepto tributario y beneficiario."
      },
      {
        name: "Matriz de Reorden (SmartReorderMatrixModal)",
        buttonTrigger: "Botón 'Matriz de Reorden' dentro de Compras",
        purpose: "Verifica necesidades de reposición antes de emitir órdenes de compra."
      },
      {
        name: "Detalle de Compra & Proveedor (ProfitPurchaseDetailModal / ProfitSupplierDetailModal)",
        buttonTrigger: "Clic en fila de compra o proveedor",
        purpose: "Inspección de renglones, costos unitarios y estado de cuenta histórico con el proveedor."
      }
    ],
    buttons: [
      {
        name: "Nueva Compra Fiscal SENIAT",
        color: "Azul Motorven",
        icon: "Plus",
        action: "Abre la pestaña de registro fiscal para ingresar factura de proveedor con cálculo automático de retenciones y pase a CxP."
      },
      {
        name: "Retenciones ISLR SENIAT",
        color: "Ámbar / Índigo",
        icon: "FileText",
        action: "Abre el gestor de comprobantes y conceptos de retención de ISLR."
      },
      {
        name: "Imprimir Reporte Compras PDF",
        color: "Rojo SIGNUM",
        icon: "Printer",
        action: "Genera el reporte oficial de compras y retenciones en PDF."
      }
    ],
    bestPractices: [
      "Registrar siempre toda factura de proveedor sujeta a retención desde 'Compras & Proveedores' para que CxP nazca automáticamente con el Neto a Pagar correcto.",
      "Verificar el N° de Control (00-XXXXXX) y RIF del proveedor antes de guardar para evitar rechazos en el TXT/Libro de Compras SENIAT."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 9. ANÁLISIS DE RENTABILIDAD & P&L
  // ─────────────────────────────────────────────────────────
  {
    id: "rentabilidad",
    title: "Análisis de Rentabilidad & P&L Operativo",
    icon: "TrendingUp",
    category: "Estratégico & Costos",
    badge: "BI Financiero",
    roleRequired: "Master, Gerencia, Administración",
    summary: "Estado de Resultados gerencial en cascada (Waterfall P&L), margen de contribución por litro vendido ($/L), rentabilidad por familia de lubricantes y simulador financiero What-If para evaluación de precios y costos.",
    components: [
      {
        name: "Cascada de Resultados (Waterfall P&L)",
        description: "Desglose financiero: Ingresos Netos ➔ (-) Costo de Mercancía Vendida (CMV) ➔ Utilidad Bruta ➔ (-) Fletes, Comisiones y Deducciones ➔ EBITDA Operativo."
      },
      {
        name: "Rendimiento Neto por Litro ($/L) & Familia",
        description: "Mide cuántos dólares de utilidad neta genera cada litro comercializado por línea de aceite."
      }
    ],
    modals: [
      {
        name: "P&L Operativo en Tiempo Real (OperationalPandLModal)",
        buttonTrigger: "Botón 'P&L Operativo'",
        purpose: "Presenta el estado gerencial completo con simulador interactivo de sensibilidad What-If."
      },
      {
        name: "Rentabilidad Individual por SKU (SkuProfitabilityModal)",
        buttonTrigger: "Clic sobre cualquier producto de la matriz",
        purpose: "Comparativa de precio de venta frente a costo de reposición y margen unitario."
      }
    ],
    buttons: [
      {
        name: "P&L Operativo en Tiempo Real",
        color: "Verde Esmeralda",
        icon: "TrendingUp",
        action: "Abre el simulador financiero y cascada de márgenes."
      },
      {
        name: "Imprimir Rentabilidad PDF",
        color: "Rojo SIGNUM",
        icon: "Printer",
        action: "Descarga el informe gerencial de rentabilidad y márgenes en PDF."
      }
    ],
    bestPractices: [
      "Simular cualquier descuento por volumen en el panel What-If antes de aprobar listas especiales de precios.",
      "Comparar la utilidad gerencial aquí con el Estado de Resultados Contable formal en Auditoría & Contable."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 10. CAJA CHICA & BANCOS (TESORERÍA)
  // ─────────────────────────────────────────────────────────
  {
    id: "caja",
    title: "Caja Chica, Cajas Operativas & Bancos",
    icon: "Wallet",
    category: "Tesorería & Finanzas",
    badge: "Tesorería",
    roleRequired: "Master, Gerencia, Administración, Caja, Cobranza",
    summary: "Control central de disponibilidad monetaria en USD y Bolívares. Administra Cajas Operativas (1.01.01.001 Caja Moneda Nacional, 1.01.01.002 Caja Divisas, 1.01.01.004 Zelle), las Cuentas Bancarias institucionales (1.01.02.001 a .008) y los movimientos de Caja Chica con clasificación contable automática.",
    components: [
      {
        name: "Cajas Operativas Multimoneda",
        description: "Saldos vivos de Caja Moneda Nacional (1.01.01.001), Caja Divisas (1.01.01.002) y Zelle (1.01.01.004). Se actualizan automáticamente cuando CxC registra cobros en efectivo/Zelle o CxP realiza pagos desde caja."
      },
      {
        name: "Cuentas Bancarias Oficiales Pro Motorven",
        description: "Monitoreo en vivo vinculado al Plan de Cuentas: Banco de Venezuela (1.01.02.001), Banco Mercantil (1.01.02.002), Banco Plaza 275 (1.01.02.003), Banco Plaza 694 (1.01.02.004), Bancaribe (1.01.02.005), Banco Activo (1.01.02.006), Bancamiga (1.01.02.007) y Banco Activo Fiscal 0378 (1.01.02.008)."
      },
      {
        name: "Movimientos de Caja Chica con Clasificación Contable",
        description: "Permite registrar Ingresos o Egresos menores. Según las palabras clave del concepto ingresado (ej. 'Nómina', 'Electricidad', 'Papelería', 'Teléfono', 'Traspaso'), el motor contable asigna automáticamente la cuenta de Egresos Grupo 6 (6.01.xx) o Traspaso correspondiente."
      }
    ],
    modals: [
      {
        name: "Formulario de Movimiento de Caja / Ajuste de Cuenta",
        buttonTrigger: "Botón '+ Registrar Movimiento de Caja' / 'Editar Cuenta'",
        purpose: "Asienta ingresos/egresos de caja chica en USD o Bs. y actualiza saldos de tesorería."
      }
    ],
    buttons: [
      {
        name: "+ Registrar Movimiento de Caja",
        color: "Rojo SIGNUM",
        icon: "Plus",
        action: "Registra gasto operativo o ingreso menor especificando tipo, método (BS / USD / ZELLE) y concepto."
      },
      {
        name: "Imprimir Reporte Caja & Bancos PDF",
        color: "Azul Índigo",
        icon: "Printer",
        action: "Genera el PDF consolidado de disponibilidad total en Cajas y Bancos con doble moneda."
      },
      {
        name: "Exportar Arqueo CSV",
        color: "Gris",
        icon: "Download",
        action: "Descarga el historial completo de movimientos de caja chica."
      }
    ],
    bestPractices: [
      "Describir siempre el rubro exacto en los egresos de Caja Chica (ej. 'Pago electricidad Corpoelec', 'Compra resma papelería') para que la contabilidad los clasifique en la subcuenta 6.01 correcta en lugar de 'Gastos Varios'.",
      "Conciliar diariamente los saldos mostrados aquí con los estados de cuenta bancarios y el Mayor General de las cuentas 1.01.01 y 1.01.02."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 11. CUENTAS POR COBRAR (CXC)
  // ─────────────────────────────────────────────────────────
  {
    id: "cxc",
    title: "Cuentas por Cobrar (CxC), Cobros Parte A & Cartera",
    icon: "DollarSign",
    category: "Finanzas & Cartera",
    badge: "Ciclo Completo",
    roleRequired: "Master, Gerencia, Administración, Cobranza, Caja, Ventas",
    summary: "Módulo integral de gestión de cartera de clientes. Separa estrictamente Facturas Fiscales (Almacén 01) y Notas de Entrega (Almacén 02), controla vencimientos y días de mora reales, permite registrar cobros en Parte A con actualización automática en 5 puntos del ERP, y ofrece Consolidado por Cliente, WhatsApp, Scoring y Directorio con validación RIF.",
    components: [
      {
        name: "Separación por Origen: Facturas Fiscales vs. Notas de Entrega",
        description: "Pestañas dedicadas para auditar Facturas Fiscales (Almacén 01, con IVA 16% + IGTF 3%) y Notas de Entrega (Almacén 02) sin mezclar bases imponibles ni correlativos."
      },
      {
        name: "Estados de Cartera & Regla de Saldado (PAGADA <= $0.01)",
        description: "Clasifica cada documento en POR_VENCER (vigente), VENCIDA (con días exactos de mora) o PAGADA (cuando el saldo restante es <= $0.01, reiniciando días vencidos a 0)."
      },
      {
        name: "Parte A: Formulario 'Para Registrar Cobros' (5 Actualizaciones Automáticas)",
        description: "Al cargar un documento en Parte A, indicar monto, tasa BCV, método, referencia y elegir Banco o Caja receptora: (1) Actualiza abonos y restante del documento; (2) Crea el recibo oficial COB-XXXXXX; (3) Suma el dinero al saldo de la Caja o Banco elegido; (4) Descuenta el saldo deudor del cliente; (5) Genera el asiento contable de partida doble (Debe: Banco/Caja -> Haber: 1.01.03.001 CxC)."
      },
      {
        name: "Gestión de Clientes: Alta, Aprobaciones y Directorio Maestro",
        description: "Incluye registro de nuevos clientes con validación SENIAT Módulo 11 de RIF (J, V, E, G, P), bandeja de aprobación administrativa y edición completa de cupos de crédito y zonas."
      }
    ],
    modals: [
      {
        name: "Consolidado de CxC por Cliente (CxcConsolidatedModal)",
        buttonTrigger: "Botón 'Consolidado CxC' o clic en cliente",
        purpose: "Agrupa todas las facturas y notas de entrega pendientes de un mismo cliente y genera un Estado de Cuenta Unificado en PDF."
      },
      {
        name: "Creación / Edición de Documento CxC (CxcInvoiceCreationModal)",
        buttonTrigger: "Botón '+ Nuevo Documento CxC' / Editar",
        purpose: "Permite cargar o ajustar saldos iniciales, fechas de vencimiento y documentos por cobrar."
      },
      {
        name: "Inteligencia de Cobranzas & WhatsApp (DebtCollectionIntelligenceModal)",
        buttonTrigger: "Botón 'Inteligencia Cobranzas'",
        purpose: "Matriz de Aging por tramos (1-15d, 16-30d, +30d), recordatorios pre-redactados para WhatsApp y PDF de cobranzas."
      },
      {
        name: "Score de Crédito (CreditScoreEngineModal)",
        buttonTrigger: "Botón 'Score de Crédito'",
        purpose: "Evalúa riesgo del cliente sobre 100 puntos (Rating AAA a D) antes de despachar nuevos pedidos."
      }
    ],
    buttons: [
      {
        name: "Registrar Cobro (Parte A)",
        color: "Verde Esmeralda",
        icon: "CheckCircle2",
        action: "Aplica abono o liquidación total al documento, crea recibo COB, acredita al Banco/Caja seleccionado y rebaja deuda del cliente."
      },
      {
        name: "Imprimir PDF CxC",
        color: "Rojo SIGNUM",
        icon: "Printer",
        action: "Descarga el reporte oficial PDF de la cartera filtrada por estado, cliente o fechas."
      },
      {
        name: "Consolidado por Cliente PDF",
        color: "Azul Motorven",
        icon: "FileText",
        action: "Genera el estado de cuenta consolidado del cliente con todas sus facturas pendientes."
      },
      {
        name: "Enviar Recordatorio WhatsApp",
        color: "Verde WhatsApp",
        icon: "ExternalLink",
        action: "Abre chat de WhatsApp con el mensaje estructurado de deuda en USD/Bs y cuentas bancarias."
      }
    ],
    bestPractices: [
      "Siempre seleccionar con exactitud el Banco o Caja donde cayó la transferencia o el efectivo antes de confirmar el cobro en Parte A.",
      "Conciliar al cierre del mes el total pendiente del Reporte CxC PDF contra el saldo del Mayor General de la cuenta 1.01.03.001 (Cuentas por Cobrar Comerciales)."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 12. CUENTAS POR PAGAR (CXP)
  // ─────────────────────────────────────────────────────────
  {
    id: "cxp",
    title: "Cuentas por Pagar (CxP), Proveedores & Pagos Parte A",
    icon: "Building2",
    category: "Finanzas & Procura",
    badge: "Ciclo Completo",
    roleRequired: "Master, Gerencia, Administración, Compras",
    summary: "Control exhaustivo de obligaciones con proveedores. Muestra facturas por pagar con saldo neto post-retenciones SENIAT, segmenta vencimientos por tramos de mora, permite aplicar Notas de Crédito y registra pagos a proveedores en Parte A rebajando automáticamente el banco/caja pagador y generando la partida doble contable.",
    components: [
      {
        name: "Filtros Inteligentes de Cartera & Tramos de Mora",
        description: "Filtros en vivo: Todos los Pendientes (oculta ya pagadas), Vigentes, Vencidas 1 a 15 días, Vencidas 16 a 30 días, Vencidas más de 30 días y Solo Solventes (saldo <= $0.01)."
      },
      {
        name: "Cálculo de Neto a Pagar (Integrado con Compras SENIAT)",
        description: "Cada compra fiscal genera la deuda en CxP aplicando la fórmula oficial: Neto a Pagar = Total Factura - Retención de IVA - Retención de ISLR, evitando pagar montos retenidos al proveedor."
      },
      {
        name: "Parte A: Formulario de Pagos a Proveedores",
        description: "Al seleccionar una factura pendiente, ingresar monto (abono o cancelación), referencia y Banco/Caja emisor: (1) Actualiza abonos y saldo (pasa a SOLVENTE si <= $0.01); (2) Registra el comprobante de pago al proveedor; (3) Descuenta automáticamente el saldo de la Caja o Banco emisor; (4) Reduce el saldo adeudado al proveedor; (5) Genera asiento PAGO_PROVEEDOR."
      },
      {
        name: "Aplicación de Notas de Crédito & Clasificación Contable",
        description: "Permite editar/ajustar documentos por Notas de Crédito de proveedores. Contablemente clasifica automáticamente Keyton/Keystone en 2.02.02.002, Kontigo/USDC en 2.02.02.003 y demás proveedores en 2.02.02.001 Cuentas por Pagar Comerciales."
      }
    ],
    modals: [
      {
        name: "Detalle y Estado de Cuenta de Proveedor (ProfitSupplierDetailModal)",
        buttonTrigger: "Clic sobre proveedor o documento",
        purpose: "Historial completo de facturas recibidas, desglose de IVA en Facturas Fiscales, retenciones, notas de crédito y pagos emitidos."
      },
      {
        name: "Modal Crear / Editar Documento CxP",
        buttonTrigger: "+ Nueva Cuenta por Pagar / Botón Editar",
        purpose: "Permite registrar o editar Facturas Fiscales (FACT con desglose de Base Imponible e IVA 16%) o Notas de Entrega (NE sin IVA), ingresando montos en Bolívares (Bs.) o Divisas ($ USD) con conversión equivalente bidireccional instantánea.",
        fields: ["Tipo de Documento (FACT vs NE)", "N° Documento", "Proveedor y RIF", "Fecha Emisión / Días / Vencimiento", "Tasa BCV / Keystone", "Base Imponible (USD / Bs)", "Monto IVA 16% (USD / Bs)", "Total / Abonos / Saldo (USD y Bs)"]
      }
    ],
    buttons: [
      {
        name: "Registrar Pago a Proveedor (Parte A)",
        color: "Verde Esmeralda",
        icon: "CheckCircle2",
        action: "Ejecuta el pago desde el Banco o Caja elegido, liquidando o abonando la factura y generando el asiento contable."
      },
      {
        name: "Aplicar Nota de Crédito / Guardar Doc CxP",
        color: "Azul Motorven",
        icon: "Sliders",
        action: "Registra notas de crédito, ajustes o nuevos documentos por pagar directamente en cartera."
      },
      {
        name: "Imprimir Reporte Oficial CxP PDF",
        color: "Rojo SIGNUM",
        icon: "Printer",
        action: "Genera el listado oficial PDF de cuentas por pagar segmentado por estado de vencimiento."
      }
    ],
    bestPractices: [
      "Nunca pagar el 100% bruto de una factura gravada sin verificar que la Retención de IVA e ISLR ya fueron deducidas del Neto a Pagar.",
      "Verificar disponibilidad en Caja Chica & Bancos antes de registrar transferencias de pago a proveedores.",
      "Conciliar al cierre de cada mes las subcuentas 2.02.02.001, 2.02.02.002 y 2.02.02.003 en el Mayor General contra el Reporte Oficial CxP PDF."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 13. LIBROS FISCALES SENIAT
  // ─────────────────────────────────────────────────────────
  {
    id: "reportes",
    title: "Libros Fiscales & Cumplimiento SENIAT",
    icon: "FileCheck2",
    category: "Fiscal & Tributario",
    badge: "Oficial SENIAT",
    roleRequired: "Master, TI, Gerencia, Administración",
    summary: "Motor tributario integral conforme a las providencias vigentes del SENIAT: Libros oficiales de Ventas (Art. 76) y Compras (Art. 75), exportador TXT de Retenciones de IVA de 16 columnas (Prov. SNAT/2013/00030), XML oficial de Retenciones ISLR, Reporte X y Cierre Z definitivo con hash SHA-256 (Prov. SNAT/2011/00071).",
    components: [
      {
        name: "Libro de Ventas (Art. 76 Reg. IVA) & Libro de Compras (Art. 75)",
        description: "Compilación cronológica con RIF validado, N° Factura, N° Control (00-XXXXXX), Base Imponible 16%/8%, Exento, IVA, IGTF 3% y Comprobantes de Retención de 14 dígitos."
      },
      {
        name: "Exportador TXT Retenciones de IVA (16 Columnas Tabuladas)",
        description: "Compila exactamente la estructura exigida por el portal SENIAT para las declaraciones quincenales de IVA retenido bajo Providencia SNAT/2013/00030."
      },
      {
        name: "Exportador XML Retenciones de ISLR",
        description: "Genera el archivo XML conforme al esquema XSD oficial del SENIAT con RIF de agente de retención, sujeto retenido, concepto, base, porcentaje e impuesto."
      },
      {
        name: "Reporte X & Cierre Z Diario con SHA-256 (Incluye Día en Cero)",
        description: "El Reporte X ofrece lectura parcial sin cerrar jornada; el Cierre Z consolida las ventas fiscales del día, incrementa el correlativo, actualiza el Gran Total Histórico y genera firma SHA-256 inmutable."
      }
    ],
    modals: [
      {
        name: "Ticket Fiscal 80mm — Reporte X / Cierre Z (FiscalTicketModal)",
        buttonTrigger: "Botones 'Reporte X (Parcial)' o 'Cierre Z Definitivo'",
        purpose: "Emulación térmica oficial de 80mm con desglose fiscal, métodos de pago, correlativo y hash SHA-256."
      },
      {
        name: "Comprobantes de Retención ISLR (IslrWithholdingModal)",
        buttonTrigger: "Botón 'Comprobantes ISLR'",
        purpose: "Emisión e inspección de certificados de retención ISLR emitidos a proveedores."
      }
    ],
    buttons: [
      {
        name: "Generar TXT Retenciones IVA SENIAT",
        color: "Verde Esmeralda",
        icon: "FileSpreadsheet",
        action: "Descarga el archivo .txt de 16 columnas tabuladas listo para cargar en el portal SENIAT."
      },
      {
        name: "Generar XML ISLR SENIAT",
        color: "Cyan / Azul",
        icon: "FileText",
        action: "Descarga el archivo .xml oficial de retenciones de ISLR."
      },
      {
        name: "Ejecutar Cierre Z Definitivo",
        color: "Rojo SIGNUM",
        icon: "CheckCircle2",
        action: "Sella la jornada fiscal del día (incluso en Día en Cero) y guarda el historial inmutable."
      },
      {
        name: "Imprimir Libro Fiscal Oficial PDF",
        color: "Azul Índigo",
        icon: "Printer",
        action: "Genera el PDF certificado del Libro de Ventas, Compras, Cierre Z o ISLR."
      }
    ],
    bestPractices: [
      "Ejecutar el Cierre Z al finalizar cada día hábil comercial (aun sin ventas en el día).",
      "Generar y validar el archivo TXT de Retenciones de IVA al cierre de cada quincena (días 15 y fin de mes) antes de declarar en el portal SENIAT."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 14. AUDITORÍA & CONTABILIDAD DIGITAL (PLAN DE CUENTAS + ESTADOS FINANCIEROS)
  // ─────────────────────────────────────────────────────────
  {
    id: "auditoria",
    title: "Auditoría, Plan de Cuentas Oficial & Contabilidad Digital",
    icon: "ShieldCheck",
    category: "Contabilidad & Auditoría",
    badge: "BA VEN-NIF 2",
    roleRequired: "Master, TI, Gerencia, Administración",
    summary: "Motor contable automatizado bajo el Plan de Cuentas Oficial de Pro Motorven C.A. (156 cuentas, 6 grupos, 99 imputables) y normativa BA VEN-NIF 2. Transforma automáticamente Ventas, Cobros, Compras, Pagos a Proveedores y Caja Chica en asientos de Partida Doble estricta (Debe === Haber), generando en vivo Libro Diario, Mayor General Analítico, Balance de Comprobación y Estados Financieros Básicos con impresión formal en PDF.",
    components: [
      {
        name: "Pestaña 1: Libro Diario (Partida Doble Automática)",
        description: "Lista todos los comprobantes ASI-XXXX generados automáticamente para VENTA, COBRO, COMPRA, PAGO_PROVEEDOR y CAJA_CHICA. Normaliza cobranzas históricas de Profit, desglosa descuentos en ventas (4.01.02.001) y costos por servicios/fletes (5.01.01.002), y resuelve cada banco/caja exacto."
      },
      {
        name: "Pestaña 2: Libro Mayor General Analítico",
        description: "Selector de cualquier cuenta activa para inspeccionar su naturaleza (DEUDORA / ACREEDORA), grupo, Total Cargos (Debe), Total Abonos (Haber) y tabla cronológica movimiento a movimiento con Saldo Acumulado en USD y Bs. Incluye exportación CSV y botón 'Imprimir Mayor PDF'."
      },
      {
        name: "Pestaña 3: Balance de Comprobación de Sumas y Saldos",
        description: "Tabla consolidada de todas las cuentas con Sumas Debe, Sumas Haber, Saldo Deudor y Saldo Acreedor. Muestra insignia automática 'CUADRADO (DEBE = HABER)' y permite hacer clic sobre cualquier fila para saltar directo a su Mayor General. Incluye CSV y botón 'Imprimir Balance PDF'."
      },
      {
        name: "Pestaña 4: Estados Financieros Básicos (BA VEN-NIF 2)",
        description: "Presenta en dos columnas: (1) Estado de Resultados Integral (Grupos 4 Ingresos, 5 Costos y 6 Egresos -> Utilidad Bruta y Resultado del Ejercicio 3.02.01.001 / 3.02.02.001) y (2) Balance General / Situación Financiera (Grupos 1 Activo, 2 Pasivo y 3 Patrimonio). Banner superior verifica matemáticamente Activo = Pasivo + Patrimonio + Resultado (Diferencia $0.00). Incluye CSV y botón 'Imprimir Estados PDF'."
      },
      {
        name: "Pestaña 5: Plan de Cuentas Oficial (156 Cuentas)",
        description: "Catálogo jerárquico completo de Pro Motorven C.A. con buscador por código/nombre/subgrupo, filtros por Grupo 1–6, filtro 'Solo Imputables' (99 cuentas operativas) e indicador de saldo del período actual por cuenta."
      },
      {
        name: "Pestaña 6 & 7: Bitácora de Auditoría & Exportación Oficial",
        description: "Trazabilidad completa de accesos, operaciones y eventos de seguridad del sistema, más formato oficial de exportación CSV/PDF para el Contador Público externo."
      }
    ],
    modals: [
      {
        name: "Detalle de Comprobante Contable (AccountingEntryModal)",
        buttonTrigger: "Clic en cualquier asiento del Libro Diario",
        purpose: "Inspección completa de líneas de cargo y abono en USD y Bs., usuario responsable, tasa BCV y documento origen."
      }
    ],
    buttons: [
      {
        name: "Imprimir Reporte (Contextual por Pestaña)",
        color: "Rojo SIGNUM",
        icon: "Printer",
        action: "Imprime automáticamente el PDF formal correspondiente a la pestaña activa: Libro Diario, Mayor General, Balance de Comprobación, Estados Financieros BA VEN-NIF 2 o Bitácora."
      },
      {
        name: "Imprimir Mayor PDF / Balance PDF / Estados PDF",
        color: "Rojo SIGNUM",
        icon: "Printer",
        action: "Botones dedicados dentro de cada vista contable para descargar el documento Tamaño Carta con totales y 3 firmas oficiales."
      },
      {
        name: "Exportar CSV (Diario / Mayor / Balance / Estados / Plan)",
        color: "Gris / Azul",
        icon: "Download",
        action: "Descarga archivos CSV delimitados para apertura directa en Excel y sistemas contables externos."
      }
    ],
    bestPractices: [
      "Verificar al cierre de cada mes que el Balance de Comprobación muestre 'CUADRADO (DEBE = HABER)' y que Estados Financieros marque 'Diferencia: $0.00'.",
      "Revisar mensualmente el Mayor General de 1.01.03.001 (CxC) y 2.02.02.001/.002/.003 (CxP) frente a los listados operativos de CxC y CxP.",
      "Imprimir y archivar en PDF el Balance de Comprobación y los Estados Financieros BA VEN-NIF 2 para firmas de Contabilidad y Gerencia."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 15. GESTIÓN DE USUARIOS & ROLES
  // ─────────────────────────────────────────────────────────
  {
    id: "usuarios",
    title: "Gestión de Usuarios & Jerarquía de 9 Roles",
    icon: "Users",
    category: "Seguridad & Administración",
    badge: "Master TI",
    roleRequired: "Master, Tecnología & Informática, Gerencia, Administración",
    summary: "Administración de operadores bajo 9 roles jerárquicos oficiales (1. Administrador Master, 2. Tecnología & Informática, 3. Gerencia, 4. Administración, 5. Ventas, 6. Almacén, 7. Caja, 8. Cobranza, 9. Compras), permisos modulares granulares, visualización segura de contraseñas (.btn-password-eye), fotos optimizadas y bitácora de auditoría.",
    components: [
      {
        name: "Matriz de 9 Roles Institucionales",
        description: "Cada rol asigna automáticamente sus módulos recomendados (ej. COBRANZA -> CxC/Caja/Ventas/Pedidos; COMPRAS -> Compras/CxP/Inventario; ADMINISTRACIÓN -> acceso completo administrativo y contable)."
      },
      {
        name: "Control de Contraseñas & Estado Activo",
        description: "Visibilidad ergonómica con botón ojo de tamaño fijo (.btn-password-eye), cambio de clave mostrando clave actual verificada y suspensión temporal mediante interruptor Activo/Inactivo sin borrar historial."
      }
    ],
    modals: [
      {
        name: "Crear / Editar Operador y Cambiar Contraseña",
        buttonTrigger: "Botones 'Nuevo Operador', Lápiz o Llave",
        purpose: "Configurar perfil, departamento, rol, accesos por casilla de módulo, foto comprimida y credenciales."
      }
    ],
    buttons: [
      {
        name: "Nuevo Operador",
        color: "Rojo SIGNUM / Azul",
        icon: "Plus",
        action: "Da de alta un nuevo usuario con rol y módulos autorizados."
      },
      {
        name: "Cambiar Contraseña / Ver Clave",
        color: "Ámbar / Cyan",
        icon: "Sliders",
        action: "Consulta o actualiza credenciales dejando rastro en bitácora de auditoría."
      },
      {
        name: "Imprimir Nómina de Usuarios PDF",
        color: "Azul Índigo",
        icon: "Printer",
        action: "Genera reporte oficial PDF de operadores, cargos, roles y bitácora."
      }
    ],
    bestPractices: [
      "Asignar exclusivamente el rol COBRANZA o CAJA al responsable de Cuentas por Cobrar y COMPRAS o ADMINISTRACIÓN al responsable de Cuentas por Pagar.",
      "Usar el switch Activo/Inactivo para bajas de personal en lugar de eliminar usuarios con historial."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 16. BARRA SUPERIOR & TASAS
  // ─────────────────────────────────────────────────────────
  {
    id: "header_rates",
    title: "Barra Superior: Tasas Cambiarias, Tema & Estado",
    icon: "DollarSign",
    category: "Global / Cabecera",
    badge: "En Todo Momento",
    roleRequired: "Todos los Roles (Acceso Global)",
    summary: "Cabecera permanente con Tasa Oficial BCV, Tasa Keystone, Euro, USDT Binance, indicador de conexión/cola offline, badge del Ejercicio Fiscal, conmutador de Tema Claro/Oscuro WCAG AAA y menú rápido de Configuración y Centro de Ayuda.",
    components: [
      {
        name: "Indicadores Cambiarios en Vivo (BCV / Keystone / EUR / USDT)",
        description: "Permiten sincronizar la tasa oficial BCV con un clic o ajustar la tasa comercial Keystone, recalculando importes en Bolívares en todo el sistema."
      },
      {
        name: "Indicador Offline-First & Cola de Sincronización",
        description: "Muestra en verde la conexión activa con servidor central; en amarillo/rojo si opera sin internet guardando operaciones en cola segura para sincronizar al volver la red."
      },
      {
        name: "Conmutador de Tema (Sol / Luna) & Menú de 3 Puntos",
        description: "Cambia entre modo Claro de alto contraste y modo Oscuro; el menú lateral derecho da acceso directo a Pedidos, Configuración y Ayuda."
      }
    ],
    modals: [
      {
        name: "Sincronizador BCV / Tasa Keystone / Estado del Servidor",
        buttonTrigger: "Clic en las insignias superiores",
        purpose: "Actualizar tasas oficiales y verificar latencia de red con servidor central."
      }
    ],
    buttons: [
      {
        name: "Tasa BCV / Keystone",
        color: "Azul / Ámbar",
        icon: "DollarSign",
        action: "Abre la ventana de actualización de tasa cambiaria oficial o comercial."
      },
      {
        name: "Sol / Luna (Tema Visual)",
        color: "Neutro",
        icon: "Sliders",
        action: "Alterna instantáneamente entre modo claro y oscuro."
      },
      {
        name: "Menú 3 Puntos (...)",
        color: "Cyan",
        icon: "Compass",
        action: "Despliega accesos rápidos a Pedidos & Preventa, Configuración y Centro de Ayuda."
      }
    ],
    bestPractices: [
      "Confirmar la actualización de Tasa BCV al iniciar la mañana antes de emitir facturas, cobros o pagos a proveedores."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 17. CONFIGURACIÓN GENERAL DEL SISTEMA
  // ─────────────────────────────────────────────────────────
  {
    id: "configuracion",
    title: "Configuración General, Crédito & WhatsApp",
    icon: "Sliders",
    category: "Dirección & Administración",
    badge: "Parámetros",
    roleRequired: "Master, TI, Gerencia, Administración",
    summary: "Panel maestro de parametrización corporativa: datos legales de la empresa, RIF, alícuotas IVA (16%) e IGTF (3%), meta comercial en litros, aprobadores autorizados de crédito, plantillas dinámicas de mensajes WhatsApp para cobranzas, sonidos de alertas de caja y exportación de configuración.",
    components: [
      {
        name: "Identidad Corporativa & Alícuotas Fiscales",
        description: "Razón social, RIF, dirección fiscal, teléfono, correo, IVA % e IGTF % aplicados globalmente en facturación y PDFs."
      },
      {
        name: "Aprobadores de Crédito & Parámetros Comerciales",
        description: "Lista oficial de usuarios autorizados para aprobar límites de crédito de clientes nuevos y meta comercial base en litros."
      },
      {
        name: "Plantilla WhatsApp Cobranzas & Audio de Alertas",
        description: "Personalización del texto de cobro con variables ({cliente}, {montoUsd}, {montoBs}, {diasMora}) e interruptor de sonido para campana de órdenes en Caja."
      }
    ],
    modals: [
      {
        name: "Modal de Configuración Global (AppConfigModal)",
        buttonTrigger: "Menú lateral 'Configuración General' o Menú 3 puntos ➔ CONFIGURACIÓN",
        purpose: "Editar y persistir parámetros globales del ERP y emitir Ficha Técnica en PDF."
      }
    ],
    buttons: [
      {
        name: "Guardar Configuración",
        color: "Verde Esmeralda",
        icon: "CheckCircle2",
        action: "Aplica los parámetros en todo el sistema de forma inmediata."
      },
      {
        name: "Imprimir Ficha de Configuración PDF",
        color: "Rojo SIGNUM",
        icon: "Printer",
        action: "Descarga el informe técnico oficial con todos los parámetros activos."
      }
    ],
    bestPractices: [
      "No modificar alícuotas fiscales (IVA/IGTF) salvo cambio oficial publicado en Gaceta Oficial.",
      "Mantener actualizados los nombres de aprobadores de crédito autorizados."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 18. EJERCICIO & PERÍODO FISCAL ANUAL
  // ─────────────────────────────────────────────────────────
  {
    id: "config_fiscal",
    title: "Ejercicio & Período Fiscal Anual",
    icon: "Calendar",
    category: "Dirección & Administración",
    badge: "Fiscal & Contable",
    roleRequired: "Todos los Roles (Lectura) / Master & Gerencia (Edición)",
    summary: "Control del año fiscal activo, fechas de apertura y cierre del ejercicio, y archivo histórico inmutable de ejercicios cerrados (historialEjercicios) con métricas consolidadas.",
    components: [
      {
        name: "Insignia de Período Fiscal en Cabecera",
        description: "Muestra año y rango vigente desde cualquier pantalla del sistema."
      },
      {
        name: "Historial de Cierres Anuales",
        description: "Tabla permanente con totales de litros, facturación neta, cobranzas, cantidad de facturas y estatus (Abierto / Cerrado Definitivo)."
      }
    ],
    modals: [
      {
        name: "Pestaña Fiscal de Configuración (AppConfigModal)",
        buttonTrigger: "Clic en el badge de Período Fiscal en barra superior",
        purpose: "Definir fechas del ejercicio y consolidar el cierre anual."
      }
    ],
    buttons: [
      {
        name: "Guardar Parámetros Fiscales",
        color: "Verde Esmeralda",
        icon: "CheckCircle2",
        action: "Actualiza las fechas oficiales de apertura y cierre del período."
      },
      {
        name: "Consolidar / Archivar Ejercicio",
        color: "Ámbar",
        icon: "Layers",
        action: "Guarda una instantánea histórica inmutable del ejercicio finalizado."
      }
    ],
    bestPractices: [
      "Consolidar el ejercicio únicamente tras cuadrar Balance de Comprobación, Estados Financieros y Libros SENIAT de diciembre."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 19. EXPLORADOR MULTI-BASE DE DATOS, BACKUPS & DESPLIEGUE
  // ─────────────────────────────────────────────────────────
  {
    id: "explorador_tablas",
    title: "Explorador de Base de Datos, Backups & Despliegue",
    icon: "Database",
    category: "Tecnología & Respaldo",
    badge: "TI & Master",
    roleRequired: "Administrador Master, Tecnología & Informática",
    summary: "Inspección directa de las tablas transaccionales del sistema (facturas, cobros, compras, cuentas por pagar, clientes, inventario, usuarios, bancos, cajas), respaldo completo previo a producción (supabase/backups/) y despliegue automatizado hacia signummotorven.com.",
    components: [
      {
        name: "Explorador de Tablas Transaccionales",
        description: "Visualización, búsqueda en tiempo real y exportación JSON de cada tabla del ecosistema local y servidor central."
      },
      {
        name: "Motor de Respaldo Integral (npm run backup)",
        description: "Genera copias completas con sello de fecha y hora exacta en supabase/backups/ (local_database_backup_YYYY-MM-DD_HH-mm-ss.json) antes de cualquier compilación o despliegue."
      },
      {
        name: "Despliegue Blindado a Producción (npm run deploy)",
        description: "Normaliza y sincroniza datos reales, compila la versión de producción en dist/, valida CNAME (signummotorven.com), backend_url.json, .nojekyll y 404.html, ejecuta respaldo automático y publica en el repositorio principal motorven."
      }
    ],
    modals: [
      {
        name: "Explorador Multi-Tabla (SupabaseTablesView)",
        buttonTrigger: "Botón 'Explorar Tablas' en barra de servidor del Dashboard",
        purpose: "Auditar registros crudos en vivo y exportar respaldos JSON por tabla."
      }
    ],
    buttons: [
      {
        name: "Explorar Tablas",
        color: "Cyan / Azul",
        icon: "Database",
        action: "Abre el inspector completo de tablas transaccionales."
      },
      {
        name: "Descargar Tabla JSON",
        color: "Verde Esmeralda",
        icon: "Download",
        action: "Exporta íntegramente los datos de la tabla seleccionada para respaldo local."
      }
    ],
    bestPractices: [
      "Ejecutar siempre un backup completo (npm run backup) antes de realizar cambios estructurales o despliegues a producción.",
      "Validar la suite de pruebas integral (npm test) y el build antes de publicar una nueva versión en signummotorven.com."
    ]
  }
];

// ==============================================================================
// PREGUNTAS FRECUENTES (FAQ) — EXHAUSTIVAS POR ÁREA
// ==============================================================================
export const FREQUENTLY_ASKED_QUESTIONS = [
  {
    question: "¿Cómo está estructurada la parte financiera y contable del sistema en SIGNUM MOTORVEN?",
    answer: "El sistema funciona en 4 pilares conectados en tiempo real: (1) Ingresos y CxC: facturación en Alm. 01/02 y cobros en Parte A; (2) Compras, SENIAT y CxP: carga de compras con retenciones de IVA/ISLR, Neto a Pagar y pagos a proveedores; (3) Tesorería: Cajas (1.01.01) y Bancos (1.01.02) actualizados automáticamente con cada cobro o pago; y (4) Contabilidad Automática en Auditoría & Contable: convierte todas las operaciones a asientos de partida doble bajo el Plan de Cuentas Oficial Pro Motorven C.A. (156 cuentas, 6 grupos) generando Libro Diario, Mayor General, Balance de Comprobación y Estados Financieros BA VEN-NIF 2."
  },
  {
    question: "¿Qué ocurre exactamente en el sistema cuando registro un cobro en Cuentas por Cobrar (Parte A)?",
    answer: "Al presionar 'Registrar Cobro' en Parte A se ejecutan 5 actualizaciones simultáneas sin intervención manual: (1) Suma el abono al documento y recalcula el restante (si es <= $0.01 pasa a PAGADA con 0 días de mora); (2) Crea el recibo oficial COB-XXXXXX; (3) Acredita el monto exacto en USD y Bs. al saldo del Banco o Caja receptora seleccionada en Caja Chica & Bancos; (4) Rebaja la deuda acumulada del cliente liberando su cupo de crédito; y (5) Genera automáticamente el asiento contable de Partida Doble (Debe: Banco/Caja -> Haber: 1.01.03.001 Cuentas por Cobrar Comerciales)."
  },
  {
    question: "¿Cómo se calcula el Neto a Pagar en Compras -> Cuentas por Pagar (CxP) con retenciones SENIAT?",
    answer: "Al registrar una compra fiscal en Compras & Proveedores (pestaña Registro Compra SENIAT), el sistema calcula: Total Factura = Subtotal + IVA (16%, 8% o 0%). Luego calcula Retención de IVA (por defecto 75% del IVA, emitiendo comprobante de 14 dígitos AAAAMM + 8 dígitos) y Retención de ISLR (ej. 2% sobre base no exenta). Finalmente, la cuenta por pagar nace por el Neto a Pagar = Total Factura - Retención IVA - Retención ISLR. Ejemplo: Factura de $1,000 + $160 IVA = $1,160; Ret. IVA $120 + Ret. ISLR $20 -> Neto en CxP = $1,020.00."
  },
  {
    question: "¿Qué ocurre exactamente al registrar un pago a proveedor en Cuentas por Pagar (Parte A)?",
    answer: "Al confirmar el pago desde Parte A en Cuentas por Pagar (CxP): (1) Descuenta el pago del documento CxP (cambia a SOLVENTE si el saldo restante es <= $0.01); (2) Guarda el comprobante de pago al proveedor; (3) Rebaja automáticamente el saldo disponible del Banco o Caja emisor en Caja Chica & Bancos; (4) Reduce el saldo pendiente del proveedor; y (5) Genera el asiento PAGO_PROVEEDOR en el Libro Diario cargando a la cuenta CxP del proveedor (2.02.02.001, .002 o .003) contra el Banco/Caja pagador."
  },
  {
    question: "¿Cómo asigna el sistema las cuentas contables de Proveedores en CxP (Keyton, Kontigo, Comerciales)?",
    answer: "El Plan de Cuentas Oficial Pro Motorven C.A. identifica automáticamente al proveedor al contabilizar Compras y Pagos: si corresponde a Keyton / Keystone (o RIF 31115365) utiliza la cuenta 2.02.02.002 Cuentas por Pagar Keyton; si corresponde a Kontigo / USDC utiliza 2.02.02.003 Cuentas por Pagar Kontigo; para cualquier otro distribuidor o proveedor utiliza 2.02.02.001 Cuentas por Pagar Comerciales."
  },
  {
    question: "¿Cómo clasifica el sistema los Bancos, Cajas y Gastos de Caja Chica en el Plan de Cuentas?",
    answer: "Las cajas operativas corresponden a 1.01.01.001 (Caja Moneda Nacional), 1.01.01.002 (Caja Divisas) y 1.01.01.004 (Zelle). Los bancos mapean a 1.01.02.001 (Banco de Venezuela), .002 (Mercantil), .003 (Plaza 275), .004 (Plaza 694), .005 (Bancaribe), .006 (Banco Activo), .007 (Bancamiga) y .008 (Banco Activo Fiscal 0378). En Caja Chica, los egresos se asignan automáticamente a cuentas del Grupo 6 (ej. Sueldos 6.01.01.002, Electricidad 6.01.02.001, Teléfono 6.01.02.002, Papelería 6.01.03.001, etc.) según las palabras clave del concepto ingresado."
  },
  {
    question: "¿Cuántas cuentas tiene el Plan de Cuentas Oficial y cómo se estructuran los Estados Financieros?",
    answer: "El Plan de Cuentas Oficial de Pro Motorven C.A. cuenta con 156 cuentas distribuidas en 6 Grupos: 1. Activo, 2. Pasivo, 3. Patrimonio, 4. Ingresos, 5. Costos y 6. Egresos (con 99 cuentas imputables de movimiento). Bajo norma BA VEN-NIF 2, los Grupos 4, 5 y 6 alimentan el Estado de Resultados Integral determinando la Utilidad Bruta y el Resultado del Ejercicio (3.02.01.001 Superávit o 3.02.02.001 Déficit); los Grupos 1, 2 y 3 junto con el Resultado del Ejercicio conforman el Balance General validando matemáticamente que Activo = Pasivo + Patrimonio + Resultado (diferencia $0.00)."
  },
  {
    question: "¿Cómo imprimo en PDF el Balance de Comprobación, el Mayor General y los Estados Financieros?",
    answer: "Dentro del módulo 'Auditoría & Contable', ingrese a la pestaña 'Mayor General' (elija la cuenta y presione 'Imprimir Mayor PDF'), 'Balance de Comprobación' (presione 'Imprimir Balance PDF') o 'Estados Financieros' (presione 'Imprimir Estados PDF'). También puede presionar el botón superior 'Imprimir Reporte' que detecta la pestaña activa y emite el PDF tamaño Carta formal con firmas de Contabilidad, Contador Público y Gerencia General."
  },
  {
    question: "¿Por qué una venta o cobro histórico de Profit no infla los saldos en Contabilidad?",
    answer: "El motor contable (accountingService.js) normaliza automáticamente registros heredados de Profit Plus donde un monto en Bolívares fue copiado accidentalmente en el campo USD (comparando contra montoBs y tasa), resuelve cada forma de pago bancaria o de caja, contempla descuentos en ventas (4.01.02.001) y costos adicionales de compras (5.01.01.002), garantizando que el 100% de los asientos cumpla Debe === Haber al centavo."
  },
  {
    question: "¿Cuál es la diferencia operativa entre Facturas Fiscales (Almacén 01) y Notas de Entrega (Almacén 02)?",
    answer: "Las Facturas Fiscales descuentan exclusivamente del stock del Almacén 01 (Principal), aplican IVA 16% (e IGTF 3% si hay pago en divisas), poseen número de control SENIAT y alimentan el Libro de Ventas. Las Notas de Entrega descuentan del stock del Almacén 02 (Central) sin recargo fiscal IVA en el cobro y se visualizan en su pestaña separada dentro de CxC, Pipeline e Inventario."
  },
  {
    question: "¿Cómo funciona la Reserva ATP de 72 Horas y por qué se bloquea la emisión si hay Stock 0?",
    answer: "En Preventa Móvil, la disponibilidad real se calcula como: Disponible ATP = max(0, Stock Físico del Almacén - Stock Comprometido Vigente <72h - En Carrito). Al emitir un pedido, esas unidades quedan reservadas durante 72 horas para el cliente; si Caja no factura en 72 horas, el sistema expira el pedido y libera el stock automáticamente. Adicionalmente, tanto Preventa como Ventas POS bloquean estrictamente la emisión si cualquier SKU incluido tiene disponibilidad 0 en su almacén."
  },
  {
    question: "¿Cómo funciona el flujo de Alta y Aprobación de Clientes nuevos y la validación de RIF?",
    answer: "Al registrar un nuevo cliente en Preventa, Ventas o CxC, el sistema valida el formato del RIF (J, V, E, G, P) mediante el Algoritmo Módulo 11 del SENIAT. Los clientes registrados desde la calle o por roles comerciales quedan en estado PENDIENTE hasta que un rol autorizado (Administración, Gerencia, Master) los apruebe desde el modal 'Aprobaciones de Clientes'."
  },
  {
    question: "¿Cómo se actualizan y sincronizan los datos entre los módulos del sistema?",
    answer: "La aplicación trabaja conectada en vivo con el servidor central PostgreSQL / API Local (api.signummotorven.com) y el volcado sincronizado de Profit Plus GRUMOTOR. Al crear, editar o liquidar facturas, cobros, compras, pagos, inventario o clientes, los estados React y el almacenamiento persistente se actualizan en tiempo real."
  },
  {
    question: "¿Qué ocurre si se interrumpe la conexión a Internet mientras estoy facturando o registrando?",
    answer: "La aplicación posee arquitectura Offline-First: las transacciones procesadas sin red se resguardan en una cola local segura y se sincronizan automáticamente al restablecerse la conexión. El indicador superior avisa visualmente cuando opera en modo offline."
  },
  {
    question: "¿Cómo calcula el sistema el Score de Crédito de un cliente?",
    answer: "Evalúa 5 factores sobre 100 puntos: (1) Historial de mora en facturas saldadas (35%), (2) Utilización de línea de crédito (25%), (3) Volumen y recurrencia de compras (20%), (4) Confiabilidad en métodos de pago (10%) y (5) Cumplimiento fiscal y retenciones (10%). Clientes con mora >30 días o score <50 reciben alerta/bloqueo para nuevos créditos."
  },
  {
    question: "¿Qué significan los valores ROP y DOI en la Matriz de Reorden de Inventario?",
    answer: "DOI (Days of Inventory) indica cuántos días de cobertura quedan según el ritmo de rotación actual. ROP (Reorder Point) marca el nivel crítico que dispara la compra a planta considerando demanda durante el tiempo de entrega más stock de seguridad."
  },
  {
    question: "¿Cómo se personaliza el mensaje de cobranza por WhatsApp?",
    answer: "Ingrese a Configuración General (menú lateral o menú de 3 puntos ➔ CONFIGURACIÓN) ➔ pestaña 'Cobranzas & WhatsApp'. Puede editar la plantilla usando variables dinámicas como {cliente}, {montoUsd}, {montoBs} y {diasMora}."
  },
  {
    question: "¿Cuáles son los 9 roles oficiales del sistema y qué rol corresponde a CxC y CxP?",
    answer: "Los 9 roles en jerarquía son: (1) ADMINISTRADOR MASTER, (2) TECNOLOGÍA & INFORMÁTICA, (3) GERENCIA, (4) ADMINISTRACIÓN, (5) VENTAS, (6) ALMACEN, (7) CAJA, (8) COBRANZA y (9) COMPRAS. Para el encargado de CxC se asigna COBRANZA o CAJA (o ADMINISTRACIÓN si supervisa contabilidad); para el encargado de CxP se asigna COMPRAS o ADMINISTRACIÓN."
  },
  {
    question: "¿Cómo genera el sistema los archivos oficiales TXT de IVA y XML de ISLR para el SENIAT?",
    answer: "En el módulo 'Libros Fiscales SENIAT', presione 'Generar TXT SENIAT' para compilar las retenciones de IVA en formato de 16 columnas tabuladas (Providencia SNAT/2013/00030) y 'Generar XML ISLR' para emitir el archivo estructurado bajo el esquema XSD oficial del portal SENIAT."
  },
  {
    question: "¿Cómo funciona el Cierre Z fiscal diario y qué garantiza el Gran Total con SHA-256?",
    answer: "El Cierre Z consolida las ventas fiscales de la jornada, reinicia acumuladores diarios, incrementa el correlativo consecutivo y sella el Gran Total Histórico con un hash criptográfico SHA-256 conforme a la Providencia SNAT/2011/00071 (admitiendo también jornadas sin ventas o 'Día en Cero')."
  },
  {
    question: "¿Cómo realizar un respaldo completo de los datos y desplegar el sistema en GitHub?",
    answer: "Para respaldar la base de datos antes de cualquier operación crítica, ejecute 'npm run backup', lo cual crea una copia íntegra con timestamp en 'supabase/backups/'. Para compilar y publicar a producción ejecute 'npm run deploy', que normaliza datos, compila 'dist/', verifica CNAME (signummotorven.com), backend_url.json, .nojekyll y 404.html, genera backup previo y publica en el repositorio principal 'motorven'."
  },
  {
    question: "¿Cómo puedo consultar o cambiar la contraseña de un operador en Usuarios?",
    answer: "En 'Gestión de Usuarios' (roles Master, TI, Gerencia, Administración), use el ícono de ojo (.btn-password-eye) en la fila para revelar la clave o presione la llave 'Cambiar Contraseña' para ver la clave actual e ingresar y confirmar una nueva."
  },
  {
    question: "¿Cómo alternar entre el Modo Claro y el Modo Oscuro?",
    answer: "En la barra superior derecha junto a los indicadores de tasa, haga clic en el botón de Sol/Luna. Toda la aplicación, tablas y modales cambian de tema al instante manteniendo alto contraste WCAG."
  }
];

// ==============================================================================
// FLUJOS PASO A PASO (PROCEDIMIENTOS OPERATIVOS ESTÁNDAR)
// ==============================================================================
export const WORKFLOWS_STEP_BY_STEP = [
  {
    title: "1. Flujo de Preventa Móvil con Reserva ATP (72h) y Segregación de Almacén",
    steps: [
      "Ingrese al módulo 'Preventa Móvil (Vendedor)' desde el menú lateral.",
      "Seleccione el cliente (debe estar en estado APROBADO; si es nuevo, postúlelo con '+ Nuevo Cliente' validando RIF Módulo 11).",
      "Defina si el pedido es Factura Fiscal (Almacén 01 con IVA/IGTF) o Nota de Entrega (Almacén 02 sin IVA).",
      "Verifique la disponibilidad ATP en tiempo real (Stock Físico - Comprometido 72h) y agregue los lubricantes al pedido.",
      "Presione 'Emitir Nota de Pedido'. El stock queda reservado por 72 horas, suena la campana en Caja y puede descargar la Nota de Pedido en PDF."
    ]
  },
  {
    title: "2. Flujo Comercial de 3 Pasos: Preventa ➔ Facturación en Caja (POS) ➔ Guía de Despacho",
    steps: [
      "Paso 1 (Vendedor): Emite la orden en Preventa Móvil quedando en el Pipeline con su almacén asignado (01 o 02).",
      "Paso 2 (Cajera): Abre 'Flujo Comercial & Pedidos', ubica el pedido pendiente antes de que venza el plazo de 72 horas y presiona 'Procesar / Facturar en POS'.",
      "Paso 3 (POS Mostrador): El sistema carga automáticamente los renglones con bloqueo de auditoría, verifica que no exista stock 0 y evalúa Score de Crédito.",
      "Paso 4 (Emisión): Al confirmar el pago o plazo a crédito, se genera la Factura SENIAT (Alm. 01) o Nota de Entrega (Alm. 02) y se descuenta el inventario físico definitivo.",
      "Paso 5 (Despacho): Almacén imprime la 'Guía de Despacho' en PDF vinculada al documento fiscal para liberar la mercancía."
    ]
  },
  {
    title: "3. Flujo Completo de Registro de Cobro en CxC (Parte A) ➔ Banco/Caja ➔ Contabilidad",
    steps: [
      "Ingrese a 'Cuentas por Cobrar (CxC)' y seleccione la pestaña correspondiente: 'Facturas Fiscales (Alm. 01)' o 'Notas de Entrega (Alm. 02)'.",
      "En Parte B (cartera de documentos), localice el documento pendiente y cárguelo en Parte A ('Para Registrar Cobros').",
      "Verifique el monto abonado o total restante en USD, confirme la Tasa BCV aplicada, elija la forma de pago (TRANS, DEPO, TPAG, EFEC, ZELLE) e ingrese el N° de referencia bancaria.",
      "CRÍTICO: Seleccione exactamente la Caja o Cuenta Bancaria receptora donde ingresaron los fondos.",
      "Presione 'Registrar Cobro'. El sistema actualiza el documento (pasa a PAGADA si saldo <= $0.01), crea el recibo COB-XXXXXX, suma el dinero al Banco/Caja, rebaja la deuda del cliente y genera el asiento contable de partida doble."
    ]
  },
  {
    title: "4. Flujo de Alta y Aprobación de Clientes (Validación SENIAT Módulo 11)",
    steps: [
      "Desde Preventa, Ventas o CxC haga clic en '+ Nuevo Cliente'.",
      "Ingrese tipo y número de RIF (J, V, E, G, P); el sistema valida el dígito verificador con el algoritmo Módulo 11 del SENIAT.",
      "Complete razón social, dirección fiscal, teléfono, vendedor asignado, zona y límite de crédito solicitado, y guarde el registro (queda en estado PENDIENTE).",
      "Un usuario autorizado (Master, Gerencia o Administración) abre 'Aprobaciones de Clientes', revisa la ficha y aprueba o rechaza la solicitud."
    ]
  },
  {
    title: "5. Flujo Completo Compra Fiscal SENIAT ➔ Retenciones ➔ Cuenta por Pagar (CxP)",
    steps: [
      "Ingrese a 'Compras & Proveedores' y seleccione la pestaña 'Registro Compra SENIAT'.",
      "Seleccione el proveedor, ingrese N° de Factura, N° de Control (00-XXXXXX), fecha, subtotal y alícuota de IVA (16%, 8% o Exento 0%).",
      "Configure el porcentaje de Retención de IVA (por defecto 75% sobre el IVA) y Concepto/% de Retención de ISLR (ej. 2% sobre base no exenta).",
      "Verifique en el resumen previo el 'Neto a Pagar al Proveedor = Total Factura - Ret. IVA - Ret. ISLR'.",
      "Confirme el registro: el sistema suma el stock al inventario, emite el comprobante de retención de 14 dígitos, crea la deuda en CxP por el Neto a Pagar y genera el asiento COMPRA en Contabilidad."
    ]
  },
  {
    title: "6. Flujo de Pago a Proveedores y Notas de Crédito en Cuentas por Pagar (CxP Parte A)",
    steps: [
      "Ingrese al módulo 'Cuentas por Pagar (CxP)' y filtre la cartera por estado (Vigente, Vencido 1-15d, 16-30d o +30d).",
      "Si existe una Nota de Crédito o devolución del proveedor, aplíquela primero editando/guardando el documento CxP para rebajar el saldo pendiente.",
      "Seleccione la factura a cancelar para cargarla en Parte A (Formulario de Pago a Proveedor) y verifique monto, fecha y tasa BCV.",
      "Seleccione la Cuenta Emisora exacta (Banco o Caja con saldo disponible) e ingrese el número de referencia bancaria.",
      "Confirme el pago: el sistema pasa la factura a SOLVENTE si queda <= $0.01, rebaja el saldo del Banco/Caja emisor, reduce el saldo del proveedor y asienta el débito en 2.02.02.001/.002/.003 contra el banco pagador."
    ]
  },
  {
    title: "7. Flujo del Ciclo Contable Completo: Diario ➔ Mayor ➔ Balance ➔ Estados Financieros PDF",
    steps: [
      "Ingrese al módulo 'Auditoría & Contable'.",
      "En 'Libro Diario', verifique los asientos automáticos generados (VENTA, COBRO, COMPRA, PAGO_PROVEEDOR, CAJA_CHICA) y compruebe que todos muestran cuadre exacto Debe === Haber.",
      "Pase a 'Balance de Comprobación', confirme la insignia verde 'CUADRADO (DEBE = HABER)' e imprima con 'Imprimir Balance PDF'.",
      "Haga clic sobre cualquier cuenta (ej. 1.01.03.001 CxC o 2.02.02.002 CxP Keyton) para abrir su 'Mayor General', auditar los movimientos cronológicos con saldo acumulado e imprimir con 'Imprimir Mayor PDF'.",
      "Abra la pestaña 'Estados Financieros', confirme que el banner BA VEN-NIF 2 indique 'Ecuación Patrimonial Cuadrada (Diferencia: $0.00)' y descargue el documento formal para firmas con 'Imprimir Estados PDF'."
    ]
  },
  {
    title: "8. Flujo de Gestión de Cobranzas, Consolidado por Cliente y WhatsApp",
    steps: [
      "Ingrese a 'Cuentas por Cobrar (CxC)' y filtre documentos 'VENCIDA' o abra 'Inteligencia de Cobranzas'.",
      "Identifique clientes con facturas vencidas en tramos de 1-15, 16-30 o +30 días.",
      "Abra el 'Consolidado CxC por Cliente' para generar un solo estado de cuenta en PDF con todas sus facturas y notas de entrega pendientes.",
      "Presione 'Enviar WhatsApp' para abrir el chat con el mensaje estructurado en USD/Bs y cuentas bancarias oficiales."
    ]
  },
  {
    title: "9. Flujo de Cierre Fiscal Diario (Reporte Z) y Declaraciones TXT/XML al SENIAT",
    steps: [
      "Al concluir el día comercial, abra 'Libros Fiscales SENIAT' y ejecute 'Reporte X (Parcial)' para revisar ventas y bases del día.",
      "Presione 'Cierre Z Definitivo' para sellar la jornada (incluso si fue Día en Cero), incrementar correlativo e imprimir el ticket fiscal 80mm con hash SHA-256.",
      "Al cierre de cada quincena (días 15 y último de mes), presione 'Generar TXT Retenciones IVA' para descargar el archivo de 16 columnas tabuladas (Prov. SNAT/2013/00030).",
      "Al cierre mensual, descargue el Libro de Ventas, Libro de Compras y 'Generar XML ISLR' para presentar ante el portal SENIAT."
    ]
  },
  {
    title: "10. Flujo de Control de Caja Chica & Conciliación Bancaria Diaria",
    steps: [
      "Ingrese a 'Caja Chica & Bancos' y revise los saldos actuales de Cajas Operativas (1.01.01) y las Cuentas Bancarias (1.01.02).",
      "Para gastos menores operativos (servicios básicos, papelería, viáticos, nómina), presione '+ Registrar Movimiento de Caja' e indique claramente el rubro en el concepto.",
      "Compare los ingresos por cobros CxC y salidas por pagos CxP contra los movimientos reales en la banca en línea.",
      "Exporte el Arqueo CSV o imprima el 'Reporte Caja & Bancos PDF' al finalizar la jornada."
    ]
  },
  {
    title: "11. Flujo de Planificación de Reposición con Matriz de Reorden ROP",
    steps: [
      "Acceda a 'Inventario de Lubricantes' y presione 'Matriz Reorden & Quiebres'.",
      "Filtre por 'Quiebre Inmediato' o 'Reorden Urgente' revisando el almacén correspondiente (01 o 02).",
      "Evalúe las 'Cajas Sugeridas' y el presupuesto requerido en USD/Bs en el simulador de inversión.",
      "Genere la orden de compra o solicite reposición a planta."
    ]
  },
  {
    title: "12. Flujo de Creación de Operadores y Gestión de Roles/Contraseñas",
    steps: [
      "Con rol Master, TI, Gerencia o Administración, abra 'Gestión de Usuarios'.",
      "Presione 'Nuevo Operador', ingrese nombre, usuario, departamento y seleccione el rol adecuado (ej. COBRANZA para CxC, COMPRAS para CxP).",
      "Ajuste permisos modulares por casilla y guarde el perfil (o use 'Cambiar Contraseña' con validación de clave actual)."
    ]
  },
  {
    title: "13. Flujo de Backup Completo de Seguridad y Despliegue a Producción",
    steps: [
      "Antes de modificar datos masivos o publicar cambios, ejecute 'npm run backup' para crear un respaldo íntegro de supabase/local_database.json dentro de supabase/backups/.",
      "Ejecute la suite completa de pruebas ('npm test') y verifique 0 errores en compilación.",
      "Ejecute 'npm run deploy' para normalizar datos, compilar dist/, validar CNAME/backend_url.json/.nojekyll/404.html, generar un segundo respaldo automático y desplegar al repositorio principal motorven (signummotorven.com)."
    ]
  }
];
