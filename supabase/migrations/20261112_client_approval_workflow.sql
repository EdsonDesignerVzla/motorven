-- ==============================================================================
-- MIGRACIÓN: FLUJO DE SOLICITUD Y APROBACIÓN DE NUEVOS CLIENTES
-- Permite a los vendedores enviar solicitudes de alta (PENDIENTE) para ser
-- aprobadas por Caja Principal (Vanessa), Cobranzas (Rosibel), Supervisión
-- Comercial (Yheyson), TI (Manuel) o Administración/Gerencia/Master (Edson).
-- ==============================================================================

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS tipo_persona text DEFAULT '',
  ADD COLUMN IF NOT EXISTS nit text DEFAULT '',
  ADD COLUMN IF NOT EXISTS direccion2 text DEFAULT '',
  ADD COLUMN IF NOT EXISTS ciudad text DEFAULT '',
  ADD COLUMN IF NOT EXISTS estado text DEFAULT 'A',
  ADD COLUMN IF NOT EXISTS zip text DEFAULT '',
  ADD COLUMN IF NOT EXISTS fax text DEFAULT '',
  ADD COLUMN IF NOT EXISTS website text DEFAULT '',
  ADD COLUMN IF NOT EXISTS responsable text DEFAULT '',
  ADD COLUMN IF NOT EXISTS saldo_inicial numeric(10,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS descuento_pronto_pago numeric(5,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS descuento_global numeric(5,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS zona_venta text DEFAULT '',
  ADD COLUMN IF NOT EXISTS segmento text DEFAULT '',
  ADD COLUMN IF NOT EXISTS vendedor_asignado text DEFAULT '',
  ADD COLUMN IF NOT EXISTS tipo_iva text DEFAULT '1',
  ADD COLUMN IF NOT EXISTS es_contribuyente boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS es_contribuyente_especial boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS porcentaje_retencion_especial numeric(5,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS inactivo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sin_credito boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fecha_registro text DEFAULT '',
  ADD COLUMN IF NOT EXISTS ultima_factura text DEFAULT '',
  ADD COLUMN IF NOT EXISTS fecha_ultima_venta text DEFAULT '',
  ADD COLUMN IF NOT EXISTS monto_ultima_venta numeric(12,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS comentarios text DEFAULT '',
  ADD COLUMN IF NOT EXISTS estado_aprobacion text NOT NULL DEFAULT 'APROBADO',
  ADD COLUMN IF NOT EXISTS solicitado_por text DEFAULT '',
  ADD COLUMN IF NOT EXISTS solicitado_por_username text DEFAULT '',
  ADD COLUMN IF NOT EXISTS fecha_solicitud timestamptz,
  ADD COLUMN IF NOT EXISTS aprobado_por text DEFAULT '',
  ADD COLUMN IF NOT EXISTS aprobado_por_username text DEFAULT '',
  ADD COLUMN IF NOT EXISTS fecha_aprobacion timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_rechazo text DEFAULT '',
  ADD COLUMN IF NOT EXISTS imagen_documento text DEFAULT '',
  ADD COLUMN IF NOT EXISTS imagen_local text DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_clients_estado_aprobacion
  ON public.clients (estado_aprobacion);
