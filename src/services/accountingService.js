/**
 * Motor Contable Oficial — Plan de Cuentas Pro Motorven C.A.
 * Sincronizado con BA VEN-NIF 2 (Estado de Resultados Integral + Balance General),
 * Mayor General Analítico y Balance de Comprobación de Sumas y Saldos.
 */

export const CHART_OF_ACCOUNTS = [
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
  { codigo: '5.', nombre: 'COSTOS', nivel: 1, imputable: false, naturaleza: 'DEUDORA', grupo: 'COSTOS' },
  { codigo: '5.01.', nombre: 'COSTOS DE VENTAS', nivel: 2, imputable: false, naturaleza: 'DEUDORA', grupo: 'COSTOS' },
  { codigo: '5.01.01.', nombre: 'COSTO DE PRODUCTOS', nivel: 3, imputable: false, naturaleza: 'DEUDORA', grupo: 'COSTOS' },
  { codigo: '5.01.01.001', nombre: 'Costo de Venta', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'COSTOS', subgrupo: 'COSTO_MERCANCIA' },
  { codigo: '5.01.01.002', nombre: 'Costos por Servicios', nivel: 4, imputable: true, naturaleza: 'DEUDORA', grupo: 'COSTOS', subgrupo: 'COSTO_SERVICIOS' },
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
];

export const CHART_OF_ACCOUNTS_MAP = CHART_OF_ACCOUNTS.reduce((acc, item) => {
  acc[item.codigo] = item;
  return acc;
}, {});

const round2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export function resolveCashAccount(desk) {
  if (!desk) return { codigo: '1.01.01.002', nombre: 'Caja Divisas' };
  const idUpper = String(desk.id || desk.coCaja || desk.descripcion || '').toUpperCase();
  const moneda = String(desk.moneda || '').toUpperCase();
  if (idUpper.includes('ZELLE') || idUpper.includes('04')) {
    return { codigo: '1.01.01.004', nombre: 'Zelle' };
  }
  if (moneda === 'BS' || idUpper.includes('NACIONAL') || idUpper.includes('BS') || idUpper.includes('03')) {
    return { codigo: '1.01.01.001', nombre: 'Caja Moneda Nacional' };
  }
  return { codigo: '1.01.01.002', nombre: 'Caja Divisas' };
}

export function resolveBankAccount(bankAccount) {
  if (!bankAccount) return { codigo: '1.01.02.001', nombre: 'Banco de Venezuela' };
  const id = String(bankAccount.id || bankAccount.codCta || '').trim();
  const numCta = String(bankAccount.numCta || bankAccount.num_cta || bankAccount.nroCta || '').trim();
  const bankName = String(bankAccount.bancoNombre || bankAccount.banco_nombre || bankAccount.banco || bankAccount.desBan || '').toUpperCase();

  if (numCta.endsWith('9275') || id === 'CTA-02') return { codigo: '1.01.02.003', nombre: 'Banco Plaza (275)' };
  if (numCta.endsWith('1694') || id === 'CTA-04') return { codigo: '1.01.02.004', nombre: 'Banco Plaza (694)' };
  if (numCta.endsWith('0378') || id === 'CTA-07' || bankName.includes('ACTIVO FISCAL')) {
    return { codigo: '1.01.02.008', nombre: 'Banco Activo (0378)' };
  }
  if (numCta.startsWith('0102') || bankName.includes('VENEZUELA') || id === 'CTA-03') {
    return { codigo: '1.01.02.001', nombre: 'Banco de Venezuela' };
  }
  if (numCta.startsWith('0105') || bankName.includes('MERCANTIL') || id === 'CTA-01') {
    return { codigo: '1.01.02.002', nombre: 'Banco Mercantil' };
  }
  if (numCta.startsWith('0114') || bankName.includes('BANCARIBE') || id === 'CTA-05' || id === 'CTA-09') {
    return { codigo: '1.01.02.005', nombre: 'Bancaribe' };
  }
  if (numCta.startsWith('0171') || bankName.includes('ACTIVO') || id === 'CTA-06') {
    return { codigo: '1.01.02.006', nombre: 'Banco Activo' };
  }
  if (numCta.startsWith('0172') || bankName.includes('BANCAMIGA') || id === 'CTA-08' || id === 'CTA-10') {
    return { codigo: '1.01.02.007', nombre: 'Bancamiga' };
  }
  return { codigo: '1.01.02.001', nombre: 'Banco de Venezuela' };
}

