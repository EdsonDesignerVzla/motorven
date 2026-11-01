// ==============================================================================
// 📖 MANUAL DE USUARIO & DOCUMENTACIÓN CENTRALIZADA DE SIGNUM MOTORVEN
// Actualizado: Octubre 2026 — incluye todos los módulos, roles y flujos actuales.
// ==============================================================================

export const SYSTEM_METADATA = {
  appName: "SIGNUM MOTORVEN ERP & POS",
  version: "5.0.0 Enterprise Multi-Device",
  company: "SIGNUM MOTORVEN, C.A. / GRUPO MOTORVEN",
  rif: "J-30401927-4",
  databaseSync: "Supabase (GRUMOTOR SQL Server) + Supabase PostgreSQL Realtime",
  lastUpdated: "Octubre 2026",
  author: "Equipo de Arquitectura y Desarrollo de Sistemas SIGNUM MOTORVEN",
  recentMilestones: [
    "Sincronización Bidireccional Completa (CRUD) Supabase ↔ Supabase: Crear, Guardar/Modificar y Eliminar clientes, lubricantes y pedidos en vivo.",
    "Motor Smart Merge: Fusión inteligente de datos que preserva imágenes HD 4K, fichas de viscosidad, especificaciones de laboratorio, contraseñas encriptadas, roles y georreferenciación GPS.",
    "Gestión Inteligente de Eliminación: Hard-delete para registros limpios y Soft-delete automático para resguardar la trazabilidad fiscal SENIAT.",
    "Directorio Oficial de Clientes con alta, edición, desactivación y sincronización en tiempo real con Supabase.",
    "Sincronización Anual 2026 Completa con Supabase SQL Server (GRUMOTOR): 2.493 facturas, 4.050 renglones y 155.199,9 Litros reales facturados.",
    "Ejercicio y Período Fiscal Parametrizable con fechas de inicio y corte editables y preservación de historial de cierres anuales.",
    "Explorador Multi-Base de Datos en vivo de las 49 tablas transaccionales de SQL Server y réplica local autónoma.",
    "Arquitectura Standalone 100% Autónoma con soporte para despliegue web estático en GitHub Pages (carpeta dist y ZIP).",
    "Centro de Notificaciones & Alertas en tiempo real con persistencia local e impresión oficial PDF.",
    "Gestión, asignación y reasignación de Zonas Comerciales por Asesor de Ventas con cuotas individuales.",
    "Jerarquía estricta de 9 Roles con blindaje ergonómico de contraseñas (.btn-password-eye) y cero solapamientos.",
    "Batería completa y homologada de 28 Reportes Oficiales en PDF con membrete corporativo y firmas legales."
  ]
};

