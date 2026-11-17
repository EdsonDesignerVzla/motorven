/**
 * Plan de Cuentas Oficial de Pro Motorven C.A.
 * RIF: J-50780548-4 | Centro de Costos: 001 | Norma: BA VEN-NIF 2
 * Transcripción y normalización del catálogo contable institucional.
 */

export const PLAN_DE_CUENTAS_MOTORVEN = [
  // =========================================================================
  // 1. ACTIVOS
  // =========================================================================
  { codigo: '1.', nombre: 'ACTIVO', nivel: 1, imputable: false, naturaleza: 'DEUDORA', grupo: 'ACTIVO' },
  { codigo: '1.01.', nombre: 'ACTIVO CORRIENTE', nivel: 2, imputable: false, naturaleza: 'DEUDORA', grupo: 'ACTIVO' },
  { codigo: '1.01.01.', nombre: 'EFECTIVO Y EQUIVALENTE', nivel: 3, imputable: false, naturaleza: 'DEUDORA', grupo: 'ACTIVO' },
  { codigo: '1.01.01.001', nombre: 'Caja Moneda Nacional', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'ACTIVO', subgrupo: 'DISPONIBLE' },
  { codigo: '1.01.01.002', nombre: 'Caja Divisas', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'ACTIVO', subgrupo: 'DISPONIBLE' },
  { codigo: '1.01.01.003', nombre: 'Traspaso de Fondos', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'ACTIVO', subgrupo: 'DISPONIBLE' },
  { codigo: '1.01.01.004', nombre: 'Zelle', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'ACTIVO', subgrupo: 'DISPONIBLE' },

  { codigo: '1.01.02.', nombre: 'BANCOS NACIONALES', nivel: 3, imputable: false, naturaleza: 'DEUDORA', grupo: 'ACTIVO' },
  { codigo: '1.01.02.001', nombre: 'Banco de Venezuela', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'ACTIVO', subgrupo: 'BANCOS' },
  { codigo: '1.01.02.002', nombre: 'Banco Mercantil', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'ACTIVO', subgrupo: 'BANCOS' },
  { codigo: '1.01.02.003', nombre: 'Banco Plaza (275)', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'ACTIVO', subgrupo: 'BANCOS' },
  { codigo: '1.01.02.004', nombre: 'Banco Plaza (694)', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'ACTIVO', subgrupo: 'BANCOS' },
  { codigo: '1.01.02.005', nombre: 'Bancaribe', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'ACTIVO', subgrupo: 'BANCOS' },
  { codigo: '1.01.02.006', nombre: 'Banco Activo', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'ACTIVO', subgrupo: 'BANCOS' },
  { codigo: '1.01.02.007', nombre: 'Bancamiga', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'ACTIVO', subgrupo: 'BANCOS' },
  { codigo: '1.01.02.008', nombre: 'Banco Activo (0378)', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'ACTIVO', subgrupo: 'BANCOS' },

  { codigo: '1.01.03.', nombre: 'DOCUMENTOS Y CUENTAS POR COBRAR', nivel: 3, imputable: false, naturaleza: 'DEUDORA', grupo: 'ACTIVO' },
  { codigo: '1.01.03.001', nombre: 'Cuentas por Cobrar Comerciales', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'ACTIVO', subgrupo: 'EXIGIBLE' },
  { codigo: '1.01.03.002', nombre: 'Provisión para Cuentas Incobrables', nivel: 4, imputable: true, naturaleza: 'ACREEDORA', grupo: 'ACTIVO', subgrupo: 'VALUACION_CXC' },

  { codigo: '1.02.', nombre: 'ANTICIPOS', nivel: 2, imputable: false, naturaleza: 'DEUDORA', grupo: 'ACTIVO' },
  { codigo: '1.02.01.', nombre: 'ANTICIPO PROVEEDORES', nivel: 3, imputable: false, naturaleza: 'DEUDORA', grupo: 'ACTIVO' },
  { codigo: '1.02.01.001', nombre: 'Anticipo Proveedores', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'ACTIVO', subgrupo: 'EXIGIBLE' },

  { codigo: '1.03.', nombre: 'OTROS ACTIVOS', nivel: 2, imputable: false, naturaleza: 'DEUDORA', grupo: 'ACTIVO' },
  { codigo: '1.03.01.', nombre: 'OTROS ACTIVOS FINANCIEROS', nivel: 3, imputable: false, naturaleza: 'DEUDORA', grupo: 'ACTIVO' },
  { codigo: '1.03.01.001', nombre: 'Cuentas por Cobrar Empleados', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'ACTIVO', subgrupo: 'EXIGIBLE' },
  { codigo: '1.03.01.002', nombre: 'Otras Cuentas por Cobrar', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'ACTIVO', subgrupo: 'EXIGIBLE' },
  { codigo: '1.03.01.003', nombre: 'Cuentas por Cobrar Socio', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'ACTIVO', subgrupo: 'EXIGIBLE' },
  { codigo: '1.03.01.004', nombre: 'Cuentas por Cobrar Intercompañías', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'ACTIVO', subgrupo: 'EXIGIBLE' },
  { codigo: '1.03.01.005', nombre: 'Depósitos en Garantía', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'ACTIVO', subgrupo: 'EXIGIBLE' },
  { codigo: '1.03.01.006', nombre: 'Otras cuentas por cobrar vehículos', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'ACTIVO', subgrupo: 'EXIGIBLE' },

  { codigo: '1.04.', nombre: 'INVENTARIOS', nivel: 2, imputable: false, naturaleza: 'DEUDORA', grupo: 'ACTIVO' },
  { codigo: '1.04.01.', nombre: 'INVENTARIO', nivel: 3, imputable: false, naturaleza: 'DEUDORA', grupo: 'ACTIVO' },
  { codigo: '1.04.01.001', nombre: 'Inventario de Mercancia', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'ACTIVO', subgrupo: 'REALIZABLE' },

  { codigo: '1.05.', nombre: 'GASTOS PREPAGADOS', nivel: 2, imputable: false, naturaleza: 'DEUDORA', grupo: 'ACTIVO' },
  { codigo: '1.05.01.', nombre: 'GASTOS PAGADOS POR ANTICIPADO', nivel: 3, imputable: false, naturaleza: 'DEUDORA', grupo: 'ACTIVO' },
  { codigo: '1.05.01.001', nombre: 'Seguros', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'ACTIVO', subgrupo: 'PREPAGADOS' },
  { codigo: '1.05.01.004', nombre: 'Anticipo 1% ISLR', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'ACTIVO', subgrupo: 'FISCAL_ACTIVO' },
  { codigo: '1.05.01.005', nombre: 'Crédito Fiscal', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'ACTIVO', subgrupo: 'FISCAL_ACTIVO' },
  { codigo: '1.05.01.006', nombre: 'Excedente Fiscal', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'ACTIVO', subgrupo: 'FISCAL_ACTIVO' },
  { codigo: '1.05.01.007', nombre: 'Retencion de IVA', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'ACTIVO', subgrupo: 'FISCAL_ACTIVO' },
  { codigo: '1.05.01.008', nombre: 'Retencion de ISLR', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'ACTIVO', subgrupo: 'FISCAL_ACTIVO' },

  { codigo: '1.06.', nombre: 'ACTIVOS NO CORRIENTES', nivel: 2, imputable: false, naturaleza: 'DEUDORA', grupo: 'ACTIVO' },
  { codigo: '1.06.01.', nombre: 'PROPIEDAD, PLANTA Y EQUIPO', nivel: 3, imputable: false, naturaleza: 'DEUDORA', grupo: 'ACTIVO' },
  { codigo: '1.06.01.001', nombre: 'Mobiliario y Equipo', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'ACTIVO', subgrupo: 'ACTIVO_FIJO' },
  { codigo: '1.06.01.002', nombre: 'Vehiculos', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'ACTIVO', subgrupo: 'ACTIVO_FIJO' },
  { codigo: '1.06.01.003', nombre: 'Equipos de Computación', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'ACTIVO', subgrupo: 'ACTIVO_FIJO' },

  { codigo: '1.06.02.', nombre: 'DEPRECIACIÓN ACUM. ACTIVOS FIJOS', nivel: 3, imputable: false, naturaleza: 'ACREEDORA', grupo: 'ACTIVO' },
  { codigo: '1.06.02.001', nombre: 'Deprec. Acum. Mobiliario y Equipo', nivel: 4, imputable: true, naturaleza: 'ACREEDORA', grupo: 'ACTIVO', subgrupo: 'DEPRECIACION' },
  { codigo: '1.06.02.002', nombre: 'Deprec. Acum. Vehiculos', nivel: 4, imputable: true, naturaleza: 'ACREEDORA', grupo: 'ACTIVO', subgrupo: 'DEPRECIACION' },
  { codigo: '1.06.02.003', nombre: 'Deprec. Acum. Equipos de Computación', nivel: 4, imputable: true, naturaleza: 'ACREEDORA', grupo: 'ACTIVO', subgrupo: 'DEPRECIACION' },

  { codigo: '1.06.03.', nombre: 'ACTIVOS INTANGIBLES', nivel: 3, imputable: false, naturaleza: 'DEUDORA', grupo: 'ACTIVO' },
  { codigo: '1.06.03.001', nombre: 'Licencias y Software Contable', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'ACTIVO', subgrupo: 'INTANGIBLES' },

  { codigo: '1.07.', nombre: 'AJUSTE POR INFLACIÓN', nivel: 2, imputable: false, naturaleza: 'DEUDORA', grupo: 'ACTIVO' },
  { codigo: '1.07.01.', nombre: 'AJUSTE POR INFLACION ACTIVO FIJO', nivel: 3, imputable: false, naturaleza: 'DEUDORA', grupo: 'ACTIVO' },
  { codigo: '1.07.01.001', nombre: 'Ajuste por Inflación Activo Fijo', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'ACTIVO', subgrupo: 'AJUSTE_INFLACION' },

  // =========================================================================
  // 2. PASIVOS
  // =========================================================================
  { codigo: '2.', nombre: 'PASIVO', nivel: 1, imputable: false, naturaleza: 'ACREEDORA', grupo: 'PASIVO' },
  { codigo: '2.01.', nombre: 'PASIVO CORRIENTE', nivel: 2, imputable: false, naturaleza: 'ACREEDORA', grupo: 'PASIVO' },
  { codigo: '2.01.01.', nombre: 'OBLIGACIONES BANCARIAS', nivel: 3, imputable: false, naturaleza: 'ACREEDORA', grupo: 'PASIVO' },

  { codigo: '2.02.', nombre: 'DOCUMENTOS Y CUENTAS POR PAGAR', nivel: 2, imputable: false, naturaleza: 'ACREEDORA', grupo: 'PASIVO' },
  { codigo: '2.02.01.', nombre: 'CUENTAS POR PAGAR ACCIONISTAS', nivel: 3, imputable: false, naturaleza: 'ACREEDORA', grupo: 'PASIVO' },
  { codigo: '2.02.01.001', nombre: 'Cuentas por Pagar Socio', nivel: 4, imputable: true, naturaleza: 'ACREEDORA', grupo: 'PASIVO', subgrupo: 'PASIVO_SOCIOS' },
  { codigo: '2.02.01.002', nombre: 'Aporte Socio', nivel: 4, imputable: true, naturaleza: 'ACREEDORA', grupo: 'PASIVO', subgrupo: 'PASIVO_SOCIOS' },

  { codigo: '2.02.02.', nombre: 'CUENTAS POR PAGAR COMERCIALES', nivel: 3, imputable: false, naturaleza: 'ACREEDORA', grupo: 'PASIVO' },
  { codigo: '2.02.02.001', nombre: 'Cuentas por Pagar Comerciales', nivel: 4, imputable: true, naturaleza: 'ACREEDORA', grupo: 'PASIVO', subgrupo: 'PROVEEDORES' },
  { codigo: '2.02.02.002', nombre: 'Cuentas por Pagar Keyton', nivel: 4, imputable: true, naturaleza: 'ACREEDORA', grupo: 'PASIVO', subgrupo: 'PROVEEDORES' },
  { codigo: '2.02.02.003', nombre: 'Cuentas por Pagar Kontigo', nivel: 4, imputable: true, naturaleza: 'ACREEDORA', grupo: 'PASIVO', subgrupo: 'PROVEEDORES' },

  { codigo: '2.03.', nombre: 'OBLIGACIONES LEGALES POR PAGAR', nivel: 2, imputable: false, naturaleza: 'ACREEDORA', grupo: 'PASIVO' },
  { codigo: '2.03.01.', nombre: 'RETENCIONES POR PAGAR', nivel: 3, imputable: false, naturaleza: 'ACREEDORA', grupo: 'PASIVO' },
  { codigo: '2.03.01.001', nombre: 'INCE', nivel: 4, imputable: true, naturaleza: 'ACREEDORA', grupo: 'PASIVO', subgrupo: 'FISCAL_PASIVO' },
  { codigo: '2.03.01.002', nombre: 'S.S.O', nivel: 4, imputable: true, naturaleza: 'ACREEDORA', grupo: 'PASIVO', subgrupo: 'FISCAL_PASIVO' },
  { codigo: '2.03.01.003', nombre: 'L.P.H', nivel: 4, imputable: true, naturaleza: 'ACREEDORA', grupo: 'PASIVO', subgrupo: 'FISCAL_PASIVO' },
  { codigo: '2.03.01.004', nombre: 'Seguro de Paro Forzoso', nivel: 4, imputable: true, naturaleza: 'ACREEDORA', grupo: 'PASIVO', subgrupo: 'FISCAL_PASIVO' },
  { codigo: '2.03.01.005', nombre: 'Débito Fiscal', nivel: 4, imputable: true, naturaleza: 'ACREEDORA', grupo: 'PASIVO', subgrupo: 'FISCAL_PASIVO' },
  { codigo: '2.03.01.006', nombre: 'Retencion de ISLR Proveedores', nivel: 4, imputable: true, naturaleza: 'ACREEDORA', grupo: 'PASIVO', subgrupo: 'FISCAL_PASIVO' },

  { codigo: '2.04.', nombre: 'OBLIGACIONES LABORALES', nivel: 2, imputable: false, naturaleza: 'ACREEDORA', grupo: 'PASIVO' },
  { codigo: '2.04.01.001', nombre: 'Antiguedad', nivel: 4, imputable: true, naturaleza: 'ACREEDORA', grupo: 'PASIVO', subgrupo: 'LABORAL_PASIVO' },
  { codigo: '2.04.01.002', nombre: 'Vacaciones por Pagar', nivel: 4, imputable: true, naturaleza: 'ACREEDORA', grupo: 'PASIVO', subgrupo: 'LABORAL_PASIVO' },
  { codigo: '2.04.01.003', nombre: 'Intereses', nivel: 4, imputable: true, naturaleza: 'ACREEDORA', grupo: 'PASIVO', subgrupo: 'LABORAL_PASIVO' },

  { codigo: '2.05.', nombre: 'PASIVO NO CORRIENTE', nivel: 2, imputable: false, naturaleza: 'ACREEDORA', grupo: 'PASIVO' },

  { codigo: '2.06.', nombre: 'OTROS PASIVOS', nivel: 2, imputable: false, naturaleza: 'ACREEDORA', grupo: 'PASIVO' },
  { codigo: '2.06.01.', nombre: 'ANTICIPO CLIENTES', nivel: 3, imputable: false, naturaleza: 'ACREEDORA', grupo: 'PASIVO' },
  { codigo: '2.06.01.001', nombre: 'Anticipo Clientes', nivel: 4, imputable: true, naturaleza: 'ACREEDORA', grupo: 'PASIVO', subgrupo: 'ANTICIPOS' },

  // =========================================================================
  // 3. PATRIMONIO
  // =========================================================================
  { codigo: '3.', nombre: 'PATRIMONIO', nivel: 1, imputable: false, naturaleza: 'ACREEDORA', grupo: 'PATRIMONIO' },
  { codigo: '3.01.', nombre: 'CAPITAL', nivel: 2, imputable: false, naturaleza: 'ACREEDORA', grupo: 'PATRIMONIO' },
  { codigo: '3.01.01.', nombre: 'CAPITAL SUSCRITO', nivel: 3, imputable: false, naturaleza: 'ACREEDORA', grupo: 'PATRIMONIO' },
  { codigo: '3.01.01.001', nombre: 'Revalorización del Patrimonio', nivel: 4, imputable: true, naturaleza: 'ACREEDORA', grupo: 'PATRIMONIO', subgrupo: 'CAPITAL' },
  { codigo: '3.01.01.002', nombre: 'Capital Social Pagado', nivel: 4, imputable: true, naturaleza: 'ACREEDORA', grupo: 'PATRIMONIO', subgrupo: 'CAPITAL' },

  { codigo: '3.01.02.', nombre: 'RESERVA', nivel: 2, imputable: false, naturaleza: 'ACREEDORA', grupo: 'PATRIMONIO' },
  { codigo: '3.01.02.001', nombre: 'Reserva Legal', nivel: 4, imputable: true, naturaleza: 'ACREEDORA', grupo: 'PATRIMONIO', subgrupo: 'RESERVA' },

  { codigo: '3.02.', nombre: 'RESULTADO DEL EJERCICIO', nivel: 2, imputable: false, naturaleza: 'ACREEDORA', grupo: 'PATRIMONIO' },
  { codigo: '3.02.01.', nombre: 'SUPERAVIT', nivel: 3, imputable: false, naturaleza: 'ACREEDORA', grupo: 'PATRIMONIO' },
  { codigo: '3.02.01.001', nombre: 'Superavit del Ejercicio', nivel: 4, imputable: true, naturaleza: 'ACREEDORA', grupo: 'PATRIMONIO', subgrupo: 'RESULTADOS' },
  { codigo: '3.02.01.002', nombre: 'Superavit Acumulado', nivel: 4, imputable: true, naturaleza: 'ACREEDORA', grupo: 'PATRIMONIO', subgrupo: 'RESULTADOS' },

  { codigo: '3.02.02.', nombre: 'DÉFICIT', nivel: 3, imputable: false, naturaleza: 'DEUDORA', grupo: 'PATRIMONIO' },
  { codigo: '3.02.02.001', nombre: 'Déficit del Ejercicio', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'PATRIMONIO', subgrupo: 'RESULTADOS' },
  { codigo: '3.02.02.002', nombre: 'Déficit Acumulado', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'PATRIMONIO', subgrupo: 'RESULTADOS' },

  // =========================================================================
  // 4. INGRESOS
  // =========================================================================
  { codigo: '4.', nombre: 'INGRESOS', nivel: 1, imputable: false, naturaleza: 'ACREEDORA', grupo: 'INGRESOS' },
  { codigo: '4.01.', nombre: 'VENTAS BRUTAS', nivel: 2, imputable: false, naturaleza: 'ACREEDORA', grupo: 'INGRESOS' },
  { codigo: '4.01.01.', nombre: 'POR VENTA DE PRODUCTOS', nivel: 3, imputable: false, naturaleza: 'ACREEDORA', grupo: 'INGRESOS' },
  { codigo: '4.01.01.001', nombre: 'Ventas', nivel: 4, imputable: true, naturaleza: 'ACREEDORA', grupo: 'INGRESOS', subgrupo: 'VENTAS_OPERATIVAS' },

  { codigo: '4.01.02.', nombre: 'DESCUENTOS Y DEVOLUCIONES', nivel: 2, imputable: false, naturaleza: 'DEUDORA', grupo: 'INGRESOS' },
  { codigo: '4.01.02.001', nombre: 'Descuento en Ventas', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'INGRESOS', subgrupo: 'DESCUENTOS' },
  { codigo: '4.01.02.002', nombre: 'Devoluciones', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'INGRESOS', subgrupo: 'DEVOLUCIONES' },

  { codigo: '4.02.', nombre: 'OTROS INGRESOS', nivel: 2, imputable: false, naturaleza: 'ACREEDORA', grupo: 'INGRESOS' },
  { codigo: '4.02.01.', nombre: 'GANACIA CAMBIARIA', nivel: 3, imputable: false, naturaleza: 'ACREEDORA', grupo: 'INGRESOS' },
  { codigo: '4.02.01.001', nombre: 'Ganacia Cambiaria', nivel: 4, imputable: true, naturaleza: 'ACREEDORA', grupo: 'INGRESOS', subgrupo: 'DIFERENCIAL_CAMBIARIO' },

  // =========================================================================
  // 5. COSTOS
  // =========================================================================
  { codigo: '5.', nombre: 'COSTOS', nivel: 1, imputable: false, naturaleza: 'DEUDORA', grupo: 'COSTOS' },
  { codigo: '5.01.', nombre: 'COSTOS DE VENTAS', nivel: 2, imputable: false, naturaleza: 'DEUDORA', grupo: 'COSTOS' },
  { codigo: '5.01.01.', nombre: 'COSTO DE PRODUCTOS', nivel: 3, imputable: false, naturaleza: 'DEUDORA', grupo: 'COSTOS' },
  { codigo: '5.01.01.001', nombre: 'Costo de Venta', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'COSTOS', subgrupo: 'COSTO_MERCANCIA' },
  { codigo: '5.01.01.002', nombre: 'Costos por Servicios', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'COSTOS', subgrupo: 'COSTO_SERVICIOS' },

  // =========================================================================
  // 6. EGRESOS (GASTOS OPERATIVOS)
  // =========================================================================
  { codigo: '6.', nombre: 'EGRESOS', nivel: 1, imputable: false, naturaleza: 'DEUDORA', grupo: 'EGRESOS' },
  { codigo: '6.01.', nombre: 'GASTOS DE OPERACION', nivel: 2, imputable: false, naturaleza: 'DEUDORA', grupo: 'EGRESOS' },

  { codigo: '6.01.01.', nombre: 'GASTOS DE NÓMINA', nivel: 3, imputable: false, naturaleza: 'DEUDORA', grupo: 'EGRESOS' },
  { codigo: '6.01.01.001', nombre: 'Sueldo Directores', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'EGRESOS', subgrupo: 'NOMINA' },
  { codigo: '6.01.01.002', nombre: 'Sueldos y Salarios', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'EGRESOS', subgrupo: 'NOMINA' },
  { codigo: '6.01.01.003', nombre: 'Bono Alimentación', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'EGRESOS', subgrupo: 'NOMINA' },
  { codigo: '6.01.01.004', nombre: 'Sobretiempo', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'EGRESOS', subgrupo: 'NOMINA' },
  { codigo: '6.01.01.005', nombre: 'Utilidades', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'EGRESOS', subgrupo: 'NOMINA' },
  { codigo: '6.01.01.006', nombre: 'Vacaciones y Bono Vacacional', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'EGRESOS', subgrupo: 'NOMINA' },
  { codigo: '6.01.01.007', nombre: 'Antiguedad', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'EGRESOS', subgrupo: 'NOMINA' },
  { codigo: '6.01.01.008', nombre: 'Preaviso', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'EGRESOS', subgrupo: 'NOMINA' },
  { codigo: '6.01.01.009', nombre: 'Bonificaciones', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'EGRESOS', subgrupo: 'NOMINA' },
  { codigo: '6.01.01.010', nombre: 'Retiro Socio', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'EGRESOS', subgrupo: 'NOMINA' },
  { codigo: '6.01.01.011', nombre: 'Comisiones Vendedores', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'EGRESOS', subgrupo: 'COMISIONES' },
  { codigo: '6.01.01.012', nombre: 'COMISIONES DE OFICINA', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'EGRESOS', subgrupo: 'COMISIONES' },
  { codigo: '6.01.01.013', nombre: 'Trabajadores a Destajo', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'EGRESOS', subgrupo: 'NOMINA' },

  { codigo: '6.01.02.', nombre: 'SERVICIOS PÚBLICOS', nivel: 3, imputable: false, naturaleza: 'DEUDORA', grupo: 'EGRESOS' },
  { codigo: '6.01.02.001', nombre: 'Electricidad y Aseo Urbano', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'EGRESOS', subgrupo: 'SERVICIOS' },
  { codigo: '6.01.02.002', nombre: 'Teléfono Celular', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'EGRESOS', subgrupo: 'SERVICIOS' },
  { codigo: '6.01.02.003', nombre: 'Servicio de Agua', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'EGRESOS', subgrupo: 'SERVICIOS' },
  { codigo: '6.01.02.004', nombre: 'Servicio de Gas y Aseo', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'EGRESOS', subgrupo: 'SERVICIOS' },

  { codigo: '6.01.03.', nombre: 'ARTÍCULOS Y EFECTOS DE OFICINA', nivel: 3, imputable: false, naturaleza: 'DEUDORA', grupo: 'EGRESOS' },
  { codigo: '6.01.03.001', nombre: 'Papelería y Art. de Oficina', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'EGRESOS', subgrupo: 'ADMINISTRATIVO' },
  { codigo: '6.01.03.002', nombre: 'Gastos de Computación', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'EGRESOS', subgrupo: 'ADMINISTRATIVO' },
  { codigo: '6.01.03.003', nombre: 'Gastos de Oficina', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'EGRESOS', subgrupo: 'ADMINISTRATIVO' },
  { codigo: '6.01.03.004', nombre: 'Suministros Varios', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'EGRESOS', subgrupo: 'ADMINISTRATIVO' },

  { codigo: '6.01.04.', nombre: 'MANTENIMIENTO Y REPARACIONES', nivel: 3, imputable: false, naturaleza: 'DEUDORA', grupo: 'EGRESOS' },
  { codigo: '6.01.04.001', nombre: 'Mantenimiento de Vehículos', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'EGRESOS', subgrupo: 'MANTENIMIENTO' },
  { codigo: '6.01.04.002', nombre: 'Mantenimiento de Instalaciones', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'EGRESOS', subgrupo: 'MANTENIMIENTO' },
  { codigo: '6.01.04.003', nombre: 'Mantenimiento Maquinaria y Equipo', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'EGRESOS', subgrupo: 'MANTENIMIENTO' },
  { codigo: '6.01.04.004', nombre: 'Suministros de Aseo y Limpieza', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'EGRESOS', subgrupo: 'MANTENIMIENTO' },
  { codigo: '6.01.04.005', nombre: 'Mantenimiento y Limpieza', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'EGRESOS', subgrupo: 'MANTENIMIENTO' },
  { codigo: '6.01.04.006', nombre: 'Ferretería', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'EGRESOS', subgrupo: 'MANTENIMIENTO' },
  { codigo: '6.01.04.007', nombre: 'Combustibles y Lubricantes', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'EGRESOS', subgrupo: 'MANTENIMIENTO' },

  { codigo: '6.01.05.', nombre: 'PUBLICIDAD Y MERCADEO', nivel: 3, imputable: false, naturaleza: 'DEUDORA', grupo: 'EGRESOS' },
  { codigo: '6.01.05.001', nombre: 'Publicidad y Mercadeo', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'EGRESOS', subgrupo: 'COMERCIAL' },

  { codigo: '6.01.06.', nombre: 'UNIFORMES', nivel: 3, imputable: false, naturaleza: 'DEUDORA', grupo: 'EGRESOS' },
  { codigo: '6.01.06.001', nombre: 'Uniformes', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'EGRESOS', subgrupo: 'COMERCIAL' },

  { codigo: '6.01.07.', nombre: 'SERVICIOS PROFESIONALES', nivel: 3, imputable: false, naturaleza: 'DEUDORA', grupo: 'EGRESOS' },
  { codigo: '6.01.07.001', nombre: 'Honorarios Profesionales', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'EGRESOS', subgrupo: 'HONORARIOS' },
  { codigo: '6.01.07.003', nombre: 'Tramites y Documentación', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'EGRESOS', subgrupo: 'HONORARIOS' },

  { codigo: '6.01.08.', nombre: 'ALQUILER', nivel: 3, imputable: false, naturaleza: 'DEUDORA', grupo: 'EGRESOS' },
  { codigo: '6.01.08.001', nombre: 'Alquiler', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'EGRESOS', subgrupo: 'ALQUILER' },
  { codigo: '6.01.08.002', nombre: 'Condominio', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'EGRESOS', subgrupo: 'ALQUILER' },

  { codigo: '6.01.09.', nombre: 'GASTOS MISCELANEOS', nivel: 3, imputable: false, naturaleza: 'DEUDORA', grupo: 'EGRESOS' },
  { codigo: '6.01.09.001', nombre: 'Cuotas y Suscripciones', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'EGRESOS', subgrupo: 'MISCELANEOS' },
  { codigo: '6.01.09.002', nombre: 'Medicinas y Gastos Médicos', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'EGRESOS', subgrupo: 'MISCELANEOS' },
  { codigo: '6.01.09.003', nombre: 'Gastos de Seguridad', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'EGRESOS', subgrupo: 'MISCELANEOS' },
  { codigo: '6.01.09.004', nombre: 'Gastos Varios', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'EGRESOS', subgrupo: 'MISCELANEOS' },

  { codigo: '6.01.10.', nombre: 'GASTOS FINANCIEROS Y TRIBUTARIOS', nivel: 3, imputable: false, naturaleza: 'DEUDORA', grupo: 'EGRESOS' },
  { codigo: '6.01.10.001', nombre: 'Comisiones y Gastos Bancarios', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'EGRESOS', subgrupo: 'FINANCIEROS' },
  { codigo: '6.01.10.002', nombre: 'IGTF y Tributos Financieros (2%)', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'EGRESOS', subgrupo: 'FINANCIEROS' },
  { codigo: '6.01.10.003', nombre: 'Intereses y Recargos Financieros', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'EGRESOS', subgrupo: 'FINANCIEROS' },
  { codigo: '6.01.10.004', nombre: 'Multas y Sanciones Fiscales', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'EGRESOS', subgrupo: 'FINANCIEROS' }
];