export function resolveSupplierPayableAccount(supplierOrDoc) {
  const haystack = typeof supplierOrDoc === 'object' && supplierOrDoc
    ? `${supplierOrDoc.rif || ''} ${supplierOrDoc.provRif || ''} ${supplierOrDoc.coProv || ''} ${supplierOrDoc.provNombre || ''} ${supplierOrDoc.prov_nombre || ''} ${supplierOrDoc.nombre || ''}`.toUpperCase()
    : String(supplierOrDoc || '').toUpperCase();

  if (haystack.includes('31115365') || haystack.includes('KEYTON') || haystack.includes('KEYSTONE')) {
    return { codigo: '2.02.02.002', nombre: 'Cuentas por Pagar Keyton' };
  }
  if (haystack.includes('KONTIGO') || haystack.includes('USDC')) {
    return { codigo: '2.02.02.003', nombre: 'Cuentas por Pagar Kontigo' };
  }
  return { codigo: '2.02.02.001', nombre: 'Cuentas por Pagar Comerciales' };
}

export function resolveCashMovementAccount(movement) {
  if (!movement) return { codigo: '6.01.09.004', nombre: 'Gastos Varios' };
  const desc = String(movement.concepto || movement.descripcion || movement.motivo || '').toUpperCase();
  const tipo = String(movement.tipo || 'EGRESO').toUpperCase();

  if (tipo === 'INGRESO') {
    if (desc.includes('TRASPASO') || desc.includes('TRANSFERENCIA')) return { codigo: '1.01.01.003', nombre: 'Traspaso de Fondos' };
    if (desc.includes('CAMBIO') || desc.includes('DIFERENCIAL') || desc.includes('GANANCIA')) return { codigo: '4.02.01.001', nombre: 'Ganacia Cambiaria' };
    return { codigo: '4.01.01.001', nombre: 'Ventas' };
  }

  if (desc.includes('SUELDO') || desc.includes('SALARIO') || desc.includes('NOMINA') || desc.includes('NÓMINA') || desc.includes('PAGO PERSONAL')) {
    return { codigo: '6.01.01.002', nombre: 'Sueldos y Salarios' };
  }
  if (desc.includes('BONO') || desc.includes('ALIMENT') || desc.includes('CESTA')) return { codigo: '6.01.01.003', nombre: 'Bono Alimentación' };
  if (desc.includes('SOBRETIEMPO') || desc.includes('HORA EXTRA') || desc.includes('HORAS EXTRA')) return { codigo: '6.01.01.004', nombre: 'Sobretiempo' };
  if (desc.includes('COMISION') || desc.includes('COMISIÓN')) return { codigo: '6.01.01.011', nombre: 'Comisiones Vendedores' };
  if (desc.includes('LUZ') || desc.includes('CORPOELEC') || desc.includes('ELECTRIC') || desc.includes('ASEO URBANO')) return { codigo: '6.01.02.001', nombre: 'Electricidad y Aseo Urbano' };
  if (desc.includes('TELEF') || desc.includes('CELULAR') || desc.includes('MOVISTAR') || desc.includes('DIGITEL') || desc.includes('CANTV')) return { codigo: '6.01.02.002', nombre: 'Teléfono Celular' };
  if (desc.includes('AGUA') || desc.includes('HIDRO')) return { codigo: '6.01.02.003', nombre: 'Servicio de Agua' };
  if (desc.includes('GAS')) return { codigo: '6.01.02.004', nombre: 'Servicio de Gas y Aseo' };
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
  if (desc.includes('MANTENIMIENTO') || desc.includes('REPARAC') || desc.includes('PINTURA')) return { codigo: '6.01.04.002', nombre: 'Mantenimiento de Instalaciones' };
  if (desc.includes('FERRETERIA') || desc.includes('FERRETERÍA') || desc.includes('TORNILL') || desc.includes('CABLE')) return { codigo: '6.01.04.006', nombre: 'Ferretería' };
  if (desc.includes('PUBLICIDAD') || desc.includes('MARKETING') || desc.includes('REDES') || desc.includes('VOLANTE') || desc.includes('PENDON')) {
    return { codigo: '6.01.05.001', nombre: 'Publicidad y Mercadeo' };
  }
  if (desc.includes('UNIFORME') || desc.includes('BRAGA') || desc.includes('CAMISA')) return { codigo: '6.01.06.001', nombre: 'Uniformes' };
  if (desc.includes('HONORARIO') || desc.includes('CONTADOR') || desc.includes('ABOGADO') || desc.includes('ASESOR') || desc.includes('AUDITOR')) {
    return { codigo: '6.01.07.001', nombre: 'Honorarios Profesionales' };
  }
  if (desc.includes('TRAMITE') || desc.includes('TRÁMITE') || desc.includes('DOCUMENT') || desc.includes('NOTARIA') || desc.includes('NOTARÍA') || desc.includes('REGISTRO')) {
    return { codigo: '6.01.07.003', nombre: 'Tramites y Documentación' };
  }
  if (desc.includes('ALQUILER') || desc.includes('LOCAL') || desc.includes('GALPON') || desc.includes('GALPÓN')) return { codigo: '6.01.08.001', nombre: 'Alquiler' };
  if (desc.includes('CONDOMINIO')) return { codigo: '6.01.08.002', nombre: 'Condominio' };
  if (desc.includes('MEDICIN') || desc.includes('FARMACIA') || desc.includes('BOTIQUIN') || desc.includes('BOTIQUÍN') || desc.includes('MEDIC')) {
    return { codigo: '6.01.09.002', nombre: 'Medicinas y Gastos Médicos' };
  }
  return { codigo: '6.01.09.004', nombre: 'Gastos Varios' };
}

