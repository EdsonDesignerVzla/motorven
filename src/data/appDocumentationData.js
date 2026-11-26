// ==============================================================================
// 📖 MANUAL DE USUARIO & DOCUMENTACIÓN CENTRALIZADA DE SIGNUM MOTORVEN
// Actualizado: Noviembre 2026 — Edición Especial Pedagógica "Desde Cero"
// Diseñado para cualquier usuario u operador, incluso sin experiencia previa.
// ==============================================================================

export const SYSTEM_METADATA = {
  appName: "SIGNUM MOTORVEN ERP & POS",
  version: "5.8.0 Enterprise Multi-Device",
  company: "SIGNUM MOTORVEN, C.A. / GRUPO MOTORVEN",
  rif: "J-50478166-0",
  databaseSync: "Servidor Central PostgreSQL / Local DB (192.168.0.3:54321 / api.signummotorven.com) + Profit Plus GRUMOTOR",
  lastUpdated: "Noviembre 2026",
  author: "Equipo de Arquitectura, Finanzas y Sistemas SIGNUM MOTORVEN",
  recentMilestones: [
    "Módulo de Predictibilidad & Alertas (Foresight): Radar de Riesgo Temprano, Proyección de Quiebres de Stock, Compresión de Márgenes con Simulador What-If y Flujo de Caja Proyectado.",
    "Módulo de Cuentas de Pasivo & Socios (2.02.01.001): control de cuentas por pagar a socios, otros pasivos, abonos/cargos vinculados a Caja/Banco y libro auxiliar.",
    "POS Mostrador Móvil & Modo Celular (PWA): experiencia móvil completa con Preventa ATP 72h, Facturación directa en POS Caja desde pedidos, Cobranzas CxC y Resumen Ejecutivo.",
    "Multi-Tasa en Barra Superior en tiempo real: BCV, KSY, EUR y USDT sincronizados, además de acceso directo al Explorador de Tablas Supabase en vivo.",
    "Plan de Cuentas Oficial Pro Motorven C.A. (156 cuentas / 99 imputables) + Motor Contable Automático de Partida Doble (accountingService.js) + Estados Financieros BA VEN-NIF 2.",
    "CxC Parte A y Parte B mejorado: cobros directos en divisa/Bs., emisión de Notas de Crédito y Notas de Débito, y filtros avanzados por fecha y cobrador.",
    "Batería de Documentos Legales Venezolanos: Solicitud de Crédito & Pagaré Mercantil (Art. 486 Cód. Comercio), Recibos LOTTT (Art. 106) y Comprobante Anual ARC de ISLR."
  ]
};

// ==============================================================================
// 🚀 GUÍA DE PRIMEROS PASOS PARA ALGUIEN QUE ESTÁ EN CERO (EMPIEZA AQUÍ)
// ==============================================================================
export const BEGINNER_FIRST_STEPS_GUIDE = {
  welcome: {
    title: "¡Bienvenido a SIGNUM MOTORVEN! (Tu Primer Día)",
    summary: "Si acabas de entrar a la empresa o nunca has usado un sistema de gestión empresarial (ERP), no te preocupes. Este sistema fue diseñado para guiarte en cada clic y evitar que cometas errores. Aquí aprenderás cómo funciona el negocio, qué hace el sistema y cómo hacer tu trabajo con total seguridad."
  },
  coreCircuit: {
    title: "El Circuito Vital de la Empresa (¿Cómo fluye el negocio?)",
    description: "Toda la actividad de SIGNUM MOTORVEN sigue una cadena de 5 pasos consecutivos. Comprender esta cadena te permitirá saber exactamente en qué parte del proceso te encuentras:",
    steps: [
      {
        step: 1,
        title: "COMPRA AL PROVEEDOR",
        module: "Compras & Proveedores",
        whatHappens: "La empresa pide lubricantes a distribuidores autorizados. Cuando llega el camión, se revisa la mercancía y se registra la Factura de Compra con sus retenciones de IVA e ISLR."
      },
      {
        step: 2,
        title: "RECEPCIÓN EN ALMACÉN",
        module: "Inventario & Kardex",
        whatHappens: "Los tambores, cuñetes, cajas y litros de aceite ingresan a los estantes físicos. El sistema suma esas unidades al inventario (Almacén 01 o Almacén 02)."
      },
      {
        step: 3,
        title: "PREVENTA O VENTA EN MOSTRADOR",
        module: "Preventa Móvil / Ventas POS",
        whatHappens: "Un asesor comercial visita talleres y tiendas (Preventa) o un cliente llega al mostrador (POS). Se eligen los lubricantes, se verifica el precio y se crea el pedido o factura."
      },
      {
        step: 4,
        title: "COBRO EN CAJA / CUENTAS POR COBRAR",
        module: "Ventas POS / CxC (Parte A)",
        whatHappens: "El cliente paga de contado (en efectivo $, bolívares por punto/pago móvil o transferencia) o pide a crédito (si tiene cupo aprobado). El dinero entra a Caja o Banco."
      },
      {
        step: 5,
        title: "DESPACHO & CONTABILIDAD AUTOMÁTICA",
        module: "Pipeline / Auditoría Contable",
        whatHappens: "El almacén entrega la mercancía con su Guía de Despacho. El sistema genera automáticamente el asiento contable en el Libro Diario sin que tengas que ser contador."
      }
    ]
  },
  theTwoWarehouses: {
    title: "Los 2 Almacenes Explicados Fácil (¡Muy Importante!)",
    description: "En SIGNUM MOTORVEN existen 2 almacenes separados. Debes saber en cuál estás trabajando antes de facturar o consultar inventario:",
    warehouses: [
      {
        code: "01",
        name: "Almacén 01 — Fiscal / Principal",
        forWhat: "¿Para qué sirve?: Para ventas formales con FACTURA FISCAL SENIAT.",
        rules: [
          "Lleva IVA del 16% obligatorio.",
          "Genera Libro de Ventas fiscal oficial para el SENIAT.",
          "Si el cliente paga en divisas ($ efectivo), se aplica el 3% de IGTF por ley.",
          "Tiene su propia lista de precios y costos independientes."
        ]
      },
      {
        code: "02",
        name: "Almacén 02 — Central / Despacho",
        forWhat: "¿Para qué sirve?: Para despachos rápidos y pedidos comerciales con NOTA DE ENTREGA.",
        rules: [
          "Se entrega con Nota de Entrega interna membretada.",
          "Descuenta del inventario físico del Almacén 02.",
          "Tiene sus propios precios y costos independientes (sin IVA en el cobro directo).",
          "Permite agilidad operativa en entregas de volumen y distribución."
        ]
      }
    ]
  },
  currencyGuide: {
    title: "Manejo de Monedas: Dólares ($), Bolívares (Bs.) y Tasa BCV",
    points: [
      "Moneda Base de Registro: Todos los precios y saldos se calculan en Dólares ($ USD) para proteger el valor comercial.",
      "Tasa Oficial BCV: En la parte superior de la pantalla siempre verás la Tasa Oficial del Banco Central de Venezuela. Al hacer clic sobre ella se sincroniza automáticamente.",
      "Conversión Automática: Cada vez que veas un monto en $, el sistema calcula al lado su equivalente exacto en Bolívares (Bs.).",
      "Pagos Mixtos: En Caja puedes recibir un pago combinado (ejemplo: una parte en $ efectivo y el resto por Transferencia Bancaria en Bs.). El sistema cuadra ambas monedas al centavo."
    ]
  },
  goldenRules: [
    {
      rule: "1. Revisa la Tasa BCV al iniciar el día",
      explanation: "Antes de hacer la primera venta, cobranza o pago, haz clic en la Tasa BCV en la barra superior para confirmar que esté al día."
    },
    {
      rule: "2. Fíjate siempre en qué Almacén estás operando",
      explanation: "Si vas a emitir Factura Fiscal, usa Almacén 01. Si vas a emitir Nota de Entrega, usa Almacén 02. Nunca mezcles ambos en el mismo documento."
    },
    {
      rule: "3. Nunca entregues mercancía sin documento impreso",
      explanation: "Todo producto que sale de bodega debe tener su Factura Fiscal o su Nota de Entrega firmada por el chofer y el cliente."
    },
    {
      rule: "4. No vendas a crédito si el cliente está bloqueado o excedido",
      explanation: "Si el semáforo del cliente está en ROJO, el sistema te advertirá que tiene facturas vencidas o superó su cupo. Requiere autorización gerencial."
    },
    {
      rule: "5. Registra los cobros el mismo día en que entra el dinero",
      explanation: "Si un cliente transfiere o paga en efectivo, regístralo de inmediato en Cuentas por Cobrar (Parte A) para que el banco cuadre con la realidad."
    },
    {
      rule: "6. Para mermas o roturas, usa el Kardex de inmediato",
      explanation: "Si un envase se rompe o derrama, no lo botes sin registrarlo en 'Kardex & Mermas'. Así el inventario físico coincidirá con el sistema."
    },
    {
      rule: "7. Si tienes dudas, consulta este Centro de Ayuda",
      explanation: "En cualquier momento puedes presionar el botón de Ayuda (?) o consultar la pestaña de 'Módulos & Tareas' para ver el paso a paso exacto."
    }
  ]
};

