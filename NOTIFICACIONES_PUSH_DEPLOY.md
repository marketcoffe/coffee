# Checklist de Despliegue — Notificaciones Push (rastreo de pedidos al móvil)

Guía paso a paso para que las notificaciones de rastreo (Pendiente → Procesando →
En preparación → En camino → Entregado) lleguen **visibles al móvil**.

Problema reportado: solo se ve una notificación ("preparando"), el resto apenas
emiten sonido. Causas: trigger de DB que fallaba por `pgcrypto`, secret de webhook
mal sincronizado y comportamiento del Service Worker (colapso de notificaciones).

---

## 0. Cambios de código ya aplicados (están en el repo)

- `public/sw-push.js`: tag de **visualización único por entrega** (+timestamp).
  Evita que el navegador colapse la notificación siguiente mientras la anterior
  sigue en pantalla (fix de "solo suena, no muestra texto").
- Migración nueva `2026080204_fix_theme_mode_pgcrypto.sql` (tema + pgcrypto).
- Migración `2026080203_fix_rls_public_grants.sql` (grants RLS tablas públicas).

> Hay **dos versiones** del trigger de push en el código:
> - `schema_definitivo.sql` → `trigger_notify_push`, lee `store_config.push_webhook_secret`.
> - `2026080200_security_hardening.sql` → `trigger_push_notification`, lee `app_secrets`.
>
> **Usa como fuente de verdad la de `2026080200` (app_secrets).** Aplica esa
> migración para que el trigger definitivo lea el secreto desde `app_secrets`.

---

## 1. Base de datos (Supabase)

### 1.1 Aplicar todas las migraciones en orden
En **SQL Editor** de Supabase (o `npx supabase db push`), en este orden:

1. `2026080200_security_hardening.sql`
2. `2026080201_fix_business_phone.sql`
3. `2026080202_multisucursal.sql`
4. `2026080203_fix_rls_public_grants.sql`
5. `2026080204_fix_theme_mode_pgcrypto.sql`

O bien: ejecuta `schema_definitivo.sql` y LUEGO las migraciones (no dupliques
objetos; `IF NOT EXISTS`/`CREATE OR REPLACE` son seguros).

### 1.2 Habilitar extensiones
**Supabase → Database → Extensions:**
- `pg_net`   → **ON** (obligatorio: el trigger usa `net.http_post`)
- `pgcrypto` → **ON** (obligatorio: `gen_random_uuid()`/`gen_random_bytes()`)

### 1.3 Secreto del webhook (una sola fuente)
1. Elige un secreto fuerte (ej. `s3cr3t-f3liz-2024-AbC9z`).
2. Guárdalo en `app_secrets`:
```sql
INSERT INTO public.app_secrets (id, push_webhook_secret)
VALUES (1, 'MI_SECRETO')
ON CONFLICT (id) DO UPDATE SET push_webhook_secret = EXCLUDED.push_webhook_secret;
```
3. (Opcional, solo si usaste schema sin la migración 200) también en `store_config`:
```sql
UPDATE public.store_config SET push_webhook_secret = 'MI_SECRETO' WHERE id = 1;
```
4. Pega **el mismo valor** en Cloudflare (paso 2.2).

Verifica el trigger definitivo:
```sql
SELECT tgname FROM pg_trigger WHERE tgname IN ('trigger_notify_push','trigger_push_notification');
SELECT * FROM public.app_secrets WHERE id = 1;
```

---

## 2. Cloudflare

### 2.1 Worker / función `/api/push-notify` (variables de entorno)
`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`,
`PUSH_WEBHOOK_SECRET` = MI_SECRETO, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`ALLOWED_ORIGINS`.

> `PUSH_WEBHOOK_SECRET` debe ser idéntico a `app_secrets.push_webhook_secret`.

### 2.2 Pages — Build del frontend
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
`VITE_VAPID_PUBLIC_KEY` (pública), `VITE_PUSH_WEBHOOK_URL`.

> La clave VAPID pública/ privada deben ser un par válido (verificado: el par de
> `.env` es consistente). Nunca pongas la privada en el frontend.

### 2.3 Rebuild + deploy
- Cloudflare Pages → **Deploy**.
- El `sw-push.js` se actualiza con el build.

---

## 3. Device / PWA

- El móvil debe tener la **PWA instalada** (no solo el navegador).
- Después de actualizar el SW, cierra y reabre la app (o reinstala) para que el
  nuevo `sw-push.js` tome efecto.
- El usuario debe **aceptar notificaciones** desde el Perfil.
- Verifica que el `destinatario_telefono` de la suscripción coincida con el del
  pedido (formato 58.../0412...).

---

## 4. Verificación final

1. `GET https://marketcoffesweet.com/api/push-notify` →
   `{ status:'ok', vapidConfigured:true, authConfigured:true }`.
2. `POST /api/push-notify` sin header `x-push-webhook-secret` → `401`.
3. Pedido de prueba: avanza estados y confirma que **cada** estado muestra su
   notificación con texto en el móvil.
4. Revisa el trigger: `SELECT * FROM pg_trigger WHERE tgname = 'trigger_push_notification';`
5. Revisa columna: `SELECT * FROM store_config LIMIT 1;` (verás `theme_mode`).

---

## 5. Troubleshooting rápido

| Síntoma | Causa / acción |
|---|---|
| `gen_random_bytes does not exist` | Habilitar `pgcrypto` (1.2) |
| No llega nada | Habilitar `pg_net` (1.2) |
| `401 Unauthorized` en webhook | `app_secrets.push_webhook_secret` ≠ `PUSH_WEBHOOK_SECRET` (1.3/2.1) |
| Solo suena, no muestra texto | `sw-push.js` viejo: redeploy + reabrir PWA (3) |
| `podemos Not authorized` al `subscribe` | Coincidir la VAPID pública entre `.env` y CF; privada en Worker (2) |