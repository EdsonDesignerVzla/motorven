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

  { codigo: '1.02.', nombre: 'ANTICIPOS', nivel: 2, imputable: false, naturaleza: 'DEUDORA', grupo: 'ACTIVO' },
  { codigo: '1.02.01.', nombre: 'ANTICIPO PROVEEDORES', nivel: 3, imputable: false, naturaleza: 'DEUDORA', grupo: 'ACTIVO' },
  { codigo: '1.02.01.001', nombre: 'Anticipo Proveedores', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'ACTIVO', subgrupo: 'EXIGIBLE' },

  { codigo: '1.03.', nombre: 'OTROS ACTIVOS', nivel: 2, imputable: false, naturaleza: 'DEUDORA', grupo: 'ACTIVO' },
  { codigo: '1.03.01.', nombre: 'OTROS ACTIVOS FINANCIEROS', nivel: 3, imputable: false, naturaleza: 'DEUDORA', grupo: 'ACTIVO' },
  { codigo: '1.03.01.001', nombre: 'Cuentas por Cobrar Empleados', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'ACTIVO', subgrupo: 'EXIGIBLE' },
  { codigo: '1.03.01.002', nombre: 'Otras Cuentas por Cobrar', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'ACTIVO', subgrupo: 'EXIGIBLE' },
  { codigo: '1.03.01.003', nombre: 'Cuentas por Cobrar Socio', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'ACTIVO', subgrupo: 'EXIGIBLE' },
  { codigo: '1.03.01.004', nombre: 'Cuentas por Cobrar Intercompañías', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'ACTIVO', subgrupo: 'EXIGIBLE' },
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
  { codigo: '6.01.09.004', nombre: 'Gastos Varios', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'EGRESOS', subgrupo: 'MISCELANEOS' }
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
