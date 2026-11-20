-- Persistencia de Saldos Iniciales (Apertura) con Fecha/Hora y Usuario en Cajas y Bancos
-- SIGNUM MOTORVEN — Tesorería BA VEN-NIF (1.01.01 Cajas / 1.01.02 Bancos)

ALTER TABLE IF EXISTS public.profit_cash_desks
  ADD COLUMN IF NOT EXISTS saldo_inicial_usd NUMERIC(18, 2),
  ADD COLUMN IF NOT EXISTS saldo_inicial_bs NUMERIC(18, 2),
  ADD COLUMN IF NOT EXISTS fecha_saldo_inicial TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS usuario_saldo_inicial TEXT;

ALTER TABLE IF EXISTS public.profit_bank_accounts
  ADD COLUMN IF NOT EXISTS saldo_inicial_usd NUMERIC(18, 2),
  ADD COLUMN IF NOT EXISTS saldo_inicial_bs NUMERIC(18, 2),
  ADD COLUMN IF NOT EXISTS fecha_saldo_inicial TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS usuario_saldo_inicial TEXT;