/**
 * Mapa de búsqueda indexado por código para O(1)
 */
export const PLAN_DE_CUENTAS_MAP = PLAN_DE_CUENTAS_MOTORVEN.reduce((acc, c) => {
  acc[c.codigo] = c;
  return acc;
}, {});

/**
 * Obtener cuenta contable por código exacto o sanitizado
 */
export function getCuentaContable(codigo) {
  if (!codigo) return null;
  const clean = String(codigo).trim();
  return PLAN_DE_CUENTAS_MAP[clean] || null;
}

/**
 * Obtener solo las cuentas imputables (de nivel 4 que reciben débitos y créditos)
 */
export function getCuentasImputables() {
  return PLAN_DE_CUENTAS_MOTORVEN.filter(c => c.imputable);
}

/**
 * Mapeo inteligente de Cajas Operativas del sistema a Cuentas Contables Oficiales
 */
export function mapCashDeskToAccount(cashDesk) {
  if (!cashDesk) return { codigo: '1.01.01.002', nombre: 'Caja Divisas' };
  const raw = String(cashDesk.id || cashDesk.coCaja || cashDesk.descripcion || '').toUpperCase();
  const moneda = String(cashDesk.moneda || '').toUpperCase();

  if (raw.includes('ZELLE') || raw.includes('04')) {
    return { codigo: '1.01.01.004', nombre: 'Zelle' };
  }
  if (moneda === 'BS' || raw.includes('NACIONAL') || raw.includes('BS') || raw.includes('03')) {
    return { codigo: '1.01.01.001', nombre: 'Caja Moneda Nacional' };
  }
  return { codigo: '1.01.01.002', nombre: 'Caja Divisas' };
}

