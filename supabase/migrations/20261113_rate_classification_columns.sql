-- Migración: Columnas estándar para clasificación e inmutabilidad de tasa de pago
-- Fecha: 2026-11-13
-- Tablas: sales, profit_invoices, profit_collections, profit_accounts_payable, profit_supplier_payments, cash_movements

ALTER TABLE IF EXISTS public.sales
    ADD COLUMN IF NOT EXISTS tipo_tasa text DEFAULT 'BCV',
    ADD COLUMN IF NOT EXISTS tasa_pago numeric(14,4),
    ADD COLUMN IF NOT EXISTS moneda_pago text DEFAULT 'USD';

ALTER TABLE IF EXISTS public.profit_invoices
    ADD COLUMN IF NOT EXISTS tipo_tasa text DEFAULT 'BCV',
    ADD COLUMN IF NOT EXISTS tasa_pago numeric(14,4),
    ADD COLUMN IF NOT EXISTS moneda_pago text DEFAULT 'BS';

ALTER TABLE IF EXISTS public.profit_collections
    ADD COLUMN IF NOT EXISTS tipo_tasa text DEFAULT 'BCV',
    ADD COLUMN IF NOT EXISTS tasa_pago numeric(14,4),
    ADD COLUMN IF NOT EXISTS moneda_pago text DEFAULT 'BS';

ALTER TABLE IF EXISTS public.profit_accounts_payable
    ADD COLUMN IF NOT EXISTS tipo_tasa text DEFAULT 'BCV',
    ADD COLUMN IF NOT EXISTS tasa_pago numeric(14,4),
    ADD COLUMN IF NOT EXISTS moneda_pago text DEFAULT 'BS';

ALTER TABLE IF EXISTS public.profit_supplier_payments
    ADD COLUMN IF NOT EXISTS tipo_tasa text DEFAULT 'BCV',
    ADD COLUMN IF NOT EXISTS tasa_pago numeric(14,4),
    ADD COLUMN IF NOT EXISTS moneda_pago text DEFAULT 'BS';

ALTER TABLE IF EXISTS public.cash_movements
    ADD COLUMN IF NOT EXISTS tipo_tasa text DEFAULT 'BCV',
    ADD COLUMN IF NOT EXISTS tasa_pago numeric(14,4),
    ADD COLUMN IF NOT EXISTS moneda_pago text DEFAULT 'USD';
