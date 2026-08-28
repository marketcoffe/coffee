-- ═══════════════════════════════════════════════════════════════════════════
-- 36. ELIMINAR COLUMNA CONTRASEÑA DE USUARIOS_CLIENTES
-- PROPÓSITO: Remover almacenamiento de contraseñas en texto plano / redundante
-- FECHA: 2026-08-28
-- NOTA: Las contraseñas se gestionan exclusivamente en auth.users (bcrypt via Supabase Auth)
-- ═══════════════════════════════════════════════════════════════════════════

-- Eliminar columna contrasena si existe
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'usuarios_clientes' AND column_name = 'contrasena'
    ) THEN
        ALTER TABLE usuarios_clientes DROP COLUMN contrasena;
        RAISE NOTICE 'Columna contrasena eliminada de usuarios_clientes';
    ELSE
        RAISE NOTICE 'Columna contrasena no existe en usuarios_clientes';
    END IF;
END $$;

-- Verificar que la columna fue eliminada
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'usuarios_clientes' 
ORDER BY ordinal_position;