/**
 * Mapeo inteligente de Cuentas Bancarias del sistema a Cuentas Contables Oficiales
 */
export function mapBankAccountToAccount(bankAccount) {
  if (!bankAccount) return { codigo: '1.01.02.001', nombre: 'Banco de Venezuela' };
  const rawId = String(bankAccount.id || bankAccount.codCta || '').trim();
  const numCta = String(bankAccount.numCta || bankAccount.num_cta || bankAccount.nroCta || '').trim();
  const banco = String(bankAccount.bancoNombre || bankAccount.banco_nombre || bankAccount.banco || bankAccount.desBan || '').toUpperCase();

  // Mapeo por número de cuenta oficial
  if (numCta.endsWith('9275') || rawId === 'CTA-02') {
    return { codigo: '1.01.02.003', nombre: 'Banco Plaza (275)' };
  }
  if (numCta.endsWith('1694') || rawId === 'CTA-04') {
    return { codigo: '1.01.02.004', nombre: 'Banco Plaza (694)' };
  }
  if (numCta.endsWith('0378') || rawId === 'CTA-07' || banco.includes('ACTIVO FISCAL')) {
    return { codigo: '1.01.02.008', nombre: 'Banco Activo (0378)' };
  }
  if (numCta.startsWith('0102') || banco.includes('VENEZUELA') || rawId === 'CTA-03') {
    return { codigo: '1.01.02.001', nombre: 'Banco de Venezuela' };
  }
  if (numCta.startsWith('0105') || banco.includes('MERCANTIL') || rawId === 'CTA-01') {
    return { codigo: '1.01.02.002', nombre: 'Banco Mercantil' };
  }
  if (numCta.startsWith('0114') || banco.includes('BANCARIBE') || rawId === 'CTA-05' || rawId === 'CTA-09') {
    return { codigo: '1.01.02.005', nombre: 'Bancaribe' };
  }
  if (numCta.startsWith('0171') || banco.includes('ACTIVO') || rawId === 'CTA-06') {
    return { codigo: '1.01.02.006', nombre: 'Banco Activo' };
  }
  if (numCta.startsWith('0172') || banco.includes('BANCAMIGA') || rawId === 'CTA-08' || rawId === 'CTA-10') {
    return { codigo: '1.01.02.007', nombre: 'Bancamiga' };
  }

  return { codigo: '1.01.02.001', nombre: 'Banco de Venezuela' };
}