export const MODULES_DOCUMENTATION = [
  // ─────────────────────────────────────────────────────────
  // 1. DASHBOARD
  // ─────────────────────────────────────────────────────────
  {
    id: "dashboard",
    title: "Dashboard & Resumen Ejecutivo",
    icon: "LayoutDashboard",
    category: "Dirección & Gestión",
    badge: "Principal",
    roleRequired: "Todos los Roles",
    summary: "Centro de comando gerencial con métricas en tiempo real de Supabase, KPIs de facturación, volumen en litros, cobros, tasa BCV, filtro mensual/anual, acceso directo al Centro de Notificaciones & Alertas y comparativas de rendimiento de la fuerza de ventas.",
    components: [
      {
        name: "Acceso Directo: Centro de Notificaciones & Alertas",
        description: "Botón destacado en la cabecera del Dashboard con icono de campana y contador en tiempo real de alertas operativas no leídas. Abre el Centro de Notificaciones con un solo clic."
      },
      {
        name: "Barra de Filtro Mensual & Cierre Anual (2026)",
        description: "Selector interactivo de período: permite alternar entre el Cierre Anual Acumulado (2026) y los meses individuales (Enero a Diciembre). Al seleccionar un mes, todo el Dashboard y el tacómetro se recalculan para ese lapso."
      },
      {
        name: "Tarjeta 'Meta Comercial Acumulada' & 'Meta de este Mes'",
        description: "Muestra la cuota consolidada proyectada para el período (ej. 300.000 L en cierre acumulado) y una insignia destacada con la 'Meta de este Mes' (30.000 L) configurada en Fuerza de Ventas."
      },
      {
        name: "Tacómetro de Cumplimiento & Rejilla Compacta de Asesores",
        description: "Visualizador radial del % total de cumplimiento y desglose de los 10 asesores comerciales en una rejilla compacta de 2 columnas con scroll, nombres diferenciados (ej. Carlos M., Carlos S.) y aportes ponderados (+% individual)."
      },
      {
        name: "Gráfico de Evolución Mensual 2026 / Ventas vs Meta",
        description: "En vista Anual muestra la gráfica de barras con el porcentaje de meta alcanzado en cada mes desde enero con código de colores semáforo. En vista de mes específico muestra la comparativa Facturado vs Pendiente vs Meta."
      },
      {
        name: "Top 5 Lubricantes Más Vendidos & Cartera de Clientes",
        description: "Ranking por volumen de litros y desglose de Cuentas por Cobrar (Al Día vs Vencidas) sincronizadas con Supabase."
      }
    ],
    modals: [
      {
        name: "Resumen Ejecutivo Gerencial (ExecutiveSummaryModal)",
        buttonTrigger: "Botón 'IMPRIMIR RESUMEN' en cabecera del Dashboard",
        purpose: "Genera un informe consolidado mensual/anual con análisis de rentabilidad bruta, margen operativo, cobranzas efectivas y cumplimiento de metas comerciales.",
        keyFeatures: [
          "Desglose de ingresos por línea de producto",
          "Análisis de eficiencia de cobranza vs. facturación",
          "Exportación a PDF con membrete corporativo y firmas de gerencia"
        ]
      },
      {
        name: "Centro de Notificaciones & Alertas (NotificationsCenterModal)",
        buttonTrigger: "Botón 'Notificaciones & Alertas' en la barra de control del Dashboard",
        purpose: "Supervisión consolidada de quiebres ROP, moras >30 días, libros fiscales pendientes y sincronizaciones de base de datos.",
        keyFeatures: [
          "Filtrado por categorías (Inventario, CxC, Reportes, Sistema)",
          "Filtrado por severidad (Crítica, Advertencia, Información, Éxito)",
          "Botón 'Ir al Módulo' para resolver la causa raíz al instante",
          "Generación de Reporte Oficial en PDF listo para imprimir"
        ]
      }
    ],
    buttons: [
      {
        name: "Notificaciones & Alertas",
        color: "Dorado / Ámbar / Rojo",
        icon: "Bell",
        action: "Abre el Centro de Notificaciones & Alertas modal con el histórico completo y opciones de gestión."
      },
      {
        name: "Selector Mensual (Ene - Dic / Anual)",
        color: "Cyan / Azul Motorven",
        icon: "Calendar",
        action: "Filtra todas las facturas y el tacómetro de cumplimiento según el mes seleccionado o el acumulado anual."
      },
      {
        name: "Imprimir Resumen",
        color: "Azul Índigo / Cyan",
        icon: "Printer",
        action: "Abre el informe ejecutivo gerencial consolidado listo para impresión o descarga PDF."
      },
      {
        name: "Sincronizar Supabase",
        color: "Verde Esmeralda",
        icon: "RefreshCw",
        action: "Ejecuta una sincronización inmediata bajo demanda con la base de datos SQL Server (GRUMOTOR)."
      }
    ],
    bestPractices: [
      "Consultar el Centro de Notificaciones & Alertas al comenzar el turno para atender alertas críticas de inventario o morosidad.",
      "Utilizar el selector de meses para auditar el cumplimiento comercial mes a mes o proyectar el cierre anual.",
      "Revisar el tacómetro de 2 columnas para identificar rápidamente a los asesores con mayor aporte a la meta empresarial.",
      "Sincronizar con Supabase tras emitir nuevas facturas en la planta para refrescar el cumplimiento en vivo."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 2. NOTIFICACIONES & ALERTAS (NUEVO MÓDULO)
  // ─────────────────────────────────────────────────────────
  {
    id: "notificaciones",
    title: "Centro de Notificaciones & Alertas",
    icon: "Bell",
    category: "Monitoreo & Auditoría",
    badge: "Alertas en Vivo",
    roleRequired: "Todos los Roles",
    summary: "Centro neurálgico de alertas operativas, financieras y de sistema que detecta automáticamente quiebres de stock ROP en lubricantes, clientes con morosidad crítica > 30 días en CxC, libros fiscales pendientes ante el SENIAT y estado de enlace Supabase. Permite filtrado multinivel, gestión de lectura individual o masiva, navegación contextual al módulo afectado e impresión de reporte oficial PDF.",
    components: [
      {
        name: "Bandeja Unificada de Notificaciones & Pestañas de Categoría",
        description: "Organiza las alertas en 5 vistas: 'Todas' (consolidado general), 'Inventario' (existencias críticas y ROP), 'Cuentas por Cobrar' (clientes con moras graves o crédito excedido), 'Fiscal & SENIAT' (libros fiscales y cierres Z pendientes) y 'Sistema' (enlace Supabase, servidor SQL y Supabase)."
      },
      {
        name: "Filtros de Severidad (Semáforo de Criticidad)",
        description: "Permite aislar notificaciones por su nivel de urgencia: Crítica (rojo: requiere acción inmediata), Advertencia (ámbar: prevención de riesgo), Información (cyan: avisos de operaciones) y Éxito (verde: tareas concluidas exitosamente)."
      },
      {
        name: "Filtro de Estado: Leídas vs. No Leídas",
        description: "Permite concentrarse exclusivamente en los eventos pendientes por atender o auditar el histórico de notificaciones ya procesadas."
      },
      {
        name: "Buscador Inteligente en Tiempo Real",
        description: "Campo de búsqueda que filtra al instante por nombre de producto, cliente, número de factura, fecha o descripción de la alerta."
      },
      {
        name: "Botón 'Ir al Módulo' (Navegación Contextual)",
        description: "Al pulsar este botón en cualquier tarjeta de notificación, el sistema cierra el modal y redirige automáticamente al operador a la pantalla correspondiente (ej. salta a Inventario ante quiebre de 15W40 o a CxC ante mora de cliente)."
      },
      {
        name: "Persistencia Cloud en Supabase PostgreSQL",
        description: "Cada notificación se almacena en la tabla 'notificaciones' de Supabase con campos de severidad, leído, fecha_creada y fecha_leida, garantizando consistencia en todos los dispositivos conectados."
      }
    ],
    modals: [
      {
        name: "Modal Centro de Notificaciones & Alertas (NotificationsCenterModal)",
        buttonTrigger: "Botón 'Notificaciones & Alertas' en Dashboard o campana de cabecera",
        purpose: "Panel centralizado para visualizar, filtrar, marcar como leídas y generar el reporte físico de incidencias operacionales.",
        keyFeatures: [
          "Contador dinámico de alertas críticas y advertencias en cabecera",
          "Acciones masivas: 'Marcar todas como leídas' y 'Vaciar leídas'",
          "Exportación a Reporte Oficial PDF con tablas y firmas",
          "Soporte multi-dispositivo garantizado sin solapamientos visuales"
        ]
      }
    ],
    buttons: [
      {
        name: "Imprimir Reporte (Centro de Notificaciones)",
        color: "Azul Índigo / Rojo Motorven",
        icon: "Printer",
        action: "Genera el reporte oficial en PDF del Centro de Notificaciones con membrete legal, resumen de alertas activas, desglose por severidad y firmas institucionales."
      },
      {
        name: "Marcar Todas como Leídas",
        color: "Verde Esmeralda",
        icon: "CheckCheck",
        action: "Actualiza el estado de todas las alertas pendientes a leídas simultáneamente en la nube."
      },
      {
        name: "Vaciar / Eliminar Leídas",
        color: "Gris / Rojo Suave",
        icon: "Trash2",
        action: "Elimina permanentemente de la bandeja las alertas que ya fueron revisadas y resueltas."
      },
      {
        name: "Ir al Módulo (En cada tarjeta)",
        color: "Cyan / Azul",
        icon: "ExternalLink",
        action: "Navega directamente al módulo funcional que generó la alerta para solventar la situación operativa."
      },
      {
        name: "Refrescar Alertas",
        color: "Neutro",
        icon: "RefreshCw",
        action: "Consulta de inmediato la base de datos Supabase para detectar nuevas alertas emitidas."
      }
    ],
    bestPractices: [
      "Priorizar la resolución de alertas 'Críticas' en rojo (quiebres inmediatos de stock de lubricantes y retenciones fiscales pendientes).",
      "Hacer clic en 'Ir al Módulo' para ir directamente al origen del problema en lugar de navegar manualmente por el menú.",
      "Imprimir el Reporte de Notificaciones semanalmente para adjuntarlo al informe de control de gestión y auditoría gerencial.",
      "Marcar las alertas como leídas a medida que se gestionan para mantener el contador del Dashboard siempre preciso."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 2. PEDIDOS & PREVENTA
  // ─────────────────────────────────────────────────────────
  {
    id: "pedidos",
    title: "Pedidos & Preventa (OrdersSalesModal)",
    icon: "ShoppingCart",
    category: "Comercial & Ventas",
    badge: "Operativo",
    roleRequired: "Todos los Roles",
    summary: "Modal unificado de gestión comercial que centraliza la creación de pedidos anticipados, el pipeline de órdenes, la facturación rápida desde pedido, la impresión de notas de entrega y el análisis de métricas de ventas.",
    components: [
      {
        name: "Pestaña 'Nuevo Pedido'",
        description: "Formulario completo para registrar un pedido anticipado: selección de cliente, productos, cantidades, precio en USD/Bs, zona de entrega, vendedor asignado y condición de pago (contado / crédito)."
      },
      {
        name: "Pestaña 'Pipeline de Pedidos'",
        description: "Panel Kanban-style que muestra todos los pedidos clasificados por estado: Borrador, Confirmado, En Despacho y Entregado. Permite mover pedidos entre estados con un solo clic."
      },
      {
        name: "Pestaña 'Facturar'",
        description: "Convierte un pedido confirmado en factura de venta formal. Integra directamente con el POS para procesar el cobro y registrar el movimiento en Supabase."
      },
      {
        name: "Pestaña 'Imprimir / Notas de Entrega'",
        description: "Genera la nota de entrega imprimible con membrete oficial de SIGNUM MOTORVEN, lista para el transportista o almacén."
      },
      {
        name: "Pestaña 'Métricas'",
        description: "Estadísticas del pipeline: total de pedidos por estado, monto comprometido en USD, tasa de conversión de pedidos a facturas y vendedor con mayor volumen de preventa."
      }
    ],
    modals: [
      {
        name: "Modal Unificado de Pedidos & Ventas (OrdersSalesModal)",
        buttonTrigger: "Botón 'Pedidos & Preventa' en el menú lateral / Menú de 3 puntos ➔ 'PEDIDOS Y PREVENTAS'",
        purpose: "Centraliza todo el ciclo comercial de preventa: desde la creación del pedido hasta su facturación y despacho.",
        keyFeatures: [
          "Flujo completo: Borrador → Confirmado → En Despacho → Entregado",
          "Creación de pedido con validación de stock disponible en tiempo real",
          "Facturación directa desde un pedido confirmado con un clic",
          "Nota de entrega imprimible con código de pedido y datos de cliente",
          "Métricas de conversión y rendimiento por vendedor"
        ]
      }
    ],
    buttons: [
      {
        name: "Pedidos & Preventa (Sidebar)",
        color: "Cyan / Azul Motorven",
        icon: "ShoppingCart",
        action: "Abre directamente el Modal Unificado de Pedidos & Ventas en la pestaña 'Nuevo Pedido'."
      },
      {
        name: "PEDIDOS Y PREVENTAS (Menú 3 puntos)",
        color: "Azul Índigo",
        icon: "ClipboardList",
        action: "Acceso alternativo al mismo modal desde la barra superior — idéntico comportamiento al botón del sidebar."
      },
      {
        name: "Nuevo Pedido (dentro del modal)",
        color: "Verde Esmeralda",
        icon: "Plus",
        action: "Limpia el formulario para crear un nuevo pedido desde cero."
      },
      {
        name: "Confirmar Pedido",
        color: "Azul Índigo",
        icon: "CheckCircle",
        action: "Cambia el estado del pedido de Borrador a Confirmado y notifica al almacén."
      },
      {
        name: "Facturar Pedido",
        color: "Verde Esmeralda / Dorado",
        icon: "Receipt",
        action: "Convierte el pedido confirmado en una factura formal y navega al módulo de POS para procesar el pago."
      },
      {
        name: "Imprimir Nota de Entrega",
        color: "Gris / Neutro",
        icon: "Printer",
        action: "Genera e imprime la nota de entrega del pedido seleccionado."
      }
    ],
    bestPractices: [
      "Siempre confirmar el stock disponible antes de confirmar un pedido a crédito.",
      "Usar la pestaña 'Pipeline' diariamente para detectar pedidos bloqueados en el estado 'En Despacho' por más de 24 horas.",
      "Generar la nota de entrega antes de liberar el vehículo de reparto.",
      "Revisar las métricas de conversión al cierre semanal para medir la efectividad del equipo de ventas."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 3. INVENTARIO
  // ─────────────────────────────────────────────────────────
  {
    id: "inventario",
    title: "Inventario de Lubricantes & Kardex",
    icon: "Package",
    category: "Logística & Almacén",
    badge: "Crítico",
    roleRequired: "Administrador, Almacén, Ventas",
    summary: "Gestión integral de las existencias físicas de lubricantes en litros, cajas, cuñetes y tambores, con control de kardex, ajustes, transferencias y matriz de reorden ROP.",
    components: [
      {
        name: "Barra de KPIs de Inventario en Tiempo Real",
        description: "Métricas consolidadas al tope del módulo: volumen total en bodega en litros y cajas, valorización total de inventario en $ USD y Bs. BCV a costo de reposición, y desglose de salud por semáforo."
      },
      {
        name: "Tabla de Existencias con Semáforo ROP",
        description: "Listado completo con fotografía Oilstone ®, código, OEM, viscosidad, presentación, stock actual en cajas y litros totales, costos, precios detal y mayor, y margen porcentual."
      },
      {
        name: "Filtros Interactivos de Semáforo (Críticos, Reorden, Óptimos)",
        description: "Botones de filtrado rápido con conteo directo de SKUs: 🔴 Crítico (stock <= mínimo), 🟡 Reorden (stock <= 2x mínimo) y 🟢 Óptimo."
      },
      {
        name: "Filtro Rápido por Familia de Aceite",
        description: "Segmenta el catálogo por Gasolina Mineral, Semisintético, Diésel 4T, Motos 2T/4T, Fuera de Borda, Transmisiones e Hidráulicos AW68."
      }
    ],
    modals: [
      {
        name: "Matriz de Reorden Inteligente y Pronóstico de Quiebre (SmartReorderMatrixModal)",
        buttonTrigger: "Botón 'Matriz Reorden & Quiebres' (Rojo / Azul)",
        purpose: "Calcula en tiempo real el Punto de Reorden (ROP), Días de Inventario Restante (DOI) y Cajas Sugeridas a Pedir a planta para evitar quiebres de stock.",
        keyFeatures: [
          "Algoritmo ROP = (Consumo Diario × Lead Time) + Stock de Seguridad",
          "Filtros de urgencia: Quiebre Inmediato (<7d), Punto Reorden, Preventivo y Sobre-Stock",
          "Generador automático de solicitud de pedido formateada para WhatsApp",
          "Orden de Compra formal imprimible y exportable a CSV / Excel con membrete oficial"
        ]
      },
      {
        name: "Kardex Físico y Movimientos de Almacén (InventoryKardexModal)",
        buttonTrigger: "Botón 'Kardex & Mermas'",
        purpose: "Auditoría cronológica de todas las entradas (compras, ajustes positivos) y salidas (facturas de venta, notas de entrega, mermas) con saldo acumulado.",
        keyFeatures: [
          "Trazabilidad por número de documento de Supabase y tipo de movimiento",
          "Detalle de responsable del movimiento y motivos de merma o traslado",
          "Exportación a Excel del historial completo por producto"
        ]
      },
      {
        name: "Hoja de Toma Física de Inventario",
        buttonTrigger: "Botón 'Toma Física'",
        purpose: "Genera formato oficial imprimible para que el personal de almacén audite físicamente los palets y anaqueles, con columnas para stock teórico, conteo real, diferencias y firmas de recepción."
      }
    ],
    buttons: [
      {
        name: "Matriz Reorden & Quiebres",
        color: "Rojo Motorven / Azul",
        icon: "Sliders",
        action: "Abre la matriz predictiva ROP con análisis de rotación, días de inventario y pedidos a planta."
      },
      {
        name: "Kardex & Mermas",
        color: "Dorado / Ámbar",
        icon: "BarChart2",
        action: "Abre el auditor de ajustes y traslados sincronizados desde Supabase."
      },
      {
        name: "Exportar CSV",
        color: "Azul Cyan",
        icon: "FileSpreadsheet",
        action: "Descarga la base de datos de inventario valorizado con stock, litros, costos y precios en formato CSV / Excel."
      },
      {
        name: "Toma Física",
        color: "Gris / Neutro",
        icon: "Printer",
        action: "Abre la hoja de recuento físico para auditoría de almacén lista para imprimir."
      },
      {
        name: "Cargar Nuevo Lubricante",
        color: "Azul Índigo",
        icon: "Plus",
        action: "Permite registrar un nuevo SKU con sus especificaciones de viscosidad, presentación, stock y precios."
      }
    ],
    bestPractices: [
      "Auditar la Matriz de Reorden dos veces por semana para anticipar pedidos a refinería con suficiente Lead Time.",
      "Realizar tomas físicas mensuales utilizando la 'Hoja de Toma Física' para conciliar existencias reales contra el sistema.",
      "Verificar en el Kardex cualquier discrepancia física antes de realizar ajustes de inventario en Supabase."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 4. PUNTO DE VENTA (POS)
  // ─────────────────────────────────────────────────────────
  {
    id: "ventas",
    title: "Punto de Venta (POS) & Facturación",
    icon: "ShoppingCart",
    category: "Comercial & Caja",
    badge: "Operativo",
    roleRequired: "Administrador, Vendedor, Caja",
    summary: "Módulo de venta ágil en mostrador con selección rápida de lubricantes, validación de límite de crédito, cálculo multimoneda (USD / Bs. BCV) y emisión de facturas/tickets fiscales.",
    components: [
      {
        name: "Selector de Clientes con Búsqueda Rápida",
        description: "Autocompletado instantáneo por RIF, Razón Social o Código Supabase, mostrando saldo deudor actual y condición comercial."
      },
      {
        name: "Catálogo Visual de Lubricantes",
        description: "Tarjetas de productos con foto del envase Oilstone, viscosidad, stock disponible y precios en USD y Bs. a tasa oficial BCV."
      },
      {
        name: "Carrito de Venta y Desglose de Impuestos",
        description: "Cálculo automático de Subtotal, Base Imponible, IVA (16%), IGTF (3% si aplica pago en divisas) y Total a Pagar en ambas monedas."
      },
      {
        name: "Pedido Pendiente Auto-cargado",
        description: "Cuando se navega desde un pedido confirmado usando 'Facturar Pedido', el POS carga automáticamente el cliente y los productos del pedido para agilizar el proceso."
      }
    ],
    modals: [
      {
        name: "Score de Crédito Automático & Validador Pre-Despacho (CreditScoreEngineModal)",
        buttonTrigger: "Botón 'Score Crédito & Riesgo' en cabecera del POS",
        purpose: "Evalúa la confiabilidad financiera del cliente (Rating AAA a C) antes de autorizar un despacho a crédito.",
        keyFeatures: [
          "Calificación de 0 a 100 puntos en 5 factores: Mora, Utilización, Volumen, Pagos y Fiscal",
          "Simulador de nuevo pedido con dictamen: Aprobado, Aprobación Condicionada o Bloqueado por Mora",
          "Ficha formal de evaluación de crédito imprimible y exportable a CSV"
        ]
      },
      {
        name: "Factura de Venta / Comprobante de Despacho (SalesInvoiceModal)",
        buttonTrigger: "Al completar una venta de contado o a crédito",
        purpose: "Muestra la factura legal con formato formal de SIGNUM MOTORVEN, lista para imprimir o enviar al cliente.",
        keyFeatures: [
          "Número de control fiscal y número de factura correlativo",
          "Desglose de productos, litros, precios unitarios e IVA",
          "Información de pago y cuentas bancarias de la empresa"
        ]
      },
      {
        name: "Ticket Fiscal de Mostrador (FiscalTicketModal)",
        buttonTrigger: "Botón 'Ticket Fiscal' en ventas de mostrador",
        purpose: "Genera el formato compacto para impresora térmica de 80mm/58mm con cumplimiento de requisitos de facturación rápida."
      }
    ],
    buttons: [
      {
        name: "Cobrar / Procesar Venta",
        color: "Verde Esmeralda",
        icon: "CreditCard",
        action: "Abre el selector de formas de pago (Transferencia Bs., Pago Móvil, Divisas Efectivo, Zelle, Crédito)."
      },
      {
        name: "Score Crédito & Riesgo",
        color: "Azul Índigo",
        icon: "ShieldAlert",
        action: "Abre el motor de análisis crediticio para validar si el cliente puede recibir despachos a crédito."
      },
      {
        name: "Vaciar Carrito",
        color: "Rojo / Peligro",
        icon: "Trash2",
        action: "Limpia todos los productos del carrito actual para iniciar una nueva venta."
      }
    ],
    bestPractices: [
      "Siempre consultar el Score de Crédito antes de facturar a crédito a clientes con facturas vencidas.",
      "Confirmar la tasa de cambio con el cliente antes de procesar pagos combinados en bolívares y divisas.",
      "Si el pedido viene de la pestaña 'Pedidos & Preventa', el POS cargará los productos automáticamente — no es necesario volver a agregarlos manualmente."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 5. COBRANZAS
  // ─────────────────────────────────────────────────────────
  {
    id: "cobranzas",
    title: "Clientes & Inteligencia de Cobranzas",
    icon: "Users",
    category: "Finanzas & Cartera",
    badge: "Estratégico",
    roleRequired: "Administrador, Finanzas, Cobranzas",
    summary: "Monitoreo integral de los 614 clientes de Supabase, análisis de antigüedad de saldos (Aging), estados de cuenta automáticos y recordatorios de cobro vía WhatsApp.",
    components: [
      {
        name: "Métricas de Cartera y Cuentas por Cobrar",
        description: "Total por cobrar ($ USD y Bs.), Cartera Corriente (No Vencida), Cartera Vencida (Mora 1-30d) y Cartera Crítica (>30 días)."
      },
      {
        name: "Matriz de Aging de Cartera (Antigüedad de Deuda)",
        description: "Clasificación de clientes en 4 tramos de vencimiento: Corriente (0d), 1-15 días, 16-30 días y +30 días de mora."
      },
      {
        name: "Directorio de Clientes con Historial Transaccional",
        description: "Filtros por zona geográfica, vendedor asignado, estatus de crédito y rango de deuda."
      }
    ],
    modals: [
      {
        name: "Inteligencia de Cobranzas & Alertas WhatsApp (DebtCollectionIntelligenceModal)",
        buttonTrigger: "Botón 'Inteligencia de Cobranzas' (Azul Cyan)",
        purpose: "Automatiza la gestión de cobranza con segmentación por urgencia y generación de enlaces de WhatsApp directos.",
        keyFeatures: [
          "Redacción automática de mensajes personalizados con nombre, facturas y saldo en USD/Bs.",
          "Estado de Cuenta formal corporativo con membrete oficial listo para imprimir / PDF",
          "Priorización de cobranzas de alto impacto (80/20 de la deuda)",
          "Exportación de la cartera completa a CSV"
        ]
      },
      {
        name: "Detalle de Factura de Venta Profit (ProfitInvoiceModal)",
        buttonTrigger: "Click en cualquier factura del listado de CxC",
        purpose: "Inspección detallada de renglones, cantidades de aceite, precios, retenciones y saldo pendiente registrado en SQL Server."
      },
      {
        name: "Detalle de Recibo de Cobro (ProfitReceiptModal)",
        buttonTrigger: "Click en cualquier recibo de cobro del historial",
        purpose: "Muestra el detalle del cobro, banco receptor, número de referencia bancaria y facturas canceladas."
      }
    ],
    buttons: [
      {
        name: "Nuevo Cliente (Alta Profit)",
        color: "Azul Índigo / Rojo Motorven",
        icon: "Plus",
        action: "Abre el formulario para registrar un nuevo cliente con código co_cli, RIF, zona y condiciones en Supabase."
      },
      {
        name: "Modificar Cliente",
        color: "Dorado / Ámbar",
        icon: "Edit2",
        action: "Permite editar datos fiscales, vendedor asignado, zona de despacho y límites de crédito con sincronización instantánea."
      },
      {
        name: "Eliminar / Inactivar Cliente",
        color: "Rojo Peligro",
        icon: "Trash2",
        action: "Ejecuta hard-delete limpio si el cliente no tiene operaciones previas, o soft-delete fiscal (inactivo = 1) si posee facturas emitidas."
      },
      {
        name: "Inteligencia de Cobranzas",
        color: "Azul Índigo / Cyan",
        icon: "MessageSquare / Activity",
        action: "Abre el panel de aging, estados de cuenta y generador de mensajes de WhatsApp."
      },
      {
        name: "Score de Crédito",
        color: "Púrpura",
        icon: "ShieldCheck",
        action: "Abre el motor de riesgo crediticio para auditar la solvencia global de la cartera."
      },
      {
        name: "Enviar WhatsApp",
        color: "Verde WhatsApp (#25D366)",
        icon: "Send",
        action: "Abre WhatsApp Web / App con el mensaje preformateado con el estado de cuenta del cliente."
      }
    ],
    bestPractices: [
      "Al registrar nuevos clientes, verificar que el código no exceda 10 caracteres alfanuméricos conforme al estándar de Supabase.",
      "Enviar estados de cuenta preventivos 3 días antes del vencimiento de la factura.",
      "Aplicar bloqueo automático a clientes en tramo crítico (>30 días) hasta registrar abono formal."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 6. VENDEDORES
  // ─────────────────────────────────────────────────────────
  {
    id: "vendedores",
    title: "Fuerza de Ventas, Zonas Comerciales & Comisiones",
    icon: "TrendingUp",
    category: "Comercial & RRHH",
    badge: "Gerencial",
    roleRequired: "Administrador, Gerencia, Ventas",
    summary: "Panel de desempeño de la fuerza de ventas con 10 asesores sincronizados desde Supabase (GRUMOTOR), asignación y edición de zonas comerciales territoriales, cuotas mensuales en litros, cobranzas efectivas por asesor, liquidación formal de comisiones y exportación de reportes.",
    components: [
      {
        name: "Gestión y Reasignación de Zonas Comerciales por Asesor",
        description: "Cada asesor comercial cuenta con sus circuitos y zonas geográficas asignadas (ej. Gran Caracas, Centro-Occidente, Oriente, Guayana, Altos Mirandinos, etc.). Permite editar la zona asignada a cualquier asesor si cambia de territorio o asume una nueva ruta, actualizando en tiempo real la cartera de clientes, el pipeline de preventa y los filtros territoriales."
      },
      {
        name: "Ranking & Rendimiento Comercial en Litros",
        description: "Tabla de posiciones del equipo sincronizada con Supabase, mostrando zona asignada, clientes atendidos, volumen vendido en litros, cajas equivalentes, cumplimiento de cuota individual, ventas facturadas ($) y cobranza efectiva ($)."
      },
      {
        name: "Cobranzas por Asesor Comercial (Pestaña Dedicada)",
        description: "Muestra las cobranzas efectivas logradas por cada vendedor en USD y Bolívares BCV, número de recibos aplicados en Supabase, porcentaje de efectividad sobre ventas facturadas, saldo pendiente en calle y desglose expandible de recibos de cobro."
      },
      {
        name: "Cuadro de Comisiones & Liquidación por Asesor",
        description: "Cálculo en vivo de incentivos: comisión por facturación directa, comisión por cobranza efectiva y bono por litros excedentes sobre la meta comercial."
      },
      {
        name: "Comisiones Liquidadas (Historial de Pagos)",
        description: "Registro permanente de comprobantes de pago de comisiones procesados. Permite auditar el monto en USD/Bs, método de pago, referencia bancaria, fecha y reimprimir el Comprobante Oficial con firmas del asesor y gerencia."
      },
      {
        name: "Panel de Configuración de Meta Mensual Global",
        description: "Permite al administrador o gerencia definir la meta mensual total en litros para la empresa (ej. 30.000 L). Al guardar, el sistema reparte la cuota en partes iguales entre los asesores activos y la persiste en el sistema."
      },
      {
        name: "Ajuste Individual de Metas & % Comisión Base",
        description: "Pestaña '% Asignación de Metas & % Comisión': permite modificar puntualmente la cuota en litros o el porcentaje de comisión de un vendedor específico si se requieren cuotas asimétricas o ajustes por potencial de zona."
      }
    ],
    modals: [
      {
        name: "Modal de Asignación / Edición de Zona de Venta",
        buttonTrigger: "Botón 'Editar Zona' o selector de territorio en la ficha del asesor",
        purpose: "Permite reasignar el territorio o circuito comercial a un asesor de ventas, transfiriendo la cartera de clientes vinculada al nuevo territorio asignado.",
        keyFeatures: [
          "Selector de Zonas Oficiales del Grupo Motorven",
          "Historial de traslados territoriales",
          "Actualización automática de filtros en Pipeline y Clientes"
        ]
      },
      {
        name: "Ficha Técnica de Asesor Comercial (SellerDetailModal)",
        buttonTrigger: "Botón 'Ver Ficha' o icono 'Ojo' en Ranking/Directorio",
        purpose: "Inspección completa de la zona asignada, historial de ventas, clientes vinculados, cobros y facturas recientes del asesor."
      },
      {
        name: "Liquidación de Comisiones (SellerCommissionModal)",
        buttonTrigger: "Botón 'Liquidar' o 'Liquidar Período'",
        purpose: "Calcula comisiones por período seleccionado, permite definir método de pago (Transferencia, Efectivo USD, etc.), referencia bancaria, y guardar el comprobante formal en el historial."
      },
      {
        name: "Comprobante Oficial Imprimible de Liquidación",
        buttonTrigger: "Icono de impresora en 'Comisiones Liquidadas'",
        purpose: "Genera el recibo formal con membrete de Distribuidora Signum Motorven C.A. / Oilstone ®, desglose de conceptos, tasa BCV y firmas de conformidad."
      },
      {
        name: "Inteligencia de Cobranzas & WhatsApp",
        buttonTrigger: "Botón superior 'Inteligencia Cobranzas & WhatsApp'",
        purpose: "Gestión directa de recordatorios de cobro a clientes asignados a los asesores comerciales según su zona de influencia."
      }
    ],
    buttons: [
      {
        name: "Editar Zona Asignada",
        color: "Cyan / Azul",
        icon: "MapPin / Edit",
        action: "Permite modificar la zona o circuito comercial asignado al asesor cuando se presentan traslados de territorio."
      },
      {
        name: "Exportar CSV / Excel",
        color: "Azul Cyan",
        icon: "FileSpreadsheet",
        action: "Descarga un archivo .csv consolidado con todas las métricas de rendimiento, zonas, cuotas, ventas, cobranzas y comisiones de los asesores para el período seleccionado."
      },
      {
        name: "Imprimir Reporte Gerencial",
        color: "Gris / Neutro",
        icon: "Printer",
        action: "Abre la vista de impresión del navegador formateada para generar el informe físico de la fuerza de ventas."
      },
      {
        name: "Selector de Período / Mes",
        color: "Azul Motorven",
        icon: "Calendar",
        action: "Permite alternar entre el Cierre Anual Acumulado y cada mes del año 2026 para auditar el desempeño histórico."
      },
      {
        name: "Configurar Meta Mensual",
        color: "Azul Índigo / Cyan",
        icon: "Edit / Layers",
        action: "Abre el selector en el banner de metas para ingresar la cuota total y repartirla equitativamente entre los asesores activos."
      },
      {
        name: "Sincronizar Profit",
        color: "Verde Esmeralda",
        icon: "RefreshCw",
        action: "Consulta la base de datos SQL Server GRUMOTOR y actualiza las ventas, facturas y cobros de cada asesor sin alterar sus zonas ni metas configuradas."
      }
    ],
    bestPractices: [
      "Mantener actualizadas las zonas comerciales asignadas a cada vendedor para garantizar que los reportes de cobertura geográfica sean fidedignos.",
      "Si un asesor comercial es reubicado a otra zona o estado, actualizar de inmediato su registro para que el pipeline de órdenes refleje el nuevo circuito.",
      "Configurar la Meta Mensual Global al inicio de cada mes mediante el botón 'Configurar Meta Mensual' para repartir equitativamente el objetivo entre el equipo.",
      "Las zonas y metas configuradas se conservan protegidas en base de datos aunque se ejecuten sincronizaciones continuas con Supabase."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 7. COMPRAS
  // ─────────────────────────────────────────────────────────
  {
    id: "compras",
    title: "Proveedores & Cuentas por Pagar",
    icon: "Truck",
    category: "Compras & Abastecimiento",
    badge: "Financiero",
    roleRequired: "Administrador, Compras, Finanzas",
    summary: "Control de proveedores de bases lubricantes, aditivos, envases y etiquetas, con registro de compras en Supabase, órdenes de pago y cuentas por pagar.",
    components: [
      {
        name: "Resumen de Cuentas por Pagar (CxP)",
        description: "Saldo total pendiente a proveedores, facturas por vencer y facturas vencidas expresadas en USD y Bs."
      },
      {
        name: "Tabla de Compras y Facturas de Proveedor",
        description: "Listado de compras sincronizadas con Supabase, número de control fiscal, proveedor, monto neto e IVA."
      },
      {
        name: "Directorio de Proveedores Homologados",
        description: "Ficha con RIF, razón social, condiciones de crédito y saldo acreedor."
      }
    ],
    modals: [
      {
        name: "Detalle de Compra Supabase (ProfitPurchaseDetailModal)",
        buttonTrigger: "Click en cualquier factura de compra",
        purpose: "Desglose de productos recibidos, costos de adquisición en planta, fletes y retenciones fiscales aplicadas."
      },
      {
        name: "Ficha de Proveedor y Estado de Cuenta (ProfitSupplierDetailModal)",
        buttonTrigger: "Click en cualquier proveedor del listado",
        purpose: "Historial completo de compras, pagos emitidos y saldo pendiente de pago."
      },
      {
        name: "Asiento Contable / Comprobante (AccountingEntryModal)",
        buttonTrigger: "Botón 'Ver Asiento' en documentos de compra",
        purpose: "Auditoría de las cuentas de débito y crédito generadas en la contabilidad general de Supabase."
      }
    ],
    buttons: [
      {
        name: "Registrar Orden de Pago",
        color: "Azul Índigo",
        icon: "FileCheck",
        action: "Abre el formulario para emitir una orden de pago a proveedor con retención de ISLR/IVA."
      },
      {
        name: "Filtrar por Proveedor",
        color: "Gris",
        icon: "Filter",
        action: "Segmenta las compras por refinería de aceite, fabricantes de envases o servicios logísticos."
      }
    ],
    bestPractices: [
      "Verificar que las retenciones de ISLR e IVA coincidan con la alícuota legal antes de registrar el pago.",
      "Cruzar los precios de compra con el módulo de Rentabilidad para auditar variaciones en el CMV."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 8. RENTABILIDAD
  // ─────────────────────────────────────────────────────────
  {
    id: "rentabilidad",
    title: "Análisis de Rentabilidad & P&L Operativo",
    icon: "TrendingUp",
    category: "Estratégico & Costos",
    badge: "Avanzado",
    roleRequired: "Administrador, Dirección, Finanzas",
    summary: "Estado de Resultados operativo (Waterfall P&L) en tiempo real, análisis de margen de contribución por línea de lubricante y simulador de sensibilidad financiera.",
    components: [
      {
        name: "Cascada de Resultados (Waterfall P&L)",
        description: "Evolución financiera: (+) Ingresos Brutos ➔ (-) CMV ➔ (=) Utilidad Bruta ➔ (-) Fletes, Comisiones, ISLR y Mermas ➔ (=) Margen de Contribución ➔ (-) OPEX ➔ (=) EBITDA Operativo."
      },
      {
        name: "Rentabilidad Neta por Familia de Aceite",
        description: "Desglose de volumen en litros, facturación, costos y margen neto porcentual de Gasolina, Semisintético, Diésel, Motos, Transmisiones e Industriales."
      },
      {
        name: "Rendimiento Neto por Litro ($/L)",
        description: "Métrica clave que revela cuántos dólares netos de ganancia deja cada litro vendido por línea de producto."
      }
    ],
    modals: [
      {
        name: "P&L Operativo en Tiempo Real y Rentabilidad por Línea (OperationalPandLModal)",
        buttonTrigger: "Botón 'P&L Operativo en Tiempo Real' (Verde Esmeralda)",
        purpose: "Presenta el Estado de Resultados formal con deducciones operativas reales y simulador de sensibilidad.",
        keyFeatures: [
          "Cascada financiera completa con porcentaje vertical sobre ventas",
          "Simulador interactivo What-If: variación de precios, costos de refinería, fletes y comisiones",
          "Estado de Resultados imprimible con membrete oficial y firmas de Junta Directiva",
          "Exportación a CSV / Excel de todas las partidas"
        ]
      },
      {
        name: "Rentabilidad por SKU Individual (SkuProfitabilityModal)",
        buttonTrigger: "Click en cualquier producto en la tabla de rentabilidad",
        purpose: "Análisis micro-económico de un producto específico, comparando precio de venta vs. costo de reposición histórico."
      }
    ],
    buttons: [
      {
        name: "P&L Operativo en Tiempo Real",
        color: "Verde Esmeralda / Cyan",
        icon: "LineChart / DollarSign",
        action: "Abre el estado de resultados consolidado con simulador financiero."
      },
      {
        name: "Imprimir Estado de Resultados",
        color: "Azul Índigo",
        icon: "Printer",
        action: "Genera el formato corporativo oficial para firmas de Dirección y Finanzas."
      },
      {
        name: "Exportar P&L a Excel",
        color: "Verde",
        icon: "Download",
        action: "Descarga el desglose de ingresos, deducciones y márgenes por línea."
      }
    ],
    bestPractices: [
      "Utilizar el simulador What-If antes de autorizar listas de precios o descuentos comerciales.",
      "Monitorear las líneas con margen neto < 15% para evaluar renegociación de compras o ajuste de precios."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 9. CAJA CHICA & BANCOS
  // ─────────────────────────────────────────────────────────
  {
    id: "caja",
    title: "Caja Chica & Conciliación Bancaria",
    icon: "Wallet",
    category: "Tesorería & Bancos",
    badge: "Operativo",
    roleRequired: "Administrador, Tesorería, Caja, Finanzas",
    summary: "Control integral de tesorería y efectivo multimoneda: Arqueo de caja chica en USD y Bs. BCV, registro de ingresos/egresos menores y conciliación con las 10 cuentas bancarias de Supabase.",
    components: [
      {
        name: "Arqueo de Caja Chica y Libro de Movimientos",
        description: "Registro cronológico de entradas y salidas de efectivo, pagos móviles y transferencias con soporte de beneficiario, concepto y responsable."
      },
      {
        name: "Disponibilidad Bancaria Supabase",
        description: "Saldos auditados en tiempo real sincronizados desde SQL Server en Banesco, Mercantil, Venezuela, Provincial, etc."
      },
      {
        name: "Libro de Cobranzas y Recibos",
        description: "Historial de recibos de cobro asentados en Supabase con banco receptor y número de referencia bancaria."
      }
    ],
    modals: [
      {
        name: "Registro de Movimiento de Caja",
        buttonTrigger: "Botón '+ Registrar Movimiento de Caja'",
        purpose: "Asienta ingresos o egresos de caja chica con selección de método de pago y monto en USD/Bs."
      }
    ],
    buttons: [
      {
        name: "Exportar Arqueo (CSV)",
        color: "Gris / Neutro",
        icon: "Download",
        action: "Descarga el libro de movimientos de caja en formato CSV para conciliación contable."
      },
      {
        name: "Registrar Movimiento de Caja",
        color: "Rojo Motorven",
        icon: "Plus",
        action: "Abre el formulario para asentar un ingreso o egreso de caja menor."
      }
    ],
    bestPractices: [
      "Realizar el cuadre de caja diario contrastando los cobros de mostrador y abonos con el efectivo físico y estados de cuenta.",
      "Asentar de inmediato cualquier gasto menor con su respectivo comprobante de soporte."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 9.1. CUENTAS POR COBRAR (CXC)
  // ─────────────────────────────────────────────────────────
  {
    id: "cxc",
    title: "Cuentas por Cobrar (CxC) & Aging",
    icon: "DollarSign",
    category: "Finanzas & Cartera",
    badge: "Estratégico",
    roleRequired: "Administrador, Finanzas, Cobranza, Ventas",
    summary: "Gestión ejecutiva de cartera de clientes: Antigüedad de saldos (Aging) por tramos, score crediticio dinámico, recordatorios de cobro vía WhatsApp y emisión de estados de cuenta oficiales.",
    components: [
      {
        name: "Matriz Integral de Aging por Tramos",
        description: "Segmentación de la deuda en 4 tramos: Vigente (al día), Mora 1-15 días, Mora 16-30 días y Mora Crítica (+30 días), con totales en USD y Bs. BCV."
      },
      {
        name: "Score Crediticio Dinámico (AAA a D)",
        description: "Calificación automática del cliente basada en historial de cumplimiento y días máximos de retraso."
      },
      {
        name: "Recordatorios de Cobranza por WhatsApp",
        description: "Generación de enlaces y mensajes estructurados con estado de cuenta, desglose de facturas y cuentas bancarias receptoras."
      }
    ],
    modals: [
      {
        name: "Panel de Inteligencia de Cobranzas (DebtCollectionIntelligenceModal)",
        buttonTrigger: "Botón 'Inteligencia Cobranzas & WhatsApp'",
        purpose: "Genera mensajes automáticos para WhatsApp y estados de cuenta oficiales imprimibles."
      },
      {
        name: "Motor de Credit Score (CreditScoreEngineModal)",
        buttonTrigger: "Botón 'Score de Crédito'",
        purpose: "Audita la salud crediticia del cliente para autorizaciones de despacho a crédito."
      }
    ],
    buttons: [
      {
        name: "Recordar WhatsApp",
        color: "Verde WhatsApp (#25D366)",
        icon: "MessageSquare",
        action: "Abre chat directo de WhatsApp con el cliente con el saldo y factura pendiente."
      },
      {
        name: "Abonar Saldo",
        color: "Verde Esmeralda",
        icon: "DollarSign",
        action: "Registra un cobro o abono inmediato a la cuenta corriente del cliente."
      },
      {
        name: "Exportar CSV",
        color: "Gris",
        icon: "FileSpreadsheet",
        action: "Descarga la cartera completa con tramos de aging y vendedor asignado."
      }
    ],
    bestPractices: [
      "Enviar recordatorios WhatsApp en el tramo de 1 a 15 días antes del paso a mora crítica.",
      "Auditar el score crediticio antes de aprobar pedidos con condición de crédito."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 9.2. CUENTAS POR PAGAR (CXP)
  // ─────────────────────────────────────────────────────────
  {
    id: "cxp",
    title: "Cuentas por Pagar (CxP) a Proveedores",
    icon: "Building2",
    category: "Finanzas & Procura",
    badge: "Financiero",
    roleRequired: "Administrador, Finanzas, Compras",
    summary: "Control de compromisos adquiridos con proveedores de lubricantes, aditivos y envases: Facturas de compra por vencer, vencidas, órdenes de pago emitidas y retenciones de ISLR.",
    components: [
      {
        name: "Resumen de Compromisos Pendientes",
        description: "Monto total adeudado a proveedores en USD y Bolívares oficiales con desglose de días de plazo restante."
      },
      {
        name: "Directorio de Proveedores y Condiciones",
        description: "Ficha con RIF, razón social, teléfonos, días de crédito otorgados y saldo actual pendiente."
      }
    ],
    modals: [
      {
        name: "Ficha de Proveedor y Estado de Cuenta (ProfitSupplierDetailModal)",
        buttonTrigger: "Click en cualquier proveedor del listado",
        purpose: "Auditoría de compras históricas y saldo por liquidar."
      }
    ],
    buttons: [
      {
        name: "Filtrar Proveedores",
        color: "Gris",
        icon: "Filter",
        action: "Segmenta los compromisos por fabricante de lubricante o insumo logístico."
      }
    ],
    bestPractices: [
      "Priorizar pagos a proveedores críticos con menor margen de crédito para evitar retrasos de despacho en planta.",
      "Cruzar las compras registradas con las retenciones de ISLR correspondientes."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 10. REPORTES FISCALES
  // ─────────────────────────────────────────────────────────
  {
    id: "reportes",
    title: "Reportes Fiscales & Cumplimiento SENIAT",
    icon: "FileCheck2",
    category: "Fiscal & Tributario",
    badge: "Oficial SENIAT",
    roleRequired: "Administrador Master, TI, Gerencia, Administración",
    summary: "Motor tributario integral para la emisión de Libros de Ventas y Compras (Arts. 75 y 76 Reg. IVA), Cierres X y Z definitivos con hash SHA-256, generador de archivos TXT de retención de IVA (Prov. SNAT/2013/00030) y XML de ISLR bajo esquemas oficiales del SENIAT.",
    components: [
      {
        name: "Libro de Ventas Fiscales (Art. 76 Reg. IVA)",
        description: "Registro cronológico estricto con RIF de cliente, Número de Factura, Número de Control (00-XXXXXX), bases imponibles al 16%, ventas exentas, cálculo de IGTF (3%) y retenciones de IVA aplicadas (75% / 100%)."
      },
      {
        name: "Libro de Compras Fiscales (Art. 75 Reg. IVA)",
        description: "Relación de facturas de compras a proveedores con créditos fiscales deducibles, compras exentas, números de comprobante de retención de 14 dígitos y porcentaje retenido."
      },
      {
        name: "Generador de Archivo TXT SENIAT (Prov. SNAT/2013/00030)",
        description: "Compila las retenciones de IVA en el formato oficial de 16 columnas tabuladas exigido por el portal del SENIAT para la carga masiva quincenal sin inconsistencias."
      },
      {
        name: "Generador de Archivo XML de ISLR (Esquemas XSD SENIAT)",
        description: "Estructura el archivo electrónico de retenciones de ISLR para personas jurídicas y naturales bajo la especificación técnica oficial del SENIAT."
      },
      {
        name: "Cierres X (Parcial) y Cierre Z (Definitivo)",
        description: "Emisión de Reporte X (lectura informativa sin alteración del correlativo) y Cierre Z diario que consolida ventas, reinicia acumuladores diarios, incrementa el número de cierre y calcula el Gran Total Histórico sellado con SHA-256."
      }
    ],
    modals: [
      {
        name: "Cierre Z Definitivo & Reporte X (FiscalTicketModal)",
        buttonTrigger: "Botones 'Reporte X (Parcial)' y 'Cierre Z Definitivo' en la cabecera del módulo",
        purpose: "Visualiza el ticket fiscal en formato térmico de 80mm con desglose de bases, impuestos, formas de pago, Gran Total y firma criptográfica SHA-256 listo para imprimir o archivar.",
        keyFeatures: [
          "Cumplimiento de la Providencia SNAT/2011/00071 (incluso para jornadas sin ventas o 'Día en Cero')",
          "Correlativo consecutivo inalterable protegido en base de datos",
          "Emulación de ticket de impresora fiscal térmica de 80mm"
        ]
      },
      {
        name: "Comprobante de Retención de ISLR (IslrWithholdingModal)",
        buttonTrigger: "Botón 'Comprobante ISLR' en la tabla de retenciones",
        purpose: "Emite el certificado de retención de impuesto sobre la renta con porcentaje aplicable, base imponible y sustraendo oficial."
      }
    ],
    buttons: [
      {
        name: "Reporte X (Parcial Informativo)",
        color: "Azul Índigo",
        icon: "FileText",
        action: "Genera una lectura parcial de la jornada fiscal para arqueo de caja sin cerrar el turno diario."
      },
      {
        name: "Cierre Z Definitivo",
        color: "Rojo Motorven / Alerta",
        icon: "CheckCircle2",
        action: "Ejecuta el cierre fiscal del día, incrementa el correlativo legal, genera el Gran Total histórico y sella la jornada con hash SHA-256."
      },
      {
        name: "Generar TXT SENIAT",
        color: "Verde Esmeralda",
        icon: "Download",
        action: "Exporta el archivo TXT de 16 columnas listo para subir a la plataforma SENIAT en línea."
      },
      {
        name: "Generar XML ISLR",
        color: "Cyan / Azul",
        icon: "Code / Download",
        action: "Descarga el archivo XML formateado conforme al XSD oficial para la declaración de retenciones de ISLR."
      },
      {
        name: "Imprimir Ticket 80mm",
        color: "Gris Pizarra",
        icon: "Printer",
        action: "Envía el documento al formato de impresión térmica estándar de puntos de venta e impresoras fiscales."
      }
    ],
    bestPractices: [
      "Ejecutar el Cierre Z una sola vez al finalizar la jornada comercial (incluso si no hubo ventas, conforme al Art. 21 de la Prov. SNAT/2011/00071).",
      "Descargar el archivo TXT de retenciones de IVA al cierre de cada quincena fiscal (días 15 y último de mes) para evitar sanciones por presentación extemporánea.",
      "Verificar que cada factura de compra registrada cuente con su número de control antes de generar el Libro de Compras."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 11. AUDITORÍA
  // ─────────────────────────────────────────────────────────
  {
    id: "auditoria",
    title: "Pistas de Auditoría & Trazabilidad",
    icon: "ShieldAlert",
    category: "Seguridad & Control",
    badge: "Auditoría",
    roleRequired: "Solo Administrador Master / TI / Gerencia",
    summary: "Registro inmutable de eventos del sistema: inicios de sesión, cambios de tasas cambiarias, modificaciones de precios, eliminaciones y sincronizaciones con Supabase.",
    components: [
      {
        name: "Línea de Tiempo de Eventos de Seguridad",
        description: "Muestra fecha, hora exacta, usuario responsable, rol, IP/dispositivo y acción ejecutada."
      },
      {
        name: "Filtros por Tipo de Evento",
        description: "Permite aislar eventos de: Autenticación, Ventas, Inventario, Cambios de Tasa y Sincronización."
      }
    ],
    modals: [],
    buttons: [
      {
        name: "Exportar Bitácora de Auditoría",
        color: "Gris / Neutro",
        icon: "Download",
        action: "Descarga el registro completo de auditoría para revisiones de seguridad informática."
      },
      {
        name: "Filtrar por Usuario",
        color: "Azul Índigo",
        icon: "UserCheck",
        action: "Muestra exclusivamente las actividades realizadas por un operador específico."
      }
    ],
    bestPractices: [
      "Revisar semanalmente los registros de cambios en las tasas cambiarias BCV y Keystone.",
      "Investigar de inmediato cualquier intento de acceso no autorizado registrado en las pistas."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 12. USUARIOS & ROLES
  // ─────────────────────────────────────────────────────────
  {
    id: "usuarios",
    title: "Gestión de Usuarios & Control de Accesos",
    icon: "Users",
    category: "Seguridad & Administración",
    badge: "Master TI",
    roleRequired: "Administrador Master / Tecnología & Informática / Gerencia",
    summary: "Control y administración de operadores y personal de SIGNUM MOTORVEN bajo una jerarquía estricta de 9 roles oficiales, permisos modulares, gestión y visualización ergonómica de contraseñas, diseño responsivo anti-solapamiento y bitácora de auditoría en tiempo real.",
    components: [
      {
        name: "Tabla de Operadores & Jerarquía de 9 Roles",
        description: "Catálogo jerárquico oficial: (1) ADMINISTRADOR MASTER (Edson Designer) 👑 → (2) TECNOLOGÍA & INFORMÁTICA 💻 → (3) GERENCIA 👔 → (4) ADMINISTRACIÓN 👨‍💼 → (5) VENTAS 🏷️ → (6) ALMACEN 📦 → (7) CAJA 💵 → (8) COBRANZA 📋 → (9) COMPRAS 🛒."
      },
      {
        name: "Diseño Responsivo Multi-Dispositivo & Cero Solapamientos",
        description: "Arquitectura CSS limpia sin posicionamiento 'sticky' forzado ni sombras invasivas. Columnas 'Contraseña' y 'Acciones' con anchos mínimos protegidos (150px) y botones de acción independientes que garantizan legibilidad perfecta en smartphones, tablets, laptops y pantallas 4K."
      },
      {
        name: "Visualizador Ergonómico de Contraseñas (.btn-password-eye)",
        description: "Botón selector de ojo centrado con dimensiones fijas de 32x32px que no deforma los inputs de texto ni se estira sobre otros elementos. Permite alternar entre texto encriptado (••••••••) y texto legible alfanumérico instantáneamente."
      },
      {
        name: "Modal 'Cambiar Contraseña' con Contraseña Actual Visible",
        description: "Al abrir el modal de cambio de clave, el sistema presenta en primer lugar la 'Contraseña Actual' registrada con tipografía monoespaciada de alta claridad y selector de visibilidad, permitiendo conocer la clave previa antes de ingresar y confirmar la nueva."
      },
      {
        name: "Gestión de Perfiles & Asignación de Módulos",
        description: "Configuración de nombre, usuario único, departamento corporativo (TI, Dirección, Finanzas, Ventas, Operaciones), avatar, foto de perfil optimizada y selección granular de módulos accesibles."
      },
      {
        name: "Bitácora de Auditoría de Usuarios & Supabase Cloud",
        description: "Pestaña dedicada que registra cada evento de creación de usuarios, edición de perfiles y cambios de contraseña con fecha, hora, responsable y detalles sincronizados en Supabase PostgreSQL."
      },
      {
        name: "Protección del Propietario (Administrador Master)",
        description: "El usuario 'edson designer' con rol ADMINISTRADOR MASTER es el titular con autoridad absoluta sobre la plataforma: no puede ser eliminado ni degradado."
      }
    ],
    modals: [
      {
        name: "Modal Cambiar Contraseña (KeyRound)",
        buttonTrigger: "Botón de llave en la fila de cualquier usuario",
        purpose: "Muestra la contraseña actual del usuario y permite asignar una nueva contraseña con confirmación.",
        keyFeatures: [
          "Campo 'Contraseña Actual' visible de inmediato con tipografía destacada",
          "Botón interactivo de ojo (.btn-password-eye) para ocultar o revelar la clave actual",
          "Validación de longitud mínima de 4 caracteres y confirmación coincidente",
          "Persistencia inmediata en la nube (Supabase) y almacenamiento seguro local",
          "Distribución vertical espaciada sin cortes ni desbordamiento visual"
        ]
      },
      {
        name: "Modal Crear / Editar Usuario",
        buttonTrigger: "Botón 'Nuevo Operador' o botón de lápiz en la tabla",
        purpose: "Formulario integral para dar de alta un operador o ajustar su rol, departamento, estado activo/inactivo y foto de perfil.",
        keyFeatures: [
          "Compresión automática de imagen de perfil para no sobrecargar el almacenamiento",
          "En modo edición muestra la contraseña actual como referencia",
          "Selector granular de permisos modulares por casilla de verificación",
          "Espaciado armónico de campos (input padding e icon alignment) en cualquier resolución"
        ]
      }
    ],
    buttons: [
      {
        name: "Nuevo Operador",
        color: "Azul Índigo / Rojo Motorven",
        icon: "UserPlus",
        action: "Abre el formulario para registrar un nuevo usuario con rol y departamento asignados."
      },
      {
        name: "Cambiar Contraseña (Llave)",
        color: "Amarillo / Dorado",
        icon: "KeyRound",
        action: "Despliega el modal de cambio de clave donde se visualiza la contraseña actual y se introduce la nueva."
      },
      {
        name: "Editar Perfil (Lápiz)",
        color: "Azul Neutro",
        icon: "Edit2",
        action: "Permite editar datos del operador, cargo, foto, módulos autorizados y estado."
      },
      {
        name: "Eliminar Usuario (Papelera)",
        color: "Rojo Alerta",
        icon: "Trash2",
        action: "Elimina permanentemente un operador (deshabilitado para el Administrador Master)."
      },
      {
        name: "Ver/Ocultar Clave (.btn-password-eye)",
        color: "Gris / Cyan",
        icon: "Eye / EyeOff",
        action: "Alterna la visibilidad de la contraseña en texto plano en la tabla o en el modal sin afectar el ancho del campo."
      }
    ],
    bestPractices: [
      "Consultar la contraseña actual en el modal de cambio de clave antes de restablecer una cuenta para verificar si el usuario olvidó su credencial o requiere renovación periódica.",
      "Asignar roles de acuerdo a las funciones reales: TECNOLOGÍA & INFORMÁTICA para personal técnico de soporte, GERENCIA para directores y ADMINISTRACIÓN para contabilidad.",
      "Suspender temporalmente las cuentas de operadores desactivando el switch 'Activo' sin necesidad de eliminar el usuario ni perder su historial de auditoría.",
      "El Administrador Master (Edson Designer) cuenta con acceso prioritario e irrestricto a todas las funcionalidades.",
      "En dispositivos móviles o tablets, utilizar el scroll horizontal suave para navegar la tabla de usuarios sin distorsión de los botones de acción."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 13. BARRA SUPERIOR
  // ─────────────────────────────────────────────────────────
  {
    id: "header_rates",
    title: "Barra Superior: Tasas Cambiarias & Sincronización",
    icon: "DollarSign",
    category: "Global / Cabecera",
    badge: "En Todo Momento",
    roleRequired: "Todos los Roles",
    summary: "Indicadores en vivo de la Tasa Oficial BCV, Tasa Keystone Comercial, Tasa Euro, USDT Binance, conmutador de tema Claro/Oscuro de alto contraste, estado de sincronización offline y menú principal de configuración y ayuda.",
    components: [
      {
        name: "Insignia Tasa Oficial BCV",
        description: "Muestra la tasa oficial vigente en Bolívares. Al hacer clic abre la ventana de sincronización directa con el Banco Central de Venezuela."
      },
      {
        name: "Insignia Tasa Comercial Keystone",
        description: "Tasa de referencia para cotizaciones comerciales y cálculo de listas de precios."
      },
      {
        name: "Insignia Informativa Euro / USDT Binance",
        description: "Monitoreo en tiempo real de mercados internacionales y criptoactivos de referencia."
      },
      {
        name: "Conmutador de Tema de Alto Contraste (Sol / Luna)",
        description: "Permite cambiar instantáneamente entre el Tema Claro (fondo blanco níveo con textos oscuros legibles bajo luz solar directa) y el Tema Oscuro (modo noche de baja fatiga visual). Toda la paleta de colores mantiene contraste WCAG AAA en tarjetas, modales y tablas."
      },
      {
        name: "Insignia de Conexión y Estado Offline",
        description: "Indica en verde si hay conexión a internet y base de datos, o en amarillo/rojo si el sistema está operando en modo offline con cola de sincronización."
      },
      {
        name: "Fecha Actual & Botón Menú (...) de 3 Puntos",
        description: "Ubicado a la derecha de la fecha; abre el menú desplegable con accesos directos a 'PEDIDOS Y PREVENTAS', 'CONFIGURACIÓN' y 'AYUDA'."
      }
    ],
    modals: [
      {
        name: "Sincronizador de Tasa BCV Oficial (showBcvModal)",
        buttonTrigger: "Click en la insignia 'BCV' en la barra superior",
        purpose: "Consulta y sincroniza la última tasa oficial publicada por el BCV sin intervención manual."
      },
      {
        name: "Actualizador de Tasa Keystone (showKeystoneModal)",
        buttonTrigger: "Click en la insignia 'Keystone' en la barra superior",
        purpose: "Permite a los administradores ajustar la tasa comercial en Bolívares con entrada de derecha a izquierda."
      },
      {
        name: "Estado de Enlace Supabase (ProfitStatusModal)",
        buttonTrigger: "Click en la insignia 'Supabase' en la barra superior",
        purpose: "Diagnóstico completo de latencia, tablas sincronizadas y salud del daemon SQL Server."
      },
      {
        name: "Configuración Global del Sistema (AppConfigModal)",
        buttonTrigger: "Menú de 3 puntos ➔ Opción 'CONFIGURACIÓN'",
        purpose: "Personaliza datos de la empresa, RIF, políticas de crédito, stock mínimo ROP, plantillas de WhatsApp y preferencias."
      },
      {
        name: "Centro de Ayuda y Manual Interactivo (AppHelpCenterModal)",
        buttonTrigger: "Menú de 3 puntos ➔ Opción 'AYUDA'",
        purpose: "Documentación exhaustiva de cada botón, módulo, modal y proceso del sistema."
      },
      {
        name: "Modal de Pedidos & Ventas (OrdersSalesModal)",
        buttonTrigger: "Menú de 3 puntos ➔ Opción 'PEDIDOS Y PREVENTAS'",
        purpose: "Acceso rápido al modal unificado de pedidos y preventa desde la barra superior."
      }
    ],
    buttons: [
      {
        name: "Botón de 3 Puntos Verticales (Menú Más)",
        color: "Cyan / Neutro",
        icon: "MoreVertical",
        action: "Despliega el menú flotante con las opciones 'PEDIDOS Y PREVENTAS', 'CONFIGURACIÓN' y 'AYUDA'."
      },
      {
        name: "PEDIDOS Y PREVENTAS (En Menú 3 Puntos)",
        color: "Cyan / Verde",
        icon: "ClipboardList",
        action: "Abre el modal unificado de pedidos y preventa directamente."
      },
      {
        name: "CONFIGURACIÓN (En Menú 3 Puntos)",
        color: "Azul Índigo",
        icon: "Sliders / Settings",
        action: "Abre el modal de configuración de toda la aplicación."
      },
      {
        name: "AYUDA (En Menú 3 Puntos)",
        color: "Verde Esmeralda",
        icon: "BookOpen / HelpCircle",
        action: "Abre este manual interactivo y centro de documentación."
      },
      {
        name: "Cambiar Tema (Sol / Luna)",
        color: "Neutro / Dorado",
        icon: "Sun / Moon",
        action: "Alterna instantáneamente entre el tema Claro de alta legibilidad y el tema Oscuro moderno sin recargar la página."
      },
      {
        name: "Cerrar Sesión",
        color: "Rojo",
        icon: "LogOut",
        action: "Finaliza la sesión actual y regresa a la pantalla de autenticación segura."
      }
    ],
    bestPractices: [
      "Verificar que la insignia de sincronización esté en verde ('En Línea') antes de iniciar operaciones masivas de facturación.",
      "Utilizar la opción de Configuración para actualizar datos de contacto cuando cambien teléfonos o direcciones de la empresa.",
      "El menú de 3 puntos tiene acceso rápido a Pedidos & Preventa para agilizar el flujo comercial sin navegar por el sidebar.",
      "Alternar al tema Claro en laptops o tablets cuando se opere en almacenes o áreas de despacho con luz exterior brillante para maximizar contraste."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 17. EJERCICIO & PERÍODO FISCAL ANUAL
  // ─────────────────────────────────────────────────────────
  {
    id: "config_fiscal",
    title: "Ejercicio & Período Fiscal Anual",
    icon: "Calendar",
    category: "Dirección & Administración",
    badge: "Fiscal & Contable",
    roleRequired: "Administrador Master, Gerencia, Administración",
    summary: "Parametrización dinámica del ejercicio fiscal en curso (año, fecha de inicio y fecha de cierre), consolidación y archivado del historial de cierres anuales con métricas reales de ventas netas, cobranzas y volumen de litros facturados.",
    components: [
      {
        name: "Identificador de Período Activo en Barra Superior",
        description: "Badge interactivo '📅 Año 2026: 01/01 - 31/12' visible en todo momento en la cabecera. Al hacer clic, abre de inmediato el panel de configuración fiscal."
      },
      {
        name: "Formulario de Parametrización Fiscal",
        description: "Permite definir y editar el año del ejercicio (ej. 2026), la fecha exacta de apertura (ej. 2026-01-01) y la fecha de cierre de ejercicio (ej. 2026-12-31)."
      },
      {
        name: "Historial de Ejercicios Guardados (historialEjercicios)",
        description: "Tabla interactiva donde se conservan los cierres de cada año con litros facturados, ventas netas en USD, cobros totales, número de facturas y estado (Abierto o Cerrado Definitivo)."
      },
      {
        name: "Botón de Consolidación & Archivado",
        description: "Guarda una instantánea inmutable del ejercicio en curso para mantener el registro contable y las comparativas plurianuales de la empresa."
      }
    ],
    modals: [
      {
        name: "Modal de Configuración - Pestaña Ejercicio & Período Fiscal (AppConfigModal)",
        buttonTrigger: "Clic en el badge superior '📅 Año 2026: 01/01 - 31/12' o en 'CONFIGURACIÓN' pestaña 'fiscal'",
        purpose: "Gestionar el año fiscal en curso, cambiar fechas de inicio/cierre y revisar los registros históricos de años anteriores.",
        keyFeatures: [
          "Edición interactiva de año, fecha inicio y fecha fin",
          "Consolidación automática con datos reales sincronizados",
          "Tabla histórica con estados y auditoría de usuario",
          "Persistencia inmediata en la base de datos local"
        ]
      }
    ],
    buttons: [
      {
        name: "Badge de Período Fiscal",
        color: "Azul Índigo / Cyan",
        icon: "Calendar",
        action: "Abre de forma instantánea la pestaña de configuración fiscal desde cualquier pantalla."
      },
      {
        name: "Guardar Parámetros Fiscales",
        color: "Verde Esmeralda",
        icon: "Save",
        action: "Aplica las nuevas fechas de apertura y cierre a todos los módulos y reportes del sistema."
      },
      {
        name: "Consolidar Ejercicio en Historial",
        color: "Dorado / Ámbar",
        icon: "Archive",
        action: "Archiva una copia con el estado y totales del ejercicio seleccionado en la tabla histórica."
      }
    ],
    bestPractices: [
      "Verificar que las fechas coincidan con el ejercicio contable oficial antes de emitir los Libros de Ventas para el SENIAT.",
      "Consolidar el ejercicio fiscal al finalizar cada año para que los reportes ejecutivos mantengan comparativas históricas fieles.",
      "Las modificaciones a las fechas del período fiscal recalculan de inmediato las metas y facturación del Dashboard y de la Fuerza de Ventas."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 18. EXPLORADOR MULTI-BASE DE DATOS & SQL SERVER
  // ─────────────────────────────────────────────────────────
  {
    id: "explorador_tablas",
    title: "Explorador Multi-Base de Datos & SQL Server",
    icon: "Database",
    category: "Tecnología & Auditoría",
    badge: "TI & Master",
    roleRequired: "Administrador Master, Tecnología & Informática",
    summary: "Supervisión directa, en vivo y transparente de las 49 tablas transaccionales de la base de datos de SIGNUM MOTORVEN y el servidor SQL Server 2014 GRUMOTOR de Supabase.",
    components: [
      {
        name: "Selector de Tablas Transaccionales",
        description: "Menú desplegable con las 49 tablas del ecosistema (facturas, reng_fac, clientes, cobros, inventario, compras, proveedores, etc.) con conteo de registros en tiempo real."
      },
      {
        name: "Buscador Predictivo en Tiempo Real",
        description: "Filtra al instante cualquier registro dentro de la tabla seleccionada por código, descripción, RIF, número de documento o monto."
      },
      {
        name: "Visor de Esquema & Tipos de Datos",
        description: "Muestra la estructura exacta de columnas, tipos y valores de cada tabla para diagnóstico técnico y auditoría forense."
      },
      {
        name: "Exportador JSON / Respaldo Rápido",
        description: "Permite descargar el contenido íntegro de cualquier tabla en archivo JSON para copias de seguridad o análisis externo."
      }
    ],
    modals: [
      {
        name: "Explorador de Tablas (ServerExplorerModal)",
        buttonTrigger: "Botón 'Explorar Tablas' en la barra de servidor del Dashboard o desde el menú lateral",
        purpose: "Inspeccionar las tablas de la base de datos local y de Supabase con paginación, filtros y visualización de registros.",
        keyFeatures: [
          "Monitoreo de 49 tablas transaccionales",
          "Búsqueda instantánea en vivo",
          "Paginación optimizada para miles de filas",
          "Descarga directa de datos en JSON"
        ]
      }
    ],
    buttons: [
      {
        name: "Explorar Tablas",
        color: "Cyan / Azul Claro",
        icon: "Database",
        action: "Abre el visor interactivo de tablas transaccionales."
      },
      {
        name: "Abrir Servidor en Nueva Ventana",
        color: "Azul Eléctrico",
        icon: "ExternalLink",
        action: "Abre la raíz del servidor Supabase Micro-API (:3005) en una pestaña nueva para diagnóstico de hardware y discos."
      },
      {
        name: "Descargar Tabla JSON",
        color: "Verde Esmeralda",
        icon: "Download",
        action: "Descarga un archivo con todos los registros de la tabla actualmente seleccionada."
      }
    ],
    bestPractices: [
      "Utilizar el buscador antes de navegar entre páginas cuando se consulten tablas masivas como factura o reng_fac.",
      "Verificar periódicamente el estado de los discos del servidor desde el enlace de apertura en nueva ventana.",
      "El acceso a este módulo está restringido exclusivamente a roles técnicos y de dirección para resguardar la seguridad de la información."
    ]
  }
];

// ==============================================================================
// PREGUNTAS FRECUENTES (FAQ)
// ==============================================================================
export const FREQUENTLY_ASKED_QUESTIONS = [
  {
    question: "¿Cómo se actualizan los datos de Supabase en la aplicación web?",
    answer: "El sistema cuenta con un Daemon en segundo plano (Profit Bridge) que se conecta directamente al servidor SQL Server de GRUMOTOR. Los datos de facturas, clientes, cobros, inventario y compras se sincronizan en tiempo real mediante Supabase Webhooks y consultas programadas. Puede forzar una sincronización manual desde el botón 'Sincronizar Supabase' en el Dashboard o en la barra superior."
  },
  {
    question: "¿Qué ocurre si se interrumpe la conexión a Internet mientras estoy facturando en el POS?",
    answer: "La aplicación cuenta con arquitectura Offline-First. Todas las ventas y cobros procesados sin conexión se almacenan en una cola local encriptada y se sincronizan automáticamente en cuanto se restablece el enlace de red. La insignia de estado en la barra superior cambia a amarillo/rojo cuando el sistema está operando offline."
  },
  {
    question: "¿Cómo calcula el sistema el Score de Crédito de un cliente?",
    answer: "El motor evalúa 5 factores ponderados sobre 100 puntos: 1) Historial de mora en facturas saldadas (35%), 2) Nivel de utilización de la línea de crédito (25%), 3) Volumen y recurrencia de compras (20%), 4) Confiabilidad en formas de pago (10%), y 5) Cumplimiento formal y retenciones fiscales (10%). Clientes con score <50 o mora >30 días quedan bloqueados para nuevos créditos."
  },
  {
    question: "¿Qué significan los valores ROP y DOI en la Matriz de Reorden de Inventario?",
    answer: "DOI (Days of Inventory) indica cuántos días de existencias quedan al ritmo de consumo actual. ROP (Reorder Point) es el nivel de inventario que activa una nueva orden a refinería, calculado sumando el consumo durante el tiempo de entrega del proveedor más el stock de seguridad."
  },
  {
    question: "¿Cómo se personaliza el mensaje de cobranza por WhatsApp?",
    answer: "Abra el Menú de 3 puntos ➔ 'CONFIGURACIÓN' ➔ Pestaña 'Cobranzas & WhatsApp'. Allí podrá redactar la plantilla utilizando etiquetas dinámicas como {cliente}, {montoUsd}, {montoBs} y {diasMora}."
  },
  {
    question: "¿Cuál es el ciclo operativo entre Vendedor, Cajera y Almacén en Pedidos & Preventa?",
    answer: "El flujo comercial de SIGNUM MOTORVEN consta de 3 pasos estrictos de control: (1) El Vendedor emite la Orden de Compra / Preventa; (2) La Cajera es la persona autorizada que procesa el cobro y emite la Factura de Venta formal; (3) Únicamente una vez generada la Factura por la cajera, el sistema genera y habilita automáticamente la Orden de Entrega / Guía de Despacho para que Almacén entregue los lubricantes."
  },
  {
    question: "¿Por qué la Orden de Entrega aparece bloqueada y no se puede imprimir de inmediato?",
    answer: "Por normativa operativa y control de inventarios, no se permite la salida física de mercancía sin factura previa. La Orden de Entrega permanece bloqueada hasta que la Cajera procese la orden en la pestaña 'Facturación en Caja'. Al generarse la factura, la Orden de Entrega se desbloquea de inmediato citando el número de factura fiscal correspondiente."
  },
  {
    question: "¿Cómo accedo al módulo de Pedidos & Preventa?",
    answer: "Tiene dos rutas de acceso: (1) Haga clic en 'Pedidos & Preventa' en el menú lateral izquierdo, o (2) Use el menú de 3 puntos en la barra superior ➔ 'PEDIDOS Y PREVENTAS'. Ambas opciones abren el mismo Modal Unificado de Pedidos directamente en la pestaña 'Nuevo Pedido'."
  },
  {
    question: "¿Qué es el rol ADMINISTRADOR MASTER y qué jerarquía tiene en el sistema?",
    answer: "El ADMINISTRADOR MASTER (Nivel 1) es la máxima autoridad del sistema, reservado para Edson Designer (@edson designer). Posee control absoluto sobre todas las operaciones, finanzas, usuarios, auditoría y parámetros del sistema. Es un usuario protegido que no puede ser eliminado ni degradado."
  },
  {
    question: "¿Cuáles son los 9 roles oficiales del sistema y sus facultades?",
    answer: "La estructura institucional consta de 9 roles en orden estricto de jerarquía: (1) ADMINISTRADOR MASTER — Propietario con control absoluto; (2) TECNOLOGÍA & INFORMÁTICA — Soporte técnico e infraestructura TI; (3) GERENCIA — Dirección general y supervisión estratégica; (4) ADMINISTRACIÓN — Gestión contable, administrativa y fiscal; (5) VENTAS — Preventa, facturación POS y seguimiento comercial; (6) ALMACEN — Control de stock físico y despachos; (7) CAJA — Cobros, movimientos diarios y arqueo; (8) COBRANZA — Cartera de clientes y recuperación de créditos; (9) COMPRAS — Procura y cuentas por pagar a proveedores."
  },
  {
    question: "¿Cómo puedo consultar o cambiar la contraseña de un operador y ver su clave actual?",
    answer: "Ingrese a 'Gestión de Usuarios & Roles' (disponible para Master, TI y Gerencia). En la tabla de usuarios, puede presionar el botón de ojo (👁️) para ver la contraseña actual de cualquier usuario. Además, al presionar el botón de llave ('Cambiar Contraseña'), el modal presenta en primer lugar el campo 'Contraseña Actual' visible en texto legible con opción de alternar su visibilidad, permitiéndole conocer la clave previa antes de ingresar y confirmar la nueva."
  },
  {
    question: "¿Cómo genera el sistema los archivos oficiales TXT de IVA y XML de ISLR para el SENIAT?",
    answer: "En el módulo 'Reportes Fiscales & Cumplimiento SENIAT', la pestaña de Retenciones cuenta con los botones 'Generar TXT SENIAT' y 'Generar XML ISLR'. El sistema procesa automáticamente las facturas del período y compila el archivo TXT oficial de 16 columnas tabuladas conforme a la Providencia Administrativa SNAT/2013/00030, y el archivo XML bajo los esquemas XSD validados por el portal tributario."
  },
  {
    question: "¿Cómo funciona el Cierre Z fiscal diario y qué garantiza el Gran Total con SHA-256?",
    answer: "El Cierre Z consolida las ventas fiscales del día, reinicia los acumuladores diarios y genera un número de cierre correlativo consecutivo e inalterable. El Gran Total Histórico acumula todas las ventas desde la puesta en marcha de la empresa y se sella criptográficamente mediante un hash SHA-256 para garantizar su autenticidad ante auditorías fiscales del SENIAT (cumpliendo con la Prov. SNAT/2011/00071, incluso en 'Días en Cero')."
  },
  {
    question: "¿Cómo alternar entre el Modo Claro y Modo Oscuro?",
    answer: "En la barra superior de la aplicación, al lado del selector de moneda y fecha, se encuentra el botón de alternancia con los íconos de Sol (☀️) y Luna (🌙). Al hacer clic, toda la interfaz, modales, fichas técnicas y gráficos se adaptan instantáneamente preservando su preferencia en el navegador."
  },
  {
    question: "¿Cómo funciona el filtro mensual y el Cierre Anual en el Dashboard Principal?",
    answer: "En la parte superior del Dashboard se encuentra la barra interactiva con los botones 'Anual' y los meses 'Ene' a 'Dic'. Al seleccionar 'Anual', el sistema presenta el Cierre Acumulado de 2026 frente a la meta comercial acumulada, y el gráfico muestra la evolución mensual de cumplimiento. Al seleccionar un mes específico, todos los KPIs, litros y el tacómetro se recalculan únicamente con las facturas de dicho mes."
  },
  {
    question: "¿Qué significan 'Meta Comercial Acumulada' y 'Meta de este Mes' en el Dashboard?",
    answer: "'Meta Comercial Acumulada' representa la cuota total acumulada proyectada para el período analizado (por ejemplo, 300.000 L para el cierre de los 10 meses transcurridos del año). La etiqueta 'Meta de este Mes' indica la cuota base individual fijada para el mes en curso (ej. 30.000 L)."
  },
  {
    question: "¿Cómo funciona el Centro de Notificaciones & Alertas y cómo imprimir su reporte oficial?",
    answer: "El Centro de Notificaciones & Alertas (NotificationsCenterModal) monitorea en tiempo real inventarios por debajo del punto de reorden (ROP), deudas con mora superior a 30 días, discrepancias fiscales y sincronizaciones pendientes. El acceso está disponible desde el botón 'Notificaciones & Alertas' en el Dashboard o el ícono de campana en la cabecera. Dispone de filtros por severidad (Crítica, Advertencia, Informativa, Éxito) y estado (Pendientes o Leídas), botones de acción masiva ('Marcar todas como leídas' y 'Vaciar leídas'), navegación directa al módulo de origen del problema ('Ir al Módulo') y el botón 'Imprimir Reporte', el cual genera un documento legal en PDF con membrete oficial, métricas consolidadas, detalle de eventos y casillas de firma institucional."
  },
  {
    question: "¿Cómo asignar o reasignar las zonas comerciales a los asesores de venta?",
    answer: "En el módulo 'Asesores Comerciales & Zonas de Venta', cada vendedor cuenta con una zona o circuito asignado. Para asignar o modificar la zona, haga clic en el botón 'Editar Zona Asignada' (ícono MapPin) presente en la fila del asesor o en su Ficha Técnica. Se abrirá el modal de reasignación territorial donde podrá seleccionar la nueva zona geográfica (Gran Caracas, Centro-Occidente, Oriente, Los Llanos, etc.) o ingresar una zona personalizada. Al guardar, el cambio se sincroniza de inmediato en Supabase y se actualizan automáticamente las vistas de Pedidos, Preventa y Clientes asociados a ese territorio, sin que se alteren las ventas históricas de Supabase."
  },
  {
    question: "¿Cómo garantiza el sistema la legibilidad óptima y visualización en cualquier dispositivo (smartphones, tablets, laptops, PC)?",
    answer: "La plataforma fue rediseñada integralmente bajo un estándar multi-dispositivo sin cortes horizontales ni superposiciones de interfaz. Se eliminaron los contenedores con posicionamiento 'sticky' forzado que generaban sombras y solapamientos en pantallas compactas; las tablas cuentan con anchos mínimos protegidos y barras de desplazamiento suaves; los modales se abren con límites de altura responsivos (max-h-[90vh]) y scroll vertical fluido; y los botones de interacción crítica (como el ojito de contraseñas con clase '.btn-password-eye' de 32x32px) mantienen dimensiones fijas y centradas en cualquier pantalla, desde un iPhone hasta una laptop o monitor panorámico."
  },
  {
    question: "¿Cómo se protegen y auditan las contraseñas de los operadores en el módulo de usuarios?",
    answer: "Las contraseñas se almacenan de manera segura y sincronizada en Supabase PostgreSQL. En la tabla de gestión de usuarios, el Administrador Master y personal autorizado disponen del botón ergonómico '.btn-password-eye' para alternar la visibilidad entre viñetas y texto claro sin que se desplace el contenido contiguo. Al presionar el botón de llave ('Cambiar Contraseña'), el modal despliega de inmediato la 'Contraseña Actual' para verificarla antes de emitir una nueva clave, la cual requiere un mínimo de 4 caracteres y confirmación idéntica. Todo cambio de contraseña o edición de perfil se registra automáticamente en la Pestaña de Bitácora de Auditoría con marca de tiempo, usuario ejecutor y descripción del evento."
  },
  {
    question: "¿Cómo se generan y qué validez legal tienen los 28 reportes oficiales en PDF generados por SIGNUM MOTORVEN?",
    answer: "SIGNUM MOTORVEN integra un motor generador nativo de 28 reportes oficiales en PDF (pdfReportService.js) que cumplen con las normativas comerciales venezolanas y la Providencia SNAT/2011/00071 del SENIAT. Todos los reportes incluyen membrete corporativo de Distribuidora Signum Motorven C.A. / Oilstone ®, RIF J-50444983-4, correlativo de reporte, fecha y hora de emisión, identificación del operador activo, resumen analítico de métricas, desglose de datos tabulares y tres firmas de conformidad institucional (Elaborado por, Revisado por y Aprobado por). Pueden descargarse o imprimirse directamente para fines de auditoría interna, fiscalizaciones y asambleas gerenciales."
  },
  {
    question: "¿Por qué en Enero de 2026 no aparecen litros facturados en el Dashboard?",
    answer: "En la base de datos oficial GRUMOTOR de Supabase SQL Server, la empresa no emitió facturación comercial en el mes de Enero de 2026. La primera factura oficial emitida en el ejercicio 2026 fue la Factura N° 12 con fecha del 10 de Febrero de 2026. A partir de esa fecha y hasta la actualidad, el sistema consolida el 100% de las facturas (2.493 documentos) y sus 155.199,9 Litros de lubricante vendidos."
  },
  {
    question: "¿Cómo modificar las fechas de apertura o cierre del ejercicio fiscal en curso?",
    answer: "Tiene dos accesos directos: (1) Presione el badge '📅 Año 2026: 01/01 - 31/12' ubicado en la barra superior (HeaderBar), o (2) Ingrese al menú de 3 puntos ➔ 'CONFIGURACIÓN' ➔ Pestaña 'Ejercicio & Período Fiscal'. En dicho formulario podrá definir el año activo y cambiar las fechas de apertura o de cierre según el cronograma legal de la empresa. Al guardar, todo el sistema recalcula los indicadores y rangos de facturación."
  },
  {
    question: "¿Dónde y de qué forma se guardan los cierres de ejercicios de años anteriores?",
    answer: "En la pestaña 'Ejercicio & Período Fiscal' del modal de configuración se encuentra la tabla de 'Historial de Cierres de Ejercicios' (historialEjercicios). Allí se almacena permanentemente cada año cerrado con sus litros totales, facturación neta en USD, cobranzas, número de facturas y estado ('Abierto' o 'Cerrado Definitivo'). Se puede archivar una copia de cualquier año con el botón 'Consolidar / Archivar Ejercicio'."
  },
  {
    question: "¿Cómo desplegar la aplicación en GitHub Pages mediante la carpeta 'dist'?",
    answer: "La aplicación cuenta con una compilación de producción optimizada y autónoma en la carpeta 'dist/' (y su equivalente comprimido 'dist_github_deploy.zip'). Para publicarla: (1) En su repositorio de GitHub, haga clic en 'Add file' ➔ 'Upload files'; (2) Arrastre todo el contenido de 'dist/' (incluyendo la carpeta assets, index.html, 404.html y .nojekyll); (3) Haga clic en 'Commit changes'; (4) Vaya a 'Settings' ➔ 'Pages', elija 'Deploy from a branch', seleccione la rama 'main' (o master) con la carpeta '/ (root)' y presione 'Save'. En 2 minutos su sistema estará en línea."
  },
  {
    question: "¿Cómo funciona la sincronización bidireccional entre la aplicación web y Supabase?",
    answer: "El sistema opera con doble vía: (1) Cuando crea, modifica o elimina un cliente o lubricante desde la app web, el cambio impacta de inmediato en SQL Server (GRUMOTOR) respetando todas las reglas contables e integridad referencial; (2) Cuando se opera en Supabase de escritorio en Windows (ej. se cambian precios o stocks), el demonio de fondo detecta las actualizaciones cada 2 minutos o al presionar 'Sincronizar Profit' y las refleja en la web al instante."
  },
  {
    question: "¿Por qué no se pierden las imágenes de envases ni las fichas de laboratorio al sincronizar desde Supabase?",
    answer: "Gracias al motor arquitectónico 'Smart Merge': Supabase no almacena imágenes ni especificaciones de laboratorio ni contraseñas. Antes de actualizar Supabase, el sincronizador consulta los registros existentes en la nube, retiene la metadata enriquecida (fotos WebP/Base64, viscosidades API, laboratorio a 40°C/100°C, credenciales y georreferenciación GPS) y fusiona únicamente los datos contables e inventario de Supabase, garantizando 0% de pérdida de información."
  }
];

// ==============================================================================
// FLUJOS PASO A PASO
// ==============================================================================
export const WORKFLOWS_STEP_BY_STEP = [
  {
    title: "1. Flujo de Emisión de Factura a Crédito en POS",
    steps: [
      "Ingrese al módulo 'Punto de Venta (POS)' desde el menú lateral.",
      "Seleccione o busque el cliente por RIF o nombre.",
      "Haga clic en 'Score Crédito & Riesgo' para validar que el cliente no tenga moras >30 días y cuente con saldo disponible.",
      "Agregue las presentaciones de lubricante requeridas al carrito.",
      "Presione 'Cobrar', seleccione la condición 'A Crédito', elija los días de plazo (ej: 15 días) y confirme.",
      "El sistema emitirá la Factura Formal y actualizará automáticamente las cuentas por cobrar y el Kardex."
    ]
  },
  {
    title: "2. Flujo Comercial de 3 Pasos: Orden de Compra ➔ Facturación en Caja ➔ Orden de Entrega",
    steps: [
      "Paso 1 (Vendedor): El asesor comercial abre 'Pedidos & Preventa' (Pestaña '1. Orden de Compra'), selecciona cliente, presentaciones de lubricantes y presiona 'Emitir Orden de Compra a Caja'.",
      "Paso 2 (Recepción en Caja): La orden ingresa automáticamente al Pipeline con estado 'En Caja (Por Facturar)'.",
      "Paso 3 (Cajera): La cajera entra a la pestaña '3. Facturación en Caja', selecciona la orden, valida el método de pago y presiona 'Emitir Factura en Caja'.",
      "Paso 4 (Generación de Factura): El sistema procesa la venta fiscal formal, le asigna número de factura legal (ej. FACT-001045) y cambia el estado a 'Facturado'.",
      "Paso 5 (Generación Automática de Orden de Entrega): Al emitirse la factura, el sistema genera y desbloquea automáticamente la 'Orden de Entrega / Guía de Despacho'.",
      "Paso 6 (Despacho Almacén): Almacén y Transporte imprimen la Orden de Entrega oficial (vinculada con el número de factura fiscal) para liberar los lubricantes y entregar al cliente."
    ]
  },
  {
    title: "3. Flujo de Gestión de Cobranzas y Envío de Recordatorio por WhatsApp",
    steps: [
      "Vaya al módulo 'Clientes & Cuentas por Cobrar'.",
      "Haga clic en el botón 'Inteligencia de Cobranzas' en la cabecera.",
      "Revise la Matriz de Aging para identificar los clientes en tramo vencido (15-30 días o +30 días).",
      "Haga clic en el botón verde de WhatsApp al lado del cliente.",
      "Revise el mensaje pre-redactado y presione 'Enviar WhatsApp' para abrir la conversación con el estado de cuenta oficial."
    ]
  },
  {
    title: "4. Flujo de Planificación de Reposición con Matriz de Reorden",
    steps: [
      "Acceda al módulo 'Inventario de Lubricantes'.",
      "Haga clic en 'Matriz de Reorden Inteligente'.",
      "Filtre por 'Quiebre Inmediato' o 'Reorden Urgente'.",
      "Revise las 'Cajas Sugeridas a Producir/Comprar' calculadas por el modelo ROP.",
      "Utilice el simulador de inversión para conocer el presupuesto en USD y Bs. requerido.",
      "Haga clic en 'Generar Orden de Compra' para imprimir o exportar la solicitud a planta."
    ]
  },
  {
    title: "5. Flujo de Creación y Configuración de un Nuevo Operador",
    steps: [
      "Inicie sesión con el usuario Administrador Master ('edson designer') o con rol Tecnología & Informática / Gerencia.",
      "Vaya al módulo 'Gestión de Usuarios & Roles' en el sidebar o menú de cabecera.",
      "Haga clic en el botón 'Nuevo Operador'.",
      "Complete los datos: Nombre completo, nombre de usuario único, departamento corporativo (TI, Dirección, Finanzas, Ventas, Operaciones) y contraseña inicial.",
      "Seleccione el rol jerárquico apropiado entre los 9 disponibles conforme a las responsabilidades del usuario.",
      "Configure los permisos modulares marcando las casillas de los módulos a los que tendrá acceso.",
      "Opcionalmente cargue la fotografía de perfil (el sistema la comprimirá automáticamente para optimizar almacenamiento).",
      "Presione 'Registrar Operador'. El usuario quedará activo y registrado en Supabase y en la bitácora de auditoría de inmediato."
    ]
  },
  {
    title: "6. Flujo de Consulta y Cambio Seguro de Contraseña de Operadores",
    steps: [
      "Acceda al módulo 'Gestión de Usuarios & Roles'.",
      "Localice al operador en la tabla principal. Puede verificar su clave actual haciendo clic en el ícono de ojo (👁️) en la columna Contraseña.",
      "Para modificarla, haga clic en el botón de llave ('Cambiar Contraseña').",
      "En el modal emergente, observe el campo 'Contraseña Actual' para confirmar la clave que el usuario tiene asignada en el sistema.",
      "Ingrese la nueva contraseña deseada (mínimo 4 caracteres) y confírmela en el campo inferior.",
      "Haga clic en 'Actualizar Contraseña'. El cambio se guardará en la nube y se dejará constancia en la Bitácora de Auditoría."
    ]
  },
  {
    title: "7. Flujo de Cierre Fiscal Diario (Reporte Z) y Exportación al SENIAT",
    steps: [
      "Al finalizar la jornada comercial, ingrese al módulo 'Reportes Fiscales & Cumplimiento SENIAT'.",
      "Haga clic en 'Reporte X (Parcial)' para verificar los totales facturados, bases imponibles y formas de pago antes del cierre definitivo.",
      "Presione 'Cierre Z Definitivo'. El sistema emitirá el reporte legal diario, incrementará el correlativo consecutivo y actualizará el Gran Total histórico con sello SHA-256.",
      "Imprima el ticket fiscal térmico de 80mm para el archivo físico de la empresa.",
      "Para la declaración quincenal de retenciones, haga clic en 'Generar TXT SENIAT' para descargar el archivo de 16 columnas tabuladas listo para cargar en el portal oficial del SENIAT."
    ]
  },
  {
    title: "8. Flujo de Análisis de Rentabilidad Mensual",
    steps: [
      "Vaya al módulo 'Análisis de Rentabilidad & P&L Operativo'.",
      "Seleccione el período mensual o trimestral a analizar.",
      "Revise la Cascada Waterfall para identificar las principales partidas de costo.",
      "Haga clic en 'P&L Operativo en Tiempo Real' para ver el estado de resultados completo.",
      "Use el Simulador What-If para evaluar el impacto de subir precios o reducir costos de refinería.",
      "Exporte o imprima el Estado de Resultados para la presentación a la Junta Directiva."
    ]
  },
  {
    title: "9. Flujo de Atención, Resolución y Auditoría de Alertas en el Centro de Notificaciones",
    steps: [
      "Desde el Dashboard Principal o la campana de la barra superior, haga clic en 'Notificaciones & Alertas'.",
      "Revise el contador superior: las alertas rojas 'Críticas' indican quiebre inminente de stock o retenciones por declarar; las amarillas 'Advertencias' señalan cobros demorados.",
      "En cada tarjeta de alerta, haga clic en 'Ir al Módulo' para navegar directamente a la pantalla correspondiente y resolver la causa raíz del evento.",
      "Una vez solventada la situación, haga clic en el botón de verificación para marcar la notificación como leída, o use 'Marcar Todas como Leídas'.",
      "Para auditoría o comités semanales, haga clic en 'Imprimir Reporte' para generar el PDF oficial certificado con firmas institucionales."
    ]
  },
  {
    title: "10. Flujo de Asignación y Reasignación de Zonas Comerciales a Asesores de Venta",
    steps: [
      "Ingrese al módulo 'Asesores Comerciales & Zonas de Venta' desde el menú lateral.",
      "Ubique al vendedor en la tabla de ranking o en el directorio comercial y haga clic en 'Editar Zona Asignada' (ícono MapPin).",
      "En el modal emergente, seleccione el nuevo circuito o estado correspondiente (ej. 'Caracas Metropolitana', 'Región Central - Aragua/Carabobo', 'Occidente - Zulia/Falcón').",
      "Confirme la reasignación haciendo clic en 'Guardar Zona'. El sistema actualizará el registro en la nube en tiempo real.",
      "Verifique en el módulo 'Pedidos & Preventa' que los nuevos pedidos del asesor reflejen de inmediato la zona asignada."
    ]
  },
  {
    title: "11. Flujo de Emisión, Certificación y Descarga de Reportes Oficiales en PDF",
    steps: [
      "Acceda al módulo del cual desea emitir el informe oficial (Inventario, POS, Cobranzas, Notificaciones, Reportes Fiscales, Vendedores, etc.).",
      "Aplique los filtros requeridos (mes, año 2026, vendedor, severidad o estado de cuenta).",
      "Haga clic en el botón de impresión o exportación PDF correspondiente (ej. 'Imprimir Reporte', 'Descargar PDF Oficial', 'Imprimir Manual').",
      "El sistema compilará el documento con membrete legal, cálculo bimoneda en USD y Bs. a Tasa BCV, resumen ejecutivo y firmas institucionales.",
      "Descargue el archivo digital para archivo tributario o imprímalo en formato térmico o papel carta según corresponda."
    ]
  },
  {
    title: "12. Flujo de Modificación de Fechas y Cierre de Ejercicio Fiscal Anual",
    steps: [
      "Haga clic en el badge '📅 Año 2026: 01/01 - 31/12' en la barra superior o abra el Menú de 3 puntos ➔ 'CONFIGURACIÓN' ➔ Pestaña 'Ejercicio & Período Fiscal'.",
      "Defina el año del ejercicio en curso (ej. 2026).",
      "Indique la fecha de apertura oficial ('Fecha Inicio del Ejercicio', por defecto 2026-01-01) y la fecha de corte ('Fecha Fin del Ejercicio', por defecto 2026-12-31).",
      "Presione 'Guardar Parámetros Fiscales'. El sistema guardará la configuración y ajustará todos los filtros del Dashboard y módulos.",
      "Para archivar un snapshot definitivo del año, presione 'Consolidar / Archivar Ejercicio' para agregarlo a la tabla inmutable de historial."
    ]
  },
  {
    title: "13. Flujo de Exploración y Auditoría de Tablas en Supabase SQL Server",
    steps: [
      "En el Dashboard Ejecutivo (con rol Administrador Master o TI), ubique la barra superior 'SERVIDOR SUPABASE & SQL SERVER'.",
      "Haga clic en 'Explorar Tablas' para abrir el modal del explorador multi-base de datos.",
      "Seleccione del menú desplegable cualquiera de las 49 tablas (factura, reng_fac, clientes, cobros, saart, prov, etc.).",
      "Utilice el buscador en tiempo real para localizar transacciones o renglones específicos sin necesidad de escribir código SQL.",
      "Si requiere un respaldo local, haga clic en 'Descargar Tabla JSON' para exportar la información completa a su equipo."
    ]
  },
  {
    title: "14. Flujo de Despliegue en GitHub Pages vía Web Upload",
    steps: [
      "Abra su cuenta en GitHub (https://github.com) y cree un nuevo repositorio público.",
      "En la página principal del repositorio, presione 'Add file' ➔ 'Upload files'.",
      "Abra la carpeta local 'dist/' generada en su proyecto y arrastre todos sus archivos y la subcarpeta 'assets/' al navegador de GitHub.",
      "Escriba un mensaje de confirmación y haga clic en 'Commit changes'.",
      "Ingrese a 'Settings' ➔ 'Pages', seleccione 'Deploy from a branch', elija la rama 'main' con la carpeta '/ (root)' y haga clic en 'Save'. Su aplicación quedará activa en la web en menos de 2 minutos."
    ]
  },
  {
    title: "15. Flujo de Creación, Modificación y Eliminación Bidireccional (App Web ↔ Supabase)",
    steps: [
      "Para Registrar un Nuevo Cliente: Ingrese a 'Clientes & Directorio Oficial', presione el botón '+ Nuevo Cliente', complete el código co_cli (máximo 10 caracteres), RIF, razón social, vendedor asignado y zona comercial. Al hacer clic en 'Registrar Cliente', se guardará en Supabase (SQL Server: clientes) y en Supabase en tiempo real.",
      "Para Modificar Datos: Localice el cliente o lubricante en la lista, presione 'Modificar', ajuste los precios, límites de crédito o condiciones fiscales y guarde los cambios. El impacto en Supabase y la nube es inmediato (<15 ms).",
      "Para Eliminar un Registro: Presione 'Eliminar' en la ficha del elemento. Si el registro no tiene histórico contable, el sistema ejecutará un borrado físico limpio; si ya tiene facturas o pedidos pasados, aplicará automáticamente Soft Delete fiscal (anulado = 1 o inactivo = 1) para resguardar la legalidad tributaria SENIAT.",
      "Para Modificaciones Directas en Supabase Desktop (Windows): Cuando en administración cambien precios o stock en Supabase de escritorio, el motor 'Smart Merge' detectará los cambios automáticamente y actualizará la app web sin alterar fotos, fichas técnicas ni contraseñas."
    ]
  }
];
