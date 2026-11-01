-- ==============================================================================
-- MIGRACIÓN DE POLÍTICAS DE ESCRITURA, MODIFICACIÓN Y ELIMINACIÓN (FULL CRUD)
-- Habilita permisos totales para SELECT, INSERT, UPDATE, DELETE en todas las tablas
-- ==============================================================================

DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'config',
        'clients',
        'products',
        'suppliers',
        'sales',
        'purchases',
        'cash_movements',
        'orders',
        'fiscal_closures',
        'users',
        'user_activity_logs',
        'notifications',
        'profit_invoices',
        'profit_collections',
        'profit_accounts_payable',
        'profit_supplier_payments',
        'profit_purchases',
        'profit_suppliers',
        'profit_sellers',
        'profit_bank_accounts',
        'profit_cash_desks',
        'profit_zones',
        'profit_transports',
        'profit_customer_returns',
        'profit_inventory_adjustments',
        'profit_warehouse_transfers',
        'profit_islr_concepts',
        'profit_beneficiaries',
        'profit_payment_orders',
        'profit_warehouses',
        'profit_product_lines',
        'profit_product_categories',
        'profit_currencies'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables
    LOOP
        -- Verificar si la tabla existe en public
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = tbl
        ) THEN
            -- Habilitar RLS
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);

            -- Limpiar políticas anteriores si existían
            EXECUTE format('DROP POLICY IF EXISTS "allow_all_select_%s" ON public.%I;', tbl, tbl);
            EXECUTE format('DROP POLICY IF EXISTS "allow_all_insert_%s" ON public.%I;', tbl, tbl);
            EXECUTE format('DROP POLICY IF EXISTS "allow_all_update_%s" ON public.%I;', tbl, tbl);
            EXECUTE format('DROP POLICY IF EXISTS "allow_all_delete_%s" ON public.%I;', tbl, tbl);
            EXECUTE format('DROP POLICY IF EXISTS "allow_all_crud_%s" ON public.%I;', tbl, tbl);

            -- Crear política universal permisiva de control total
            EXECUTE format('
                CREATE POLICY "allow_all_crud_%s" 
                ON public.%I 
                FOR ALL 
                TO public, anon, authenticated, service_role 
                USING (true) 
                WITH CHECK (true);
            ', tbl, tbl);

            -- Otorgar privilegios DML explícitos
            EXECUTE format('GRANT ALL PRIVILEGES ON TABLE public.%I TO anon, authenticated, service_role;', tbl);
        END IF;
    END LOOP;
END $$;
