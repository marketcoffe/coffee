-- MIGRACION: Agregar columna username a admin_users y usuarios_clientes
-- Permite login con usuario en vez de correo electronico
-- Fecha: 2026-08-23

-- 1. Agregar username a admin_users
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username) WHERE username IS NOT NULL;

-- 2. Agregar username a usuarios_clientes
ALTER TABLE usuarios_clientes ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_usuarios_clientes_username ON usuarios_clientes(username) WHERE username IS NOT NULL;

-- 3. Insertar usuarios iniciales con username
-- Admin principal
UPDATE admin_users SET username = 'maketo' WHERE email = 'kecho8a@gmail.com';

-- Cliente principal
UPDATE usuarios_clientes SET username = 'marketcoffee' WHERE email = 'marketcoffee.ve@gmail.com';