/**
 * Mapeo inteligente de Proveedores del sistema a Cuentas Contables Oficiales de CxP
 */
export function mapSupplierToPayableAccount(supplierOrRif) {
  const raw = typeof supplierOrRif === 'object' && supplierOrRif !== null
    ? `${supplierOrRif.rif || ''} ${supplierOrRif.provRif || ''} ${supplierOrRif.coProv || ''} ${supplierOrRif.provNombre || ''} ${supplierOrRif.prov_nombre || ''} ${supplierOrRif.nombre || ''}`.toUpperCase()
    : String(supplierOrRif || '').toUpperCase();

  if (raw.includes('31115365') || raw.includes('KEYTON') || raw.includes('KEYSTONE')) {
    return { codigo: '2.02.02.002', nombre: 'Cuentas por Pagar Keyton' };
  }
  if (raw.includes('KONTIGO') || raw.includes('USDC')) {
    return { codigo: '2.02.02.003', nombre: 'Cuentas por Pagar Kontigo' };
  }
  return { codigo: '2.02.02.001', nombre: 'Cuentas por Pagar Comerciales' };
}

/**
 * Mapeo inteligente de Movimientos de Caja Chica (Egresos / Ingresos) a Cuentas Contables Oficiales (Grupo 6 y 4)
 */
