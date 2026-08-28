-- ============================================================================
-- VERIFICACIÓN ESTADO SUPABASE - Market Coffee
-- Ejecuta esto en: Supabase Dashboard → SQL Editor → Run
-- ============================================================================

-- 1️⃣ VERIFICAR MIGRACIONES BASE (33, 34, 23)
SELECT '=== MIGRACIONES BASE ===' as check;

-- Tabla auditoría (migración 33)
SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'security_audit_logs')
  THEN '✅ security_audit_logs EXISTE'
  ELSE '❌ security_audit_logs FALTA' END as status;

-- RPC login_seguro (admin/operator) - migración 33
SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'login_seguro')
  THEN '✅ login_seguro EXISTE'
  ELSE '❌ login_seguro FALTA' END as status;

-- RPC solicitar_reset_whatsapp - migración 33
SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'solicitar_reset_whatsapp')
  THEN '✅ solicitar_reset_whatsapp EXISTE'
  ELSE '❌ solicitar_reset_whatsapp FALTA' END as status;

-- RPC reset_password_manual - migración 33
SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'reset_password_manual')
  THEN '✅ reset_password_manual EXISTE'
  ELSE '❌ reset_password_manual FALTA' END as status;

-- RPC check_account_lockout (admin) - migración 33
SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_account_lockout')
  THEN '✅ check_account_lockout EXISTE'
  ELSE '❌ check_account_lockout FALTA' END as status;

-- Función cleanup - migración 33
SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_expired_security_logs')
  THEN '✅ cleanup_expired_security_logs EXISTE'
  ELSE '❌ cleanup_expired_security_logs FALTA' END as status;

-- RPC lookup_admin_email - migración 22
SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'lookup_admin_email')
  THEN '✅ lookup_admin_email EXISTE'
  ELSE '❌ lookup_admin_email FALTA' END as status;

-- 2️⃣ VERIFICAR USUARIOS ADMIN/OPERATOR (migraciones 33, 34, 23)
SELECT '=== USUARIOS AUTH ===' as check;

SELECT 
  u.email,
  u.email_confirmed_at IS NOT NULL as email_confirmado,
  u.raw_app_meta_data->>'role' as auth_role,
  a.username,
  a.role as admin_role,
  a.active
FROM auth.users u
LEFT JOIN public.admin_users a ON a.id = u.id
WHERE u.email IN ('kecho8a@gmail.com', 'marketcoffe.ve@gmail.com')
ORDER BY u.email;

-- 3️⃣ VERIFICAR MIGRACIONES NUEVAS (35, 36)
SELECT '=== MIGRACIONES NUEVAS (35, 36) ===' as check;

-- RPC login_seguro_cliente - migración 35
SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'login_seguro_cliente')
  THEN '✅ login_seguro_cliente EXISTE'
  ELSE '❌ login_seguro_cliente FALTA (ejecutar 35_login_seguro_cliente.sql)' END as status;

-- RPC check_client_account_lockout - migración 35
SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_client_account_lockout')
  THEN '✅ check_client_account_lockout EXISTE'
  ELSE '❌ check_client_account_lockout FALTA (ejecutar 35_login_seguro_cliente.sql)' END as status;

-- RPC register_client_audit - migración 35
SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'register_client_audit')
  THEN '✅ register_client_audit EXISTE'
  ELSE '❌ register_client_audit FALTA (ejecutar 35_login_seguro_cliente.sql)' END as status;

-- Columna contrasena eliminada - migración 36
SELECT 
  CASE WHEN NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'usuarios_clientes' AND column_name = 'contrasena'
  )
  THEN '✅ contrasena ELIMINADA de usuarios_clientes'
  ELSE '❌ contrasena AÚN EXISTE (ejecutar 36_drop_contrasena_column.sql)' END as status;

-- 4️⃣ VERIFICAR RLS EN security_audit_logs
SELECT '=== RLS POLICIES ===' as check;

SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'security_audit_logs'
ORDER BY policyname;

-- 5️⃣ VERIFICAR GRANTS (permisos anon/authenticated)
SELECT '=== GRANTS ===' as check;

SELECT proname, 
  CASE WHEN proacl::text LIKE '%anon%' THEN '✅ anon' ELSE '❌ anon' END as anon_grant,
  CASE WHEN proacl::text LIKE '%authenticated%' THEN '✅ authenticated' ELSE '❌ authenticated' END as auth_grant
FROM pg_proc
WHERE proname IN (
  'login_seguro', 'check_account_lockout', 'solicitar_reset_whatsapp', 
  'reset_password_manual', 'login_seguro_cliente', 'check_client_account_lockout',
  'register_client_audit', 'cleanup_expired_security_logs', 'lookup_admin_email'
)
ORDER BY proname;

-- 6️⃣ VERIFICAR TRIGGER on_auth_user_created
SELECT '=== TRIGGERS ===' as check;

SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE tgname = 'on_auth_user_created';

-- 7️⃣ VERIFICAR store_config (configuración central)
SELECT '=== STORE CONFIG ===' as check;

SELECT id, site_nombre, theme_color, loyalty
FROM store_config
WHERE id = 1;

-- 8️⃣ RESUMEN FINAL
SELECT '=== RESUMEN ===' as check;
SELECT 
  (SELECT COUNT(*) FROM pg_proc WHERE proname IN ('login_seguro_cliente', 'check_client_account_lockout', 'register_client_audit')) as rpcs_nuevos_creados,
  (SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usuarios_clientes' AND column_name = 'contrasena') THEN 1 ELSE 0 END) as contrasena_eliminada,
  (SELECT COUNT(*) FROM auth.users WHERE email IN ('kecho8a@gmail.com', 'marketcoffe.ve@gmail.com')) as usuarios_auth_creados;