-- ==============================================================================
-- MIGRACIÓN DE ALINEACIÓN DE ESQUEMA CON EL FRONTEND - SIGNUM MOTORVEN
-- Fecha: 2026-11-12
-- Descripción: Agrega de forma idempotente las columnas utilizadas por
-- src/services/supabaseService.js que no estaban declaradas en las migraciones previas.
-- ==============================================================================

-- 1. Tabla config: tasas adicionales, políticas de crédito, inventario, WhatsApp y ejercicio fiscal
ALTER TABLE public.config
    ADD COLUMN IF NOT EXISTS pie_de_pagina text,
    ADD COLUMN IF NOT EXISTS tasa_keystone numeric(12,4),
    ADD COLUMN IF NOT EXISTS margen_keystone_porcentaje numeric(6,2) DEFAULT 3.00,
    ADD COLUMN IF NOT EXISTS dias_credito_defecto integer DEFAULT 15,
    ADD COLUMN IF NOT EXISTS limite_credito_defecto numeric(14,2) DEFAULT 1000.00,
    ADD COLUMN IF NOT EXISTS aprobador_credito_defecto text,
    ADD COLUMN IF NOT EXISTS aprobadores_credito jsonb DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS alerta_stock_minimo_dias integer DEFAULT 15,
    ADD COLUMN IF NOT EXISTS lead_time_dias_defecto integer DEFAULT 7,
    ADD COLUMN IF NOT EXISTS margen_ganancia_aceites numeric(6,2) DEFAULT 35.00,
    ADD COLUMN IF NOT EXISTS activar_alertas_quiebre boolean DEFAULT true,
    ADD COLUMN IF NOT EXISTS bloqueo_mora_dias integer DEFAULT 30,
    ADD COLUMN IF NOT EXISTS alerta_amarilla_mora_dias integer DEFAULT 15,
    ADD COLUMN IF NOT EXISTS plantilla_whatsapp text,
    ADD COLUMN IF NOT EXISTS profit_bridge_url text,
    ADD COLUMN IF NOT EXISTS sync_interval_sec integer DEFAULT 60,
    ADD COLUMN IF NOT EXISTS offline_first_enabled boolean DEFAULT true,
    ADD COLUMN IF NOT EXISTS sonidos_notificacion boolean DEFAULT true,
    ADD COLUMN IF NOT EXISTS ejercicio_fiscal_activo integer DEFAULT 2026,
    ADD COLUMN IF NOT EXISTS periodo_fiscal_inicio date DEFAULT '2026-01-01',
    ADD COLUMN IF NOT EXISTS periodo_fiscal_fin date DEFAULT '2026-12-31',
    ADD COLUMN IF NOT EXISTS historial_ejercicios jsonb DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2. Tabla products: almacenes 01/02, jerarquía Profit Plus y metadatos de catálogo
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS co_art text,
    ADD COLUMN IF NOT EXISTS nombre text,
    ADD COLUMN IF NOT EXISTS stock_almacen_01 numeric(14,2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS stock_almacen_02 numeric(14,2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS linea text,
    ADD COLUMN IF NOT EXISTS linea_descripcion text,
    ADD COLUMN IF NOT EXISTS co_lin text,
    ADD COLUMN IF NOT EXISTS familia text,
    ADD COLUMN IF NOT EXISTS familia_descripcion text,
    ADD COLUMN IF NOT EXISTS co_sub text,
    ADD COLUMN IF NOT EXISTS co_cat text,
    ADD COLUMN IF NOT EXISTS almacen text,
    ADD COLUMN IF NOT EXISTS co_alm text,
    ADD COLUMN IF NOT EXISTS almacenes text[] DEFAULT ARRAY['01','02'],
    ADD COLUMN IF NOT EXISTS ubicacion text,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 3. Tabla clients: campos comerciales y tributarios Profit Plus
ALTER TABLE public.clients
    ADD COLUMN IF NOT EXISTS nit text,
    ADD COLUMN IF NOT EXISTS direccion2 text,
    ADD COLUMN IF NOT EXISTS ciudad text,
    ADD COLUMN IF NOT EXISTS estado text,
    ADD COLUMN IF NOT EXISTS zip text,
    ADD COLUMN IF NOT EXISTS fax text,
    ADD COLUMN IF NOT EXISTS website text,
    ADD COLUMN IF NOT EXISTS responsable text,
    ADD COLUMN IF NOT EXISTS saldo_inicial numeric(14,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS descuento_pronto_pago numeric(6,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS descuento_global numeric(6,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS zona_venta text,
    ADD COLUMN IF NOT EXISTS segmento text,
    ADD COLUMN IF NOT EXISTS vendedor_asignado text,
    ADD COLUMN IF NOT EXISTS tipo_iva text DEFAULT '1',
    ADD COLUMN IF NOT EXISTS es_contribuyente boolean DEFAULT true,
    ADD COLUMN IF NOT EXISTS es_contribuyente_especial boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS porcentaje_retencion_especial numeric(5,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS inactivo boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS sin_credito boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS fecha_registro text,
    ADD COLUMN IF NOT EXISTS ultima_factura text,
    ADD COLUMN IF NOT EXISTS fecha_ultima_venta text,
    ADD COLUMN IF NOT EXISTS monto_ultima_venta numeric(14,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS comentarios text;

-- 4. Tabla sales: saldos, crédito y trazabilidad de pedido origen
ALTER TABLE public.sales
    ADD COLUMN IF NOT EXISTS saldo_usd numeric(18,2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS saldo_bs numeric(18,2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS dias_credito integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS fecha_emision timestamptz,
    ADD COLUMN IF NOT EXISTS fecha_vencimiento timestamptz,
    ADD COLUMN IF NOT EXISTS pedido_origen_id text,
    ADD COLUMN IF NOT EXISTS pedido_origen_doc text;

-- 5. Tabla users: campos extendidos de contacto
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS cedula text,
    ADD COLUMN IF NOT EXISTS email text,
    ADD COLUMN IF NOT EXISTS phone text;

-- 6. Tablas orders y order_items (si no existían en migraciones previas)
CREATE TABLE IF NOT EXISTS public.orders (
    id text PRIMARY KEY,
    numero_pedido text NOT NULL,
    numero_doc text,
    tipo_doc text NOT NULL DEFAULT 'PEDIDO',
    fecha_emision timestamptz NOT NULL DEFAULT now(),
    fecha_entrega timestamptz,
    fecha_vencimiento timestamptz,
    cliente_id text,
    cliente_nombre text NOT NULL DEFAULT '',
    cliente_rif text NOT NULL DEFAULT '',
    vendedor_id text,
    vendedor_nombre text,
    almacen_id text DEFAULT '01',
    zona_venta text,
    segmento text,
    condicion_pago text NOT NULL DEFAULT 'Contado',
    forma_pago text,
    dias_credito integer NOT NULL DEFAULT 0,
    moneda text NOT NULL DEFAULT 'USD',
    tasa_cambio numeric(14,4) NOT NULL DEFAULT 1.00,
    subtotal_usd numeric(18,2) NOT NULL DEFAULT 0.00,
    total_bruto_usd numeric(18,2) NOT NULL DEFAULT 0.00,
    descuento_global_pct numeric(6,2) NOT NULL DEFAULT 0.00,
    descuento_usd numeric(18,2) NOT NULL DEFAULT 0.00,
    base_imponible_usd numeric(18,2) NOT NULL DEFAULT 0.00,
    aplica_iva boolean NOT NULL DEFAULT false,
    iva_porcentaje numeric(5,2) NOT NULL DEFAULT 16.00,
    iva_usd numeric(18,2) NOT NULL DEFAULT 0.00,
    total_usd numeric(18,2) NOT NULL DEFAULT 0.00,
    total_neto_usd numeric(18,2) NOT NULL DEFAULT 0.00,
    total_bs numeric(18,2) NOT NULL DEFAULT 0.00,
    total_litros numeric(14,2) NOT NULL DEFAULT 0.00,
    status text NOT NULL DEFAULT 'PENDIENTE',
    estado text,
    observaciones text,
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_items (
    id text PRIMARY KEY,
    order_id text REFERENCES public.orders(id) ON DELETE CASCADE,
    reng_num integer NOT NULL DEFAULT 1,
    articulo_id text NOT NULL,
    articulo_descripcion text,
    unidad_venta text DEFAULT 'Caja',
    cantidad numeric(14,2) NOT NULL DEFAULT 1,
    litros_unitarios numeric(12,2) NOT NULL DEFAULT 1,
    litros_totales numeric(14,2) NOT NULL DEFAULT 1,
    precio_unitario_usd numeric(18,2) NOT NULL DEFAULT 0.00,
    total_usd numeric(18,2) NOT NULL DEFAULT 0.00
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
