-- ==============================================================================
-- MIGRACIÓN: NÓMINA, GASTOS OPERATIVOS, EMPLEADOS, COMISIONES Y CUENTAS DE GASTO
-- Fecha: 2026-11-13
-- Descripción: Crea de forma idempotente las tablas `employees`, `payroll`,
-- `expenses` y asegura columnas/políticas de `commission_settlements` y `cash_movements`
-- para que el módulo P&L Operativo y Rentabilidad opere con cifras reales.
-- ==============================================================================

-- 1. Tabla de Empleados
CREATE TABLE IF NOT EXISTS public.employees (
    id text PRIMARY KEY,
    cedula text NOT NULL,
    nombre text NOT NULL,
    cargo text,
    departamento text DEFAULT 'OPERACIONES',
    fecha_ingreso date,
    salario_base_usd numeric(14,2) NOT NULL DEFAULT 0.00,
    bono_fijo_usd numeric(14,2) NOT NULL DEFAULT 0.00,
    frecuencia_pago text DEFAULT 'QUINCENAL',
    metodo_pago text DEFAULT 'TRANSFERENCIA',
    cuenta_bancaria text,
    telefono text,
    activo boolean NOT NULL DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. Tabla de Corridas / Recibos de Nómina
CREATE TABLE IF NOT EXISTS public.payroll (
    id text PRIMARY KEY,
    periodo text NOT NULL,
    periodo_inicio date,
    periodo_fin date,
    fecha_pago date NOT NULL,
    frecuencia text DEFAULT 'QUINCENAL',
    total_salarios_usd numeric(14,2) NOT NULL DEFAULT 0.00,
    total_bonos_usd numeric(14,2) NOT NULL DEFAULT 0.00,
    total_deducciones_usd numeric(14,2) NOT NULL DEFAULT 0.00,
    total_neto_usd numeric(14,2) NOT NULL DEFAULT 0.00,
    total_neto_bs numeric(18,2) NOT NULL DEFAULT 0.00,
    tasa_bcv numeric(12,4) NOT NULL DEFAULT 0.00,
    tipo_tasa text DEFAULT 'BCV',
    metodo_pago text DEFAULT 'TRANSFERENCIA',
    cuenta_destino text,
    caja_banco_id text,
    referencia text,
    estado text DEFAULT 'PAGADA',
    notas text,
    detalles jsonb DEFAULT '[]'::jsonb,
    cash_movement_id text,
    created_by text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3. Tabla de Gastos Operativos Clasificados
CREATE TABLE IF NOT EXISTS public.expenses (
    id text PRIMARY KEY,
    fecha date NOT NULL,
    concepto text NOT NULL,
    categoria text NOT NULL DEFAULT 'GASTO_OPERATIVO',
    cuenta_gasto text,
    cuenta_gasto_desc text,
    proveedor text,
    rif_proveedor text,
    documento_ref text,
    monto_usd numeric(14,2) NOT NULL DEFAULT 0.00,
    monto_bs numeric(18,2) NOT NULL DEFAULT 0.00,
    tasa_pago numeric(12,4) NOT NULL DEFAULT 0.00,
    tipo_tasa text DEFAULT 'BCV',
    metodo_pago text DEFAULT 'TRANSFERENCIA',
    caja_banco_id text,
    caja_banco_nombre text,
    referencia text,
    estado text DEFAULT 'PAGADA',
    notas text,
    cash_movement_id text,
    created_by text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 4. Alinear tabla `commission_settlements`
CREATE TABLE IF NOT EXISTS public.commission_settlements (
    id text PRIMARY KEY,
    co_ven text NOT NULL,
    ven_des text,
    cedula text,
    periodo text,
    periodo_id text,
    total_litros numeric(14,2) DEFAULT 0.00,
    meta_litros numeric(14,2) DEFAULT 0.00,
    total_facturado_usd numeric(14,2) DEFAULT 0.00,
    base_pagada_sin_iva_usd numeric(14,2) DEFAULT 0.00,
    documentos_pagados_count integer DEFAULT 0,
    documentos_pendientes_excluidos_count integer DEFAULT 0,
    motorven_tiers jsonb DEFAULT '[]'::jsonb,
    bono_adicional_usd numeric(14,2) DEFAULT 0.00,
    total_cobrado_usd numeric(14,2) DEFAULT 0.00,
    total_comision_usd numeric(14,2) NOT NULL DEFAULT 0.00,
    total_comision_bs numeric(18,2) DEFAULT 0.00,
    tasa_bcv numeric(12,4) DEFAULT 0.00,
    metodo_pago text,
    referencia_pago text,
    fecha_pago text,
    notas text,
    seller jsonb DEFAULT '{}'::jsonb,
    estado text DEFAULT 'PAGADA',
    cash_movement_id text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 5. Columnas de clasificación contable/P&L en `cash_movements`
ALTER TABLE public.cash_movements
    ADD COLUMN IF NOT EXISTS cuenta_gasto text,
    ADD COLUMN IF NOT EXISTS cuenta_gasto_desc text,
    ADD COLUMN IF NOT EXISTS referencia_tipo text,
    ADD COLUMN IF NOT EXISTS referencia_id text;

-- 6. RLS y Permisos CRUD Idempotentes
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS allow_all_crud_employees ON public.employees;
CREATE POLICY allow_all_crud_employees ON public.employees FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS allow_all_crud_payroll ON public.payroll;
CREATE POLICY allow_all_crud_payroll ON public.payroll FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS allow_all_crud_expenses ON public.expenses;
CREATE POLICY allow_all_crud_expenses ON public.expenses FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS allow_all_crud_commission_settlements ON public.commission_settlements;
CREATE POLICY allow_all_crud_commission_settlements ON public.commission_settlements FOR ALL TO public USING (true) WITH CHECK (true);

GRANT ALL ON public.employees TO anon, authenticated, service_role;
GRANT ALL ON public.payroll TO anon, authenticated, service_role;
GRANT ALL ON public.expenses TO anon, authenticated, service_role;
GRANT ALL ON public.commission_settlements TO anon, authenticated, service_role;
