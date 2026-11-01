-- ==============================================================================
-- MIGRACIÓN DE AUDITORÍA Y CIERRES FISCALES SENIAT: REPORTE X Y REPORTE Z
-- Sistema: SIGNUM MOTORVEN (Grupo Motorven C.A. - RIF: J-31115365-9)
-- Normativa: Providencia Administrativa SNAT/2011/00071, Ley del IVA, Ley del IGTF
-- ==============================================================================

-- 1. Actualización de Secuencias Fiscales para el Correlativo de Reporte Z
INSERT INTO public.fiscal_sequences (id, prefijo, ultimo_numero, longitud_formato, descripcion)
VALUES 
    ('REPORTE_Z', 'Z-', 0, 8, 'Correlativo legal consecutivo de Cierres Diarios Z (SNAT/2011/00071)')
ON CONFLICT (id) DO NOTHING;

-- 2. Creación de la Tabla de Cierres Fiscales (fiscal_closures)
CREATE TABLE IF NOT EXISTS public.fiscal_closures (
    id text PRIMARY KEY,                                      -- Ej: 'Z-00000001' o 'X-20260910-173000'
    tipo text NOT NULL CHECK (tipo IN ('X', 'Z')),            -- 'X' (Corte parcial) o 'Z' (Cierre definitivo)
    numero_z integer,                                         -- Correlativo entero consecutivo para Reporte Z
    fecha_apertura timestamptz NOT NULL,                      -- Timestamp de la primera transacción o inicio del día
    fecha_cierre timestamptz NOT NULL DEFAULT now(),          -- Timestamp exacto de emisión del reporte
    
    -- Rangos de Documentos Fiscales Emitidos en el Período
    primera_factura text,                                     -- Ej: 'FACT-001040'
    ultima_factura text,                                      -- Ej: 'FACT-001042'
    primera_nc text,                                          -- Primera Nota de Crédito
    ultima_nc text,                                           -- Última Nota de Crédito
    primera_nd text,                                          -- Primera Nota de Débito
    ultima_nd text,                                           -- Última Nota de Débito
    cantidad_facturas integer NOT NULL DEFAULT 0,
    cantidad_nc integer NOT NULL DEFAULT 0,
    cantidad_nd integer NOT NULL DEFAULT 0,
    total_documentos integer NOT NULL DEFAULT 0,

    -- Desglose Impositivo Oficial SENIAT (Moneda de Cuenta: Bolívares - Bs.)
    ventas_exentas_bs numeric(18, 2) NOT NULL DEFAULT 0.00,
    base_general_bs numeric(18, 2) NOT NULL DEFAULT 0.00,
    debito_general_bs numeric(18, 2) NOT NULL DEFAULT 0.00,   -- IVA 16%
    base_reducida_bs numeric(18, 2) NOT NULL DEFAULT 0.00,
    debito_reducido_bs numeric(18, 2) NOT NULL DEFAULT 0.00,  -- IVA 8%
    base_adicional_bs numeric(18, 2) NOT NULL DEFAULT 0.00,
    debito_adicional_bs numeric(18, 2) NOT NULL DEFAULT 0.00, -- IVA Adicional 31%
    total_debito_fiscal_bs numeric(18, 2) NOT NULL DEFAULT 0.00,

    -- Percepción de IGTF (3% cobros en divisas / criptoactivos no soberanos)
    base_igtf_bs numeric(18, 2) NOT NULL DEFAULT 0.00,
    total_igtf_bs numeric(18, 2) NOT NULL DEFAULT 0.00,

    -- Totales del Cierre y Equivalente Multimoneda
    total_ventas_bs numeric(18, 2) NOT NULL DEFAULT 0.00,
    total_ventas_usd numeric(18, 2) NOT NULL DEFAULT 0.00,
    tasa_bcv numeric(12, 4) NOT NULL,

    -- Memoria Fiscal Digital: Gran Total Histórico Acumulado (Perpetuo)
    gran_total_historico_bs numeric(18, 2) NOT NULL DEFAULT 0.00,

    -- Desglose Consolidado por Medios de Pago (JSONB)
    -- Ej: { "EFECTIVO_USD": 500.00, "PAGO_MOVIL": 12000.00, "TRANSFERENCIA": 45000.00 }
    desglose_pagos jsonb NOT NULL DEFAULT '{}'::jsonb,

    -- Auditoría de Usuario y Criptografía
    usuario_id text,
    usuario_nombre text NOT NULL DEFAULT 'Administrador / Caja',
    firma_hash_sha256 text NOT NULL,                          -- Firma inmutable SHA-256 de los datos fiscales
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Constraint de Unicidad estricta para el correlativo de Reporte Z (ignora tipo X)
CREATE UNIQUE INDEX IF NOT EXISTS idx_fiscal_closures_numero_z 
ON public.fiscal_closures (numero_z) 
WHERE tipo = 'Z';

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_fiscal_closures_fecha_cierre ON public.fiscal_closures (fecha_cierre);
CREATE INDEX IF NOT EXISTS idx_fiscal_closures_tipo ON public.fiscal_closures (tipo);

-- 3. Vinculación en la Tabla de Ventas (sales)
ALTER TABLE public.sales
    ADD COLUMN IF NOT EXISTS cierre_z_id text REFERENCES public.fiscal_closures(id),
    ADD COLUMN IF NOT EXISTS cerrada boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_sales_cierre_z ON public.sales(cierre_z_id);
CREATE INDEX IF NOT EXISTS idx_sales_cerrada ON public.sales(cerrada);

-- 4. Función Almacenada Transaccional ACID para Ejecución de Cierre Z
CREATE OR REPLACE FUNCTION public.sp_ejecutar_cierre_z(
    p_usuario_id text,
    p_usuario_nombre text,
    p_tasa_bcv numeric,
    p_firma_hash text
) RETURNS jsonb AS $$
DECLARE
    v_ultimo_z integer;
    v_nuevo_z integer;
    v_cierre_id text;
    v_ultimo_gran_total numeric(18, 2) := 0.00;
    v_nuevo_gran_total numeric(18, 2) := 0.00;
    
    v_fecha_apertura timestamptz;
    v_fecha_cierre timestamptz := now();
    
    v_primera_factura text;
    v_ultima_factura text;
    v_primera_nc text;
    v_ultima_nc text;
    v_primera_nd text;
    v_ultima_nd text;
    
    v_cant_facturas integer := 0;
    v_cant_nc integer := 0;
    v_cant_nd integer := 0;
    v_total_docs integer := 0;

    v_ventas_exentas_bs numeric(18, 2) := 0.00;
    v_base_general_bs numeric(18, 2) := 0.00;
    v_debito_general_bs numeric(18, 2) := 0.00;
    v_base_reducida_bs numeric(18, 2) := 0.00;
    v_debito_reducido_bs numeric(18, 2) := 0.00;
    v_base_adicional_bs numeric(18, 2) := 0.00;
    v_debito_adicional_bs numeric(18, 2) := 0.00;
    v_total_debito_bs numeric(18, 2) := 0.00;
    v_base_igtf_bs numeric(18, 2) := 0.00;
    v_total_igtf_bs numeric(18, 2) := 0.00;
    v_total_ventas_bs numeric(18, 2) := 0.00;
    v_total_ventas_usd numeric(18, 2) := 0.00;
    v_desglose_pagos jsonb := '{}'::jsonb;
    v_sale_record RECORD;
BEGIN
    -- Bloqueo pesimista de secuencia para evitar condiciones de carrera concurrentes
    SELECT ultimo_numero INTO v_ultimo_z
    FROM public.fiscal_sequences
    WHERE id = 'REPORTE_Z'
    FOR UPDATE;

    v_nuevo_z := COALESCE(v_ultimo_z, 0) + 1;
    v_cierre_id := 'Z-' || lpad(v_nuevo_z::text, 8, '0');

    -- Obtener el Gran Total Histórico del cierre Z anterior
    SELECT gran_total_historico_bs INTO v_ultimo_gran_total
    FROM public.fiscal_closures
    WHERE tipo = 'Z'
    ORDER BY numero_z DESC
    LIMIT 1;

    v_ultimo_gran_total := COALESCE(v_ultimo_gran_total, 0.00);

    -- Determinar fecha de apertura de las ventas pendientes
    SELECT MIN(fecha) INTO v_fecha_apertura
    FROM public.sales
    WHERE cerrada = false AND estado != 'ANULADA';

    IF v_fecha_apertura IS NULL THEN
        v_fecha_apertura := v_fecha_cierre;
    END IF;

    -- Iterar y agregar documentos no cerrados
    FOR v_sale_record IN
        SELECT *
        FROM public.sales
        WHERE cerrada = false AND estado != 'ANULADA'
        ORDER BY fecha ASC
        FOR UPDATE
    LOOP
        v_total_docs := v_total_docs + 1;

        IF v_sale_record.tipo_doc = 'FACTURA' THEN
            v_cant_facturas := v_cant_facturas + 1;
            IF v_primera_factura IS NULL THEN v_primera_factura := v_sale_record.numero_doc; END IF;
            v_ultima_factura := v_sale_record.numero_doc;
        ELSIF v_sale_record.tipo_doc = 'NOTA_CREDITO' THEN
            v_cant_nc := v_cant_nc + 1;
            IF v_primera_nc IS NULL THEN v_primera_nc := v_sale_record.numero_doc; END IF;
            v_ultima_nc := v_sale_record.numero_doc;
        ELSIF v_sale_record.tipo_doc = 'NOTA_DEBITO' THEN
            v_cant_nd := v_cant_nd + 1;
            IF v_primera_nd IS NULL THEN v_primera_nd := v_sale_record.numero_doc; END IF;
            v_ultima_nd := v_sale_record.numero_doc;
        END IF;

        -- Acumulación impositiva (Notas de Crédito restan)
        IF v_sale_record.tipo_doc = 'NOTA_CREDITO' THEN
            v_ventas_exentas_bs := v_ventas_exentas_bs - COALESCE(v_sale_record.base_exenta_bs, 0);
            v_base_general_bs := v_base_general_bs - COALESCE(v_sale_record.base_general_bs, 0);
            v_debito_general_bs := v_debito_general_bs - COALESCE(v_sale_record.iva_general_bs, 0);
            v_base_reducida_bs := v_base_reducida_bs - COALESCE(v_sale_record.base_reducida_bs, 0);
            v_debito_reducido_bs := v_debito_reducido_bs - COALESCE(v_sale_record.iva_reducida_bs, 0);
            v_total_ventas_bs := v_total_ventas_bs - COALESCE(v_sale_record.total_bs, 0);
            v_total_ventas_usd := v_total_ventas_usd - COALESCE(v_sale_record.total_usd, 0);
        ELSE
            v_ventas_exentas_bs := v_ventas_exentas_bs + COALESCE(v_sale_record.base_exenta_bs, 0);
            v_base_general_bs := v_base_general_bs + COALESCE(v_sale_record.base_general_bs, 0);
            v_debito_general_bs := v_debito_general_bs + COALESCE(v_sale_record.iva_general_bs, 0);
            v_base_reducida_bs := v_base_reducida_bs + COALESCE(v_sale_record.base_reducida_bs, 0);
            v_debito_reducido_bs := v_debito_reducido_bs + COALESCE(v_sale_record.iva_reducida_bs, 0);
            v_total_ventas_bs := v_total_ventas_bs + COALESCE(v_sale_record.total_bs, 0);
            v_total_ventas_usd := v_total_ventas_usd + COALESCE(v_sale_record.total_usd, 0);
        END IF;

        v_base_igtf_bs := v_base_igtf_bs + COALESCE(v_sale_record.base_igtf_bs, 0);
        v_total_igtf_bs := v_total_igtf_bs + COALESCE(v_sale_record.igtf_bs, 0);
    END LOOP;

    v_total_debito_bs := v_debito_general_bs + v_debito_reducido_bs + v_debito_adicional_bs;
    v_nuevo_gran_total := v_ultimo_gran_total + GREATEST(0.00, v_total_ventas_bs);

    -- Insertar el Registro Oficial de Cierre Z
    INSERT INTO public.fiscal_closures (
        id, tipo, numero_z, fecha_apertura, fecha_cierre,
        primera_factura, ultima_factura, primera_nc, ultima_nc, primera_nd, ultima_nd,
        cantidad_facturas, cantidad_nc, cantidad_nd, total_documentos,
        ventas_exentas_bs, base_general_bs, debito_general_bs,
        base_reducida_bs, debito_reducido_bs, base_adicional_bs, debito_adicional_bs,
        total_debito_fiscal_bs, base_igtf_bs, total_igtf_bs,
        total_ventas_bs, total_ventas_usd, tasa_bcv,
        gran_total_historico_bs, desglose_pagos,
        usuario_id, usuario_nombre, firma_hash_sha256
    ) VALUES (
        v_cierre_id, 'Z', v_nuevo_z, v_fecha_apertura, v_fecha_cierre,
        v_primera_factura, v_ultima_factura, v_primera_nc, v_ultima_nc, v_primera_nd, v_ultima_nd,
        v_cant_facturas, v_cant_nc, v_cant_nd, v_total_docs,
        v_ventas_exentas_bs, v_base_general_bs, v_debito_general_bs,
        v_base_reducida_bs, v_debito_reducido_bs, v_base_adicional_bs, v_debito_adicional_bs,
        v_total_debito_bs, v_base_igtf_bs, v_total_igtf_bs,
        v_total_ventas_bs, v_total_ventas_usd, p_tasa_bcv,
        v_nuevo_gran_total, v_desglose_pagos,
        p_usuario_id, p_usuario_nombre, p_firma_hash
    );

    -- Actualizar secuencia
    UPDATE public.fiscal_sequences
    SET ultimo_numero = v_nuevo_z, updated_at = now()
    WHERE id = 'REPORTE_Z';

    -- Marcar todas las ventas del período como cerradas e inmutables
    UPDATE public.sales
    SET cierre_z_id = v_cierre_id, cerrada = true
    WHERE cerrada = false AND estado != 'ANULADA';

    RETURN jsonb_build_object(
        'success', true,
        'cierre_id', v_cierre_id,
        'numero_z', v_nuevo_z,
        'documentos_cerrados', v_total_docs,
        'total_ventas_bs', v_total_ventas_bs,
        'gran_total_historico_bs', v_nuevo_gran_total
    );
END;
$$ LANGUAGE plpgsql;
