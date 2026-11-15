-- ==============================================================================
-- MIGRACIÓN: PRECIOS Y COSTOS INDEPENDIENTES POR ALMACÉN (01 y 02)
-- Fecha: 2026-11-15
-- Descripción: Agrega columnas para independizar costos y precios (detal y mayor)
-- entre Almacén 01 (Principal / Fiscal) y Almacén 02 (Central / Despacho / NE).
-- ==============================================================================

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS costo_usd_01 numeric(18,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS costo_usd_02 numeric(18,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS precio_usd_detal_01 numeric(18,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS precio_usd_detal_02 numeric(18,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS precio_usd_mayor_01 numeric(18,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS precio_usd_mayor_02 numeric(18,2) DEFAULT 0.00;

-- Inicializar valores por almacén con los valores generales si aún están en cero o nulos
UPDATE public.products
SET 
    costo_usd_01 = COALESCE(NULLIF(costo_usd_01, 0), costo_usd, 0),
    costo_usd_02 = COALESCE(NULLIF(costo_usd_02, 0), costo_usd, 0),
    precio_usd_detal_01 = COALESCE(NULLIF(precio_usd_detal_01, 0), precio_usd_detal, 0),
    precio_usd_detal_02 = COALESCE(NULLIF(precio_usd_detal_02, 0), precio_usd_detal, 0),
    precio_usd_mayor_01 = COALESCE(NULLIF(precio_usd_mayor_01, 0), precio_usd_mayor, 0),
    precio_usd_mayor_02 = COALESCE(NULLIF(precio_usd_mayor_02, 0), precio_usd_mayor, 0)
WHERE 
    costo_usd_01 = 0 OR costo_usd_02 = 0 OR 
    precio_usd_detal_01 = 0 OR precio_usd_detal_02 = 0 OR 
    precio_usd_mayor_01 = 0 OR precio_usd_mayor_02 = 0;