export function findAccountByCode(codigo, chartMap = CHART_OF_ACCOUNTS_MAP) {
  if (chartMap[codigo]) return chartMap[codigo];
  const prefix = String(codigo || '').split('.')[0];
  const defaults = {
    1: { grupo: 'ACTIVO', naturaleza: 'DEUDORA' },
    2: { grupo: 'PASIVO', naturaleza: 'ACREEDORA' },
    3: { grupo: 'PATRIMONIO', naturaleza: 'ACREEDORA' },
    4: { grupo: 'INGRESOS', naturaleza: 'ACREEDORA' },
    5: { grupo: 'COSTOS', naturaleza: 'DEUDORA' },
    6: { grupo: 'EGRESOS', naturaleza: 'DEUDORA' },
  };
  return defaults[prefix] || { grupo: 'ACTIVO', naturaleza: 'DEUDORA' };
}

export function generateAccountingEntries({
  profitInvoices = [],
  profitCollections = [],
  profitPurchases = [],
  profitSupplierPayments = [],
  cashMovements = [],
  profitBankAccounts = [],
  desksList = [],
  tasa = 827.73,
} = {}) {
  const entries = [];
  let seq = 1001;

  profitInvoices.forEach((inv) => {
    if (inv.anulado || inv.anulada) return;
    const docNum = inv.factNum || inv.id;
    const fecha = inv.fechaEmision || inv.fec_emis;
    const rate = Number(inv.tasa || tasa || 827.73);
    const totalUsd = round2(inv.totNetoUsd ?? inv.tot_neto_usd ?? (inv.totNetoBs ? inv.totNetoBs / rate : 0));
    if (totalUsd <= 0) return;

    const useSnake = inv.iva_usd !== undefined && inv.tot_bruto_usd !== undefined && Math.abs(Number(inv.tot_bruto_usd) + Number(inv.iva_usd) - totalUsd) < 0.05;
    const ivaUsd = round2(useSnake ? inv.iva_usd : inv.ivaUsd ?? (inv.ivaBs ? inv.ivaBs / rate : 0));
    let brutoUsd = round2(useSnake ? inv.tot_bruto_usd : inv.totBrutoUsd ?? (inv.totBrutoBs ? inv.totBrutoBs / rate : totalUsd - ivaUsd));
    let descuentoUsd = 0;

    const diff = round2(totalUsd - (brutoUsd + ivaUsd));
    if (Math.abs(diff) > 0) {
      if (Math.abs(diff) <= 0.05) {
        brutoUsd = round2(totalUsd - ivaUsd);
      } else if (diff < -0.05) {
        descuentoUsd = round2(Math.abs(diff));
      } else {
        brutoUsd = round2(totalUsd - ivaUsd);
      }
    }

    const totalBs = round2(totalUsd * rate);
    const brutoBs = round2(brutoUsd * rate);
    const ivaBs = round2(ivaUsd * rate);
    const descuentoBs = round2(descuentoUsd * rate);

    const lines = [
      { cuentaCodigo: '1.01.03.001', cuentaNombre: 'Cuentas por Cobrar Comerciales', debeUsd: totalUsd, haberUsd: 0, debeBs: totalBs, haberBs: 0 },
    ];
    if (descuentoUsd > 0) {
      lines.push({ cuentaCodigo: '4.01.02.001', cuentaNombre: 'Descuento en Ventas', debeUsd: descuentoUsd, haberUsd: 0, debeBs: descuentoBs, haberBs: 0 });
    }
    lines.push({ cuentaCodigo: '4.01.01.001', cuentaNombre: 'Ventas', debeUsd: 0, haberUsd: brutoUsd, debeBs: 0, haberBs: brutoBs });
    if (ivaUsd > 0) {
      lines.push({ cuentaCodigo: '2.03.01.005', cuentaNombre: 'Débito Fiscal', debeUsd: 0, haberUsd: ivaUsd, debeBs: 0, haberBs: ivaBs });
    }

    entries.push({
      id: `asi-fac-${docNum}`,
      asientoNum: `ASI-${seq++}`,
      fecha,
      tipoOperacion: 'VENTA',
      origenDoc: `Factura Venta #${docNum}`,
      documentoReferencia: `FAC-${docNum}`,
      usuario: inv.coVen || inv.co_us_in || 'FACTURACIÓN',
      tasa: rate,
      concepto: `Facturación de venta a cliente: ${inv.clienteNombre || inv.cli_des || 'Cliente General'}`,
      montoTotalUsd: totalUsd,
      lines,
    });
  });

  profitCollections.forEach((cob) => {
    if (cob.anulado || cob.anulada) return;
    const cobNum = cob.cobNum || cob.id;
    const fecha = cob.fechaCobro || cob.fec_cob || cob.fecha;
    const rate = Number(cob.tasa || tasa || 827.73);
    const rawUsd = Number(cob.montoUsd ?? cob.monto_usd ?? 0);
    const rawBs = Number(cob.montoBs ?? cob.monto_bs ?? 0);
    const rawMonto = Number(cob.monto ?? 0);

    let montoUsd = 0;
    let montoBs = 0;
    if (rawBs > 0 && rate > 10 && Math.abs(rawUsd * rate - rawBs) <= Math.max(2, rawBs * 0.05)) {
      montoUsd = round2(rawUsd);
      montoBs = round2(rawBs);
    } else if (rate > 10 && ((rawBs > 0 && Math.abs(rawUsd - rawBs) < 1) || (!rawBs && rawMonto > 0 && Math.abs(rawUsd - rawMonto) < 1))) {
      montoUsd = round2(rawUsd / rate);
      montoBs = round2(rawUsd);
    } else {
      montoUsd = round2(rawUsd || (rawBs && rate > 1 ? rawBs / rate : 0));
      montoBs = round2(rawBs || montoUsd * rate);
    }
    if (montoUsd <= 0) return;

    let cuenta = { codigo: '1.01.01.002', nombre: 'Caja Divisas' };
    const bankId = cob.cuentaBancariaId || cob.bancoId || cob.codCta;
    const deskId = cob.cajaId || cob.cashDeskId;
    const firstForma = Array.isArray(cob.formasPago) && cob.formasPago.length > 0 ? cob.formasPago[0] : null;
    const formaStr = String(firstForma?.formaPago || firstForma?.tipo || cob.formaPago || cob.metodo || '').toUpperCase();
    const codCaja = String(firstForma?.codCaja || '').trim();

    if (bankId) {
      cuenta = resolveBankAccount(profitBankAccounts.find((b) => b.id === bankId || b.codCta === bankId) || { id: bankId });
    } else if (deskId) {
      cuenta = resolveCashAccount(desksList.find((d) => d.id === deskId || d.coCaja === deskId) || { id: deskId });
    } else if (firstForma && (formaStr.includes('DEPO') || formaStr.includes('TRAN') || formaStr.includes('TPAG') || formaStr.includes('CHEQ'))) {
      cuenta = resolveBankAccount(
        profitBankAccounts.find((b) => b.codCta === codCaja || b.id === `CTA-${codCaja}` || b.id === firstForma.banco) || { id: `CTA-${codCaja}` }
      );
    } else if (codCaja) {
      cuenta = resolveCashAccount(
        desksList.find((d) => d.id === codCaja || d.id === `caja-${codCaja}` || d.coCaja === `CAJA-${codCaja}`) || { id: codCaja }
      );
    } else if (formaStr.includes('ZELLE') || formaStr === '04') {
      cuenta = { codigo: '1.01.01.004', nombre: 'Zelle' };
    } else if (cob.moneda === 'BS' || formaStr.includes('BS')) {
      cuenta = { codigo: '1.01.01.001', nombre: 'Caja Moneda Nacional' };
    }

    entries.push({
      id: `asi-cob-${cobNum}`,
      asientoNum: `ASI-${seq++}`,
      fecha,
      tipoOperacion: 'COBRO',
      origenDoc: `Recibo de Cobro #${cobNum}`,
      documentoReferencia: `COB-${cobNum}`,
      usuario: cob.coVen || cob.co_us_in || 'COBRANZAS',
      tasa: rate,
      concepto: `Recaudación de cobranza cliente: ${cob.clienteNombre || 'Cliente General'}`,
      montoTotalUsd: montoUsd,
      lines: [
        { cuentaCodigo: cuenta.codigo, cuentaNombre: cuenta.nombre, debeUsd: montoUsd, haberUsd: 0, debeBs: montoBs, haberBs: 0 },
        { cuentaCodigo: '1.01.03.001', cuentaNombre: 'Cuentas por Cobrar Comerciales', debeUsd: 0, haberUsd: montoUsd, debeBs: 0, haberBs: montoBs },
      ],
    });
  });

  profitPurchases.forEach((pur) => {
    if (pur.anulado || pur.anulada) return;
    const docNum = pur.factNum || pur.id;
    const fecha = pur.fechaEmision || pur.fec_emis;
    const rate = Number(pur.tasa || tasa || 827.73);
    const totalUsd = round2(pur.totNetoUsd || 0);
    if (totalUsd <= 0) return;

    let ivaUsd = round2(pur.ivaUsd ?? totalUsd - Number(pur.totBrutoUsd || totalUsd / 1.16));
    let brutoUsd = round2(pur.totBrutoUsd ?? totalUsd - ivaUsd);
    let servicioUsd = 0;

    const diff = round2(totalUsd - (brutoUsd + ivaUsd));
    if (Math.abs(diff) > 0) {
      if (Math.abs(diff) <= 0.05) brutoUsd = round2(totalUsd - ivaUsd);
      else if (diff > 0.05) servicioUsd = diff;
      else {
        brutoUsd = Math.max(0, round2(totalUsd - ivaUsd));
        if (round2(brutoUsd + ivaUsd) > totalUsd) {
          ivaUsd = Math.max(0, round2(totalUsd - brutoUsd));
        }
      }
    }

    const retIvaUsd = round2(pur.retencionIvaUsd || pur.retIvaUsd || 0);
    const retIslrUsd = round2(pur.retencionIslrUsd || pur.retIslrUsd || 0);
    const netPayableUsd = round2(Math.max(0, totalUsd - retIvaUsd - retIslrUsd));

    const brutoBs = round2(brutoUsd * rate);
    const ivaBs = round2(ivaUsd * rate);
    const servicioBs = round2(servicioUsd * rate);
    const retIvaBs = round2(retIvaUsd * rate);
    const retIslrBs = round2(retIslrUsd * rate);
    const netPayableBs = round2(netPayableUsd * rate);
    const cxpCuenta = resolveSupplierPayableAccount(pur);

    const lines = [
      { cuentaCodigo: '1.04.01.001', cuentaNombre: 'Inventario de Mercancia', debeUsd: brutoUsd, haberUsd: 0, debeBs: brutoBs, haberBs: 0 },
    ];
    if (ivaUsd > 0) {
      lines.push({ cuentaCodigo: '1.05.01.005', cuentaNombre: 'Crédito Fiscal', debeUsd: ivaUsd, haberUsd: 0, debeBs: ivaBs, haberBs: 0 });
    }
    if (servicioUsd > 0) {
      lines.push({ cuentaCodigo: '5.01.01.002', cuentaNombre: 'Costos por Servicios', debeUsd: servicioUsd, haberUsd: 0, debeBs: servicioBs, haberBs: 0 });
    }
    if (retIvaUsd > 0) {
      lines.push({ cuentaCodigo: '1.05.01.007', cuentaNombre: 'Retencion de IVA', debeUsd: 0, haberUsd: retIvaUsd, debeBs: 0, haberBs: retIvaBs });
    }
    if (retIslrUsd > 0) {
      lines.push({ cuentaCodigo: '2.03.01.006', cuentaNombre: 'Retencion de ISLR Proveedores', debeUsd: 0, haberUsd: retIslrUsd, debeBs: 0, haberBs: retIslrBs });
    }
    lines.push({ cuentaCodigo: cxpCuenta.codigo, cuentaNombre: cxpCuenta.nombre, debeUsd: 0, haberUsd: netPayableUsd, debeBs: 0, haberBs: netPayableBs });

    entries.push({
      id: `asi-pur-${docNum}`,
      asientoNum: `ASI-${seq++}`,
      fecha,
      tipoOperacion: 'COMPRA',
      origenDoc: `Factura Compra #${docNum}`,
      documentoReferencia: `COM-${docNum}`,
      usuario: pur.co_us_in || 'PROCURA',
      tasa: rate,
      concepto: `Recepción de compra proveedor: ${pur.provNombre || 'Distribuidor Keystone'}`,
      montoTotalUsd: totalUsd,
      lines,
    });
  });

  profitSupplierPayments.forEach((pay) => {
    if (pay.anulado || pay.anulada) return;
    const payNum = pay.pagoNum || pay.id;
    const fecha = pay.fechaPago || pay.fec_pago;
    const rate = Number(pay.tasa || tasa || 827.73);
    const montoUsd = round2(pay.montoUsd || 0);
    if (montoUsd <= 0) return;

    const montoBs = round2(montoUsd * rate);
    const cxpCuenta = resolveSupplierPayableAccount(pay);
    let bancoCuenta = { codigo: '1.01.02.001', nombre: 'Banco de Venezuela' };
    const bankId = pay.cuentaBancariaId || pay.bancoId || pay.cuentaId;
    const deskId = pay.cajaId;

    if (bankId) {
      bancoCuenta = resolveBankAccount(profitBankAccounts.find((b) => b.id === bankId || b.codCta === bankId) || { id: bankId });
    } else if (deskId) {
      bancoCuenta = resolveCashAccount(desksList.find((d) => d.id === deskId) || { id: deskId });
    }

    entries.push({
      id: `asi-pay-${payNum}`,
      asientoNum: `ASI-${seq++}`,
      fecha,
      tipoOperacion: 'PAGO_PROVEEDOR',
      origenDoc: `Comprobante de Pago #${payNum}`,
      documentoReferencia: `PAG-${payNum}`,
      usuario: pay.co_us_in || 'TESORERÍA',
      tasa: rate,
      concepto: `Pago / Abono a proveedor: ${pay.provNombre || 'Proveedor'}`,
      montoTotalUsd: montoUsd,
      lines: [
        { cuentaCodigo: cxpCuenta.codigo, cuentaNombre: cxpCuenta.nombre, debeUsd: montoUsd, haberUsd: 0, debeBs: montoBs, haberBs: 0 },
        { cuentaCodigo: bancoCuenta.codigo, cuentaNombre: bancoCuenta.nombre, debeUsd: 0, haberUsd: montoUsd, debeBs: 0, haberBs: montoBs },
      ],
    });
  });

  cashMovements.forEach((mov, idx) => {
    const montoUsd = round2(mov.montoUsd || 0);
    if (montoUsd <= 0) return;
    const rate = Number(mov.tasa || tasa || 827.73);
    const montoBs = round2(mov.montoBs || montoUsd * rate);
    const isEgreso = (mov.tipo || 'EGRESO').toUpperCase() === 'EGRESO';
    const movId = mov.id || `mov-${idx + 1}`;
    const fecha = mov.fecha || mov.createdAt || new Date().toISOString();

    let cashCuenta = { codigo: '1.01.01.002', nombre: 'Caja Divisas' };
    if (mov.metodo === 'BS' || mov.moneda === 'BS') {
      cashCuenta = { codigo: '1.01.01.001', nombre: 'Caja Moneda Nacional' };
    } else if (mov.metodo === 'ZELLE') {
      cashCuenta = { codigo: '1.01.01.004', nombre: 'Zelle' };
    }

    const gastoCuenta = resolveCashMovementAccount(mov);
    const lines = isEgreso
      ? [
          { cuentaCodigo: gastoCuenta.codigo, cuentaNombre: gastoCuenta.nombre, debeUsd: montoUsd, haberUsd: 0, debeBs: montoBs, haberBs: 0 },
          { cuentaCodigo: cashCuenta.codigo, cuentaNombre: cashCuenta.nombre, debeUsd: 0, haberUsd: montoUsd, debeBs: 0, haberBs: montoBs },
        ]
      : [
          { cuentaCodigo: cashCuenta.codigo, cuentaNombre: cashCuenta.nombre, debeUsd: montoUsd, haberUsd: 0, debeBs: montoBs, haberBs: 0 },
          { cuentaCodigo: gastoCuenta.codigo, cuentaNombre: gastoCuenta.nombre, debeUsd: 0, haberUsd: montoUsd, debeBs: 0, haberBs: montoBs },
        ];

    entries.push({
      id: `asi-mov-${movId}`,
      asientoNum: `ASI-${seq++}`,
      fecha,
      tipoOperacion: 'CAJA_CHICA',
      origenDoc: `Movimiento Caja #${movId}`,
      documentoReferencia: `CAJA-${movId}`,
      usuario: mov.usuario || 'ADMINISTRACIÓN',
      tasa: rate,
      concepto: `${isEgreso ? 'Egreso Operativo' : 'Ingreso Operativo'}: ${mov.concepto || 'Movimiento de Caja Chica'}`,
      montoTotalUsd: montoUsd,
      lines,
    });
  });

  return entries.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
}