export function mapMovementToAccount(movement) {
  if (!movement) return { codigo: '6.01.09.004', nombre: 'Gastos Varios' };
  const desc = String(movement.concepto || movement.descripcion || movement.motivo || '').toUpperCase();
  const tipo = String(movement.tipo || 'EGRESO').toUpperCase();

  if (tipo === 'INGRESO') {
    if (desc.includes('TRASPASO') || desc.includes('TRANSFERENCIA')) {
      return { codigo: '1.01.01.003', nombre: 'Traspaso de Fondos' };
    }
    if (desc.includes('CAMBIO') || desc.includes('DIFERENCIAL') || desc.includes('GANANCIA')) {
      return { codigo: '4.02.01.001', nombre: 'Ganacia Cambiaria' };
    }
    return { codigo: '4.01.01.001', nombre: 'Ventas' };
  }

  // Egresos / Gastos Operativos (Grupo 6)
  if (desc.includes('SUELDO') || desc.includes('SALARIO') || desc.includes('NOMINA') || desc.includes('NÓMINA') || desc.includes('PAGO PERSONAL')) {
    return { codigo: '6.01.01.002', nombre: 'Sueldos y Salarios' };
  }
  if (desc.includes('BONO') || desc.includes('ALIMENT') || desc.includes('CESTA')) {
    return { codigo: '6.01.01.003', nombre: 'Bono Alimentación' };
  }
  if (desc.includes('SOBRETIEMPO') || desc.includes('HORA EXTRA') || desc.includes('HORAS EXTRA')) {
    return { codigo: '6.01.01.004', nombre: 'Sobretiempo' };
  }
  if (desc.includes('IGTF')) {
    return { codigo: '6.01.10.002', nombre: 'IGTF y Tributos Financieros (2%)' };
  }
  if (desc.includes('COMISION BANC') || desc.includes('COMISIÓN BANC') || desc.includes('GASTO BANC') || desc.includes('PUNTO DE VENTA')) {
    return { codigo: '6.01.10.001', nombre: 'Comisiones y Gastos Bancarios' };
  }
  if (desc.includes('INTERES BANC') || desc.includes('INTERÉS BANC') || desc.includes('RECARGO FINANC')) {
    return { codigo: '6.01.10.003', nombre: 'Intereses y Recargos Financieros' };
  }
  if (desc.includes('MULTA') || desc.includes('SANCION') || desc.includes('SANCIÓN')) {
    return { codigo: '6.01.10.004', nombre: 'Multas y Sanciones Fiscales' };
  }
  if (desc.includes('COMISION') || desc.includes('COMISIÓN')) {
    return { codigo: '6.01.01.011', nombre: 'Comisiones Vendedores' };
  }
  if (desc.includes('LUZ') || desc.includes('CORPOELEC') || desc.includes('ELECTRIC') || desc.includes('ASEO URBANO')) {
    return { codigo: '6.01.02.001', nombre: 'Electricidad y Aseo Urbano' };
  }
  if (desc.includes('TELEF') || desc.includes('CELULAR') || desc.includes('MOVISTAR') || desc.includes('DIGITEL') || desc.includes('CANTV')) {
    return { codigo: '6.01.02.002', nombre: 'Teléfono Celular' };
  }
  if (desc.includes('AGUA') || desc.includes('HIDRO')) {
    return { codigo: '6.01.02.003', nombre: 'Servicio de Agua' };
  }
  if (desc.includes('GAS')) {
    return { codigo: '6.01.02.004', nombre: 'Servicio de Gas y Aseo' };
  }
  if (desc.includes('PAPEL') || desc.includes('LIBRERIA') || desc.includes('OFICINA') || desc.includes('COPIA') || desc.includes('IMPRESION') || desc.includes('IMPRESIÓN')) {
    return { codigo: '6.01.03.001', nombre: 'Papelería y Art. de Oficina' };
  }
  if (desc.includes('COMPUT') || desc.includes('SISTEMA') || desc.includes('TONER') || desc.includes('TÓNER') || desc.includes('INTERNET')) {
    return { codigo: '6.01.03.002', nombre: 'Gastos de Computación' };
  }
  if (desc.includes('GASOLINA') || desc.includes('COMBUSTIBLE') || desc.includes('DIESEL') || desc.includes('GASOIL')) {
    return { codigo: '6.01.04.007', nombre: 'Combustibles y Lubricantes' };
  }
  if (desc.includes('VEHIC') || desc.includes('CAMION') || desc.includes('CAMIÓN') || desc.includes('MOTO') || desc.includes('REPUESTO') || desc.includes('CAUCH')) {
    return { codigo: '6.01.04.001', nombre: 'Mantenimiento de Vehículos' };
  }
  if (desc.includes('LIMPIEZA') || desc.includes('ASEO') || desc.includes('DETERGENTE') || desc.includes('JABON') || desc.includes('JABÓN')) {
    return { codigo: '6.01.04.004', nombre: 'Suministros de Aseo y Limpieza' };
  }
  if (desc.includes('MANTENIMIENTO') || desc.includes('REPARAC') || desc.includes('PINTURA')) {
    return { codigo: '6.01.04.002', nombre: 'Mantenimiento de Instalaciones' };
  }
  if (desc.includes('FERRETERIA') || desc.includes('FERRETERÍA') || desc.includes('TORNILL') || desc.includes('CABLE')) {
    return { codigo: '6.01.04.006', nombre: 'Ferretería' };
  }
  if (desc.includes('PUBLICIDAD') || desc.includes('MARKETING') || desc.includes('REDES') || desc.includes('VOLANTE') || desc.includes('PENDON')) {
    return { codigo: '6.01.05.001', nombre: 'Publicidad y Mercadeo' };
  }
  if (desc.includes('UNIFORME') || desc.includes('BRAGA') || desc.includes('CAMISA')) {
    return { codigo: '6.01.06.001', nombre: 'Uniformes' };
  }
  if (desc.includes('HONORARIO') || desc.includes('CONTADOR') || desc.includes('ABOGADO') || desc.includes('ASESOR') || desc.includes('AUDITOR')) {
    return { codigo: '6.01.07.001', nombre: 'Honorarios Profesionales' };
  }
  if (desc.includes('TRAMITE') || desc.includes('TRÁMITE') || desc.includes('DOCUMENT') || desc.includes('NOTARIA') || desc.includes('NOTARÍA') || desc.includes('REGISTRO')) {
    return { codigo: '6.01.07.003', nombre: 'Tramites y Documentación' };
  }
  if (desc.includes('ALQUILER') || desc.includes('LOCAL') || desc.includes('GALPON') || desc.includes('GALPÓN')) {
    return { codigo: '6.01.08.001', nombre: 'Alquiler' };
  }
  if (desc.includes('CONDOMINIO')) {
    return { codigo: '6.01.08.002', nombre: 'Condominio' };
  }
  if (desc.includes('MEDICIN') || desc.includes('FARMACIA') || desc.includes('BOTIQUIN') || desc.includes('BOTIQUÍN') || desc.includes('MEDIC')) {
    return { codigo: '6.01.09.002', nombre: 'Medicinas y Gastos Médicos' };
  }

  return { codigo: '6.01.09.004', nombre: 'Gastos Varios' };
}

/**
 * Matriz Estructural Oficial de Módulos del Sistema Pro Motorven C.A. (Marco BA VEN-NIF 2)
 * Clasifica los 17 módulos del ERP en:
 * 1) SÍNTESIS EJECUTIVA (Consolidado Grupos 1 al 6)
 * 2) CUENTAS REALES (Balance General / Situación Financiera: Activos, Pasivos, Patrimonio — Saldos acumulativos)
 * 3) CUENTAS NOMINALES (Estado de Resultados / Ganancias y Pérdidas: Ingresos, Costos, Egresos — Cierran al 31/12)
 * 4) MÓDULOS ESTRUCTURALES (Pre-Asiento Comercial, Control Tributario SENIAT y Gobierno / Control Interno)
 */