// ==============================================================================
// 📚 DOCUMENTACIÓN DETALLADA DE CADA MÓDULO (EDICIÓN PEDAGÓGICA DESDE CERO)
// ==============================================================================
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
    summary: "Centro de comando gerencial con KPIs en tiempo real de facturación, volumen en litros, cobranzas efectivas normalizadas, cuentas por cobrar/pagar, tasa BCV, filtro mensual/anual y rendimiento de los asesores.",
    beginnerIntro: {
      whatIsIt: "Es la pantalla principal del sistema, como el tablero de mandos de un automóvil o un avión. Aquí ves de un solo vistazo la salud completa de la empresa.",
      whyItMatters: "Permite a los dueños y gerentes saber cuánto dinero ha ingresado hoy, cuántos litros de aceite se han vendido, cuánto nos deben los clientes y cuánto debemos a proveedores.",
      whenToUse: "Al iniciar la mañana para ver los números del día anterior, y durante el día para monitorear las metas comerciales.",
      whatIfSkipped: "No afecta la operatividad diaria de ventas, pero no sabrías si la empresa está ganando dinero o alcanzando sus metas de ventas."
    },
    glossary: [
      { term: "KPI", definition: "Indicador Clave de Rendimiento. Son los números grandes en las tarjetas (Ventas, Cobranzas, Litros)." },
      { term: "Volumen en Litros", definition: "Cantidad física total de lubricante vendido (sumando tambores, cuñetes, cajas y potes)." },
      { term: "Cobranza Efectiva", definition: "Dinero real que ya ingresó a las cuentas bancarias o cajas, no promesas de pago." },
      { term: "Tasa BCV", definition: "Precio oficial del Dólar según el Banco Central de Venezuela para convertir a Bolívares." }
    ],
    commonTasks: [
      {
        title: "Tarea 1: Consultar las Ventas y Cobranzas de un Mes Específico",
        objective: "Ver cómo le fue a la empresa en Enero, Febrero o cualquier otro mes.",
        steps: [
          "1. Ubica la barra horizontal de meses que está arriba (Ene, Feb, Mar... Dic, Cierre Anual).",
          "2. Haz clic sobre el mes que deseas analizar.",
          "3. Observa cómo todas las tarjetas de números, gráficos y el tacómetro se actualizan al instante para ese período."
        ],
        proTip: "Si quieres ver el acumulado de todo el año calendario, haz clic en el último botón 'Cierre Anual'."
      },
      {
        title: "Tarea 2: Ver el Rendimiento de un Vendedor en Particular",
        objective: "Saber cuántos litros vendió y cuánto ha cobrado un asesor comercial.",
        steps: [
          "1. Desplázate hacia abajo hasta la sección 'Rendimiento de Asesores Comerciales'.",
          "2. Encontrarás la tarjeta de cada uno de los 10 asesores.",
          "3. Revisa su volumen en litros, total facturado en USD y su barra de porcentaje de meta."
        ],
        proTip: "El color verde indica que superó la meta, amarillo que está cerca, y rojo que está por debajo del 70%."
      },
      {
        title: "Tarea 3: Imprimir el Resumen Gerencial en PDF",
        objective: "Tener un informe formal en papel o enviarlo por WhatsApp a la junta directiva.",
        steps: [
          "1. En la parte superior derecha del Dashboard, busca el botón 'Resumen Ejecutivo' (icono de impresora o documento).",
          "2. Haz clic sobre él. Se abrirá una ventana de vista previa.",
          "3. Presiona 'Generar PDF' o 'Imprimir'. Se descargará un documento formal con firmas autorizadas."
        ],
        proTip: "Este reporte incluye el desglose de rentabilidad bruta y cartera sin desbordar los márgenes de la hoja."
      }
    ],
    mistakesToAvoid: [
      {
        mistake: "Confundir Ventas Facturadas con Dinero en Banco",
        why: "Una venta a crédito suma en 'Ventas', pero el dinero no entra a 'Cobranza' hasta que el cliente realmente paga.",
        solution: "Fíjate siempre en la tarjeta 'Cobranza Efectiva' para saber cuánto dinero líquido tiene la empresa."
      }
    ],
    components: [
      {
        name: "KPIs Gerenciales en Tiempo Real",
        description: "Tarjetas con Ventas Netas Facturadas (USD y Bs.), Litros Vendidos, Cobranza Efectiva Real, Cuentas por Cobrar pendientes y Cuentas por Pagar vigentes."
      },
      {
        name: "Barra de Filtro Mensual & Cierre Anual",
        description: "Selector interactivo para alternar entre el Cierre Anual Acumulado y cada mes individual (Enero a Diciembre)."
      },
      {
        name: "Tacómetro de Cumplimiento Comercial",
        description: "Medidor circular con porcentaje de cumplimiento global frente a la cuota establecida."
      },
      {
        name: "Top 5 Lubricantes Más Vendidos",
        description: "Ranking por volumen real en litros para saber cuáles aceites tienen mayor rotación en bodega."
      }
    ],
    modals: [
      {
        name: "Resumen Ejecutivo Gerencial (ExecutiveSummaryModal)",
        buttonTrigger: "Botón 'Resumen Ejecutivo' en cabecera del Dashboard",
        purpose: "Compila un informe gerencial completo con rentabilidad, litros, cobranzas y cartera.",
        keyFeatures: ["Desglose por línea de lubricante", "Comparativa cobranza vs facturación", "PDF con membrete formal"]
      },
      {
        name: "Centro de Notificaciones & Alertas (NotificationsCenterModal)",
        buttonTrigger: "Botón 'Notificaciones & Alertas' en la barra del Dashboard",
        purpose: "Supervisa quiebres de inventario, moras >30 días en clientes y estado de sincronización.",
        keyFeatures: ["Filtro por severidad", "Navegación contextual 'Ir al Módulo'", "Exportación en PDF"]
      }
    ],
    buttons: [
      { name: "Notificaciones & Alertas", color: "Dorado / Rojo", icon: "Bell", action: "Abre el panel de alertas operativas en tiempo real." },
      { name: "Selector Mensual (Ene - Dic)", color: "Azul Cyan", icon: "Calendar", action: "Filtra todas las métricas al mes seleccionado." },
      { name: "Resumen Ejecutivo PDF", color: "Azul Marino", icon: "Printer", action: "Genera informe gerencial oficial en PDF." },
      { name: "Sincronizar Datos", color: "Verde", icon: "RefreshCw", action: "Actualiza los datos locales con el servidor central." }
    ],
    bestPractices: [
      "Revisar el Dashboard a primera hora de la mañana para conocer el estado general.",
      "Verificar las alertas rojas de quiebre de stock antes de prometer entregas a clientes grandes."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 2. CENTRO DE NOTIFICACIONES & ALERTAS
  // ─────────────────────────────────────────────────────────
  {
    id: "notificaciones",
    title: "Centro de Notificaciones & Alertas",
    icon: "Bell",
    category: "Supervisión & Riesgo",
    badge: "Auditoría",
    roleRequired: "Todos los Roles (Contextual)",
    summary: "Monitorea quiebres de inventario ROP, clientes en mora severa >30 días, facturas por vencer y estado de sincronización con servidor.",
    beginnerIntro: {
      whatIsIt: "Es el sistema de alarmas de la empresa. Te avisa cuando algo urgente necesita tu atención.",
      whyItMatters: "Evita que te quedes sin stock de un aceite muy vendido o que un cliente pase meses sin pagar sin que nadie se dé cuenta.",
      whenToUse: "Cuando veas un número rojo sobre la campanita o al iniciar la jornada laboral.",
      whatIfSkipped: "Podrías prometer mercancía que ya se agotó o dejar que la deuda de un cliente crezca peligrosamente."
    },
    glossary: [
      { term: "Quiebre ROP", definition: "Significa que las existencias llegaron al Punto de Reorden (nivel mínimo de seguridad) y hay que comprar urgente." },
      { term: "Mora Severa", definition: "Facturas de crédito que tienen más de 30 días de retraso sin ser pagadas." },
      { term: "Severidad Crítica", definition: "Alerta de color rojo que requiere solución inmediata hoy mismo." }
    ],
    commonTasks: [
      {
        title: "Tarea 1: Revisar y Resolver una Alerta Crítica",
        objective: "Atender una notificación urgente de inventario o cobranza.",
        steps: [
          "1. Haz clic en la campanita o en el botón 'Notificaciones' en el menú superior.",
          "2. Observa la lista de alertas. Las rojas (Críticas) están arriba.",
          "3. Lee el mensaje (por ejemplo: 'SKU 20W50 Tambor con stock por debajo del mínimo').",
          "4. Haz clic en el botón 'Ir al Módulo' que aparece al lado de la alerta para ir directamente a solucionarla."
        ],
        proTip: "Puedes filtrar por 'Solo Críticas' para concentrarte en lo más urgente."
      }
    ],
    mistakesToAvoid: [
      {
        mistake: "Ignorar las alertas de morosidad",
        why: "Un cliente moroso que sigue comprando acumula una deuda que luego es muy difícil de cobrar.",
        solution: "Avisa de inmediato al departamento de cobranzas cuando veas una alerta de mora >30 días."
      }
    ],
    components: [
      { name: "Contadores de Alertas", description: "Tarjetas con total de alertas Críticas, Advertencias, Informativas y Resueltas." },
      { name: "Listado Contextual", description: "Detalle con fecha, módulo afectado y botón de acción directa." }
    ],
    modals: [
      { name: "Detalle de Alerta", buttonTrigger: "Clic en cualquier tarjeta de alerta", purpose: "Ver el historial y los documentos afectados." }
    ],
    buttons: [
      { name: "Filtrar por Severidad", color: "Gris / Azul", icon: "Sliders", action: "Muestra solo críticas, advertencias o informativas." },
      { name: "Marcar como Leída", color: "Verde", icon: "CheckCircle2", action: "Oculta la alerta cuando ya fue atendida." },
      { name: "Exportar Alertas PDF", color: "Rojo SIGNUM", icon: "Printer", action: "Descarga un informe formal de incidencias." }
    ],
    bestPractices: [
      "No dejar que las alertas críticas superen las 48 horas sin gestión.",
      "Exportar el informe de alertas semanal para la reunión de operaciones."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 3. PREVENTA MÓVIL
  // ─────────────────────────────────────────────────────────
  {
    id: "preventa",
    title: "Preventa Móvil & Reserva ATP 72h",
    icon: "Smartphone",
    category: "Ventas & Campo",
    badge: "Móvil / Vendedor",
    roleRequired: "Master, Ventas, Asesores Comerciales",
    summary: "Catálogo táctil optimizado para celulares y tablets. Permite a los vendedores levantar pedidos en la calle con cálculo de stock disponible ATP, reserva de 72 horas y envío directo al Flujo Comercial.",
    beginnerIntro: {
      whatIsIt: "Es la aplicación que usan los vendedores cuando andan en la calle visitando talleres, tiendas de repuestos y lubricentros.",
      whyItMatters: "Permite armar el pedido en el teléfono del vendedor frente al cliente, mostrándole fotos de los aceites, precios actualizados y existencias reales.",
      whenToUse: "Cada vez que un vendedor está con un cliente y este decide comprar.",
      whatIfSkipped: "El vendedor tendría que anotar en papel, arriesgándose a vender productos agotados o con precios viejos."
    },
    glossary: [
      { term: "Reserva ATP (Available to Promise)", definition: "Garantiza que el producto que agregaste al pedido quede apartado para ese cliente durante 72 horas." },
      { term: "Catálogo Visual", definition: "Muestra las imágenes de cada producto, su grado SAE (ej. 15W40, 20W50) y presentación." },
      { term: "Semáforo del Cliente", definition: "Verde: Al día / Amarillo: Factura próxima a vencer / Rojo: Bloqueado por mora." }
    ],
    commonTasks: [
      {
        title: "Tarea 1: Tomar un Pedido Nuevo en la Calle en 4 Pasos",
        objective: "Levantar un pedido completo para un cliente y enviarlo a facturación.",
        steps: [
          "1. Selecciona el Cliente: En la parte superior busca el nombre o RIF del cliente en la lista.",
          "2. Elige el Almacén: Selecciona 'Almacén 01 (Fiscal)' o 'Almacén 02 (Despacho)' según lo acordado.",
          "3. Agrega los Lubricantes: Busca el producto en el catálogo táctil y presiona el botón '+' para agregar unidades al carrito.",
          "4. Enviar a Facturación: Abre el carrito (icono de bolsa), revisa el total en $ y Bs., y presiona el botón verde 'Enviar Pedido al Pipeline'."
        ],
        proTip: "El sistema apartará automáticamente las unidades durante 72 horas para que nadie más las venda."
      },
      {
        title: "Tarea 2: Registrar un Cliente Nuevo desde el Teléfono",
        objective: "Dar de alta a un cliente que visita el vendedor por primera vez.",
        steps: [
          "1. Haz clic en el botón '+ Nuevo Cliente' en la barra superior de Preventa.",
          "2. Escribe el RIF (ejemplo: J-12345678-0). El sistema validará que sea un RIF válido.",
          "3. Escribe la Razón Social (nombre del taller o empresa), teléfono y dirección exacta.",
          "4. Presiona 'Guardar Solicitud'. El cliente quedará en estado PENDIENTE hasta que la administración lo apruebe."
        ],
        proTip: "Puedes adjuntar el número de WhatsApp para enviarle la cotización en PDF al instante."
      }
    ],
    mistakesToAvoid: [
      {
        mistake: "Intentar agregar productos con Stock 0",
        why: "El sistema bloquea la venta para no prometer mercancía que no existe en bodega.",
        solution: "Verifica el número verde 'Disponible'. Si dice 0, consulta en el otro almacén o avisa a Compras."
      }
    ],
    components: [
      { name: "Buscador Predictivo de Productos", description: "Encuentra lubricantes por código, viscosidad (ej. 20W50), marca o presentación." },
      { name: "Carrito Flotante Táctil", description: "Muestra la cantidad de ítems, subtotal, IVA aplicable y total en $ y Bs." },
      { name: "Directorio 'Mis Clientes'", description: "Lista de clientes asignados a la ruta del vendedor con su cupo disponible." }
    ],
    modals: [
      { name: "Ficha del Producto", buttonTrigger: "Clic sobre la foto del aceite", purpose: "Ver ficha técnica, aplicaciones recomendadas y existencias por almacén." },
      { name: "Registro de Nuevo Cliente", buttonTrigger: "Botón '+ Nuevo Cliente'", purpose: "Formulario para alta rápida de clientes desde el móvil." }
    ],
    buttons: [
      { name: "Agregar al Carrito (+)", color: "Azul Cyan", icon: "Plus", action: "Suma 1 unidad o caja al pedido en curso." },
      { name: "Vaciar Carrito", color: "Rojo", icon: "X", action: "Borra los ítems seleccionados para comenzar de nuevo." },
      { name: "Enviar Pedido", color: "Verde Esmeralda", icon: "CheckCircle2", action: "Guarda el pedido con reserva de 72 horas y lo manda a Caja." }
    ],
    bestPractices: [
      "Confirmar siempre con el cliente si requiere Factura Fiscal (Alm. 01) o Nota de Entrega (Alm. 02) antes de agregar al carrito.",
      "Revisar que la batería del teléfono esté cargada y que los datos se sincronicen antes de salir de zona con internet."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 4. FLUJO COMERCIAL & PIPELINE DE PEDIDOS
  // ─────────────────────────────────────────────────────────
  {
    id: "pedidos",
    title: "Flujo Comercial & Pipeline de Pedidos",
    icon: "Truck",
    category: "Ventas & Logística",
    badge: "Coordinación",
    roleRequired: "Master, Gerencia, Ventas, Caja, Almacén",
    summary: "Tablero estilo Kanban donde se controlan todos los pedidos que vienen de los vendedores. Permite aprobar créditos, verificar stock físico, autorizar el despacho y enviarlo a facturación POS.",
    beginnerIntro: {
      whatIsIt: "Es como la bandeja de entrada de los pedidos. Aquí llegan los pedidos que tomaron los vendedores en la calle.",
      whyItMatters: "Asegura que ningún pedido se pierda, que el cliente tenga crédito suficiente antes de despacharle, y que el almacén prepare la mercancía a tiempo.",
      whenToUse: "El personal de administración y almacén lo usa constantemente durante todo el día.",
      whatIfSkipped: "Los pedidos de los vendedores se quedarían esperando y los clientes no recibirían su mercancía."
    },
    glossary: [
      { term: "Pipeline / Embudo", definition: "Las columnas por las que avanza un pedido: (1) Pendiente -> (2) Aprobado Crédito -> (3) En Facturación -> (4) Despachado." },
      { term: "Vigencia de 72 Horas", definition: "Tiempo máximo que un pedido puede estar esperando antes de que el sistema libere los productos para otros clientes." },
      { term: "Guía de Despacho", definition: "Documento que firma el chofer y el cliente certificando cuántas cajas y litros se entregaron." }
    ],
    commonTasks: [
      {
        title: "Tarea 1: Revisar y Aprobar un Pedido que Viene de Preventa",
        objective: "Autorizar un pedido para que pase a facturación y caja.",
        steps: [
          "1. En el módulo 'Pedidos', revisa la columna 'Pendientes de Aprobación'.",
          "2. Haz clic sobre el pedido que deseas revisar para ver su detalle.",
          "3. Revisa el cliente, los productos solicitados y si tiene crédito aprobado.",
          "4. Haz clic en el botón verde 'Aprobar y Enviar a Facturación (POS)'."
        ],
        proTip: "Si el cliente tiene deuda vencida, el sistema te solicitará confirmación gerencial antes de aprobar."
      },
      {
        title: "Tarea 2: Imprimir la Orden de Preparación para el Bodeguero",
        objective: "Entregarle al personal de almacén la lista de cajas que debe montar en el camión.",
        steps: [
          "1. Ubica el pedido en la columna 'Aprobados'.",
          "2. Haz clic en el botón 'Imprimir Orden de Preparación' (icono de impresora).",
          "3. Se generará un PDF tamaño carta con los pasillos, tambores y cajas que debe alistar el bodeguero."
        ],
        proTip: "El documento incluye casilla para que el bodeguero anote el lote y firme la salida."
      }
    ],
    mistakesToAvoid: [
      {
        mistake: "Dejar un pedido más de 72 horas sin facturar",
        why: "Al cumplirse las 72 horas, el sistema expira el pedido automáticamente y devuelve el stock a disponible.",
        solution: "Monitorea la columna 'Por Vencer' y contacta a Caja si un pedido lleva más de 24 horas sin facturarse."
      }
    ],
    components: [
      { name: "Columnas del Pipeline (Kanban)", description: "Visualización por estados: Pendiente, Aprobado, Facturado, Despachado y Anulado." },
      { name: "Filtro por Almacén (01 vs 02)", description: "Permite separar los pedidos fiscales de las notas de entrega para logística." }
    ],
    modals: [
      { name: "Detalle del Pedido", buttonTrigger: "Clic en cualquier tarjeta de pedido", purpose: "Ver desglose de ítems, precios, vendedor asignado y dirección de entrega." }
    ],
    buttons: [
      { name: "Aprobar Pedido", color: "Verde Esmeralda", icon: "CheckCircle2", action: "Valida crédito y lo envía al mostrador de facturación." },
      { name: "Rechazar / Anular", color: "Rojo", icon: "X", action: "Cancela el pedido y libera inmediatamente el stock reservado." },
      { name: "Imprimir Guía", color: "Azul", icon: "Printer", action: "Emite la guía formal de transporte y entrega." }
    ],
    bestPractices: [
      "Aprobar pedidos en menos de 2 horas desde que el vendedor los emite.",
      "Verificar que el chofer firme la copia de la Guía de Despacho antes de que el camión salga del portón."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 5. INVENTARIO & ALMACENES
  // ─────────────────────────────────────────────────────────
  {
    id: "inventario",
    title: "Inventario de Lubricantes, Multialmacén & Kardex",
    icon: "Package",
    category: "Logística & Almacén",
    badge: "Crítico",
    roleRequired: "Master, Gerencia, Administración, Almacén",
    summary: "Control maestro de existencias físicas de lubricantes en Almacén 01 (Fiscal) y Almacén 02 (Central). Precios y costos independientes, Kardex cronológico, registro de mermas/roturas, traslados y toma física ciega.",
    beginnerIntro: {
      whatIsIt: "Es el libro digital donde está anotada cada lata, caja, cuñete y tambor de aceite que tiene la empresa en sus galpones.",
      whyItMatters: "El inventario es el activo más valioso de SIGNUM MOTORVEN. Si el inventario está descuadrado, todo lo demás (ventas, compras, contabilidad) fallará.",
      whenToUse: "Para consultar si hay stock de un producto, saber cuánto cuesta reponerlo, hacer traslados entre galpones o registrar pérdidas por merma.",
      whatIfSkipped: "Habría robos, pérdidas sin justificar, ventas de productos inexistentes o compras innecesarias de productos que ya sobran."
    },
    glossary: [
      { term: "SKU / Código", definition: "Identificador único de cada producto (ejemplo: MOT-20W50-TB para tambor de 20W50)." },
      { term: "Kardex", definition: "Historial completo de cada producto: cada vez que entra una unidad por compra o sale por venta, queda registrado con fecha, hora y responsable." },
      { term: "Merma / Rotura", definition: "Pérdida de lubricante por bote, envase roto, vencimiento o evaporación." },
      { term: "Traslado", definition: "Mover mercancía física del Almacén 01 al Almacén 02 (o viceversa)." }
    ],
    commonTasks: [
      {
        title: "Tarea 1: Consultar Existencias y Precios de un Aceite en Almacén 01 o 02",
        objective: "Saber rápidamente cuántas unidades quedan y a qué precio venderlas.",
        steps: [
          "1. Entra al módulo 'Inventario'.",
          "2. En la barra de búsqueda escribe el nombre o viscosidad (ej. '15W40 Mineral').",
          "3. Observa la tabla: verás las columnas 'Stock Alm. 01' y 'Stock Alm. 02'.",
          "4. Revisa también la columna 'Precio Venta': notarás que Almacén 01 tiene su precio con IVA y Almacén 02 su precio independiente."
        ],
        proTip: "Si haces clic en el botón de filtro 'Solo con Stock', ocultarás los productos que están en cero."
      },
      {
        title: "Tarea 2: Registrar una Pérdida por Merma o Rotura (con Comprobante PDF)",
        objective: "Dar de baja legalmente un envase roto o derrame en bodega.",
        steps: [
          "1. En el módulo 'Inventario', haz clic en el botón dorado 'Kardex & Mermas'.",
          "2. En la ventana que se abre, presiona '+ Nuevo Movimiento'.",
          "3. En 'Tipo de Movimiento', selecciona 'Salida / Merma (S)'.",
          "4. Elige el Almacén (01 o 02) donde ocurrió la rotura y busca el producto.",
          "5. Escribe la cantidad perdida y el MOTIVO EXACTO (ejemplo: 'Cuñete perforado por montacargas en pasillo B').",
          "6. Presiona 'Registrar Ajuste'. El sistema rebajará el stock de inmediato y te permitirá descargar el Comprobante de Merma en PDF con espacio para firmas."
        ],
        proTip: "Haz firmar ese comprobante por el jefe de almacén y archívalo en la carpeta de auditoría física."
      },
      {
        title: "Tarea 3: Realizar un Traslado entre Almacén 01 y Almacén 02",
        objective: "Mover stock de un almacén a otro sin alterar el total general de la empresa.",
        steps: [
          "1. Haz clic en el botón 'Kardex & Mermas' y presiona '+ Nuevo Movimiento'.",
          "2. Selecciona 'Traslado entre Almacenes (T)'.",
          "3. Elige el Almacén Origen (de dónde sale) y el Almacén Destino (a dónde entra).",
          "4. Elige el producto y la cantidad a mover.",
          "5. Haz clic en 'Procesar Traslado'. El sistema restará del origen y sumará al destino automáticamente."
        ],
        proTip: "Ambos almacenes quedan perfectamente cuadrados sin descuadrar la contabilidad."
      }
    ],
    mistakesToAvoid: [
      {
        mistake: "Botar un envase roto sin registrar la merma en el sistema",
        why: "El sistema seguirá creyendo que ese aceite existe, y alguien intentará venderlo.",
        solution: "Registra la merma el mismo día en que ocurrió con su respectivo comprobante firmado."
      }
    ],
    components: [
      { name: "Tabla Maestra de Existencias", description: "Muestra SKU, Descripción, Marca, Stock Físico 01, Stock Físico 02, Comprometido, Disponible y Costos." },
      { name: "Semáforo ROP de Existencias", description: "Verde: Stock saludable / Amarillo: Cerca del mínimo / Rojo: Quiebre urgente." }
    ],
    modals: [
      { name: "Kardex & Movimientos de Almacén", buttonTrigger: "Botón 'Kardex & Mermas'", purpose: "Consulta de entradas, salidas, mermas y traslados por producto." },
      { name: "Toma Física & Conteo Ciego", buttonTrigger: "Botón 'Toma Física'", purpose: "Auditoría física de inventario para comparar conteo manual vs sistema." }
    ],
    buttons: [
      { name: "Kardex & Mermas", color: "Dorado", icon: "BarChart2", action: "Abre el registro de movimientos y mermas." },
      { name: "Toma Física", color: "Azul", icon: "ClipboardList", action: "Inicia el proceso de conteo físico mensual." },
      { name: "Imprimir Inventario PDF", color: "Rojo SIGNUM", icon: "Printer", action: "Descarga el listado valorizado oficial para auditoría." },
      { name: "Exportar CSV", color: "Verde", icon: "FileSpreadsheet", action: "Descarga la lista de inventario en Excel." }
    ],
    bestPractices: [
      "Hacer conteos físicos rotativos de los productos de mayor valor (tambores de sintético) cada 15 días.",
      "Verificar que cada traslado físico esté acompañado de su comprobante de traslado del sistema."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 6. VENTAS & FACTURACIÓN POS MOSTRADOR
  // ─────────────────────────────────────────────────────────
  {
    id: "ventas",
    title: "Ventas & POS Mostrador (Facturación & Notas de Entrega)",
    icon: "ShoppingCart",
    category: "Comercial & Caja",
    badge: "Operativo",
    roleRequired: "Master, Gerencia, Admin, Ventas, Caja, Cobranza",
    summary: "Terminal de facturación fiscal (Almacén 01) y emisión de Notas de Entrega (Almacén 02) en mostrador. Bloqueo de stock 0, cobro multimoneda ($ y Bs.), cálculo de IVA 16% + IGTF 3%, y flujo de devoluciones con Nota de Crédito.",
    beginnerIntro: {
      whatIsIt: "Es la caja registradora y el punto de venta de la empresa. Aquí es donde se le cobra al cliente y se le entrega su comprobante oficial.",
      whyItMatters: "Es el motor que genera los ingresos diarios. Si cobras mal, entregas mal el cambio o emites el documento incorrecto, la empresa pierde dinero o tiene problemas con el SENIAT.",
      whenToUse: "Cada vez que un cliente compra en mostrador o cuando un pedido de Preventa pasa a ser cobrado.",
      whatIfSkipped: "No se puede omitir; es la única forma legal de emitir una factura o nota de entrega y rebajar el inventario."
    },
    glossary: [
      { term: "Factura Fiscal", definition: "Documento oficial del SENIAT emitido desde Almacén 01, con IVA 16% y número de control correlativo." },
      { term: "Nota de Entrega", definition: "Documento comercial emitido desde Almacén 02 para despacho rápido sin IVA directo en el cobro." },
      { term: "IGTF (Impuesto a Grandes Transacciones Financieras)", definition: "Impuesto del 3% que cobra el SENIAT cuando un cliente paga una Factura Fiscal en divisas (Dólares en efectivo)." },
      { term: "Nota de Crédito", definition: "Documento legal que se emite cuando un cliente devuelve mercancía para reingresar el stock y devolverle su dinero o saldo." }
    ],
    commonTasks: [
      {
        title: "Tarea 1: Emitir una Factura Fiscal de Contado en Mostrador",
        objective: "Facturar y cobrar en el momento con Factura SENIAT.",
        steps: [
          "1. En Ventas POS, selecciona el Tipo de Documento: 'Factura Fiscal' (automáticamente usará Almacén 01).",
          "2. Busca o selecciona el Cliente por su RIF o nombre.",
          "3. Agrega los productos haciendo clic sobre ellos o escribiendo el código.",
          "4. En la parte derecha, selecciona la Condición: 'Contado'.",
          "5. Elige la Forma de Pago (Efectivo $, Transferencia Bs., Punto de Venta o Mixto).",
          "6. Si paga en Bolívares, el sistema usa la Tasa BCV oficial para calcular el total exacto.",
          "7. Presiona el botón verde 'Procesar Factura & Imprimir'. Se imprimirá la factura formal y se rebajará el stock del Almacén 01."
        ],
        proTip: "Si el cliente paga en $ efectivo sobre Factura Fiscal, el sistema calcula automáticamente el 3% de IGTF."
      },
      {
        title: "Tarea 2: Emitir una Nota de Entrega a Crédito",
        objective: "Vender productos de Almacén 02 para ser pagados a 15 o 30 días.",
        steps: [
          "1. Selecciona el Tipo de Documento: 'Nota de Entrega' (usará Almacén 02).",
          "2. Elige el Cliente. El sistema te mostrará su límite de crédito y su saldo actual.",
          "3. Agrega los productos acordados.",
          "4. En Condición de Pago, selecciona 'Crédito'.",
          "5. Elige los días de crédito (ej. 15 días o 30 días). El sistema calculará la fecha exacta de vencimiento.",
          "6. Presiona 'Procesar Nota de Entrega'. El documento se enviará a Cuentas por Cobrar (CxC) para su posterior cobro."
        ],
        proTip: "Si el cliente está en mora o excedió su cupo, el sistema te pedirá autorización de un supervisor."
      },
      {
        title: "Tarea 3: Procesar una Devolución de Cliente con Nota de Crédito",
        objective: "Recibir de vuelta mercancía devuelta por un cliente y anular su deuda.",
        steps: [
          "1. Haz clic en el botón 'Devolución / Nota de Crédito'.",
          "2. Selecciona la Factura o Nota de Entrega original sobre la que se hace la devolución.",
          "3. Elige los productos específicos que el cliente está regresando y la cantidad.",
          "4. Escribe el Motivo (ej. 'Cliente pidió viscosidad equivocada').",
          "5. Presiona 'Emitir Nota de Crédito'. El sistema devolverá las unidades al Almacén físico y rebajará la deuda del cliente en Cuentas por Cobrar."
        ],
        proTip: "Se imprimirá la Nota de Crédito oficial con el nuevo saldo del cliente."
      }
    ],
    mistakesToAvoid: [
      {
        mistake: "Emitir una Factura Fiscal usando productos de Almacén 02",
        why: "El sistema no lo permite porque los inventarios y costos están separados.",
        solution: "Verifica qué tipo de documento necesitas antes de seleccionar los productos."
      },
      {
        mistake: "Olvidar cobrar el IGTF cuando pagan en dólares en efectivo",
        why: "El SENIAT sanciona el no cobro del 3% en pagos en divisas sobre facturas fiscales.",
        solution: "Deja que el sistema lo calcule automáticamente al marcar 'Efectivo USD'."
      }
    ],
    components: [
      { name: "Selector de Documento (FAC vs NE)", description: "Permite alternar entre Factura Fiscal SENIAT y Nota de Entrega." },
      { name: "Parrilla de Productos con Stock en Vivo", description: "Muestra foto, descripción, existencias disponibles y precio." },
      { name: "Panel de Liquidación y Totales", description: "Desglose claro de Base Imponible, IVA 16%, IGTF 3%, Total en USD y Total en Bs." }
    ],
    modals: [
      { name: "Modal de Cobro Multimoneda", buttonTrigger: "Botón 'Cobrar / Facturar'", purpose: "Registro de formas de pago: efectivo, transferencias, Zelle o mixto." },
      { name: "Historial de Ventas del Día", buttonTrigger: "Botón 'Ver Ventas de Hoy'", purpose: "Reimpresión de facturas, notas de entrega y arqueo de caja." }
    ],
    buttons: [
      { name: "Cobrar / Facturar", color: "Verde Esmeralda", icon: "ShoppingCart", action: "Abre el panel de cobro y finalización de venta." },
      { name: "Nueva Venta / Limpiar", color: "Gris", icon: "RefreshCw", action: "Limpia la pantalla para atender al siguiente cliente." },
      { name: "Devolución (Nota de Crédito)", color: "Ámbar", icon: "FileText", action: "Abre el flujo de devolución de mercancía." }
    ],
    bestPractices: [
      "Contar el dinero físico en frente del cliente antes de presionar 'Procesar Factura'.",
      "Verificar en la pantalla del banco que la transferencia o pago móvil se haya acreditado efectivamente."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 7. FUERZA DE VENTAS, ZONAS & COMISIONES
  // ─────────────────────────────────────────────────────────
  {
    id: "vendedores",
    title: "Fuerza de Ventas, Zonas Comerciales & Comisiones",
    icon: "Users",
    category: "Comercial & RRHH",
    badge: "Supervisión",
    roleRequired: "Master, Gerencia, Administración",
    summary: "Gestión de los 10 asesores comerciales, asignación de rutas/zonas geográficas, seguimiento de cuotas mensuales en litros y cálculo automático de comisiones por cobranza efectiva.",
    beginnerIntro: {
      whatIsIt: "Es el panel donde se administra al equipo de vendedores que recorre el país ofreciendo los lubricantes.",
      whyItMatters: "Permite saber qué vendedor está vendiendo más, qué zonas están rindiendo mejor y calcular con exactitud cuánto se le debe pagar a cada uno de comisión.",
      whenToUse: "A fin de mes para liquidar comisiones, o cada semana para revisar las metas de venta.",
      whatIfSkipped: "Los vendedores no tendrían metas claras y no se sabría cómo calcular sus comisiones de forma justa."
    },
    glossary: [
      { term: "Cuota / Meta en Litros", definition: "Cantidad mínima de litros de aceite que el asesor debe vender en el mes (ejemplo: 5,000 Litros)." },
      { term: "Comisión por Cobranza", definition: "Porcentaje que gana el vendedor únicamente cuando el cliente YA PAGÓ la factura (no cuando solo se emitió)." },
      { term: "Zona Comercial", definition: "Región geográfica asignada (ejemplo: Gran Caracas, Oriente, Centro, Occidente)." }
    ],
    commonTasks: [
      {
        title: "Tarea 1: Consultar la Liquidación de Comisiones de un Vendedor",
        objective: "Saber cuánto dinero ganó un vendedor por sus ventas cobradas del mes.",
        steps: [
          "1. Entra al módulo 'Fuerza de Ventas'.",
          "2. Ubica la tarjeta del vendedor que deseas revisar.",
          "3. Haz clic en 'Ver Detalle de Comisiones'.",
          "4. Verás la lista de todas las facturas que sus clientes pagaron en el mes y el porcentaje aplicado.",
          "5. Presiona 'Imprimir Reporte de Comisión PDF' para entregarle su comprobante."
        ],
        proTip: "El sistema no paga comisión sobre facturas impagas para incentivar la buena cobranza."
      }
    ],
    mistakesToAvoid: [
      {
        mistake: "Calcular comisiones sobre ventas no cobradas",
        why: "Si un cliente nunca paga, la empresa estaría pagando comisiones sobre un dinero que nunca entró.",
        solution: "El sistema calcula las comisiones automáticamente basándose en la cobranza efectiva real."
      }
    ],
    components: [
      { name: "Ranking Comercial de Asesores", description: "Tabla comparativa ordenada por litros vendidos y dinero cobrado." },
      { name: "Mapa de Zonas y Rutas", description: "Asignación de clientes y estados a cada asesor comercial." }
    ],
    modals: [
      { name: "Ficha del Asesor Comercial", buttonTrigger: "Clic en el vendedor", purpose: "Configurar porcentaje de comisión, meta mensual y zona asignada." }
    ],
    buttons: [
      { name: "Nueva Meta Comercial", color: "Azul", icon: "TrendingUp", action: "Establece la cuota de litros para el mes siguiente." },
      { name: "Reporte de Comisiones PDF", color: "Verde", icon: "Printer", action: "Genera la liquidación oficial de comisiones para nómina." }
    ],
    bestPractices: [
      "Revisar el avance de metas los viernes en la tarde con todo el equipo comercial.",
      "Asignar zonas sin solapamientos para evitar disputas entre vendedores."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 8. COMPRAS, PROVEEDORES & REGISTRO SENIAT
  // ─────────────────────────────────────────────────────────
  {
    id: "compras",
    title: "Compras, Proveedores & Registro Fiscal SENIAT",
    icon: "ShoppingBag",
    category: "Compras & Fiscal",
    badge: "Crítico",
    roleRequired: "Master, Gerencia, Compras, Administración",
    summary: "Ciclo completo de adquisiciones: Requisición interna -> Orden de Compra (OC) -> Recepción de Mercancía en Almacén -> Registro de Factura SENIAT con Retenciones de IVA (75%/100%) e ISLR, y generación automática del Neto a Pagar en CxP.",
    beginnerIntro: {
      whatIsIt: "Es el módulo donde se registran todas las compras que la empresa hace a sus distribuidores y fabricantes de lubricantes.",
      whyItMatters: "Sin compras no hay mercancía para vender. Además, aquí se calculan las retenciones de impuestos que la ley venezolana exige retener a los proveedores para entregárselas al SENIAT.",
      whenToUse: "Cada vez que se hace un pedido a un proveedor o cuando llega una factura con un camión de mercancía.",
      whatIfSkipped: "No entraría el inventario al sistema, no se registraría la deuda con el proveedor y el SENIAT podría multar a la empresa por no retener impuestos."
    },
    glossary: [
      { term: "Orden de Compra (OC)", definition: "Documento oficial donde le decimos al proveedor qué productos queremos comprar y a qué precio acordado." },
      { term: "Retención de IVA (75% o 100%)", definition: "Porcentaje del impuesto que la empresa no le paga al proveedor, sino que se lo entrega directamente al SENIAT." },
      { term: "Retención de ISLR", definition: "Porcentaje retenido sobre la ganancia estimada del proveedor (normalmente 2% o 5%)." },
      { term: "Neto a Pagar", definition: "Lo que realmente se le transfiere al proveedor = Total Factura MENOS Retención IVA MENOS Retención ISLR." }
    ],
    commonTasks: [
      {
        title: "Tarea 1: Registrar una Factura de Compra Fiscal SENIAT en 5 Pasos",
        objective: "Cargar una factura que nos dio un proveedor y calcular las retenciones legales.",
        steps: [
          "1. En el módulo 'Compras', haz clic en la pestaña 'Registro Compra SENIAT'.",
          "2. Selecciona el Proveedor (ej. Distribuidora Nacional de Lubricantes, C.A.).",
          "3. Escribe los datos de la factura que tienes en la mano: Número de Factura, Número de Control SENIAT y Fecha de Emisión.",
          "4. Ingresa el Monto Base y el IVA (16%).",
          "5. El sistema calculará automáticamente: Retención IVA (75%), Retención ISLR (ej. 2%) y el Neto a Pagar.",
          "6. Elige el Almacén al que entra la mercancía y presiona 'Guardar Compra Fiscal'.",
          "7. El sistema creará la Cuenta por Pagar (CxP) por el Neto exacto y generará el Comprobante de Retención de IVA oficial con su correlativo de 14 dígitos."
        ],
        proTip: "Imprime de inmediato el Comprobante de Retención de IVA para enviárselo al proveedor por correo."
      }
    ],
    mistakesToAvoid: [
      {
        mistake: "Olvidar escribir el Número de Control SENIAT de la factura del proveedor",
        why: "El SENIAT exige el número de control para validar el crédito fiscal en el Libro de Compras.",
        solution: "Copia cuidadosamente el número preimpreso en rojo que está en la esquina de la factura física."
      }
    ],
    components: [
      { name: "Bandeja de Requisiciones y Órdenes de Compra", description: "Flujo formal de aprobación de compras antes de comprometer dinero." },
      { name: "Formulario Fiscal SENIAT", description: "Campos estrictos para RIF, Número de Factura, Número de Control, Afecta, Exenta e IVA." }
    ],
    modals: [
      { name: "Registro de Nueva Compra Fiscal", buttonTrigger: "Botón '+ Cargar Factura'", purpose: "Ventana con cálculo en tiempo real de retenciones y neto a pagar." }
    ],
    buttons: [
      { name: "Nueva Orden de Compra", color: "Azul", icon: "Plus", action: "Emite documento formal de compra al distribuidor." },
      { name: "Cargar Factura SENIAT", color: "Verde Esmeralda", icon: "CheckCircle2", action: "Registra la factura formal y crea el pasivo en CxP." },
      { name: "Comprobante Retención PDF", color: "Rojo SIGNUM", icon: "Printer", action: "Descarga el comprobante de 14 dígitos de retención de IVA." }
    ],
    bestPractices: [
      "Verificar que la factura física original no tenga tachaduras ni enmiendas.",
      "Comprobar que el RIF del proveedor esté activo en el portal del SENIAT antes de registrar."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 9. INTELIGENCIA DE NEGOCIOS & RENTABILIDAD
  // ─────────────────────────────────────────────────────────
  {
    id: "rentabilidad",
    title: "Análisis de Rentabilidad & P&L Operativo",
    icon: "TrendingUp",
    category: "Finanzas & Dirección",
    badge: "Estratégico",
    roleRequired: "Master, Gerencia General",
    summary: "Evaluación de márgenes brutos y netos por línea de producto, rentabilidad por cliente y cálculo del costo de reposición frente a la inflación.",
    beginnerIntro: {
      whatIsIt: "Es la pantalla donde se analiza cuánto dinero le queda a la empresa 'limpio' después de pagar el costo de los aceites.",
      whyItMatters: "Una empresa puede vender millones de dólares pero quebrar si su margen de ganancia es menor a sus gastos operativos.",
      whenToUse: "Los gerentes y directores la consultan al final de cada mes o al momento de cambiar precios.",
      whatIfSkipped: "No sabrías qué productos te hacen ganar dinero y cuáles te están generando pérdidas ocultas."
    },
    glossary: [
      { term: "Margen Bruto (%)", definition: "Porcentaje de ganancia sobre el precio de venta (ejemplo: si compras a $10 y vendes a $13, tu margen es 23%)." },
      { term: "Costo de Reposición", definition: "Lo que cuesta volver a comprar ese mismo pote de aceite hoy en día, no lo que costó hace tres meses." }
    ],
    commonTasks: [
      {
        title: "Tarea 1: Descubrir cuál es la Línea de Lubricantes más Rentable",
        objective: "Saber qué marca o categoría deja mejor ganancia.",
        steps: [
          "1. En el módulo 'Rentabilidad', selecciona el período a consultar.",
          "2. Observa el gráfico de barras por 'Línea de Producto'.",
          "3. Compara el margen de aceites Sintéticos vs Minerales vs Grasas."
        ],
        proTip: "Normalmente los aceites Sintéticos e Industriales tienen un margen porcentual mayor que los minerales masivos."
      }
    ],
    mistakesToAvoid: [
      {
        mistake: "Fijar precios basados en costos viejos",
        why: "Si reponer el tambor cuesta más de lo que cobraste, estarás perdiendo capital de trabajo.",
        solution: "Revisa siempre la columna 'Último Costo de Reposición'."
      }
    ],
    components: [
      { name: "Gráfico de Márgenes por Familia", description: "Comparativa visual de rentabilidad por categorías." },
      { name: "Tabla de Rentabilidad por SKU", description: "Detalle con Costo Promedio, Precio Venta y Margen Neto." }
    ],
    modals: [
      { name: "Simulador de Precios", buttonTrigger: "Botón 'Simular Precios'", purpose: "Proyectar qué pasaría con las ganancias si se ajusta un precio." }
    ],
    buttons: [
      { name: "Exportar Análisis P&L", color: "Verde", icon: "Download", action: "Descarga el reporte de utilidades en Excel." }
    ],
    bestPractices: [
      "Mantener un margen bruto global mínimo del 22% para cubrir gastos fijos y fletes."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 10. CAJA CHICA & BANCOS / TESORERÍA
  // ─────────────────────────────────────────────────────────
  {
    id: "caja",
    title: "Caja Chica, Cajas Operativas & Bancos",
    icon: "Wallet",
    category: "Tesorería & Finanzas",
    badge: "Diario",
    roleRequired: "Master, Gerencia, Caja, Administración",
    summary: "Control del dinero líquido de la empresa: Caja Moneda Nacional (Bs.), Caja Divisas ($ efectivo), Zelle y 10 Cuentas Bancarias nacionales. Registro de ingresos, egresos menores, conciliación bancaria y cuadre diario de caja.",
    beginnerIntro: {
      whatIsIt: "Es el control de todo el dinero en efectivo y en las cuentas bancarias de la empresa. Aquí se sabe hasta el último centavo dónde está guardado.",
      whyItMatters: "El dinero mal administrado o no registrado desaparece. Cada bolívar y cada dólar que entra o sale debe tener un comprobante que lo justifique.",
      whenToUse: "El cajero y el administrador lo usan todos los días: al abrir la caja, cada vez que reciben un pago, cuando pagan un gasto menor (papelería, café, flete) y al cerrar al final de la tarde.",
      whatIfSkipped: "Habría faltantes de dinero, cuentas bancarias descuadradas y no se sabría si el dinero de las ventas realmente llegó al banco."
    },
    glossary: [
      { term: "Arqueo de Caja", definition: "Contar físicamente billete por billete en la gaveta y comparar contra lo que el sistema dice que debería haber." },
      { term: "Caja Chica", definition: "Fondo de dinero en efectivo para gastos pequeños e imprevistos de la oficina (ej. agua, bombillos, mensajero)." },
      { term: "Conciliación Bancaria", definition: "Comparar el estado de cuenta del banco (Banesco, Mercantil, Venezuela, etc.) contra los registros del sistema." }
    ],
    commonTasks: [
      {
        title: "Tarea 1: Registrar un Gasto Menor de Caja Chica en 3 Pasos",
        objective: "Anotar una salida de dinero en efectivo con su comprobante.",
        steps: [
          "1. En el módulo 'Caja & Bancos', haz clic en el botón '+ Registrar Movimiento'.",
          "2. En Tipo de Movimiento selecciona 'Egreso / Gasto'.",
          "3. Selecciona la Caja de donde sale el dinero (ej. 'Caja Moneda Nacional' o 'Caja Divisas').",
          "4. Escribe el Monto y el Concepto detallado (ejemplo: 'Compra de 2 botellones de agua potable para oficina').",
          "5. Presiona 'Guardar Movimiento'. El sistema rebajará el saldo disponible de esa caja al instante y generará el asiento contable."
        ],
        proTip: "Guarda la factura o recibo físico en el sobre de Caja Chica junto con el comprobante que imprime el sistema."
      },
      {
        title: "Tarea 2: Hacer el Arqueo y Cierre Diario de Caja",
        objective: "Cuadrar la caja al final de la jornada laboral.",
        steps: [
          "1. Al finalizar la tarde, haz clic en el botón 'Arqueo de Caja / Cierre Diario'.",
          "2. Cuenta todos los billetes físicos de Dólares y Bolívares que tienes en la gaveta.",
          "3. Ingresa las cantidades en la pantalla de arqueo.",
          "4. El sistema comparará tu conteo físico contra las ventas del día.",
          "5. Si la diferencia es $0.00, presiona 'Confirmar Cierre Diario' e imprime el reporte de cierre firmado."
        ],
        proTip: "Si hay alguna diferencia, revisa si se olvidó registrar algún gasto menor antes de cerrar."
      }
    ],
    mistakesToAvoid: [
      {
        mistake: "Pagar gastos personales o no autorizados de la caja",
        why: "Genera faltantes de dinero que son descontados de la responsabilidad del cajero.",
        solution: "Todo egreso de caja debe estar previamente aprobado por la administración."
      }
    ],
    components: [
      { name: "Tarjetas de Saldos Disponibles", description: "Muestra el saldo en vivo de Caja Divisas, Caja Bs., Zelle y las 10 Cuentas Bancarias." },
      { name: "Libro de Movimientos de Tesorería", description: "Tabla cronológica de cada entrada y salida con fecha, responsable y saldo resultante." }
    ],
    modals: [
      { name: "Registrar Movimiento de Caja/Banco", buttonTrigger: "Botón '+ Registrar Movimiento'", purpose: "Ingreso o egreso manual con asignación contable." },
      { name: "Arqueo y Cierre de Caja", buttonTrigger: "Botón 'Arqueo de Caja'", purpose: "Validación de saldo físico vs teórico con firmas de entrega." }
    ],
    buttons: [
      { name: "+ Registrar Movimiento", color: "Verde", icon: "Plus", action: "Abre el formulario para entrada o salida de dinero." },
      { name: "Arqueo de Caja", color: "Dorado", icon: "Wallet", action: "Ejecuta el cuadre de billetes y cierre de jornada." },
      { name: "Reporte de Cierre PDF", color: "Rojo SIGNUM", icon: "Printer", action: "Descarga el acta de arqueo firmada para contabilidad." }
    ],
    bestPractices: [
      "Nunca dejar la gaveta de caja abierta ni desatendida.",
      "Hacer el arqueo diario sin falta todos los días a las 5:00 PM."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 11. CUENTAS POR COBRAR (CxC) & CRÉDITO
  // ─────────────────────────────────────────────────────────
  {
    id: "cxc",
    title: "Cuentas por Cobrar (CxC), Cobros Parte A & Cartera",
    icon: "FileCheck2",
    category: "Cobranzas & Finanzas",
    badge: "Crítico",
    roleRequired: "Master, Gerencia, Cobranza, Administración",
    summary: "Gestión integral de cartera de clientes: Vista Consolidada (Facturas Fiscales + Notas de Entrega), Registro de Cobros (Parte A), Solicitud de Crédito & Pagaré Mercantil de Garantía Ejecutiva, alertas de mora y cobranzas por WhatsApp.",
    beginnerIntro: {
      whatIsIt: "Es donde se lleva la cuenta de todo el dinero que los clientes le deben a SIGNUM MOTORVEN por compras a crédito.",
      whyItMatters: "Vender sin cobrar es regalar la mercancía. La liquidez de la empresa depende de que este módulo se gestione con puntualidad y mano firme.",
      whenToUse: "El analista de cobranzas trabaja aquí todo el día: contactando clientes, revisando transferencias recibidas y registrando abonos.",
      whatIfSkipped: "Los clientes se atrasarían, la empresa se quedaría sin dinero para pagar nóminas o comprar mercancía y aumentaría el riesgo de pérdidas."
    },
    glossary: [
      { term: "Cobro Parte A", definition: "Función que aplica el pago del cliente directamente sobre la factura, genera el recibo COB-XXXXXX, aumenta el saldo del banco y crea el asiento contable." },
      { term: "Pagaré Mercantil de Garantía", definition: "Documento legal firmado por el cliente (según el Código de Comercio venezolano) que garantiza jurídicamente el cobro de la deuda en tribunales si se niega a pagar." },
      { term: "Días de Mora", definition: "Número de días transcurridos desde que se venció el plazo de crédito prometido." }
    ],
    commonTasks: [
      {
        title: "Tarea 1: Registrar un Cobro de Cliente en 4 Pasos (Parte A)",
        objective: "Anotar que un cliente pagó una factura y rebajar su deuda.",
        steps: [
          "1. Entra a 'Cuentas por Cobrar' y busca al cliente en la barra de búsqueda.",
          "2. En la lista de facturas pendientes, ubica la que el cliente está pagando.",
          "3. Haz clic en el botón 'Cobrar' o 'Parte A' al final de la fila de esa factura.",
          "4. En la ventana que se abre: escribe el Monto cobrado, elige el Banco o Caja donde cayó el dinero, y escribe el número de referencia bancaria.",
          "5. Presiona 'Registrar Cobro'. El sistema actualizará el saldo de la factura, rebajará la deuda del cliente, sumará el dinero al banco e imprimirá el Recibo Oficial de Cobro COB-XXXXXX."
        ],
        proTip: "Si el pago cubre la totalidad de la factura, esta cambiará de estado automáticamente a 'PAGADA'."
      },
      {
        title: "Tarea 2: Emitir la Solicitud de Línea de Crédito & Pagaré Mercantil",
        objective: "Hacer firmar al cliente la garantía legal antes de darle crédito.",
        steps: [
          "1. Haz clic en el botón 'Solicitud & Pagaré' (o desde el Directorio de Clientes).",
          "2. Selecciona el Cliente.",
          "3. Escribe el Límite de Crédito solicitado en USD y el plazo en días (ej. $5,000 a 15 días).",
          "4. Ingresa los datos del Representante Legal y el Fiador Solidario con sus cédulas y RIF.",
          "5. Presiona 'Generar Solicitud & Pagaré PDF'.",
          "6. Se descargará el documento legal de 2 páginas con el texto estricto del Art. 486 del Código de Comercio.",
          "7. Imprímelo, hazlo firmar y colocar huella por el representante legal antes de autorizar el primer despacho."
        ],
        proTip: "Guarda el pagaré original firmado en la caja fuerte de la empresa."
      },
      {
        title: "Tarea 3: Enviar Recordatorio de Cobranza por WhatsApp",
        objective: "Notificar al cliente de forma educada y profesional que su factura está por vencer.",
        steps: [
          "1. En la lista de facturas, ubica al cliente con días de mora o próximo a vencer.",
          "2. Haz clic en el icono verde de WhatsApp al lado del teléfono del cliente.",
          "3. Se abrirá WhatsApp con un mensaje pre-redactado con el número de factura, monto pendiente en $ y Bs., y los datos de las cuentas bancarias de la empresa.",
          "4. Presiona enviar en WhatsApp."
        ],
        proTip: "Esto ahorra horas de redacción y evita errores en los números de cuenta."
      }
    ],
    mistakesToAvoid: [
      {
        mistake: "Registrar un cobro sin haber verificado primero que el dinero esté disponible en el banco",
        why: "Existen comprobantes bancarios falsificados o transferencias que rebotan.",
        solution: "Abre siempre la banca por internet de la empresa y confirma que los fondos estén 'Disponibles' antes de registrar el cobro."
      }
    ],
    components: [
      { name: "Tabla de Cartera Consolidada (FAC + NE)", description: "Visualización unificada de facturas fiscales y notas de entrega pendientes de cobro." },
      { name: "Semáforo de Envejecimiento de Deuda", description: "Columnas por tramos: Por Vencer, 1-7 días, 8-15 días, 16-30 días y >30 días de mora." }
    ],
    modals: [
      { name: "Registro de Cobro (Parte A)", buttonTrigger: "Botón 'Cobrar' en la fila del documento", purpose: "Formulario para abonar o liquidar una factura con asignación bancaria." },
      { name: "Solicitud de Crédito & Pagaré Mercantil", buttonTrigger: "Botón 'Solicitud & Pagaré'", purpose: "Generador de contrato de crédito y pagaré ejecutivo según Código de Comercio." }
    ],
    buttons: [
      { name: "Registrar Cobro (Parte A)", color: "Verde Esmeralda", icon: "CheckCircle2", action: "Abre la ventana para aplicar el cobro al documento." },
      { name: "Solicitud & Pagaré", color: "Azul Índigo", icon: "FileText", action: "Genera el PDF del pagaré mercantil legal de garantía." },
      { name: "Estado de Cuenta PDF", color: "Rojo SIGNUM", icon: "Printer", action: "Descarga el estado de cuenta consolidado para el cliente." },
      { name: "Cobranza WhatsApp", color: "Verde WhatsApp", icon: "Smartphone", action: "Envía recordatorio automático de cobro con cuentas bancarias." }
    ],
    bestPractices: [
      "No despachar nueva mercancía a clientes que tengan facturas con más de 7 días de atraso sin abono.",
      "Revisar la cartera todos los lunes por la mañana y planificar la ruta de cobranzas de la semana."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 12. CUENTAS POR PAGAR (CxP) & PROVEEDORES
  // ─────────────────────────────────────────────────────────
  {
    id: "cxp",
    title: "Cuentas por Pagar (CxP), Proveedores & Pagos Parte A",
    icon: "FileSpreadsheet",
    category: "Finanzas & Compras",
    badge: "Crítico",
    roleRequired: "Master, Gerencia, Compras, Administración",
    summary: "Control de compromisos adquiridos con fabricantes y distribuidores de lubricantes: Facturas de compra, Retenciones de IVA e ISLR ya descontadas, Neto a Pagar, programación de pagos por tramo de vencimiento y registro de abonos (Parte A).",
    beginnerIntro: {
      whatIsIt: "Es el módulo donde la empresa lleva el control de lo que LE DEBE a sus proveedores de lubricantes y servicios.",
      whyItMatters: "Pagar a tiempo mantiene abiertas las líneas de crédito y asegura que los fabricantes sigan despachando mercancía con buenos descuentos. Además, garantiza que los pagos se descuenten correctamente del banco.",
      whenToUse: "El personal de administración lo revisa para planificar los pagos de la semana y registrar las transferencias realizadas a los distribuidores.",
      whatIfSkipped: "La empresa podría caer en mora con sus proveedores, perder créditos o pagar dos veces la misma factura por falta de control."
    },
    glossary: [
      { term: "Neto a Pagar en CxP", definition: "El monto exacto que se le debe pagar al proveedor luego de haberle restado las retenciones de IVA e ISLR." },
      { term: "Comprobante de Retención de IVA", definition: "Documento oficial del SENIAT con número correlativo que le entregamos al proveedor para que él demuestre que le retuvimos el impuesto." },
      { term: "Pago Parte A", definition: "Operación en la que se registra la transferencia bancaria hecha al proveedor, descontando el dinero del banco y saldando la deuda." }
    ],
    commonTasks: [
      {
        title: "Tarea 1: Registrar un Pago a Proveedor en 3 Pasos (Parte A)",
        objective: "Anotar que se le transfirió a un proveedor y rebajar la deuda de la empresa.",
        steps: [
          "1. En el módulo 'Cuentas por Pagar', busca la factura del proveedor que se va a pagar.",
          "2. Haz clic en el botón 'Pagar' o 'Parte A' al final de la fila.",
          "3. Selecciona la Cuenta Bancaria de la empresa de donde salió el dinero, escribe el número de referencia y el monto pagado.",
          "4. Presiona 'Registrar Pago al Proveedor'. El sistema rebajará la deuda del proveedor, descontará el saldo del banco seleccionado y generará el comprobante de pago."
        ],
        proTip: "Si la factura queda completamente pagada, su estado cambiará a 'SOLVENTE'."
      }
    ],
    mistakesToAvoid: [
      {
        mistake: "Pagarle al proveedor el Total de la Factura sin haber descontado las retenciones SENIAT",
        why: "Si le pagas el total, la empresa estará perdiendo dinero porque igual tendrá que pagarle el IVA retenido al SENIAT.",
        solution: "Paga siempre el monto que dice 'Neto a Pagar', que ya tiene restadas las retenciones."
      }
    ],
    components: [
      { name: "Listado de Facturas de Proveedores", description: "Tabla con Proveedor, RIF, Nro. Factura, Total Bruto, Retención IVA, Retención ISLR, Neto a Pagar y Saldo Pendiente." },
      { name: "Semáforo de Pagos por Vencer", description: "Organiza las facturas por fecha para saber cuáles vencen esta semana." }
    ],
    modals: [
      { name: "Registro de Pago a Proveedor (Parte A)", buttonTrigger: "Botón 'Pagar'", purpose: "Aplicar la transferencia bancaria al pasivo del proveedor." }
    ],
    buttons: [
      { name: "Registrar Pago (Parte A)", color: "Verde Esmeralda", icon: "CheckCircle2", action: "Abre el formulario para cancelar la factura." },
      { name: "Reporte de Deuda a Proveedores PDF", color: "Rojo SIGNUM", icon: "Printer", action: "Genera informe detallado de compromisos pendientes." }
    ],
    bestPractices: [
      "Entregar siempre los comprobantes de retención al proveedor en los primeros 10 días del mes.",
      "Programar los pagos fuertes a distribuidores en base al flujo de cobranza proyectado."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 13. REPORTES FISCALES & SENIAT
  // ─────────────────────────────────────────────────────────
  {
    id: "reportes",
    title: "Libros Fiscales & Cumplimiento SENIAT",
    icon: "FileText",
    category: "Fiscal & Tributos",
    badge: "Oficial SENIAT",
    roleRequired: "Master, Gerencia, Administración, Contabilidad",
    summary: "Generación de obligaciones tributarias venezolanas: Libro de Ventas mensual, Libro de Compras mensual, Comprobante Anual ARC de Proveedores (Art. 24 Decreto 1.808), Declaración TXT de IVA y reportes de retenciones de ISLR.",
    beginnerIntro: {
      whatIsIt: "Es el departamento tributario digital de la empresa. Aquí se generan los libros y reportes que exige el SENIAT (el ente tributario de Venezuela).",
      whyItMatters: "El incumplimiento tributario en Venezuela acarrea multas millonarias en Unidades Tributarias o incluso el cierre temporal de las instalaciones por parte del SENIAT.",
      whenToUse: "El contador y el administrador lo usan al inicio de cada mes (primeros 15 días) para declarar el IVA y el ISLR.",
      whatIfSkipped: "La empresa recibiría sanciones severas y multas fiscales por atraso en declaraciones."
    },
    glossary: [
      { term: "Libro de Ventas", definition: "Registro de todas las facturas fiscales y notas de crédito emitidas a clientes durante el mes, con sus bases imponibles e IVA." },
      { term: "Libro de Compras", definition: "Registro de todas las facturas de proveedores con sus números de control y retenciones aplicadas." },
      { term: "Comprobante Anual ARC", definition: "Certificado oficial que se le entrega a cada proveedor a fin de año resumiendo todo el ISLR que se le retuvo durante el ejercicio." },
      { term: "Archivo TXT para SENIAT", definition: "Archivo de texto digital con formato especial que se sube directamente a la página web del SENIAT para declarar las retenciones." }
    ],
    commonTasks: [
      {
        title: "Tarea 1: Generar e Imprimir el Libro de Ventas del Mes",
        objective: "Tener el Libro de Ventas oficial listo para la carpeta fiscal o auditoría del SENIAT.",
        steps: [
          "1. En el módulo 'Reportes Fiscales', selecciona la pestaña 'Libro de Ventas'.",
          "2. Elige el Mes y Año que deseas consultar (ej. Octubre 2026).",
          "3. Revisa la tabla con todas las facturas ordenadas por fecha y número de control.",
          "4. Haz clic en el botón 'Imprimir Libro de Ventas PDF'.",
          "5. Se generará un documento formal con encabezado legal, RIF de la empresa, columnas oficiales del SENIAT y resumen de débitos fiscales."
        ],
        proTip: "Guarda una copia digital en PDF y ten una copia impresa en la carpeta fiscal de la oficina."
      },
      {
        title: "Tarea 2: Emitir el Comprobante Anual ARC de ISLR para un Proveedor",
        objective: "Entregarle a un proveedor su certificado anual de retenciones de impuesto sobre la renta.",
        steps: [
          "1. Haz clic en el botón 'Comprobante Anual ARC' en la barra superior del módulo.",
          "2. Selecciona el Proveedor y el Año Fiscal (ej. 2026).",
          "3. El sistema compilará automáticamente todas las retenciones de ISLR aplicadas a ese proveedor mes por mes (Enero a Diciembre).",
          "4. Haz clic en 'Generar ARC Anual PDF'.",
          "5. Se descargará el formato oficial bajo el Artículo 24 del Decreto 1.808 con firmas autorizadas."
        ],
        proTip: "Los proveedores suelen pedir este documento en Enero y Febrero para su declaración anual de ISLR."
      }
    ],
    mistakesToAvoid: [
      {
        mistake: "Declarar el IVA fuera de la fecha límite fijada por el calendario de Contribuyentes Especiales",
        why: "El SENIAT aplica multas automáticas por declaraciones extemporáneas.",
        solution: "Revisa siempre el último dígito del RIF de la empresa y la fecha límite del calendario SENIAT."
      }
    ],
    components: [
      { name: "Pestaña Libro de Ventas", description: "Consolidación de operaciones gravadas, exentas, IVA y retenciones de clientes." },
      { name: "Pestaña Libro de Compras", description: "Consolidación de adquisiciones, números de control y comprobantes de retención emitidos." },
      { name: "Exportador TXT / XML", description: "Generador de archivos magnéticos listos para subir al portal fiscal." }
    ],
    modals: [
      { name: "Generador de Comprobante Anual ARC", buttonTrigger: "Botón 'Comprobante Anual ARC'", purpose: "Consolidación anual de retenciones de ISLR por proveedor." }
    ],
    buttons: [
      { name: "Imprimir Libro de Ventas PDF", color: "Azul", icon: "Printer", action: "Genera el libro oficial en formato apaisado legal." },
      { name: "Imprimir Libro de Compras PDF", color: "Verde", icon: "Printer", action: "Genera el libro de compras oficial para el SENIAT." },
      { name: "Comprobante Anual ARC", color: "Dorado", icon: "Award", action: "Abre el emisor del formato ARC bajo Decreto 1.808." },
      { name: "Descargar TXT SENIAT", color: "Gris", icon: "Download", action: "Exporta el archivo de retenciones para el portal del SENIAT." }
    ],
    bestPractices: [
      "Verificar que el Libro de Ventas y el Libro de Compras cuadren al centavo con los saldos de la contabilidad.",
      "Archivar físicamente los comprobantes de retención recibidos y emitidos por mes."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 14. AUDITORÍA, PLAN DE CUENTAS & CONTABILIDAD DIGITAL
  // ─────────────────────────────────────────────────────────
  {
    id: "auditoria",
    title: "Auditoría, Plan de Cuentas Oficial & Contabilidad Digital",
    icon: "Building2",
    category: "Contabilidad & Finanzas",
    badge: "Oficial Pro Motorven",
    roleRequired: "Master, Gerencia, Contabilidad, Administración",
    summary: "Ciclo Contable Completo bajo normas BA VEN-NIF 2: Plan de Cuentas Oficial Pro Motorven C.A. (156 cuentas, 6 grupos), Libro Diario con asientos automáticos de Partida Doble (Debe === Haber), Mayor General Analítico, Balance de Comprobación, Estados Financieros y Módulo de Nómina LOTTT con Recibos de Pago individuales.",
    beginnerIntro: {
      whatIsIt: "Es el cerebro contable de SIGNUM MOTORVEN. Aquí todas las ventas, compras, cobros, pagos de sueldos y gastos de la empresa se organizan en las cuentas contables oficiales.",
      whyItMatters: "Muestra la verdad financiera de la empresa: cuánto tenemos de Activo (bienes y dinero), cuánto de Pasivo (deudas) y cuánto hemos ganado de Utilidad real.",
      whenToUse: "El contador público y el equipo de finanzas lo usan para auditar operaciones, emitir balances y liquidar la nómina quincenal de los trabajadores.",
      whatIfSkipped: "No se podrían firmar balances para los bancos, no se sabría el estado financiero real de la empresa y no se cumplirían las leyes laborales ni mercantiles."
    },
    glossary: [
      { term: "Partida Doble (Debe y Haber)", definition: "Regla de oro de la contabilidad: todo lo que entra por un lado (Debe) debe salir por el otro (Haber). La suma del Debe siempre es exactamente igual a la suma del Haber." },
      { term: "Libro Diario", definition: "Registro de cada movimiento de la empresa organizado en asientos numerados cronológicamente." },
      { term: "Mayor General Analítico", definition: "Libro que muestra la historia de una sola cuenta contable (ej. ver todo lo que entró y salió de la cuenta de Banco Mercantil)." },
      { term: "Balance de Comprobación", definition: "Tabla que resume todas las 156 cuentas de la empresa para comprobar que no haya ningún descuadre contable." },
      { term: "Recibo de Pago LOTTT", definition: "Comprobante individual obligatorio por ley (Art. 106 LOTTT) que se le entrega a cada empleado detallando su salario, Cestaticket y deducciones (IVSS, FAOV, Paro Forzoso)." }
    ],
    commonTasks: [
      {
        title: "Tarea 1: Imprimir los Estados Financieros Oficiales (Balance General & Estado de Resultados)",
        objective: "Obtener los balances certificados bajo norma venezolana BA VEN-NIF 2.",
        steps: [
          "1. En el módulo 'Auditoría & Contable', haz clic en la pestaña 'Estados Financieros'.",
          "2. Observa el Estado de Resultados Integral (muestra las ventas, costos de lubricantes y gastos operativos, calculando la Utilidad del Ejercicio).",
          "3. Desplázate hacia abajo para ver el Balance General (comprueba que Activo = Pasivo + Patrimonio).",
          "4. Haz clic en el botón 'Imprimir Estados PDF'.",
          "5. Se generará un documento formal tamaño carta con membrete oficial y espacios para firmas de Contabilidad, Contador Público Colegiado y Gerencia General."
        ],
        proTip: "Este es el reporte que solicitan los bancos cuando la empresa tramita líneas de crédito o cuentas corporativas."
      },
      {
        title: "Tarea 2: Liquidar la Nómina y Emitir los Recibos de Pago LOTTT",
        objective: "Pagarle a los trabajadores y entregarles su recibo de sueldo legal.",
        steps: [
          "1. Dentro de 'Auditoría & Contable', haz clic en el botón 'Gastos & Nómina LOTTT'.",
          "2. En la lista de empleados, revisa el Sueldo Base en USD, el equivalente en Bs. a Tasa BCV y el Cestaticket de ley.",
          "3. El sistema calcula automáticamente las deducciones de ley venezolana: IVSS (Seguro Social 4%), FAOV (Vivienda 1%) y Paro Forzoso (0.5%).",
          "4. Para generar el recibo individual de un trabajador, haz clic en el botón 'Recibo' en su fila.",
          "5. Se descargará el Recibo Individual en PDF cumpliendo con el Artículo 106 de la LOTTT con espacio para la firma del empleado.",
          "6. Si deseas generar los recibos de todos los empleados de una sola vez, haz clic en 'Recibos LOTTT' en la tabla de nóminas."
        ],
        proTip: "Entrega siempre el recibo firmado en cada pago quincenal para mantener el expediente laboral al día."
      },
      {
        title: "Tarea 3: Consultar el Mayor General de una Cuenta",
        objective: "Auditar los movimientos detallados de una cuenta específica (ej. Cuentas por Cobrar Comerciales 1.01.03.001).",
        steps: [
          "1. Haz clic en la pestaña 'Mayor General'.",
          "2. En el menú desplegable, selecciona la cuenta que deseas auditar.",
          "3. Verás todos los asientos de débito y crédito con su saldo acumulado progresivo.",
          "4. Haz clic en 'Imprimir Mayor PDF' para exportar el reporte formal."
        ],
        proTip: "El saldo inicial más los débitos menos los créditos cuadra de forma analítica e instantánea."
      }
    ],
    mistakesToAvoid: [
      {
        mistake: "Hacer asientos contables manuales sin conocer la naturaleza de la cuenta",
        why: "Una cuenta de Activo suma por el Debe y resta por el Haber; una de Pasivo hace lo contrario.",
        solution: "El sistema genera automáticamente el 99% de los asientos cuando vendes, compras, cobras o pagas. No necesitas hacer asientos manuales a menos que seas contador."
      }
    ],
    components: [
      { name: "Pestaña Libro Diario", description: "Muestra los asientos automáticos de ventas, cobros, compras SENIAT, pagos a proveedores y caja chica." },
      { name: "Pestaña Mayor General Analítico", description: "Detalle cronológico por cuenta con saldo progresivo y naturaleza deudora/acreedora." },
      { name: "Pestaña Balance de Comprobación", description: "Sumas del Debe, Sumas del Haber, Saldos Deudores y Acreedores de las 156 cuentas." },
      { name: "Pestaña Estados Financieros BA VEN-NIF 2", description: "Estado de Resultados Integral y Balance General Cuadrado con Ecuación Patrimonial." }
    ],
    modals: [
      { name: "Panel de Gastos & Nómina LOTTT", buttonTrigger: "Botón 'Gastos & Nómina LOTTT'", purpose: "Directorio de empleados, cálculo de asignaciones/deducciones y emisión de recibos LOTTT." }
    ],
    buttons: [
      { name: "Imprimir Reporte Activo PDF", color: "Azul Marino", icon: "Printer", action: "Detecta la pestaña visible (Mayor, Balance o Estados) y genera su PDF oficial." },
      { name: "Gastos & Nómina LOTTT", color: "Verde Esmeralda", icon: "Users", action: "Abre el panel de nómina laboral y recibos de salario." },
      { name: "Regenerar Asientos", color: "Ámbar", icon: "RefreshCw", action: "Recalcula todos los asientos contables en tiempo real." }
    ],
    bestPractices: [
      "Validar que el Balance de Comprobación tenga Diferencia = $0.00 al cierre de cada mes.",
      "Guardar los recibos de pago LOTTT firmados por los empleados en sus carpetas físicas de recursos humanos."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 15. USUARIOS, OPERADORES & ROLES
  // ─────────────────────────────────────────────────────────
  {
    id: "usuarios",
    title: "Gestión de Usuarios & Jerarquía de 9 Roles",
    icon: "ShieldCheck",
    category: "Seguridad & Accesos",
    badge: "TI & Master",
    roleRequired: "Administrador Master, TI, Gerencia",
    summary: "Administración del personal que accede al sistema. Asignación de uno de los 9 roles oficiales, permisos personalizados por módulo, visualización segura de contraseñas, suspensión temporal de usuarios e historial de bitácora.",
    beginnerIntro: {
      whatIsIt: "Es la oficina de seguridad informática. Aquí se crean los usuarios para cada trabajador de la empresa y se decide qué partes del sistema puede ver.",
      whyItMatters: "Protege la información confidencial de la empresa. Por ejemplo, un cajero no debe poder modificar costos de compra, y un vendedor de calle no debe poder ver las cuentas bancarias.",
      whenToUse: "Cuando entra un empleado nuevo a trabajar o cuando alguien cambia de cargo o renuncia.",
      whatIfSkipped: "Cualquier persona podría ver o modificar información crítica de la empresa sin autorización."
    },
    glossary: [
      { term: "Rol de Usuario", definition: "Nivel de acceso predeterminado (ejemplo: CAJA, VENTAS, COBRANZA, ALMACÉN, ADMINISTRACIÓN, GERENCIA, MASTER)." },
      { term: "Módulos Autorizados", definition: "Las casillas específicas que ese usuario verá en su pantalla cuando inicie sesión." },
      { term: "Estado Activo / Inactivo", definition: "Interruptor que permite suspender el acceso de un empleado sin borrar su historial de operaciones pasadas." }
    ],
    commonTasks: [
      {
        title: "Tarea 1: Crear un Usuario para un Nuevo Empleado en 4 Pasos",
        objective: "Darle acceso seguro al sistema a un nuevo trabajador.",
        steps: [
          "1. En el módulo 'Usuarios', haz clic en el botón '+ Nuevo Operador'.",
          "2. Escribe su Nombre Completo, Cargo y Nombre de Usuario (ej. 'cajero1').",
          "3. Asígnale una Contraseña segura y elige su Rol (ej. 'CAJA'). El sistema marcará automáticamente los módulos correspondientes a ese rol.",
          "4. Presiona 'Guardar Usuario'. El nuevo empleado ya podrá iniciar sesión con su nombre y contraseña."
        ],
        proTip: "Usa contraseñas que combinen letras y números para mayor seguridad."
      },
      {
        title: "Tarea 2: Inactivar a un Empleado que ya no Trabaja en la Empresa",
        objective: "Bloquear su acceso de inmediato manteniendo intacto su historial de ventas o cobros.",
        steps: [
          "1. Busca al empleado en la lista de usuarios.",
          "2. Haz clic en el interruptor de estado (cambiar de 'Activo' a 'Inactivo').",
          "3. El sistema bloqueará su ingreso al sistema de inmediato sin borrar ninguna factura o movimiento que haya hecho en el pasado."
        ],
        proTip: "Nunca elimines un usuario que tenga historial de transacciones; simplemente inactívalo."
      }
    ],
    mistakesToAvoid: [
      {
        mistake: "Compartir la contraseña de Administrador con otros empleados",
        why: "Si alguien comete un error grave o borra un registro, no se sabrá quién fue en la bitácora de auditoría.",
        solution: "Cada persona debe tener su propio usuario y contraseña individual."
      }
    ],
    components: [
      { name: "Directorio de Operadores", description: "Tarjetas con foto, rol, departamento, estado activo/inactivo y botón de ver clave." },
      { name: "Matriz de 9 Roles Institucionales", description: "Configuración estándar de permisos por puesto de trabajo." }
    ],
    modals: [
      { name: "Crear / Editar Operador", buttonTrigger: "Botón '+ Nuevo Operador'", purpose: "Configuración completa del perfil, rol y módulos autorizados." }
    ],
    buttons: [
      { name: "+ Nuevo Operador", color: "Rojo SIGNUM", icon: "Plus", action: "Abre el formulario de alta de nuevo trabajador." },
      { name: "Ver Contraseña", color: "Gris", icon: "Sliders", action: "Permite al administrador consultar o cambiar credenciales." },
      { name: "Imprimir Nómina de Usuarios PDF", color: "Azul", icon: "Printer", action: "Descarga la lista de usuarios y roles autorizados." }
    ],
    bestPractices: [
      "Revisar la lista de usuarios cada trimestre para inactivar accesos de personas que ya no laboran en la empresa.",
      "Asignar siempre el rol mínimo necesario para las funciones de cada puesto."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 16. BARRA SUPERIOR & TASAS CAMBIARIAS
  // ─────────────────────────────────────────────────────────
  {
    id: "header_rates",
    title: "Barra Superior: Tasas Cambiarias, Tema & Estado",
    icon: "DollarSign",
    category: "Global / Cabecera",
    badge: "En Todo Momento",
    roleRequired: "Todos los Roles (Acceso Global)",
    summary: "Cabecera permanente en todas las pantallas con Tasa Oficial BCV, Tasa Keystone, Euro, USDT Binance, indicador de sincronización offline, conmutador de Tema Claro/Oscuro y acceso rápido al Centro de Ayuda.",
    beginnerIntro: {
      whatIsIt: "Es la franja horizontal que siempre está arriba de tu pantalla, sin importar en qué módulo te encuentres.",
      whyItMatters: "Te mantiene informado sobre el precio del dólar oficial, si el sistema está conectado a internet y te permite cambiar los colores de la pantalla si te cansa la vista.",
      whenToUse: "La miras constantemente durante todo el día de trabajo.",
      whatIfSkipped: "Podrías trabajar con una tasa de cambio vieja y cobrar menos bolívares de lo que corresponde."
    },
    glossary: [
      { term: "Tasa BCV", definition: "Precio oficial del Dólar publicado por el Banco Central de Venezuela." },
      { term: "Indicador Online/Offline", definition: "Punto verde: conectado al servidor / Punto amarillo o rojo: sin internet, pero puedes seguir trabajando porque el sistema guarda tus datos en memoria local." },
      { term: "Tema Claro / Oscuro", definition: "Botón de Sol/Luna para poner el fondo blanco de día o fondo oscuro de noche para descansar los ojos." }
    ],
    commonTasks: [
      {
        title: "Tarea 1: Sincronizar la Tasa BCV Oficial de la Mañana",
        objective: "Asegurarse de que el sistema tenga la tasa del día.",
        steps: [
          "1. En la barra superior, busca la cajita azul que dice 'BCV: Bs. XX.XX'.",
          "2. Haz clic sobre ella.",
          "3. Se abrirá una ventana para actualizar la tasa oficial desde internet.",
          "4. Presiona 'Sincronizar con BCV' o escribe la tasa manualmente si el portal del banco está lento.",
          "5. Presiona 'Guardar Tasa'. Todos los precios y facturas en Bolívares se actualizarán al instante."
        ],
        proTip: "Haz esto a las 8:00 AM todos los días laborables."
      }
    ],
    mistakesToAvoid: [
      {
        mistake: "Facturar en la mañana sin haber verificado la Tasa BCV",
        why: "Si la tasa subió y no la actualizaste, estarás cobrando bolívares de menos al cliente.",
        solution: "Convierte en rutina revisar la tasa antes de emitir la primera factura del día."
      }
    ],
    components: [
      { name: "Indicadores Cambiarios en Vivo", description: "Muestra BCV, Keystone, EUR y USDT con su valor actual." },
      { name: "Monitor de Conexión Offline-First", description: "Garantiza que el sistema nunca se detenga aunque se caiga el internet." }
    ],
    modals: [
      { name: "Sincronizador de Tasas de Cambio", buttonTrigger: "Clic en la cajita de Tasa BCV", purpose: "Actualización de tasas oficiales y comerciales." }
    ],
    buttons: [
      { name: "Tasa BCV", color: "Azul", icon: "DollarSign", action: "Abre la ventana de actualización de divisas." },
      { name: "Sol / Luna (Tema)", color: "Neutro", icon: "Sliders", action: "Cambia entre modo claro y oscuro." },
      { name: "Ayuda (?)", color: "Cyan", icon: "HelpCircle", action: "Abre este Centro de Ayuda interactivo." }
    ],
    bestPractices: [
      "Confirmar la tasa oficial cada mañana con el portal del Banco Central de Venezuela."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 17. CONFIGURACIÓN GENERAL DEL SISTEMA
  // ─────────────────────────────────────────────────────────
  {
    id: "configuracion",
    title: "Configuración General, Crédito & WhatsApp",
    icon: "Sliders",
    category: "Administración & Sistema",
    badge: "Parámetros",
    roleRequired: "Master, Gerencia, TI, Administración",
    summary: "Parámetros base de SIGNUM MOTORVEN: Datos fiscales de la empresa (RIF J-50478166-0, dirección fiscal, teléfonos), políticas de crédito, tasa de mora, formatos de impresión de tickets y plantillas de mensajes de WhatsApp.",
    beginnerIntro: {
      whatIsIt: "Es donde se configuran los datos fundamentales de la empresa y cómo se comporta el sistema.",
      whyItMatters: "Define qué nombre y RIF sale en los membretes de las facturas, qué teléfono aparece en los reportes y las reglas de crédito que se aplican a los clientes.",
      whenToUse: "Solo se entra cuando cambia algún dato legal de la empresa (teléfono, dirección) o se quiere modificar las políticas de crédito.",
      whatIfSkipped: "El sistema funciona con los valores por defecto ya configurados."
    },
    glossary: [
      { term: "Datos Fiscales", definition: "Razón Social, RIF, Dirección Fiscal registrada ante el SENIAT y teléfono oficial de contacto." },
      { term: "Política de Crédito", definition: "Reglas sobre cuántos días máximos de crédito se otorgan y qué porcentaje de recargo aplica por mora." }
    ],
    commonTasks: [
      {
        title: "Tarea 1: Actualizar el Teléfono o Dirección Fiscal en los Reportes",
        objective: "Hacer que las facturas y presupuestos salgan con los nuevos números de contacto.",
        steps: [
          "1. Entra a 'Configuración'.",
          "2. En la pestaña 'Empresa', modifica el campo 'Teléfono' o 'Dirección Fiscal'.",
          "3. Presiona el botón verde 'Guardar Cambios'. A partir de ese momento, todos los reportes en PDF saldrán con los nuevos datos."
        ],
        proTip: "Revisa siempre que el RIF esté escrito correctamente con su guión (ej. J-50478166-0)."
      }
    ],
    mistakesToAvoid: [
      {
        mistake: "Cambiar el RIF de la empresa por error",
        why: "Descuadraría los libros de ventas y compras fiscales ante el SENIAT.",
        solution: "Modifica datos fiscales únicamente con la autorización expresa de la Dirección General."
      }
    ],
    components: [
      { name: "Pestaña Datos de Empresa", description: "Nombre, RIF, Logotipo, Dirección, Correo y Teléfonos oficiales." },
      { name: "Pestaña Políticas Comerciales", description: "Límites de crédito por defecto y días de vencimiento." }
    ],
    modals: [
      { name: "Configuración del Sistema (AppConfigModal)", buttonTrigger: "Menú superior ➔ Configuración", purpose: "Panel general de parámetros operativos." }
    ],
    buttons: [
      { name: "Guardar Cambios", color: "Verde Esmeralda", icon: "CheckCircle2", action: "Aplica los nuevos parámetros en todo el sistema." }
    ],
    bestPractices: [
      "Respaldar la base de datos antes de hacer cambios profundos de configuración."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 18. EJERCICIO & PERÍODO FISCAL ANUAL
  // ─────────────────────────────────────────────────────────
  {
    id: "config_fiscal",
    title: "Ejercicio & Período Fiscal Anual",
    icon: "Calendar",
    category: "Fiscal & Cierre",
    badge: "Anual",
    roleRequired: "Master, TI, Contabilidad, Gerencia",
    summary: "Control del año fiscal de la empresa (1 de enero al 31 de diciembre), bloqueo de períodos cerrados para evitar modificaciones accidentales de meses anteriores y consolidación del ejercicio contable.",
    beginnerIntro: {
      whatIsIt: "Es el candado que protege los años fiscales que ya terminaron.",
      whyItMatters: "Una vez que un mes o un año ya fue declarado al SENIAT y auditado por los contadores, nadie puede modificar una factura o un gasto de esa fecha porque alteraría la contabilidad legal.",
      whenToUse: "Una vez al año, en el mes de Enero, para cerrar el año viejo y abrir el nuevo.",
      whatIfSkipped: "Alguien podría por error editar una factura de hace seis meses y causar un grave descuadre con el SENIAT."
    },
    glossary: [
      { term: "Ejercicio Fiscal", definition: "El año contable completo (del 01 de Enero al 31 de Diciembre)." },
      { term: "Cierre Contable", definition: "Proceso donde se calcula la ganancia neta del año y se trasladan los saldos para arrancar en cero el año siguiente." }
    ],
    commonTasks: [
      {
        title: "Tarea 1: Verificar que el Período Activo sea el Año en Curso",
        objective: "Confirmar que las operaciones se están registrando en el año correcto.",
        steps: [
          "1. Observa el badge 'Ejercicio Fiscal' en la cabecera superior.",
          "2. Debe indicar el año actual (ejemplo: 'Ejercicio 2026').",
          "3. Si está correcto, no necesitas hacer nada."
        ],
        proTip: "Los períodos cerrados aparecen con un candado para indicar que son de solo lectura."
      }
    ],
    mistakesToAvoid: [
      {
        mistake: "Intentar registrar una factura en un mes ya cerrado",
        why: "El sistema lo bloqueará para proteger la declaración ya presentada al SENIAT.",
        solution: "Si necesitas registrar un comprobante rezagado, regístralo con fecha del mes actual."
      }
    ],
    components: [
      { name: "Visualizador del Ejercicio Fiscal", description: "Fechas de inicio, fin y estado (Abierto / Cerrado)." }
    ],
    modals: [
      { name: "Cierre de Ejercicio Fiscal", buttonTrigger: "Botón 'Consolidar Ejercicio'", purpose: "Cierre anual y traspaso de utilidades a patrimonio." }
    ],
    buttons: [
      { name: "Guardar Parámetros", color: "Verde", icon: "CheckCircle2", action: "Actualiza las fechas oficiales del ejercicio." }
    ],
    bestPractices: [
      "No cerrar el ejercicio fiscal hasta que el contador público haya auditado todos los libros de diciembre."
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
    summary: "Supervisión técnica del sistema: Inspección directa de las 51 tablas de datos en PostgreSQL, generación de copias de seguridad completas (npm run backup) y políticas de despliegue seguro a producción.",
    beginnerIntro: {
      whatIsIt: "Es el cuarto de máquinas donde los ingenieros y el personal de sistemas cuidan los datos de la empresa.",
      whyItMatters: "Garantiza que la información nunca se pierda. Si una computadora se daña o se quema, gracias a los respaldos (backups) la empresa puede recuperar toda su información en minutos.",
      whenToUse: "El personal técnico lo usa todos los días para hacer copias de seguridad de la base de datos.",
      whatIfSkipped: "Si no se hacen respaldos y la computadora falla, se perderían años de facturación, clientes e inventario."
    },
    glossary: [
      { term: "Backup / Respaldo", definition: "Copia idéntica de toda la base de datos guardada en un archivo con fecha y hora exacta." },
      { term: "PostgreSQL / Supabase", definition: "El motor de base de datos profesional y ultra veloz donde residen todos los registros del sistema." },
      { term: "Despliegue (Deploy)", definition: "Publicar las nuevas mejoras y pantallas para que todos los usuarios de la empresa puedan verlas." }
    ],
    commonTasks: [
      {
        title: "Tarea 1: Generar un Respaldo Completo de Seguridad en la Laptop",
        objective: "Guardar una copia de seguridad de toda la base de datos en el disco duro.",
        steps: [
          "1. En la consola de comandos de la laptop, escribe: npm run backup",
          "2. Presiona Enter.",
          "3. El sistema descargará las 51 tablas y creará un archivo con fecha y hora en la carpeta 'supabase/backups/' (ejemplo: local_database_backup_2026-11-15.json).",
          "4. Verás el mensaje verde 'Respaldo generado con éxito'."
        ],
        proTip: "Guarda periódicamente una copia de esa carpeta de backups en un pendrive externo para mayor seguridad."
      }
    ],
    mistakesToAvoid: [
      {
        mistake: "Hacer cambios técnicos en el servidor sin haber sacado un respaldo primero",
        why: "Si algo sale mal, no tendrías cómo restaurar la información al estado previo.",
        solution: "Saca siempre un backup con 'npm run backup' antes de cualquier actualización."
      }
    ],
    components: [
      { name: "Explorador de Tablas", description: "Permite ver registros crudos de clientes, productos, facturas, cobros y compras." },
      { name: "Consola de Respaldo", description: "Verificación de la integridad de los datos almacenados." }
    ],
    modals: [
      { name: "Inspector de Tablas (SupabaseTablesView)", buttonTrigger: "Botón 'Explorar Tablas'", purpose: "Auditoría técnica de registros en tiempo real." }
    ],
    buttons: [
      { name: "Explorar Tablas", color: "Cyan", icon: "Database", action: "Abre el visor técnico de base de datos." },
      { name: "Descargar Tabla JSON", color: "Verde", icon: "Download", action: "Exporta una tabla específica para revisión." }
    ],
    bestPractices: [
      "Hacer un respaldo completo al final de cada semana y almacenarlo fuera de la oficina.",
      "Trabajar en el entorno local (localhost:5180) hasta verificar todas las pruebas antes de enviar a producción."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 20. PREDICTIBILIDAD & ALERTAS (FORESIGHT)
  // ─────────────────────────────────────────────────────────
  {
    id: "predictibilidad",
    title: "Predictibilidad & Alertas (Foresight)",
    icon: "Sparkles",
    category: "Dirección & Síntesis Financiera",
    badge: "PRO / IA",
    roleRequired: "Gerencia, Administración, Compras & Finanzas",
    summary: "Motor de inteligencia operativa que anticipa quiebres de inventario, detecta compresión de márgenes, simula escenarios de precios (What-If) y proyecta el flujo de caja a 30/60/90 días.",
    beginnerIntro: {
      whatIsIt: "Es el 'radar de futuro' del sistema: analiza las ventas recientes, el inventario actual, las cuentas por cobrar y por pagar para avisarte qué va a pasar antes de que ocurra un problema.",
      whyItMatters: "Evita que te quedes sin los lubricantes más vendidos, que vendas por debajo de tu margen seguro por cambios de costo o que te falte liquidez para pagar a proveedores.",
      whenToUse: "Úsalo al inicio de cada semana o antes de aprobar órdenes de compra y ajustes de precios.",
      whatIfSkipped: "Solo reaccionarías cuando el producto ya esté en 0 o cuando la caja no alcance para cubrir compromisos."
    },
    glossary: [
      { term: "Radar de Riesgo Temprano", definition: "Tablero principal que agrupa alertas críticas y preventivas de stock, márgenes y tesorería en un solo lugar." },
      { term: "Quiebre de Stock", definition: "Momento proyectado en el que un SKU llegará a 0 unidades según su velocidad diaria de venta (run-rate)." },
      { term: "Simulador What-If", definition: "Herramienta interactiva para probar cuánto cambiaría tu precio y utilidad si sube el costo del proveedor o si ajustas el margen objetivo." }
    ],
    commonTasks: [
      {
        title: "Tarea 1: Revisar Alertas de Quiebre de Stock y Planificar Reposición",
        objective: "Detectar qué lubricantes se agotarán en los próximos días y actuar a tiempo.",
        steps: [
          "1. Entra a 'Predictibilidad & Alertas' en el menú lateral (o desde el Menú en Modo Celular).",
          "2. Elige el horizonte de proyección (ej. 30 días) y filtra por Almacén (Todos, 01 o 02).",
          "3. En la pestaña 'Radar de Riesgo' o 'Inventario', revisa los productos marcados en Rojo (crítico) o Amarillo (atención).",
          "4. Haz clic en 'Exportar Reporte Predictivo PDF' si deseas compartir el plan de reposición con Compras."
        ],
        proTip: "Revisa primero los SKUs de alta rotación en Almacén 01 y 02 antes de cerrar pedidos grandes de la semana."
      },
      {
        title: "Tarea 2: Simular Ajustes de Costo y Margen (What-If)",
        objective: "Calcular el nuevo precio sugerido ante un aumento de proveedor sin perder rentabilidad.",
        steps: [
          "1. Ve a la pestaña 'Márgenes' dentro de Predictibilidad & Alertas.",
          "2. Define el 'Margen Mínimo Seguro (%)' (por defecto 18%).",
          "3. En el Simulador What-If, selecciona el SKU, indica el % de variación de costo y el margen objetivo (%).",
          "4. Observa al instante el precio sugerido en USD/Bs. y el impacto en utilidad."
        ],
        proTip: "Úsalo antes de actualizar listas de precios en Inventario."
      }
    ],
    mistakesToAvoid: [
      {
        mistake: "Ignorar alertas de compresión de margen cuando sube el costo de reposición",
        why: "Puedes seguir facturando un producto creyendo que ganas dinero, pero al reponerlo el efectivo no alcanza.",
        solution: "Revisa semanalmente la pestaña 'Márgenes' y ajusta precios de venta cuando caigan debajo del margen seguro."
      }
    ],
    components: [
      { name: "Pestaña Radar de Riesgo", description: "Resumen ejecutivo de alertas tempranas por severidad (críticas y preventivas)." },
      { name: "Pestaña Inventario (Quiebres)", description: "Días de cobertura restantes por SKU y consumo promedio diario." },
      { name: "Pestaña Márgenes & Simulador What-If", description: "Detección de productos con margen comprimido y simulador de precios." },
      { name: "Pestaña Flujo de Caja", description: "Gráfico proyectado de ingresos (CxC + run-rate de ventas) vs egresos (CxP, gastos y nómina)." }
    ],
    modals: [
      { name: "Reporte Predictivo PDF", buttonTrigger: "Botón 'Descargar PDF'", purpose: "Genera un informe ejecutivo imprimible con las proyecciones activas." }
    ],
    buttons: [
      { name: "Radar / Inventario / Márgenes / Flujo de Caja", color: "Azul", icon: "Sparkles", action: "Cambia entre las 4 vistas analíticas del motor Foresight." },
      { name: "Descargar PDF", color: "Verde", icon: "Download", action: "Exporta el reporte predictivo completo en PDF." }
    ],
    bestPractices: [
      "Revisar el Radar de Riesgo todos los lunes por la mañana.",
      "Combinar la proyección de flujo de caja con Cuentas por Pagar antes de comprometer pagos grandes."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 21. CUENTAS DE PASIVO & SOCIOS (2.02.01.001)
  // ─────────────────────────────────────────────────────────
  {
    id: "pasivos",
    title: "Cuentas de Pasivo & Socios",
    icon: "Scale",
    category: "Cuentas Reales • Balance General",
    badge: "2.02-06",
    roleRequired: "Gerencia, Contabilidad, Administración & Master",
    summary: "Control detallado de obligaciones con socios y otros pasivos (grupo 2.02.01.001 y cuentas de pasivo del Plan de Cuentas): saldos, abonos/cargos vinculados a Caja/Banco y libro auxiliar.",
    beginnerIntro: {
      whatIsIt: "Es el módulo donde se llevan las cuentas que la empresa debe a sus socios (préstamos o aportes por pagar) y otros pasivos distintos a proveedores comerciales.",
      whyItMatters: "Mantiene la transparencia total entre el dinero de los socios y el dinero operativo de la empresa, evitando descuadres en Caja y Bancos.",
      whenToUse: "Cuando un socio aporta capital temporal, presta dinero a la empresa o recibe un reintegro desde Caja o Banco.",
      whatIfSkipped: "Los ingresos o salidas de dinero de socios quedarían sin respaldo en el Balance General."
    },
    glossary: [
      { term: "Cuenta por Pagar a Socio", definition: "Registro individual (ej. SOC-01) del saldo que la empresa adeuda o tiene cruzado con un socio." },
      { term: "Abono / Cargo de Pasivo", definition: "Movimiento que aumenta (abono/préstamo recibido) o disminuye (cargo/pago o reintegro) la deuda con el socio." }
    ],
    commonTasks: [
      {
        title: "Tarea 1: Registrar una Cuenta de Socio o Pasivo y su Movimiento",
        objective: "Crear la ficha del socio/pasivo y registrar un aporte o reintegro vinculado a tesorería.",
        steps: [
          "1. Entra a 'Cuentas de Pasivo' en el menú lateral.",
          "2. Si es un socio nuevo, presiona '+ Nueva Cuenta' y completa nombre, código (SOC-XX) y moneda.",
          "3. Para registrar un aporte o pago, haz clic en el botón de movimiento sobre la cuenta correspondiente.",
          "4. Selecciona la Caja o Banco involucrado, indica el monto en USD/Bs. y guarda."
        ],
        proTip: "Verifica siempre la Caja o Banco de origen antes de registrar un pago o reintegro para mantener el saldo real cuadrado."
      }
    ],
    mistakesToAvoid: [
      {
        mistake: "Registrar un reintegro a socio sin asociar la cuenta de Caja o Banco real",
        why: "Se rebaja la deuda del socio pero el saldo de la caja/banco quedaría inflado.",
        solution: "Selecciona siempre la cuenta de tesorería exacta desde la cual salió o entró el dinero."
      }
    ],
    components: [
      { name: "Tarjetas de Resumen de Pasivos", description: "Totales consolidados de pasivos con socios, otros pasivos y CxP." },
      { name: "Directorio de Cuentas de Socios y Pasivos", description: "Listado con saldos en USD/Bs. y acciones rápidas de edición y movimiento." },
      { name: "Libro Auxiliar de Movimientos", description: "Historial cronológico filtrable con exportación e impresión en PDF." }
    ],
    modals: [
      { name: "Modal Nueva / Editar Cuenta de Pasivo", buttonTrigger: "Botón '+ Nueva Cuenta'", purpose: "Crea o actualiza cuentas de socios u otros pasivos." },
      { name: "Modal Registrar Movimiento", buttonTrigger: "Botón de Abono / Cargo", purpose: "Registra ingresos o egresos vinculados a Caja/Banco." }
    ],
    buttons: [
      { name: "+ Nueva Cuenta", color: "Azul", icon: "Plus", action: "Abre el formulario para crear una cuenta de socio u otro pasivo." },
      { name: "Imprimir / PDF", color: "Verde", icon: "Printer", action: "Genera el reporte oficial de pasivos y movimientos en PDF." }
    ],
    bestPractices: [
      "Conciliar mensualmente el saldo de cada socio con su estado de cuenta.",
      "Documentar en la descripción el motivo y comprobante bancario de cada movimiento."
    ]
  },

  // ─────────────────────────────────────────────────────────
  // 22. POS MOSTRADOR MÓVIL & MODO CELULAR (PWA)
  // ─────────────────────────────────────────────────────────
  {
    id: "pos_movil",
    title: "POS Mostrador Móvil & Modo Celular (PWA)",
    icon: "Smartphone",
    category: "Operación Móvil & Terreno",
    badge: "PWA MÓVIL",
    roleRequired: "Todos los roles (según permisos móviles asignados)",
    summary: "Interfaz móvil optimizada para teléfonos y tablets ('Modo Celular'): permite crear pedidos en Preventa ATP 72h, consultar inventario consolidado, cobrar cartera CxC y facturar directamente en POS Mostrador Móvil.",
    beginnerIntro: {
      whatIsIt: "Es la versión portátil y táctil de SIGNUM MOTORVEN diseñada para trabajar desde tu celular en el mostrador, el almacén o la calle.",
      whyItMatters: "Permite atender clientes al instante sin depender de una computadora de escritorio, viendo stock real, precios y crédito disponible en la palma de tu mano.",
      whenToUse: "Cuando uses el sistema desde un teléfono/tablet o cuando actives el botón flotante 'Modo Celular 📱' desde la PC.",
      whatIfSkipped: "Tendrías que caminar hasta la computadora de caja para consultar precios, revisar si un cliente tiene deuda o armar un pedido."
    },
    glossary: [
      { term: "Modo Celular / PC", definition: "Botón superior ('PC') o flotante inferior ('Modo Celular 📱') que te permite alternar entre la vista móvil táctil y la vista completa de escritorio." },
      { term: "Facturar / Pasar a Caja", definition: "Acción directa dentro de un pedido móvil que carga automáticamente el pedido en el POS Mostrador (Facturación POS Caja) para emitir la factura o nota de entrega." },
      { term: "Dock Inferior Móvil", definition: "Barra fija en la parte inferior del teléfono con acceso rápido a Inicio, Resumen, Preventa, Cobranzas, Almacén y Menú." }
    ],
    commonTasks: [
      {
        title: "Tarea 1: Activar el Modo Celular y Crear un Pedido de Mostrador o Preventa",
        objective: "Armar un pedido rápido desde el teléfono validando cliente, almacén y stock disponible.",
        steps: [
          "1. Si estás en PC, toca el botón 'Modo Celular 📱' abajo a la derecha (en teléfonos abre automático).",
          "2. Toca 'Preventa' en la barra inferior (o '+ Nuevo Pedido' en Inicio) y selecciona la pestaña 'Crear Pedido'.",
          "3. Toca 'Elegir Cliente' para seleccionar al cliente y verificar su límite, saldo CxC y crédito disponible.",
          "4. Elige Almacén 01 (Factura Fiscal SENIAT) o Almacén 02 (Nota de Entrega) y la condición de pago (Contado o Crédito).",
          "5. Busca los lubricantes, agrégalos al carrito y presiona guardar/enviar el pedido."
        ],
        proTip: "El sistema muestra stock ATP (descontando reservas activas de otros pedidos por 72 horas) para evitar vender mercancía ya comprometida."
      },
      {
        title: "Tarea 2: Facturar Directamente desde el POS Mostrador Móvil",
        objective: "Convertir un pedido móvil en Factura o Nota de Entrega, o abrir el POS Caja desde el celular.",
        steps: [
          "1. Entra a 'Preventa' ➔ 'Mis Pedidos' y abre el detalle del pedido activo.",
          "2. Presiona el botón 'Facturar / Pasar a Caja' (disponible para usuarios con permiso de facturación).",
          "3. También puedes abrir 'Menú' ➔ 'Facturación POS Caja' para entrar directo al POS Mostrador desde el móvil.",
          "4. En el POS, verifica modalidad ('POS Mostrador' para Factura Fiscal Alm. 01 o 'Venta por Oficina' para Nota de Entrega Alm. 02), registra el pago y emite el documento."
        ],
        proTip: "Si necesitas una vista más amplia para pagos mixtos complejos, toca el botón 'PC' en la barra superior sin perder tu sesión."
      }
    ],
    mistakesToAvoid: [
      {
        mistake: "Intentar facturar un pedido de un cliente que aún está 'En revisión administrativa'",
        why: "Por política de control interno, todo cliente nuevo debe estar APROBADO antes de poder procesarle pedidos o facturas.",
        solution: "Solicita la aprobación del cliente desde Gerencia/Administración en la vista de escritorio."
      }
    ],
    components: [
      { name: "Inicio Móvil (Home)", description: "Panel de bienvenida con Tasa BCV, KPIs rápidos y accesos directos a Resumen, Preventa, CxC e Inventario." },
      { name: "Preventa & Mis Pedidos", description: "Creación de pedidos ATP 72h, filtros de estado (Activos, Por Vencer, Vencidos, Retenidos, Facturados) y detalle con botón 'Facturar / Pasar a Caja'." },
      { name: "Facturación POS Caja (Móvil)", description: "Acceso directo al motor SalesPOSView desde el celular para emitir Facturas Fiscales o Notas de Entrega." },
      { name: "Cobranzas (CxC) & Almacén Móvil", description: "Consulta de cartera morosa, estados de cuenta y stock consolidado Alm 01 + Alm 02 en PDF." }
    ],
    modals: [
      { name: "Detalle de Pedido Móvil", buttonTrigger: "Tocar cualquier pedido en 'Mis Pedidos'", purpose: "Muestra productos, montos USD/Bs., aprobación, anulación, PDF y paso directo a Caja." }
    ],
    buttons: [
      { name: "Facturar / Pasar a Caja", color: "Azul", icon: "ShoppingCart", action: "Carga el pedido seleccionado directamente en Facturación POS Caja." },
      { name: "PC (Barra Superior)", color: "Gris", icon: "Monitor", action: "Cambia instantáneamente a la versión completa de escritorio." },
      { name: "Modo Celular 📱", color: "Azul", icon: "Smartphone", action: "Activa la interfaz móvil PWA desde cualquier pantalla de escritorio." }
    ],
    bestPractices: [
      "Instala la app en la pantalla de inicio de tu teléfono ('Agregar a pantalla de inicio') para usarla como PWA a pantalla completa.",
      "Verifica la Tasa BCV en la barra superior móvil antes de cotizar en Bolívares."
    ]
  }
];

// ==============================================================================
// 📋 GUÍAS Y FLUJOS OPERATIVOS PASO A PASO (PROCEDIMIENTOS SOP)
// ==============================================================================
export const WORKFLOWS_STEP_BY_STEP = [
  {
    title: "1. Flujo de Preventa Móvil con Reserva ATP (72h) y Segregación de Almacén",
    steps: [
      "Paso 1: Abre el módulo 'Preventa' desde tu teléfono o tablet.",
      "Paso 2: Selecciona el Cliente en la barra superior o regístralo si es nuevo con su RIF.",
      "Paso 3: Elige si el cliente comprará con 'Almacén 01 (Fiscal)' o 'Almacén 02 (Despacho)'.",
      "Paso 4: Busca los lubricantes en el catálogo y presiona '+' para agregar unidades al carrito.",
      "Paso 5: Verifica que el stock disponible ATP sea mayor a cero (el sistema bloquea si hay stock 0).",
      "Paso 6: Abre el carrito, revisa el total en $ y Bs., y presiona 'Enviar Pedido al Pipeline'. El sistema apartará las unidades durante 72 horas para ese cliente."
    ]
  },
  {
    title: "2. Flujo Comercial de 3 Pasos: Preventa ➔ Facturación en Caja (POS) ➔ Guía de Despacho",
    steps: [
      "Paso 1: El vendedor emite el pedido en la calle con el módulo Preventa Móvil.",
      "Paso 2: En la oficina, el supervisor entra a 'Pedidos' (Pipeline), revisa el crédito del cliente y presiona 'Aprobar Pedido'.",
      "Paso 3: El pedido pasa automáticamente a 'Ventas POS' donde el cajero lo cobra (de contado o crédito) y emite la Factura Fiscal o Nota de Entrega.",
      "Paso 4: Se imprime la Guía de Despacho en PDF para que el chofer y el bodeguero preparen y entreguen la carga con sus firmas."
    ]
  },
  {
    title: "3. Flujo Completo de Facturación en Mostrador (POS): Contado vs Crédito, Fiscal vs Nota de Entrega",
    steps: [
      "Paso 1: Entra a 'Ventas POS' y elige el Tipo de Documento: 'Factura Fiscal' (Almacén 01) o 'Nota de Entrega' (Almacén 02).",
      "Paso 2: Busca al cliente por su RIF o Razón Social.",
      "Paso 3: Selecciona los lubricantes. El sistema validará existencias y aplicará los precios correspondientes a ese almacén.",
      "Paso 4: Elige la Condición: si es 'Contado', registra el pago (Efectivo $, Transferencia Bs., Punto de Venta o Mixto); si es 'Crédito', elige el plazo de vencimiento.",
      "Paso 5: Si el cliente paga en dólares en efectivo sobre Factura Fiscal, el sistema sumará el 3% de IGTF por ley.",
      "Paso 6: Presiona 'Procesar Factura / Cobrar'. El sistema rebajará el inventario del almacén correspondiente, actualizará la Caja/Banco (si fue contado) o Cuentas por Cobrar (si fue crédito), y generará el asiento contable."
    ]
  },
  {
    title: "4. Flujo Completo de Registro de Cobro en CxC (Parte A) ➔ Banco/Caja ➔ Contabilidad",
    steps: [
      "Paso 1: Entra a 'Cuentas por Cobrar' (CxC) y localiza al cliente que realizó el pago.",
      "Paso 2: Ubica la factura pendiente y haz clic en el botón verde 'Cobrar' o 'Parte A'.",
      "Paso 3: Escribe el Monto cobrado, elige la Cuenta Bancaria o Caja donde cayó el dinero e ingresa el número de referencia bancaria.",
      "Paso 4: Presiona 'Registrar Cobro'.",
      "Paso 5: El sistema ejecutará automáticamente 5 acciones: (1) Rebaja el saldo de la factura, (2) Emite el recibo oficial COB-XXXXXX, (3) Aumenta el saldo del banco o caja, (4) Libera el cupo de crédito del cliente, y (5) Crea el asiento contable en el Libro Diario."
    ]
  },
  {
    title: "5. Flujo de Alta y Aprobación de Clientes Nuevos (Validación RIF Módulo 11)",
    steps: [
      "Paso 1: Haz clic en '+ Nuevo Cliente' en Preventa, Ventas POS o Directorio de Clientes.",
      "Paso 2: Ingresa el prefijo (J, V, E, G, P) y los números del RIF. El sistema validará automáticamente mediante el algoritmo Módulo 11 del SENIAT que no haya errores de tipeo.",
      "Paso 3: Completa la Razón Social, teléfono de WhatsApp, correo electrónico y dirección física exacta.",
      "Paso 4: El cliente se guarda inicialmente en estado 'PENDIENTE' para control de seguridad.",
      "Paso 5: La administración o gerencia revisa la solicitud en el modal de 'Aprobaciones de Clientes', asigna su límite de crédito y presiona 'Aprobar'."
    ]
  },
  {
    title: "6. Flujo de Solicitud de Línea de Crédito & Pagaré Mercantil de Garantía Ejecutiva (Art. 486 Cód. Comercio)",
    steps: [
      "Paso 1: En 'Cuentas por Cobrar' o 'Directorio de Clientes', haz clic en el botón 'Solicitud & Pagaré'.",
      "Paso 2: Selecciona el Cliente a quien se le otorgará el crédito comercial.",
      "Paso 3: Define el Monto de la Línea de Crédito en USD y el plazo máximo en días.",
      "Paso 4: Escribe el nombre del Representante Legal, su Cédula, RIF, y los datos del Fiador Solidario.",
      "Paso 5: Haz clic en 'Generar Solicitud & Pagaré PDF'.",
      "Paso 6: Se descargará el documento legal de 2 páginas con cláusulas de mora y título ejecutivo mercantil.",
      "Paso 7: Imprímelo y haz que el cliente lo firme y estampe su huella antes de despacharle mercancía a crédito."
    ]
  },
  {
    title: "7. Flujo Completo Compra Fiscal SENIAT ➔ Retenciones ➔ Cuenta por Pagar (CxP)",
    steps: [
      "Paso 1: Entra a 'Compras & Proveedores' y haz clic en la pestaña 'Registro Compra SENIAT'.",
      "Paso 2: Selecciona el Proveedor y escribe los datos de la factura física: Nro. de Factura, Nro. de Control SENIAT y Fecha.",
      "Paso 3: Ingresa el Monto Base imponible y el IVA aplicable (16%).",
      "Paso 4: El sistema calcula automáticamente la Retención de IVA (75% o 100%), la Retención de ISLR y el Neto a Pagar.",
      "Paso 5: Elige a qué Almacén (01 o 02) entra la mercancía y presiona 'Guardar Compra Fiscal'.",
      "Paso 6: El sistema sumará las unidades al inventario físico, creará la deuda en Cuentas por Pagar por el Neto exacto, y generará el Comprobante de Retención de IVA con su correlativo de 14 dígitos listo para imprimir."
    ]
  },
  {
    title: "8. Flujo de Pago a Proveedores y Notas de Crédito en Cuentas por Pagar (CxP Parte A)",
    steps: [
      "Paso 1: Entra a 'Cuentas por Pagar' (CxP) y busca la factura del proveedor que se va a pagar.",
      "Paso 2: Haz clic en el botón 'Pagar' (Parte A) en la fila de la factura.",
      "Paso 3: Selecciona la Cuenta Bancaria de la empresa de donde se debitarán los fondos, escribe la referencia de transferencia y el monto.",
      "Paso 4: Presiona 'Registrar Pago al Proveedor'.",
      "Paso 5: El sistema descontará el saldo del banco seleccionado en Tesorería, rebajará el pasivo del proveedor y generará el asiento contable PAGO_PROVEEDOR en el Libro Diario."
    ]
  },
  {
    title: "9. Flujo de Emisión de Comprobantes de Retención y Comprobante Anual ARC de ISLR (Art. 24 Decreto 1.808)",
    steps: [
      "Paso 1: Para comprobantes mensuales de IVA: al registrar la compra en el Paso 7, haz clic en 'Imprimir Comprobante de Retención' (14 dígitos) y envíaselo al proveedor.",
      "Paso 2: Para el Comprobante Anual ARC de ISLR: entra a 'Reportes Fiscales' o 'Retenciones ISLR' y haz clic en el botón 'Comprobante Anual ARC'.",
      "Paso 3: Selecciona el Proveedor y el Ejercicio Fiscal Anual (ej. 2026).",
      "Paso 4: El sistema agrupa todas las retenciones de ISLR aplicadas en los 12 meses del año con sus bases imponibles y porcentajes.",
      "Paso 5: Presiona 'Generar ARC Anual PDF'. Se descargará el formato certificado oficial bajo el Decreto 1.808 para entregárselo al proveedor."
    ]
  },
  {
    title: "10. Flujo del Ciclo Contable Completo: Diario ➔ Mayor ➔ Balance ➔ Estados Financieros BA VEN-NIF 2",
    steps: [
      "Paso 1: El sistema genera automáticamente los asientos en el 'Libro Diario' cada vez que hay una venta, cobro, compra o pago (Debe === Haber al centavo).",
      "Paso 2: Entra a 'Auditoría & Contable' ➔ Pestaña 'Mayor General' para consultar el saldo acumulado analítico de cualquier cuenta.",
      "Paso 3: Pasa a la pestaña 'Balance de Comprobación' y verifica que las columnas de Sumas y Saldos estén cuadradas (Diferencia = $0.00).",
      "Paso 4: Pasa a la pestaña 'Estados Financieros' para revisar el Estado de Resultados Integral (Utilidad del Ejercicio) y el Balance General.",
      "Paso 5: Presiona 'Imprimir Estados PDF' para generar los reportes formales certificados con firmas de Contabilidad y Gerencia."
    ]
  },
  {
    title: "11. Flujo de Liquidación de Nómina LOTTT & Emisión de Recibos Individuales de Pago (Art. 106 LOTTT)",
    steps: [
      "Paso 1: En 'Auditoría & Contable', presiona el botón 'Gastos & Nómina LOTTT'.",
      "Paso 2: Revisa la lista de trabajadores con su Sueldo Base en USD, equivalente en Bs. a Tasa BCV y Cestaticket legal.",
      "Paso 3: El sistema calcula las deducciones obligatorias: IVSS (4%), FAOV (1%) y Paro Forzoso (0.5%).",
      "Paso 4: En la fila del empleado, presiona el botón 'Recibo' para emitir su recibo individual en PDF con membrete y base legal del Art. 106 de la LOTTT.",
      "Paso 5: Haz firmar el recibo por el trabajador al momento de realizar la transferencia de su sueldo."
    ]
  },
  {
    title: "12. Flujo de Devolución de Cliente con Nota de Crédito (Reingreso de Stock & Ajuste CxC/Caja)",
    steps: [
      "Paso 1: En 'Ventas POS', haz clic en el botón 'Devolución (Nota de Crédito)'.",
      "Paso 2: Busca la Factura o Nota de Entrega original por su número o nombre de cliente.",
      "Paso 3: Selecciona los productos específicos que el cliente está devolviendo y escribe la cantidad exacta devuelta.",
      "Paso 4: Escribe el Motivo detallado de la devolución (ej. 'Envase golpeado en transporte' o 'Cambio por viscosidad diferente').",
      "Paso 5: Presiona 'Emitir Nota de Crédito'.",
      "Paso 6: El sistema reingresa físicamente las unidades al inventario del almacén de origen, anula o rebaja la cuenta por cobrar del cliente en CxC (o genera saldo a favor), y emite la Nota de Crédito en PDF."
    ]
  },
  {
    title: "13. Flujo de Registro de Mermas, Derrames o Daños en Almacén (Kardex & Comprobante PDF)",
    steps: [
      "Paso 1: Entra a 'Inventario' y haz clic en el botón dorado 'Kardex & Mermas'.",
      "Paso 2: Presiona el botón '+ Nuevo Movimiento' y en Tipo selecciona 'Salida / Merma (S)'.",
      "Paso 3: Elige el Almacén donde ocurrió el incidente (Almacén 01 o 02).",
      "Paso 4: Busca el producto afectado e ingresa las unidades perdidas.",
      "Paso 5: En el campo 'Concepto / Motivo' escribe una justificación clara (ejemplo: 'Tambor perforado por uña de montacargas en descarga').",
      "Paso 6: Presiona 'Registrar Ajuste'. El sistema rebajará el stock físico y te permitirá descargar el Comprobante de Merma en PDF para firma del jefe de bodega."
    ]
  },
  {
    title: "14. Flujo de Traslado de Mercancía entre Almacén 01 (Fiscal) y Almacén 02 (Central)",
    steps: [
      "Paso 1: En 'Inventario', haz clic en 'Kardex & Mermas' y luego en '+ Nuevo Movimiento'.",
      "Paso 2: En Tipo de Movimiento selecciona 'Traslado entre Almacenes (T)'.",
      "Paso 3: Elige el Almacén Origen (ej. Almacén 02) y el Almacén Destino (ej. Almacén 01).",
      "Paso 4: Selecciona el lubricante y la cantidad de unidades o cajas a mover.",
      "Paso 5: Escribe el motivo del traslado (ej. 'Reabastecimiento para pedidos fiscales').",
      "Paso 6: Presiona 'Procesar Traslado'. El stock se descontará del origen y se sumará al destino sin descuadrar la empresa."
    ]
  },
  {
    title: "15. Flujo de Control de Caja Chica & Conciliación Bancaria Diaria",
    steps: [
      "Paso 1: Para cualquier egreso menor: en 'Caja & Bancos' haz clic en '+ Registrar Movimiento', elige la caja pagadora, ingresa el monto y concepto, y guarda el comprobante.",
      "Paso 2: Para conciliar bancos: entra a la pestaña de la cuenta bancaria en el sistema y abre en paralelo la banca online del banco.",
      "Paso 3: Compara cada cobro y pago del sistema contra los movimientos del estado de cuenta bancario.",
      "Paso 4: Al final de la tarde, haz clic en 'Arqueo de Caja', cuenta el efectivo físico y genera el Acta de Cierre Diario en PDF."
    ]
  },
  {
    title: "16. Flujo de Cierre Fiscal Diario (Reporte Z) y Declaraciones TXT/XML al SENIAT",
    steps: [
      "Paso 1: Al terminar el horario de ventas, entra a 'Ventas POS' y revisa el arqueo de facturas fiscales emitidas en el día.",
      "Paso 2: En 'Reportes Fiscales', verifica que el Libro de Ventas registre todas las facturas del día con sus números de control correlativos.",
      "Paso 3: A fin de mes, genera el archivo TXT de retenciones de IVA haciendo clic en 'Descargar TXT SENIAT'.",
      "Paso 4: Ingresa al portal web del SENIAT con el usuario de la empresa y sube el archivo TXT para consolidar la declaración."
    ]
  },
  {
    title: "17. Flujo de Planificación de Reposición con Matriz de Reorden ROP",
    steps: [
      "Paso 1: Entra a 'Inventario' y haz clic en el botón 'Matriz Reorden & Quiebres'.",
      "Paso 2: Revisa la lista de productos filtrada por semáforo rojo (quiebre inminente) o amarillo (alcanzó el punto de reorden ROP).",
      "Paso 3: Observa la cantidad sugerida a comprar calculada por el sistema según el consumo promedio mensual.",
      "Paso 4: Presiona 'Generar Requisición de Compra' para enviar el pedido al departamento de Compras."
    ]
  },
  {
    title: "18. Flujo de Creación de Operadores y Asignación de Roles y Contraseñas",
    steps: [
      "Paso 1: Entra a 'Usuarios' con credenciales de Administrador Master.",
      "Paso 2: Presiona '+ Nuevo Operador', escribe nombre, cargo y usuario.",
      "Paso 3: Selecciona uno de los 9 roles institucionales (ej. CAJA, VENTAS, ALMACÉN). El sistema marcará los módulos recomendados.",
      "Paso 4: Si deseas darle o quitarle un módulo específico, marca o desmarca su casilla correspondiente.",
      "Paso 5: Asigna una contraseña segura y presiona 'Guardar Usuario'."
    ]
  },
  {
    title: "19. Flujo de Respaldo Local (npm run backup) y Gestión de Base de Datos",
    steps: [
      "Paso 1: En la laptop abre una terminal de PowerShell en la carpeta del proyecto.",
      "Paso 2: Ejecuta el comando: npm run backup",
      "Paso 3: El sistema se conectará a la base de datos local (127.0.0.1:54321), extraerá las 51 tablas y guardará un archivo JSON sellado con fecha y hora en 'supabase/backups/'.",
      "Paso 4: Confirma que la consola muestre 'Respaldo generado con éxito'. La base de datos queda protegida contra fallos."
    ]
  },
  {
    title: "20. Flujo Completo de POS Mostrador Móvil (Modo Celular PWA — Preventa y Facturación en Caja)",
    steps: [
      "Paso 1: Abre SIGNUM MOTORVEN en tu teléfono (o haz clic en 'Modo Celular 📱' desde la PC).",
      "Paso 2: Toca 'Preventa' en la barra inferior y entra a 'Crear Pedido', o abre 'Menú' ➔ 'Facturación POS Caja' para venta directa en mostrador.",
      "Paso 3: Selecciona al Cliente (el sistema valida aprobación, límite de crédito y saldo CxC al instante) y elige Almacén 01 (Factura Fiscal) o Almacén 02 (Nota de Entrega).",
      "Paso 4: Agrega los lubricantes verificando el stock disponible ATP 72h y guarda el pedido.",
      "Paso 5: En el detalle del pedido, presiona 'Facturar / Pasar a Caja' para abrir el POS Mostrador Móvil, registrar el pago y emitir la Factura o Nota de Entrega."
    ]
  },
  {
    title: "21. Flujo de Análisis Predictivo y Simulación de Precios (Foresight)",
    steps: [
      "Paso 1: Entra a 'Predictibilidad & Alertas' desde el menú lateral o desde el Menú Móvil.",
      "Paso 2: En 'Radar de Riesgo', revisa las alertas críticas de quiebre de stock y compresión de márgenes.",
      "Paso 3: Entra a la pestaña 'Márgenes' y usa el Simulador What-If para probar variaciones de costo y margen objetivo.",
      "Paso 4: Revisa la pestaña 'Flujo de Caja' y descarga el Reporte Predictivo en PDF para gerencia y compras."
    ]
  },
  {
    title: "22. Flujo de Gestión de Cuentas de Pasivo & Socios (2.02.01.001)",
    steps: [
      "Paso 1: Entra a 'Cuentas de Pasivo' en el menú lateral.",
      "Paso 2: Crea o selecciona la cuenta del socio u otro pasivo (ej. SOC-01).",
      "Paso 3: Registra el abono (préstamo/aporte recibido) o cargo (pago/reintegro) seleccionando la Caja o Banco real involucrado.",
      "Paso 4: Verifica el saldo actualizado y genera el reporte PDF del libro auxiliar cuando sea requerido."
    ]
  }
];

// ==============================================================================
// ❓ PREGUNTAS FRECUENTES (FAQ) — RESUELTAS PARA PRINCIPIANTES
// ==============================================================================
export const FREQUENTLY_ASKED_QUESTIONS = [
  {
    question: "Soy nuevo en la empresa, ¿por dónde debo empezar a aprender el sistema?",
    answer: "¡Bienvenido! Entra a este Centro de Ayuda y haz clic en la primera pestaña '🚀 Empieza Aquí (Desde Cero)'. Allí tienes la explicación de cómo funciona el negocio, qué es Almacén 01 y 02, cómo se usan los Dólares y Bolívares y las 7 Reglas de Oro. Luego ve a la pestaña 'Módulos & Tareas' para ver la pantalla donde te toque trabajar."
  },
  {
    question: "¿Cuál es la diferencia entre Factura Fiscal y Nota de Entrega en SIGNUM MOTORVEN?",
    answer: "La Factura Fiscal se emite desde el Almacén 01 (Principal), lleva IVA del 16%, tiene número de control oficial del SENIAT y alimenta el Libro de Ventas legal. La Nota de Entrega se emite desde el Almacén 02 (Central), es para despachos comerciales rápidos y tiene sus propios precios y costos independientes sin recargo de IVA en el cobro directo."
  },
  {
    question: "¿Por qué el sistema no me deja vender un producto o agregarlo al carrito?",
    answer: "El sistema tiene un bloqueo estricto de Stock Cero para proteger a la empresa. Si el almacén seleccionado (01 o 02) tiene 0 unidades disponibles de ese lubricante, el sistema no te permitirá agregarlo al pedido ni facturarlo. Debes consultar si hay unidades en el otro almacén o avisar a Compras para que repongan inventario."
  },
  {
    question: "¿Cómo se manejan los pagos en Dólares ($) y Bolívares (Bs.)?",
    answer: "Todo el sistema guarda los precios y deudas en Dólares ($) para no perder valor frente a la inflación. En la parte superior de la pantalla siempre verás la Tasa Oficial del Banco Central de Venezuela (BCV). Si el cliente paga en Bolívares, el sistema multiplica los dólares por la tasa BCV y te dice exactamente cuántos bolívares cobrar."
  },
  {
    question: "¿Qué es el IGTF del 3% y cuándo se debe cobrar?",
    answer: "El IGTF (Impuesto a Grandes Transacciones Financieras) es un impuesto del 3% que exige la ley del SENIAT. Se cobra obligatoriamente cuando un cliente paga una Factura Fiscal en divisas (Dólares en efectivo). Al seleccionar 'Efectivo USD' en Caja, el sistema suma ese 3% automáticamente."
  },
  {
    question: "¿Qué ocurre cuando registro un cobro en Cuentas por Cobrar (Parte A)?",
    answer: "Al presionar 'Registrar Cobro' en Parte A se ejecutan 5 acciones automáticas: (1) Se descuenta el abono de la factura del cliente, (2) Se genera el recibo oficial COB-XXXXXX, (3) Se suma el dinero en USD y Bs. al banco o caja receptora, (4) Se libera el cupo de crédito del cliente para que pueda volver a comprar, y (5) Se crea el asiento contable en el Libro Diario."
  },
  {
    question: "¿Cómo registro una rotura o derrame de aceite en el almacén?",
    answer: "Entra a 'Inventario' ➔ Botón 'Kardex & Mermas' ➔ '+ Nuevo Movimiento' ➔ Elige 'Salida / Merma (S)' ➔ Elige el Almacén y el producto ➔ Escribe las unidades perdidas y el motivo ➔ Presiona 'Registrar Ajuste'. El sistema rebajará el stock físico e imprimirá el Comprobante de Merma en PDF para que lo firme el jefe de bodega."
  },
  {
    question: "¿Cómo devuelvo una mercancía que un cliente regresó por error?",
    answer: "En 'Ventas POS', presiona el botón 'Devolución (Nota de Crédito)', busca la factura original, selecciona los productos devueltos y emite la Nota de Crédito. El sistema regresará las unidades al almacén de forma automática y rebajará la deuda del cliente en Cuentas por Cobrar."
  },
  {
    question: "¿Qué es la Solicitud de Crédito & Pagaré Mercantil y por qué es obligatoria?",
    answer: "Es un documento legal de 2 páginas basado en el Artículo 486 del Código de Comercio venezolano. Cuando un cliente solicita comprar a crédito, debe firmar este pagaré y estampar su huella. Si el cliente no paga, este pagaré permite a los abogados de la empresa demandar ejecutivamente en tribunales y embargar bienes de forma inmediata."
  },
  {
    question: "¿Qué es el Recibo Individual de Pago LOTTT y a quién se le entrega?",
    answer: "Es el comprobante de sueldo que exige el Artículo 106 de la Ley Orgánica del Trabajo (LOTTT). En el módulo 'Auditoría & Contable' ➔ 'Gastos & Nómina LOTTT', puedes imprimirlo para cada empleado. Muestra su salario base, Cestaticket, y los descuentos legales de IVSS, FAOV y Paro Forzoso."
  },
  {
    question: "¿Qué es el Comprobante Anual ARC de ISLR para proveedores?",
    answer: "Es el documento anual obligatorio bajo el Artículo 24 del Decreto 1.808 que resume todas las retenciones de Impuesto sobre la Renta aplicadas a un proveedor durante los 12 meses del año. Se emite en 'Reportes Fiscales' ➔ 'Comprobante Anual ARC'."
  },
  {
    question: "¿Cómo se hace el respaldo de seguridad de la base de datos?",
    answer: "En la terminal de la laptop, escribe el comando: npm run backup. El sistema descargará todas las 51 tablas de la base de datos y creará un archivo seguro en la carpeta 'supabase/backups/' con la fecha y hora exacta."
  },
  {
    question: "¿Puedo seguir trabajando si se va el internet en la oficina?",
    answer: "¡Sí! SIGNUM MOTORVEN fue diseñado con tecnología 'Offline-First'. Si se cae el internet, la barra superior cambiará a modo sin conexión, pero tú podrás seguir consultando inventario y creando pedidos. Toda la información se guarda en la memoria local y se sincronizará automáticamente cuando vuelva la conexión."
  },
  {
    question: "¿Cómo uso el POS Mostrador Móvil desde mi teléfono?",
    answer: "Al abrir SIGNUM MOTORVEN desde un teléfono se activa automáticamente el Modo Celular (también puedes activarlo en PC con el botón 'Modo Celular 📱'). Desde allí puedes crear pedidos en 'Preventa', abrir un pedido y tocar 'Facturar / Pasar a Caja', o ir a 'Menú' ➔ 'Facturación POS Caja' para facturar directamente en Almacén 01 (Fiscal) o Almacén 02 (Nota de Entrega)."
  },
  {
    question: "¿Para qué sirve el módulo 'Predictibilidad & Alertas (Foresight)'?",
    answer: "Analiza automáticamente tus ventas recientes, stock, cuentas por cobrar y por pagar para anticipar quiebres de inventario, alertar si algún producto bajó del margen mínimo seguro, simular aumentos de precio (What-If) y proyectar el flujo de caja de la empresa."
  },
  {
    question: "¿Qué se registra en 'Cuentas de Pasivo & Socios'?",
    answer: "Se registran las cuentas por pagar a socios (aportes temporales o préstamos de socios a la empresa) y otros pasivos distintos a proveedores comerciales, manteniendo cada abono o reintegro cuadrado con la Caja o Banco correspondiente."
  }
];