export function buildTrialBalance(entries = [], chartMap = CHART_OF_ACCOUNTS_MAP) {
  const accMap = {};
  entries.forEach((entry) => {
    (entry.lines || []).forEach((line) => {
      const code = line.cuentaCodigo;
      if (!accMap[code]) {
        const meta = findAccountByCode(code, chartMap);
        accMap[code] = {
          codigo: code,
          nombre: line.cuentaNombre || meta.nombre || code,
          grupo: meta.grupo,
          naturaleza: meta.naturaleza,
          subgrupo: meta.subgrupo || '',
          totalDebeUsd: 0,
          totalHaberUsd: 0,
          totalDebeBs: 0,
          totalHaberBs: 0,
        };
      }
      accMap[code].totalDebeUsd += Number(line.debeUsd || 0);
      accMap[code].totalHaberUsd += Number(line.haberUsd || 0);
      accMap[code].totalDebeBs += Number(line.debeBs || 0);
      accMap[code].totalHaberBs += Number(line.haberBs || 0);
    });
  });

  const accounts = Object.values(accMap)
    .map((acc) => {
      const totalDebeUsd = round2(acc.totalDebeUsd);
      const totalHaberUsd = round2(acc.totalHaberUsd);
      const totalDebeBs = round2(acc.totalDebeBs);
      const totalHaberBs = round2(acc.totalHaberBs);
      const diffUsd = round2(totalDebeUsd - totalHaberUsd);
      const saldoDeudorUsd = diffUsd > 0 ? diffUsd : 0;
      const saldoAcreedorUsd = diffUsd < 0 ? Math.abs(diffUsd) : 0;
      const diffBs = round2(totalDebeBs - totalHaberBs);
      const saldoDeudorBs = diffBs > 0 ? diffBs : 0;
      const saldoAcreedorBs = diffBs < 0 ? Math.abs(diffBs) : 0;
      return {
        ...acc,
        totalDebeUsd,
        totalHaberUsd,
        totalDebeBs,
        totalHaberBs,
        saldoDeudorUsd,
        saldoAcreedorUsd,
        saldoDeudorBs,
        saldoAcreedorBs,
      };
    })
    .sort((a, b) => a.codigo.localeCompare(b.codigo));

  const totalSumasDebeUsd = round2(accounts.reduce((acc, item) => acc + item.totalDebeUsd, 0));
  const totalSumasHaberUsd = round2(accounts.reduce((acc, item) => acc + item.totalHaberUsd, 0));
  const totalSaldosDeudorUsd = round2(accounts.reduce((acc, item) => acc + item.saldoDeudorUsd, 0));
  const totalSaldosAcreedorUsd = round2(accounts.reduce((acc, item) => acc + item.saldoAcreedorUsd, 0));

  return {
    accounts,
    totalSumasDebeUsd,
    totalSumasHaberUsd,
    totalSaldosDeudorUsd,
    totalSaldosAcreedorUsd,
    totalSumasDebeBs: round2(accounts.reduce((acc, item) => acc + item.totalDebeBs, 0)),
    totalSumasHaberBs: round2(accounts.reduce((acc, item) => acc + item.totalHaberBs, 0)),
    isBalanced: Math.abs(totalSumasDebeUsd - totalSumasHaberUsd) < 0.05 && Math.abs(totalSaldosDeudorUsd - totalSaldosAcreedorUsd) < 0.05,
  };
}

