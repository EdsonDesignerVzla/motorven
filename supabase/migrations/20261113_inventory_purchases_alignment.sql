-- ==============================================================================
-- MIGRACIÓN: ALINEACIÓN DE INVENTARIO, ALMACENES 01/02 Y COMPRAS - SIGNUM MOTORVEN
-- Fecha: 2026-11-13
-- Descripción: Agrega de forma idempotente las columnas de trazabilidad de
-- almacén, flete, base reducida, condición de pago, recepción y control anti-doble-stock.
-- ==============================================================================

ALTER TABLE public.purchases
    ADD COLUMN IF NOT EXISTS almacen text DEFAULT '01',
    ADD COLUMN IF NOT EXISTS almacen_nombre text,
    ADD COLUMN IF NOT EXISTS base_reducida_usd numeric(18,2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS iva_reducida_usd numeric(18,2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS base_reducida_bs numeric(18,2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS iva_reducida_bs numeric(18,2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS flete_usd numeric(18,2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS flete_bs numeric(18,2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS monto_neto_pagar_usd numeric(18,2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS condicion_pago text DEFAULT 'CREDITO',
    ADD COLUMN IF NOT EXISTS dias_credito integer NOT NULL DEFAULT 15,
    ADD COLUMN IF NOT EXISTS recepcion_id text,
    ADD COLUMN IF NOT EXISTS stock_aplicado boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS items jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.profit_goods_receipt_notes
    ADD COLUMN IF NOT EXISTS almacen text DEFAULT '01',
    ADD COLUMN IF NOT EXISTS stock_aplicado boolean NOT NULL DEFAULT false;