export const STRUCTURAL_MODULES_VEN_NIF = [
  // =========================================================================
  // I. DIRECCIÓN & SÍNTESIS FINANCIERA (ESTRUCTURAL EJECUTIVO)
  // =========================================================================
  {
    orden: 1,
    id: 'dashboard',
    modulo: 'Dashboard Ejecutivo',
    bloqueId: 'ESTRUCTURAL',
    bloqueContable: 'MÓDULOS ESTRUCTURALES',
    estadoFinanciero: 'Síntesis Consolidada (Balance General + Est. Resultados)',
    seccionMenu: 'DIRECCIÓN & SÍNTESIS FINANCIERA',
    subgrupo: 'Síntesis Ejecutiva (Grupos 1 al 6)',
    naturaleza: 'MIXTA (DEUDORA / ACREEDORA)',
    reglaPartidaDoble: 'Consolida Activo = Pasivo + Patrimonio + Resultado',
    cierraAl31Dic: 'Mixto (Reales acumulan / Nominales cierran)',
    badgeCorto: 'GRUPOS 1–6',
    colorTag: '#38bdf8',
    rubroVenNif: 'Consolidado General de Estados Financieros (buildFinancialStatements)',
    codigosPrincipales: ['1.01.01.002', '1.01.03.001', '1.04.01.001', '2.02.02.001', '3.02.01.001', '4.01.01.001'],
    codigosResumen: 'Grupos 1, 2, 3 (Reales) y 4, 5, 6 (Nominales)',
    funcionContableAdministrativa:
      'Presenta a la Junta Directiva y Gerencia la foto patrimonial acumulada (Cuentas Reales) y la película operativa del ejercicio (Cuentas Nominales) en doble moneda (USD y Bs).'
  },

  // =========================================================================
  // II. CUENTAS REALES (ESTADO DE SITUACIÓN FINANCIERA / BALANCE GENERAL)
  // =========================================================================
  {
    orden: 2,
    id: 'caja',
    modulo: 'Caja Chica & Bancos',
    bloqueId: 'CUENTAS_REALES',
    bloqueContable: 'CUENTAS REALES (BALANCE GENERAL)',
    estadoFinanciero: 'Balance General — 1. Activo Corriente',
    seccionMenu: 'CUENTAS REALES • BALANCE GENERAL',
    subgrupo: '1. ACTIVO — Efectivo y Equivalentes',
    naturaleza: 'DEUDORA',
    reglaPartidaDoble: 'Aumenta por el DEBE (+) / Disminuye por el HABER (-)',
    cierraAl31Dic: 'No (Saldo acumulativo)',
    badgeCorto: '1.01 ACTIVO',
    colorTag: '#10b981',
    rubroVenNif: 'Efectivo y Equivalentes (Caja principal, chica, Zelle y bancos nacionales)',
    codigosPrincipales: ['1.01.01.001', '1.01.01.002', '1.01.01.003', '1.01.01.004', '1.01.02.001', '1.01.02.002', '1.01.02.003'],
    codigosResumen: '1.01.01.001–004 Cajas/Zelle | 1.01.02.001–008 Bancos (originan 6.01.* en egresos)',
    funcionContableAdministrativa:
      'Administra la disponibilidad y tesorería. resolveCashAccount() y resolveBankAccount() dirigen cobros POS/Cobranzas al DEBE y pagos a proveedores o egresos de caja chica al HABER.'
  },
  {
    orden: 3,
    id: 'cxc',
    modulo: 'Cuentas por Cobrar (CxC)',
    bloqueId: 'CUENTAS_REALES',
    bloqueContable: 'CUENTAS REALES (BALANCE GENERAL)',
    estadoFinanciero: 'Balance General — 1. Activo Exigible',
    seccionMenu: 'CUENTAS REALES • BALANCE GENERAL',
    subgrupo: '1. ACTIVO — Cuentas y Efectos por Cobrar',
    naturaleza: 'DEUDORA',
    reglaPartidaDoble: 'Aumenta por el DEBE (+) / Disminuye por el HABER (-)',
    cierraAl31Dic: 'No (Saldo acumulativo)',
    badgeCorto: '1.01.03 ACTIVO',
    colorTag: '#10b981',
    rubroVenNif: 'Cuentas y Efectos por Cobrar (Clientes, anticipos a proveedores, empleados y socios)',
    codigosPrincipales: ['1.01.03.001', '1.01.03.002', '1.02.01.001', '1.03.01.001', '1.03.01.003'],
    codigosResumen: '1.01.03.001 CxC Comerciales | 1.01.03.002 Prov. Incobrables | 1.02.01.001 Anticipo Prov. | 1.03.01.*',
    funcionContableAdministrativa:
      'Controla la cartera exigible. Al emitir factura a crédito (profitInvoices) se carga el total al DEBE de 1.01.03.001; cuando el cliente abona (profitCollections), se acredita al HABER permutando deuda por liquidez.'
  },
  {
    orden: 4,
    id: 'inventario',
    modulo: 'Inventario de Lubricantes',
    bloqueId: 'CUENTAS_REALES',
    bloqueContable: 'CUENTAS REALES (BALANCE GENERAL)',
    estadoFinanciero: 'Balance General — 1. Activo Realizable',
    seccionMenu: 'CUENTAS REALES • BALANCE GENERAL',
    subgrupo: '1. ACTIVO — Inventarios de Mercancía',
    naturaleza: 'DEUDORA',
    reglaPartidaDoble: 'Aumenta por el DEBE (+) / Disminuye por el HABER (-)',
    cierraAl31Dic: 'No (Saldo acumulativo)',
    badgeCorto: '1.04 ACTIVO',
    colorTag: '#10b981',
    rubroVenNif: 'Inventarios (Mercancía disponible para la venta en Almacén 01 y Almacén 02)',
    codigosPrincipales: ['1.04.01.001'],
    codigosResumen: '1.04.01.001 Inventario de Mercancía',
    funcionContableAdministrativa:
      'Resguarda el activo realizable. Como comercializadora, al registrar compras (profitPurchases) la base imponible sin IVA entra al DEBE de 1.04.01.001 (cambia dinero/deuda por activo, no es gasto inmediato).'
  },
  {
    orden: 5,
    id: 'compras',
    modulo: 'Compras & Proveedores',
    bloqueId: 'CUENTAS_REALES',
    bloqueContable: 'CUENTAS REALES (BALANCE GENERAL)',
    estadoFinanciero: 'Balance General — 2. Pasivo Comercial & 1.04/1.05 Activo',
    seccionMenu: 'CUENTAS REALES • BALANCE GENERAL',
    subgrupo: '2. PASIVO — Procura y Obligación con Proveedores',
    naturaleza: 'ACREEDORA',
    reglaPartidaDoble: 'Pasivo aumenta por el HABER (+) / Activo Inventario e IVA por el DEBE (+)',
    cierraAl31Dic: 'No (Saldo acumulativo)',
    badgeCorto: '2.02 / 1.04 REAL',
    colorTag: '#f59e0b',
    rubroVenNif: 'Recepción de Compras, Crédito Fiscal IVA y Cuentas por Pagar Proveedores',
    codigosPrincipales: ['2.02.02.001', '2.02.02.002', '2.02.02.003', '1.04.01.001', '1.05.01.005', '2.03.01.006'],
    codigosResumen: 'Debe: 1.04.01.001 Inventario + 1.05.01.005 Créd. Fiscal | Haber: 2.02.02.* CxP + 2.03.01.006 Ret. ISLR',
    funcionContableAdministrativa:
      'Origina el pasivo con proveedores (resolveSupplierPayableAccount() al HABER) y simultáneamente incorpora el activo de inventario y el Crédito Fiscal IVA soportado frente al SENIAT.'
  },
  {
    orden: 6,
    id: 'cxp',
    modulo: 'Cuentas por Pagar (CxP)',
    bloqueId: 'CUENTAS_REALES',
    bloqueContable: 'CUENTAS REALES (BALANCE GENERAL)',
    estadoFinanciero: 'Balance General — 2. Pasivo Corriente Comercial',
    seccionMenu: 'CUENTAS REALES • BALANCE GENERAL',
    subgrupo: '2. PASIVO — Cuentas y Efectos por Pagar',
    naturaleza: 'ACREEDORA',
    reglaPartidaDoble: 'Aumenta por el HABER (+) / Disminuye por el DEBE (-)',
    cierraAl31Dic: 'No (Saldo acumulativo)',
    badgeCorto: '2.02.02 PASIVO',
    colorTag: '#ef4444',
    rubroVenNif: 'Cuentas y Efectos por Pagar (Proveedores Comerciales, Keyton, Kontigo y Anticipo Clientes)',
    codigosPrincipales: ['2.02.02.001', '2.02.02.002', '2.02.02.003', '2.02.01.001', '2.06.01.001'],
    codigosResumen: '2.02.02.001–003 CxP Comerciales / Keyton / Kontigo | 2.06.01.001 Anticipo Clientes',
    funcionContableAdministrativa:
      'Gestiona el pasivo exigible a favor de proveedores. Se abona al HABER en la compra y se carga al DEBE al emitir el pago (profitSupplierPayments) contra Banco o Caja.'
  },
  {
    orden: 7,
    id: 'pasivos',
    modulo: 'Cuentas de Pasivo',
    bloqueId: 'CUENTAS_REALES',
    bloqueContable: 'CUENTAS REALES (BALANCE GENERAL)',
    estadoFinanciero: 'Balance General — 2. Pasivo Socios, Laboral y Parafiscal',
    seccionMenu: 'CUENTAS REALES • BALANCE GENERAL',
    subgrupo: '2. PASIVO — Obligaciones Accionistas, Laborales y Legales',
    naturaleza: 'ACREEDORA',
    reglaPartidaDoble: 'Aumenta por el HABER (+) / Disminuye por el DEBE (-)',
    cierraAl31Dic: 'No (Saldo acumulativo)',
    badgeCorto: '2.01–2.06 PASIVO',
    colorTag: '#ef4444',
    rubroVenNif: 'Cuentas por Pagar Accionistas, Obligaciones Parafiscales, Laborales y Pasivo No Corriente',
    codigosPrincipales: ['2.02.01.001', '2.02.01.002', '2.03.01.001', '2.03.01.002', '2.04.01.001', '2.04.01.002'],
    codigosResumen: '2.02.01.* CxP/Aporte Socio | 2.03.01.001–004 INCE/SSO/LPH | 2.04.01.* Antigüedad y Vacaciones',
    funcionContableAdministrativa:
      'Controla las deudas con socios (reembolsos por pagos asumidos), apartados de prestaciones sociales/vacaciones y pasivos parafiscales o bancarios.'
  },
  {
    orden: 8,
    id: 'auditoria',
    modulo: 'Auditoría & Contable',
    bloqueId: 'CUENTAS_REALES',
    bloqueContable: 'CUENTAS REALES (BALANCE GENERAL)',
    estadoFinanciero: 'Balance General — 3. Patrimonio, 1.06 Activo Fijo & Cierre',
    seccionMenu: 'CUENTAS REALES • BALANCE GENERAL',
    subgrupo: '3. PATRIMONIO & 1.06 PROPIEDAD, PLANTA Y EQUIPO',
    naturaleza: 'ACREEDORA* (Patrimonio) / DEUDORA (Activo Fijo)',
    reglaPartidaDoble: 'Patrimonio aumenta por HABER (+) / Déficit 3.02.02 y Activo Fijo 1.06.01 son Deudoras',
    cierraAl31Dic: 'No (Recibe el resultado del ejercicio en 3.02)',
    badgeCorto: '3. PATRIMONIO',
    colorTag: '#a855f7',
    rubroVenNif: 'Patrimonio Neto, Propiedad Planta y Equipo, Libro Diario, Mayor y Cierre Automático',
    codigosPrincipales: ['3.01.01.002', '3.01.02.001', '3.02.01.001', '3.02.02.001', '1.06.01.001', '1.06.02.001'],
    codigosResumen: '3.01 Capital/Reserva | 3.02 Superávit/Déficit | 1.06.01–03 Activo Fijo y Deprec. Acumulada',
    funcionContableAdministrativa:
      'Núcleo contable (AuditLedgerView.jsx): ejecuta el cierre automático conectando Ingresos - Costos - Egresos a 3.02 Superávit/Déficit y verifica la ecuación Activo = Pasivo + Patrimonio.'
  },

  // =========================================================================
  // III. CUENTAS NOMINALES (ESTADO DE RESULTADOS / GANANCIAS Y PÉRDIDAS)
  // =========================================================================
  {
    orden: 9,
    id: 'ventas',
    modulo: 'Ventas & POS Mostrador',
    bloqueId: 'CUENTAS_NOMINALES',
    bloqueContable: 'CUENTAS NOMINALES (ESTADO DE RESULTADOS)',
    estadoFinanciero: 'Estado de Resultados — 4. Ingresos Operacionales',
    seccionMenu: 'CUENTAS NOMINALES • RESULTADOS',
    subgrupo: '4. INGRESOS — Ventas Brutas, Descuentos y Devoluciones',
    naturaleza: 'ACREEDORA* (Rectificadoras 4.01.02 son Deudoras)',
    reglaPartidaDoble: 'Ventas aumenta por el HABER (+) / Descuentos y Devoluciones por el DEBE (+)',
    cierraAl31Dic: 'Sí (Cierra al 31/12 contra Resultado 3.02)',
    badgeCorto: '4. INGRESOS',
    colorTag: '#3b82f6',
    rubroVenNif: 'Ingresos Operacionales por Venta de Lubricantes y Ganancia Cambiaria',
    codigosPrincipales: ['4.01.01.001', '4.01.02.001', '4.01.02.002', '4.02.01.001', '2.03.01.005'],
    codigosResumen: '4.01.01.001 Ventas | 4.01.02.001–002 Descuentos/Devoluciones (Deudoras) | 4.02.01.001 Dif. Cambiario',
    funcionContableAdministrativa:
      'Reconoce el ingreso operativo en el Estado de Resultados abonando la base imponible sin IVA al HABER de 4.01.01.001, el IVA a 2.03.01.005 Débito Fiscal y el total al DEBE de Caja o CxC.'
  },
  {
    orden: 10,
    id: 'rentabilidad',
    modulo: 'Rentabilidad & BI',
    bloqueId: 'CUENTAS_NOMINALES',
    bloqueContable: 'CUENTAS NOMINALES (ESTADO DE RESULTADOS)',
    estadoFinanciero: 'Estado de Resultados — 5. Costos de Ventas & Márgenes',
    seccionMenu: 'CUENTAS NOMINALES • RESULTADOS',
    subgrupo: '5. COSTOS — Costo de Venta y Servicios (Kardex vs Ingresos)',
    naturaleza: 'DEUDORA',
    reglaPartidaDoble: 'Aumenta por el DEBE (+) / Disminuye por el HABER (-)',
    cierraAl31Dic: 'Sí (Cierra al 31/12 contra Resultado 3.02)',
    badgeCorto: '5. COSTOS & BI',
    colorTag: '#8b5cf6',
    rubroVenNif: 'Costos de Ventas de Mercancía Vendida, Costos por Servicios y Utilidad Bruta',
    codigosPrincipales: ['5.01.01.001', '5.01.01.002', '1.04.01.001', '4.01.01.001'],
    codigosResumen: '5.01.01.001 Costo de Venta | 5.01.01.002 Costos por Servicios (cruza 4.01 vs 1.04 Kardex)',
    funcionContableAdministrativa:
      'Determina la Utilidad Bruta (Grupo 4 - Grupo 5). Según nota técnica del PDF, monitorea el costo vía Kardex/Rentabilidad mientras se concilia la descarga de 1.04.01.001 contra 5.01.01.001.'
  },
  {
    orden: 11,
    id: 'vendedores',
    modulo: 'Fuerza de Ventas',
    bloqueId: 'CUENTAS_NOMINALES',
    bloqueContable: 'CUENTAS NOMINALES (ESTADO DE RESULTADOS)',
    estadoFinanciero: 'Estado de Resultados — 6. Egresos / Gastos Comerciales',
    seccionMenu: 'CUENTAS NOMINALES • RESULTADOS',
    subgrupo: '6. EGRESOS — Comisiones de Vendedores y Nómina Comercial',
    naturaleza: 'DEUDORA',
    reglaPartidaDoble: 'Aumenta por el DEBE (+) / Disminuye por el HABER (-)',
    cierraAl31Dic: 'Sí (Cierra al 31/12 contra Resultado 3.02)',
    badgeCorto: '6. EGRESOS',
    colorTag: '#ec4899',
    rubroVenNif: 'Gastos Operativos de Nómina, Comisiones de Vendedores y Desempeño Comercial',
    codigosPrincipales: ['6.01.01.011', '6.01.01.012', '6.01.01.002', '6.01.05.001'],
    codigosResumen: '6.01.01.011 Comisiones Vendedores | 6.01.01.012 Comisiones Oficina | 6.01.01.001–013 Nómina',
    funcionContableAdministrativa:
      'Liquida comisiones e incentivos sobre ventas y cobranzas que se imputan al DEBE del Grupo 6 (6.01.01.011), reduciendo la utilidad operativa del período.'
  },

  // =========================================================================
  // IV. MÓDULOS ESTRUCTURALES (PRE-ASIENTO, TRIBUTARIO SENIAT & GOBIERNO)
  // =========================================================================
  {
    orden: 12,
    id: 'preventa',
    modulo: 'Preventa Móvil (Vendedor)',
    bloqueId: 'ESTRUCTURAL',
    bloqueContable: 'MÓDULOS ESTRUCTURALES',
    estadoFinanciero: 'Flujo Pre-Contable (Origen Comercial de Ingresos)',
    seccionMenu: 'ESTRUCTURALES • OPERACIÓN, FISCAL & GOBIERNO',
    subgrupo: 'Operación Pre-Asiento — Captura de Pedidos en Calle',
    naturaleza: 'PRE-CONTABLE (Sin asiento hasta facturar)',
    reglaPartidaDoble: 'No imputa Nivel 4 hasta convertirse en Factura (profitInvoices)',
    cierraAl31Dic: 'No aplica (Documento comercial previo)',
    badgeCorto: 'PRE-ASIENTO',
    colorTag: '#06b6d4',
    rubroVenNif: 'Captura de Pedidos y Reserva Comercial (Prepara asientos en 4.01.01.001 y 1.01.03.001)',
    codigosPrincipales: ['4.01.01.001', '1.01.03.001', '1.04.01.001'],
    codigosResumen: 'Sin asiento directo → Prepara facturación hacia 4.01.01.001 Ventas y 1.01.03.001 CxC',
    funcionContableAdministrativa:
      'Separa administrativamente la toma de pedido del vendedor en ruta del devengo contable y fiscal, evitando reconocer ingresos antes del despacho y facturación.'
  },
  {
    orden: 13,
    id: 'pedidos',
    modulo: 'Flujo Comercial & Pedidos',
    bloqueId: 'ESTRUCTURAL',
    bloqueContable: 'MÓDULOS ESTRUCTURALES',
    estadoFinanciero: 'Flujo Pre-Contable (Control de Crédito y Despacho)',
    seccionMenu: 'ESTRUCTURALES • OPERACIÓN, FISCAL & GOBIERNO',
    subgrupo: 'Operación Pre-Asiento — Pipeline, Aprobación y Despacho',
    naturaleza: 'PRE-CONTABLE (Puente Operativo-Contable)',
    reglaPartidaDoble: 'Autoriza el paso del pedido hacia el asiento de Venta / Caja / CxC',
    cierraAl31Dic: 'No aplica (Control de flujo comercial)',
    badgeCorto: 'FLUJO / CONTROL',
    colorTag: '#06b6d4',
    rubroVenNif: 'Validación de Stock Realizable (1.04) y Solvencia Exigible (1.01.03) previo a Facturar',
    codigosPrincipales: ['1.04.01.001', '1.01.03.001', '4.01.01.001'],
    codigosResumen: 'Valida 1.04.01.001 Stock y límite en 1.01.03.001 CxC antes de disparar profitInvoices',
    funcionContableAdministrativa:
      'Aplica el control interno preventivo: verifica existencia física en almacén y solvencia crediticia antes de emitir el documento fiscal que genera el asiento en el Libro Diario.'
  },
  {
    orden: 14,
    id: 'reportes',
    modulo: 'Libros Fiscales SENIAT',
    bloqueId: 'ESTRUCTURAL',
    bloqueContable: 'MÓDULOS ESTRUCTURALES',
    estadoFinanciero: 'Conciliación Tributaria (Activo Fiscal 1.05 vs Pasivo Fiscal 2.03)',
    seccionMenu: 'ESTRUCTURALES • OPERACIÓN, FISCAL & GOBIERNO',
    subgrupo: 'Cumplimiento Tributario — IVA, ISLR y Reportes X/Z',
    naturaleza: 'MIXTA FISCAL (1.05 Deudora vs 2.03 Acreedora)',
    reglaPartidaDoble: 'Compensa 1.05.01.005 Crédito Fiscal (Debe) contra 2.03.01.005 Débito Fiscal (Haber)',
    cierraAl31Dic: 'Declaración quincenal/mensual ante el SENIAT',
    badgeCorto: 'SENIAT 1.05/2.03',
    colorTag: '#eab308',
    rubroVenNif: 'Tributos y Pagos Anticipados (1.05.01) vs Obligaciones Tributarias por Enterar (2.03.01)',
    codigosPrincipales: ['1.05.01.004', '1.05.01.005', '1.05.01.006', '1.05.01.007', '1.05.01.008', '2.03.01.005', '2.03.01.006'],
    codigosResumen: 'Activo: 1.05.01.005 Créd. Fiscal, .007 Ret. IVA, .008 Ret. ISLR | Pasivo: 2.03.01.005 Déb. Fiscal, .006 Ret. ISLR Prov.',
    funcionContableAdministrativa:
      'Emite los Libros Legales de Compras y Ventas SENIAT, determina la cuota tributaria de IVA (Débito Fiscal menos Crédito Fiscal y retenciones) y audita retenciones de ISLR.'
  },
  {
    orden: 15,
    id: 'usuarios',
    modulo: 'Gestión de Usuarios',
    bloqueId: 'ESTRUCTURAL',
    bloqueContable: 'MÓDULOS ESTRUCTURALES',
    estadoFinanciero: 'Control Interno y Segregación de Funciones (COSO / VEN-NIF)',
    seccionMenu: 'ESTRUCTURALES • OPERACIÓN, FISCAL & GOBIERNO',
    subgrupo: 'Gobierno Corporativo — Roles, Jerarquía y Permisos RBAC',
    naturaleza: 'ESTRUCTURAL / CONTROL INTERNO',
    reglaPartidaDoble: 'Restringe qué operador puede originar, modificar o anular asientos y documentos',
    cierraAl31Dic: 'Permanente (Seguridad y trazabilidad de autoría)',
    badgeCorto: 'CONTROL RBAC',
    colorTag: '#94a3b8',
    rubroVenNif: 'Segregación de Funciones y Firma de Operador en Asientos (entry.usuario / pistas)',
    codigosPrincipales: [],
    codigosResumen: 'Transversal a los 6 Grupos Contables (control de acceso por rol y bitácora forense)',
    funcionContableAdministrativa:
      'Garantiza el principio contable de control interno y segregación de funciones: separa los perfiles de Ventas, Almacén, Caja, Cobranza, Compras y Administración.'
  },
  {
    orden: 16,
    id: 'notificaciones',
    modulo: 'Notificaciones & Alertas',
    bloqueId: 'ESTRUCTURAL',
    bloqueContable: 'MÓDULOS ESTRUCTURALES',
    estadoFinanciero: 'Supervisión Preventiva de Riesgo Financiero y Operativo',
    seccionMenu: 'ESTRUCTURALES • OPERACIÓN, FISCAL & GOBIERNO',
    subgrupo: 'Gobierno Corporativo — Alertas de Mora, Stock y Vencimientos',
    naturaleza: 'ESTRUCTURAL / AUDITORÍA PREVENTIVA',
    reglaPartidaDoble: 'Monitorea saldos críticos en CxC (1.01.03), Inventario (1.04) y CxP (2.02)',
    cierraAl31Dic: 'Monitoreo continuo en tiempo real',
    badgeCorto: 'ALERTAS / RIESGO',
    colorTag: '#94a3b8',
    rubroVenNif: 'Vigilancia de Riesgo de Crédito, Ruptura de Inventario y Compromisos por Vencer',
    codigosPrincipales: ['1.01.03.001', '1.04.01.001', '2.02.02.001'],
    codigosResumen: 'Supervisión transversal sobre 1.01.03.001 CxC Vencidas, 1.04.01.001 Stock Mínimo y 2.02.02.* CxP',
    funcionContableAdministrativa:
      'Actúa como sistema de alerta temprana para el Administrador y Contador ante facturas vencidas, stock crítico o solicitudes pendientes de aprobación.'
  },
  {
    orden: 17,
    id: 'configuracion',
    modulo: 'Configuración General',
    bloqueId: 'ESTRUCTURAL',
    bloqueContable: 'MÓDULOS ESTRUCTURALES',
    estadoFinanciero: 'Parametrización Bimoneda (USD/Bs), Tasas BCV y Reglas Fiscales',
    seccionMenu: 'ESTRUCTURALES • OPERACIÓN, FISCAL & GOBIERNO',
    subgrupo: 'Gobierno Corporativo — Parámetros Base del Motor Contable',
    naturaleza: 'ESTRUCTURAL / PARAMETRIZACIÓN',
    reglaPartidaDoble: 'Define la tasa oficial de conversión USD ↔ Bs para cada línea de asiento',
    cierraAl31Dic: 'Permanente (Base normativa del sistema)',
    badgeCorto: 'PARÁMETROS',
    colorTag: '#94a3b8',
    rubroVenNif: 'Parámetros Institucionales RIF J-50780548-4, Alícuota IVA, IGTF y Tasa de Cambio BCV',
    codigosPrincipales: [],
    codigosResumen: 'Gobierna PLAN_DE_CUENTAS_MOTORVEN (4 niveles) y conversión bimoneda en accountingService.js',
    funcionContableAdministrativa:
      'Establece las variables maestras (tasa BCV/Euro, datos fiscales SENIAT y correlativos) con las que el motor contable calcula los importes en USD y Bs de toda la contabilidad.'
  }
];