export function buildGeneralLedger(entries = [], chartMap = CHART_OF_ACCOUNTS_MAP) {
  const chronological = [...entries].sort((a, b) => new Date(a.fecha || 0) - new Date(b.fecha || 0));
  const accountsByCode = {};

  chronological.forEach((entry) => {
    (entry.lines || []).forEach((line) => {
      const code = line.cuentaCodigo;
      if (!accountsByCode[code]) {
        const meta = findAccountByCode(code, chartMap);
        accountsByCode[code] = {
          codigo: code,
          nombre: line.cuentaNombre || meta.nombre || code,
          grupo: meta.grupo,
          naturaleza: meta.naturaleza,
          subgrupo: meta.subgrupo || '',
          totalDebeUsd: 0,
          totalHaberUsd: 0,
          saldoFinalUsd: 0,
          totalDebeBs: 0,
          totalHaberBs: 0,
          saldoFinalBs: 0,
          movements: [],
        };
      }
      const acc = accountsByCode[code];
      const debeUsd = Number(line.debeUsd || 0);
      const haberUsd = Number(line.haberUsd || 0);
      const debeBs = Number(line.debeBs || 0);
      const haberBs = Number(line.haberBs || 0);

      acc.totalDebeUsd = round2(acc.totalDebeUsd + debeUsd);
      acc.totalHaberUsd = round2(acc.totalHaberUsd + haberUsd);
      acc.totalDebeBs = round2(acc.totalDebeBs + debeBs);
      acc.totalHaberBs = round2(acc.totalHaberBs + haberBs);

      const deltaUsd = acc.naturaleza === 'DEUDORA' ? debeUsd - haberUsd : haberUsd - debeUsd;
      const deltaBs = acc.naturaleza === 'DEUDORA' ? debeBs - haberBs : haberBs - debeBs;

      acc.saldoFinalUsd = round2(acc.saldoFinalUsd + deltaUsd);
      acc.saldoFinalBs = round2(acc.saldoFinalBs + deltaBs);
      acc.movements.push({
        fecha: entry.fecha,
        asientoNum: entry.asientoNum,
        tipoOperacion: entry.tipoOperacion,
        documentoReferencia: entry.documentoReferencia,
        concepto: entry.concepto,
        debeUsd: round2(debeUsd),
        haberUsd: round2(haberUsd),
        debeBs: round2(debeBs),
        haberBs: round2(haberBs),
        saldoAcumuladoUsd: acc.saldoFinalUsd,
        saldoAcumuladoBs: acc.saldoFinalBs,
      });
    });
  });

  return {
    accounts: Object.values(accountsByCode).sort((a, b) => a.codigo.localeCompare(b.codigo)),
    accountsByCode,
  };
}

