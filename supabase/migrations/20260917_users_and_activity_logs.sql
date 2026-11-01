-- ==============================================================================
-- MIGRACIÓN DE PERSISTENCIA DE USUARIOS Y AUDITORÍA DE ACTIVIDAD - SIGNUM MOTORVEN
-- ==============================================================================

-- 1. Tabla de Usuarios del Sistema
CREATE TABLE IF NOT EXISTS public.users (
    id text PRIMARY KEY,
    username text UNIQUE NOT NULL,
    password text NOT NULL DEFAULT '123456',
    nombre text NOT NULL,
    cargo text NOT NULL,
    rol text NOT NULL,
    avatar text DEFAULT '👤',
    foto text,
    color text DEFAULT '#0ea5e9',
    descripcion text,
    activo boolean NOT NULL DEFAULT true,
    ultimo_acceso timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users (username);
CREATE INDEX IF NOT EXISTS idx_users_rol ON public.users (rol);

-- 2. Tabla de Bitácora / Registro de Auditoría de Usuarios
CREATE TABLE IF NOT EXISTS public.user_activity_logs (
    id text PRIMARY KEY,
    usuario_id text,
    usuario_nombre text,
    usuario_rol text,
    accion text NOT NULL, -- 'LOGIN', 'LOGOUT', 'CREAR_USUARIO', 'EDITAR_USUARIO', 'CAMBIAR_PASSWORD', 'ELIMINAR_USUARIO', 'VENTA_POS', etc.
    modulo text NOT NULL DEFAULT 'USUARIOS',
    detalles text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_activity_logs_created_at ON public.user_activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_usuario_id ON public.user_activity_logs (usuario_id);

-- 3. Habilitar permisos para la clave anónima del cliente frontend
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso para public.users
DROP POLICY IF EXISTS "Permitir lectura publica usuarios" ON public.users;
CREATE POLICY "Permitir lectura publica usuarios" 
ON public.users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercion usuarios" ON public.users;
CREATE POLICY "Permitir insercion usuarios" 
ON public.users FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualizacion usuarios" ON public.users;
CREATE POLICY "Permitir actualizacion usuarios" 
ON public.users FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir eliminacion usuarios" ON public.users;
CREATE POLICY "Permitir eliminacion usuarios" 
ON public.users FOR DELETE USING (true);

-- Políticas de acceso para public.user_activity_logs
DROP POLICY IF EXISTS "Permitir lectura publica logs" ON public.user_activity_logs;
CREATE POLICY "Permitir lectura publica logs" 
ON public.user_activity_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercion logs" ON public.user_activity_logs;
CREATE POLICY "Permitir insercion logs" 
ON public.user_activity_logs FOR INSERT WITH CHECK (true);

-- 4. Semillero Inicial de Usuarios Institucionales (si no existen)
INSERT INTO public.users (id, username, password, nombre, cargo, rol, avatar, foto, color, descripcion, activo)
VALUES 
    (
        'usr-gerencia',
        'gerencia',
        '123456',
        'Ricardo Sánchez',
        'Gerente General / Dirección',
        'GERENCIA',
        '👔',
        NULL,
        '#7c3aed',
        'Acceso total y gerencial a todos los módulos comerciales, inventario, costos confidenciales y libros fiscales.',
        true
    ),
    (
        'usr-admin',
        'admin',
        '123456',
        'Carlos Mendoza',
        'Administración & Finanzas',
        'ADMIN',
        '👨‍💼',
        NULL,
        '#002b7a',
        'Módulos autorizados: Compras & proveedores, caja & cuentas por pagar/cobrar, libros fiscales y SENIAT.',
        true
    ),
    (
        'usr-almacen',
        'almacen',
        '123456',
        'Pedro Gómez',
        'Jefe de Almacén y Despacho',
        'ALMACEN',
        '👷‍♂️',
        NULL,
        '#f59e0b',
        'Gestión de existencias físicas, ajustes de stock y recepción de compras.',
        true
    ),
    (
        'usr-vendedor',
        'vendedor',
        '123456',
        'Ana Rivas',
        'Asesor Comercial / Facturación',
        'VENDEDOR',
        '👩‍💼',
        NULL,
        '#0ea5e9',
        'Punto de venta POS, emisión de facturas y catálogo sin costos confidenciales.',
        true
    )
ON CONFLICT (id) DO UPDATE SET
    cargo = EXCLUDED.cargo,
    descripcion = EXCLUDED.descripcion;
