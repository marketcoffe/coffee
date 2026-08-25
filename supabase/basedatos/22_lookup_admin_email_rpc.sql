-- =============================================================
-- 22. RPC: Lookup admin email por username (bypass RLS)
-- PROPÓSITO: Permitir que authenticateAdmin resuelva username→email
--            sin necesidad de estar autenticado (RLS bloquea anon)
-- FECHA: 2026-08-25
-- NOTA: SECURITY DEFINER ejecuta con privilegios del owner,
--        bypaseando las políticas RLS de admin_users.
-- =============================================================

CREATE OR REPLACE FUNCTION public.lookup_admin_email(p_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_email TEXT;
BEGIN
    SELECT email INTO v_email
    FROM admin_users
    WHERE username = p_username
      AND active = true
    LIMIT 1;

    RETURN v_email;
END;
$$;

-- Permisos: anon y authenticated deben poder llamar esta función
-- para resolver username→email antes de autenticarse
GRANT EXECUTE ON FUNCTION public.lookup_admin_email TO anon;
GRANT EXECUTE ON FUNCTION public.lookup_admin_email TO authenticated;