export function buildFinancialStatements(trialBalance, chartMap = CHART_OF_ACCOUNTS_MAP) {
  const accounts = trialBalance?.accounts || [];
  const ingresos = [];
  const costos = [];
  const egresos = [];
  const activo = [];
  const pasivo = [];
  const patrimonio = [];

  accounts.forEach((acc) => {
    const meta = findAccountByCode(acc.codigo, chartMap);
    const grupo = acc.grupo || meta.grupo;
    const saldoDeudorUsd = round2(acc.totalDebeUsd - acc.totalHaberUsd);
    const saldoAcreedorUsd = round2(acc.totalHaberUsd - acc.totalDebeUsd);
    const saldoDeudorBs = round2(acc.totalDebeBs - acc.totalHaberBs);
    const saldoAcreedorBs = round2(acc.totalHaberBs - acc.totalDebeBs);

    if (grupo === 'INGRESOS') ingresos.push({ ...acc, saldoUsd: saldoAcreedorUsd, saldoBs: saldoAcreedorBs });
    else if (grupo === 'COSTOS') costos.push({ ...acc, saldoUsd: saldoDeudorUsd, saldoBs: saldoDeudorBs });
    else if (grupo === 'EGRESOS') egresos.push({ ...acc, saldoUsd: saldoDeudorUsd, saldoBs: saldoDeudorBs });
    else if (grupo === 'ACTIVO') activo.push({ ...acc, saldoUsd: saldoDeudorUsd, saldoBs: saldoDeudorBs });
    else if (grupo === 'PASIVO') pasivo.push({ ...acc, saldoUsd: saldoAcreedorUsd, saldoBs: saldoAcreedorBs });
    else if (grupo === 'PATRIMONIO') patrimonio.push({ ...acc, saldoUsd: saldoAcreedorUsd, saldoBs: saldoAcreedorBs });
  });

  const totalIngresosUsd = round2(ingresos.reduce((acc, i) => acc + i.saldoUsd, 0));
  const totalIngresosBs = round2(ingresos.reduce((acc, i) => acc + i.saldoBs, 0));
  const totalCostosUsd = round2(costos.reduce((acc, i) => acc + i.saldoUsd, 0));
  const totalCostosBs = round2(costos.reduce((acc, i) => acc + i.saldoBs, 0));
  const utilidadBrutaUsd = round2(totalIngresosUsd - totalCostosUsd);
  const utilidadBrutaBs = round2(totalIngresosBs - totalCostosBs);
  const totalEgresosUsd = round2(egresos.reduce((acc, i) => acc + i.saldoUsd, 0));
  const totalEgresosBs = round2(egresos.reduce((acc, i) => acc + i.saldoBs, 0));
  const resultadoEjercicioUsd = round2(utilidadBrutaUsd - totalEgresosUsd);
  const resultadoEjercicioBs = round2(utilidadBrutaBs - totalEgresosBs);

  const totalActivoUsd = round2(activo.reduce((acc, i) => acc + i.saldoUsd, 0));
  const totalActivoBs = round2(activo.reduce((acc, i) => acc + i.saldoBs, 0));
  const totalPasivoUsd = round2(pasivo.reduce((acc, i) => acc + i.saldoUsd, 0));
  const totalPasivoBs = round2(pasivo.reduce((acc, i) => acc + i.saldoBs, 0));
  const patrimonioBaseUsd = round2(patrimonio.reduce((acc, i) => acc + i.saldoUsd, 0));
  const patrimonioBaseBs = round2(patrimonio.reduce((acc, i) => acc + i.saldoBs, 0));
  const totalPatrimonioUsd = round2(patrimonioBaseUsd + resultadoEjercicioUsd);
  const totalPatrimonioBs = round2(patrimonioBaseBs + resultadoEjercicioBs);
  const totalPasivoYPatrimonioUsd = round2(totalPasivoUsd + totalPatrimonioUsd);
  const totalPasivoYPatrimonioBs = round2(totalPasivoBs + totalPatrimonioBs);
  const diferenciaEcuacionUsd = round2(totalActivoUsd - totalPasivoYPatrimonioUsd);

  return {
    estadoResultados: {
      ingresos,
      costos,
      egresos,
      totalIngresosUsd,
      totalIngresosBs,
      totalCostosUsd,
      totalCostosBs,
      utilidadBrutaUsd,
      utilidadBrutaBs,
      totalEgresosUsd,
      totalEgresosBs,
      resultadoEjercicioUsd,
      resultadoEjercicioBs,
      cuentaResultadoCodigo: resultadoEjercicioUsd >= 0 ? '3.02.01.001' : '3.02.02.001',
      cuentaResultadoNombre: resultadoEjercicioUsd >= 0 ? 'Superavit del Ejercicio' : 'Déficit del Ejercicio',
    },
    balanceGeneral: {
      activo,
      pasivo,
      patrimonio,
      totalActivoUsd,
      totalActivoBs,
      totalPasivoUsd,
      totalPasivoBs,
      patrimonioBaseUsd,
      patrimonioBaseBs,
      resultadoEjercicioUsd,
      resultadoEjercicioBs,
      totalPatrimonioUsd,
      totalPatrimonioBs,
      totalPasivoYPatrimonioUsd,
      totalPasivoYPatrimonioBs,
      diferenciaEcuacionUsd,
      ecuacionCuadrada: Math.abs(diferenciaEcuacionUsd) < 0.05,
    },
  };
}

export const buildAccountingEntries = generateAccountingEntries;
export const computeTrialBalance = buildTrialBalance;
export const computeGeneralLedger = buildGeneralLedger;
export const computeFinancialStatements = buildFinancialStatements;
