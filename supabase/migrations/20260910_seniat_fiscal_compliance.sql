-- ==============================================================================
-- MIGRACIÓN DE ADECUACIÓN FISCAL Y CONTABLE SENIAT - SIGNUM MOTORVEN
-- Normativa: Providencia SNAT/2011/00071, Providencia SNAT/2013/00030,
-- Ley del IVA, Ley del IGTF y Código Orgánico Tributario de la República Bolivariana de Venezuela
-- ==============================================================================

-- 1. Tabla de Correlativos y Secuencias Fiscales (Sin Saltos)
CREATE TABLE IF NOT EXISTS public.fiscal_sequences (
    id text PRIMARY KEY, -- 'FACTURA', 'NOTA_CREDITO', 'NOTA_DEBITO', 'NUMERO_CONTROL', 'RETENCION_IVA'
    prefijo text NOT NULL DEFAULT '',
    ultimo_numero bigint NOT NULL DEFAULT 0,
    longitud_formato integer NOT NULL DEFAULT 6,
    descripcion text,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Inicialización de secuencias fiscales oficiales
INSERT INTO public.fiscal_sequences (id, prefijo, ultimo_numero, longitud_formato, descripcion)
VALUES 
    ('FACTURA', 'FACT-', 1042, 6, 'Correlativo de Facturas de Venta emitidas'),
    ('NOTA_CREDITO', 'NC-', 12, 6, 'Correlativo de Notas de Crédito emitidas'),
    ('NOTA_DEBITO', 'ND-', 5, 6, 'Correlativo de Notas de Débito emitidas'),
    ('NUMERO_CONTROL', '00-', 8520, 6, 'Numeración de Control Fiscal Pre-Impreso / Asignado'),
    ('RETENCION_IVA', '', 140, 8, 'Correlativo de Comprobante de Retención de IVA (8 dígitos)')
ON CONFLICT (id) DO NOTHING;

-- 2. Adaptación de Clientes con Requisitos Fiscales SENIAT
ALTER TABLE public.clients
    ADD COLUMN IF NOT EXISTS domicilio_fiscal text,
    ADD COLUMN IF NOT EXISTS tipo_contribuyente text DEFAULT 'ORDINARIO',
    ADD COLUMN IF NOT EXISTS porcentaje_retencion_iva numeric(5,2) DEFAULT 75.00,
    ADD COLUMN IF NOT EXISTS codigo_actividad_economica text;

-- Restricción de Contribuyente
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_tipo_contribuyente_clients'
    ) THEN
        ALTER TABLE public.clients ADD CONSTRAINT check_tipo_contribuyente_clients 
            CHECK (tipo_contribuyente IN ('ORDINARIO', 'ESPECIAL', 'FORMAL'));
    END IF;
END $$;

-- 3. Adaptación de Proveedores con Requisitos Fiscales SENIAT
ALTER TABLE public.suppliers
    ADD COLUMN IF NOT EXISTS domicilio_fiscal text,
    ADD COLUMN IF NOT EXISTS tipo_contribuyente text DEFAULT 'ORDINARIO',
    ADD COLUMN IF NOT EXISTS porcentaje_retencion_iva numeric(5,2) DEFAULT 75.00,
    ADD COLUMN IF NOT EXISTS porcentaje_retencion_islr numeric(5,2) DEFAULT 2.00;

-- 4. Adaptación de Productos / Lubricantes con Alícuotas de IVA
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS tipo_alicuota text DEFAULT 'GENERAL_16',
    ADD COLUMN IF NOT EXISTS alicuota_porcentaje numeric(5,2) DEFAULT 16.00;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_tipo_alicuota_products'
    ) THEN
        ALTER TABLE public.products ADD CONSTRAINT check_tipo_alicuota_products 
            CHECK (tipo_alicuota IN ('GENERAL_16', 'REDUCIDA_8', 'ADICIONAL_31', 'EXENTO_0'));
    END IF;
END $$;

