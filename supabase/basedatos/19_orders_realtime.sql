-- =============================================================
-- 19. Realtime: asegurar entrega de pedidos (incl. pedidos de mesa)
-- PROPÓSITO: si la tabla orders NO está en la publicación supabase_realtime
-- o su REPLICA IDENTITY no es FULL, los pedidos nuevos no llegan en vivo al
-- panel admin (Pedidos Mesa / Comandas) hasta recargar manualmente.
-- Estas sentencias son idempotentes (no fallan si ya están aplicadas).
-- =============================================================

-- 1) Agregar orders a la publicación de realtime (si no está).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
END $$;

-- 2) REPLICA IDENTITY FULL para que el payload de postgres_changes incluya
--    los valores completos (requerido por Supabase Realtime).
ALTER TABLE public.orders REPLICA IDENTITY FULL;

-- 3) Verificación rápida (opcional, no afecta nada):
-- SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='orders';
-- SELECT relreplident FROM pg_class WHERE relname='orders'; -- debe ser 'f' (FULL)
