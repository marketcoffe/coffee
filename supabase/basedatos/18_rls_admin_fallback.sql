-- =============================================================
-- 18. RLS: blindaje de administrador (fallback por email)
-- PROPÓSITO: garantizar que el administrador dueño (kecho8a@gmail.com)
-- siempre pueda escribir/leer catálogo y demás tablas protegidas, aunque
-- la fila en admin_users esté desincronizada. Sin esto, los INSERT/UPDATE
-- desde el panel admin son bloqueados silenciosamente por el WITH CHECK
-- de las políticas FOR ALL ... USING (is_admin_or_operator()).
-- =============================================================

-- 1) is_admin() con fallback por email del dueño (no rompe seguridad:
--    solo el correo del dueño supera la comprobación).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users a
    WHERE a.id::text = auth.uid()::text
      AND a.active = true
      AND a.role = 'admin'
  ) OR (auth.email() = 'kecho8a@gmail.com');
$$;

-- 2) (Re)asegurar la fila del administrador dueño de forma idempotente.
--    Si la fila no existe, se crea enlazada al auth user correspondiente.
INSERT INTO public.admin_users (id, email, username, nombre, role, active, created_at)
SELECT id, email, 'maketo', 'Admin', 'admin', true, NOW()
FROM auth.users
WHERE email = 'kecho8a@gmail.com'
ON CONFLICT (id) DO UPDATE SET active = true, role = 'admin';

-- 3) Comentario de trazabilidad
COMMENT ON FUNCTION public.is_admin() IS 'Admin = fila en admin_users (role=admin, active) O el email del dueño. SECURITY DEFINER.';