-- 5. Ampliación de la Tabla de Ventas (Facturación Formal SENIAT)
ALTER TABLE public.sales
    ADD COLUMN IF NOT EXISTS numero_control text,
    ADD COLUMN IF NOT EXISTS documento_afectado text, -- Referencia obligatoria en NC/ND
    ADD COLUMN IF NOT EXISTS motivo_ajuste text,
    ADD COLUMN IF NOT EXISTS base_exenta_usd numeric(18,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS base_general_usd numeric(18,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS iva_general_usd numeric(18,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS base_reducida_usd numeric(18,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS iva_reducido_usd numeric(18,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS base_adicional_usd numeric(18,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS iva_adicional_usd numeric(18,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS base_igtf_usd numeric(18,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS base_exenta_bs numeric(18,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS base_general_bs numeric(18,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS iva_general_bs numeric(18,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS base_reducida_bs numeric(18,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS iva_reducido_bs numeric(18,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS base_adicional_bs numeric(18,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS iva_adicional_bs numeric(18,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS base_igtf_bs numeric(18,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS igtf_bs numeric(18,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS retencion_iva_bs numeric(18,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS comprobante_retencion_nro text,
    ADD COLUMN IF NOT EXISTS tasa_bcv_fecha timestamptz DEFAULT now();

-- 6. Tabla de Compras Formales (Libro de Compras SENIAT)
CREATE TABLE IF NOT EXISTS public.purchases (
    id text PRIMARY KEY,
    numero_factura text NOT NULL,
    numero_control text NOT NULL,
    tipo_doc text NOT NULL DEFAULT 'FACTURA', -- FACTURA, NOTA_CREDITO, NOTA_DEBITO
    fecha timestamptz NOT NULL DEFAULT now(),
    proveedor_id text REFERENCES public.suppliers(id),
    proveedor_nombre text NOT NULL,
    proveedor_rif text NOT NULL,
    proveedor_domicilio text,
    documento_afectado text,
    tasa_dolar numeric(12,4) NOT NULL,
    subtotal_usd numeric(18,2) NOT NULL DEFAULT 0.00,
    monto_exento_usd numeric(18,2) NOT NULL DEFAULT 0.00,
    base_general_usd numeric(18,2) NOT NULL DEFAULT 0.00,
    iva_general_usd numeric(18,2) NOT NULL DEFAULT 0.00,
    base_reducida_usd numeric(18,2) NOT NULL DEFAULT 0.00,
    iva_reducido_usd numeric(18,2) NOT NULL DEFAULT 0.00,
    total_usd numeric(18,2) NOT NULL DEFAULT 0.00,
    subtotal_bs numeric(18,2) NOT NULL DEFAULT 0.00,
    monto_exento_bs numeric(18,2) NOT NULL DEFAULT 0.00,
    base_general_bs numeric(18,2) NOT NULL DEFAULT 0.00,
    iva_general_bs numeric(18,2) NOT NULL DEFAULT 0.00,
    base_reducida_bs numeric(18,2) NOT NULL DEFAULT 0.00,
    iva_reducido_bs numeric(18,2) NOT NULL DEFAULT 0.00,
    total_bs numeric(18,2) NOT NULL DEFAULT 0.00,
    retencion_iva_porcentaje numeric(5,2) DEFAULT 75.00,
    retencion_iva_bs numeric(18,2) DEFAULT 0.00,
    comprobante_retencion_iva text,
    retencion_islr_porcentaje numeric(5,2) DEFAULT 2.00,
    retencion_islr_bs numeric(18,2) DEFAULT 0.00,
    comprobante_retencion_islr text,
    estado text NOT NULL DEFAULT 'REGISTRADO',
    items jsonb NOT NULL DEFAULT '[]'::jsonb
);

-- 7. Tabla de Comprobantes de Retención de IVA Emitidos (Portal SENIAT TXT)
CREATE TABLE IF NOT EXISTS public.retenciones_iva_emitidas (
    id text PRIMARY KEY,
    comprobante_nro text NOT NULL UNIQUE, -- Formato AAAAMM + 8 dígitos
    periodo_fiscal text NOT NULL, -- AAAAMM
    fecha_emision date NOT NULL,
    tipo_operacion text NOT NULL DEFAULT '01',
    tipo_documento text NOT NULL DEFAULT '01', -- 01: Factura, 02: Nota Débito, 03: Nota Crédito
    proveedor_rif text NOT NULL,
    proveedor_nombre text NOT NULL,
    numero_documento text NOT NULL,
    numero_control text NOT NULL,
    total_documento_bs numeric(18,2) NOT NULL,
    base_imponible_bs numeric(18,2) NOT NULL,
    monto_exento_bs numeric(18,2) NOT NULL DEFAULT 0.00,
    alicuota numeric(5,2) NOT NULL DEFAULT 16.00,
    impuesto_iva_bs numeric(18,2) NOT NULL,
    porcentaje_retencion numeric(5,2) NOT NULL DEFAULT 75.00,
    monto_retenido_bs numeric(18,2) NOT NULL,
    documento_afectado text DEFAULT '',
    numero_expediente text DEFAULT '0'
);

-- 8. Tabla de Comprobantes de Retención de ISLR Emitidos (Portal SENIAT XML)
CREATE TABLE IF NOT EXISTS public.retenciones_islr_emitidas (
    id text PRIMARY KEY,
    comprobante_nro text NOT NULL,
    periodo_fiscal text NOT NULL, -- AAAAMM
    fecha_emision date NOT NULL,
    proveedor_rif text NOT NULL,
    proveedor_nombre text NOT NULL,
    numero_factura text NOT NULL,
    numero_control text NOT NULL,
    codigo_concepto text NOT NULL DEFAULT '055', -- Código oficial SENIAT (ej. 055 para compra de bienes muebles)
    monto_operacion_bs numeric(18,2) NOT NULL,
    porcentaje_retencion numeric(5,2) NOT NULL DEFAULT 2.00,
    monto_retenido_bs numeric(18,2) NOT NULL
);

-- Índices de Auditoría y Consulta Fiscal Rápida
CREATE INDEX IF NOT EXISTS idx_sales_control ON public.sales(numero_control);
CREATE INDEX IF NOT EXISTS idx_sales_fecha ON public.sales(fecha);
CREATE INDEX IF NOT EXISTS idx_purchases_control ON public.purchases(numero_control);
CREATE INDEX IF NOT EXISTS idx_purchases_fecha ON public.purchases(fecha);
CREATE INDEX IF NOT EXISTS idx_retenciones_iva_periodo ON public.retenciones_iva_emitidas(periodo_fiscal);
CREATE INDEX IF NOT EXISTS idx_retenciones_islr_periodo ON public.retenciones_islr_emitidas(periodo_fiscal);
