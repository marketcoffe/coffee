-- Paso 1: Crear funcion helper para diagnosticar policies
CREATE OR REPLACE FUNCTION public.get_table_policies(p_table text)
RETURNS TABLE (
    polname name,
    polcmd text,
    polpermissive text,
    polroles text[],
    check_expr text,
    using_expr text
)
LANGUAGE sql SECURITY DEFINER
AS $$
    SELECT 
        p.polname,
        p.polcmd::text,
        p.polpermissive::text,
        ARRAY(SELECT r.rolname FROM pg_roles r WHERE r.oid = ANY(p.polroles)),
        pg_get_expr(p.polwithcheck, p.polrelid),
        pg_get_expr(p.polqual, p.polrelid)
    FROM pg_policy p
    WHERE p.polrelid = (quote_ident(p_table))::regclass;
$$;

-- Paso 2: Crear funcion para ejecutar SQL dinamico (diagnostico)
CREATE OR REPLACE FUNCTION public.run_sql(p_sql text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    EXECUTE p_sql;
    RETURN 'OK';
EXCEPTION WHEN OTHERS THEN
    RETURN SQLERRM;
END;
$$;
