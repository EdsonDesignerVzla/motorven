-- Tabla de Configuración Global
CREATE TABLE IF NOT EXISTS public.config (
    id integer PRIMARY KEY DEFAULT 1,
    nombre_empresa text NOT NULL,
    marca_oficial text NOT NULL,
    rif text NOT NULL,
    direccion text NOT NULL,
    telefono text NOT NULL,
    email text NOT NULL,
    instagram text,
    tasa_dolar numeric(10,2) NOT NULL DEFAULT 36.50,
    moneda_principal text NOT NULL DEFAULT 'USD',
    moneda_secundaria text NOT NULL DEFAULT 'Bs.',
    almacen_actual text NOT NULL,
    iva_porcentaje numeric(5,2) NOT NULL DEFAULT 16.00,
    igtf_porcentaje numeric(5,2) NOT NULL DEFAULT 3.00,
    meta_comercial_litros numeric(12,2) NOT NULL DEFAULT 20000.00,
    constraint single_row check (id = 1)
);

-- Tabla de Clientes
CREATE TABLE IF NOT EXISTS public.clients (
    id text PRIMARY KEY,
    codigo text NOT NULL,
    nombre text NOT NULL,
    rif text NOT NULL,
    telefono text,
    email text,
    direccion text,
    limite_credito_usd numeric(10,2) NOT NULL DEFAULT 0.00,
    saldo_deudor_usd numeric(10,2) NOT NULL DEFAULT 0.00,
    dias_credito integer NOT NULL DEFAULT 0,
    tipo_cliente text NOT NULL
);

-- Tabla de Productos / Lubricantes
CREATE TABLE IF NOT EXISTS public.products (
    id text PRIMARY KEY, -- OIL-15W40-SL, etc.
    codigo text NOT NULL,
    oem text,
    descripcion text NOT NULL,
    marca text NOT NULL,
    categoria text NOT NULL,
    viscosidad text,
    norma_api text,
    presentaciones_disponibles text[] NOT NULL DEFAULT '{}',
    unidad text NOT NULL,
    litros_por_unidad numeric(10,2) NOT NULL DEFAULT 0.00,
    stock integer NOT NULL DEFAULT 0,
    comprometido integer NOT NULL DEFAULT 0,
    stock_minimo integer NOT NULL DEFAULT 0,
    costo_usd numeric(10,2) NOT NULL DEFAULT 0.00,
    precio_usd_detal numeric(10,2) NOT NULL DEFAULT 0.00,
    precio_usd_mayor numeric(10,2) NOT NULL DEFAULT 0.00,
    aplica_iva boolean NOT NULL DEFAULT true,
    color_etiqueta text NOT NULL DEFAULT '#002b7a',
    imagen text,
    especificaciones jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Tabla de Proveedores
CREATE TABLE IF NOT EXISTS public.suppliers (
    id text PRIMARY KEY,
    codigo text NOT NULL,
    nombre text NOT NULL,
    rif text NOT NULL,
    telefono text,
    email text,
    direccion text,
    saldo_pendiente_usd numeric(10,2) NOT NULL DEFAULT 0.00
);

-- Tabla de Ventas (Facturas / Notas de Entrega)
CREATE TABLE IF NOT EXISTS public.sales (
    id text PRIMARY KEY,
    numero_doc text NOT NULL,
    tipo_doc text NOT NULL,
    fecha timestamptz NOT NULL DEFAULT now(),
    cliente_id text REFERENCES public.clients(id),
    cliente_nombre text NOT NULL,
    cliente_rif text NOT NULL,
    tasa_dolar numeric(10,2) NOT NULL,
    condicion_pago text NOT NULL,
    items jsonb NOT NULL DEFAULT '[]'::jsonb,
    subtotal_usd numeric(10,2) NOT NULL,
    iva_usd numeric(10,2) NOT NULL,
    igtf_usd numeric(10,2) NOT NULL DEFAULT 0.00,
    total_usd numeric(10,2) NOT NULL,
    subtotal_bs numeric(15,2) NOT NULL,
    iva_bs numeric(15,2) NOT NULL,
    total_bs numeric(15,2) NOT NULL,
    estado text NOT NULL DEFAULT 'PAGADO', -- PAGADO / PENDIENTE
    metodo_pago text NOT NULL,
    vendedor text NOT NULL
);

-- Tabla de Movimientos de Caja Chica
CREATE TABLE IF NOT EXISTS public.cash_movements (
    id text PRIMARY KEY,
    fecha timestamptz NOT NULL DEFAULT now(),
    tipo text NOT NULL, -- INGRESO / EGRESO
    concepto text NOT NULL,
    monto_usd numeric(10,2) NOT NULL DEFAULT 0.00,
    monto_bs numeric(15,2) NOT NULL DEFAULT 0.00,
    metodo text NOT NULL,
    usuario text NOT NULL
);
