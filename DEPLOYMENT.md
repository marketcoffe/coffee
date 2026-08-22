# Guía de Despliegue Seguro — Market Coffee PWA

Pasos para llevar los cambios de seguridad a producción. Aplicar **en orden**.

---

## 1. Aplicar la migración de base de datos (Supabase)

1. Abre el **SQL Editor** de Supabase.
2. Pega el contenido de `supabase/migrations/2026080200_security_hardening.sql`.
3. Ejecuta. Crea:
   - Helpers `is_admin()`, `is_operator()`, `is_admin_or_operator()`
   - `adjust_stock()` (decremento atómico)
   - Tabla `app_secrets` + `get_push_webhook_secret()`
   - Trigger de notificaciones reescrito (lee el secret de `app_secrets`)
   - Políticas RLS: `notifications` anti-spam y `push_subscriptions` endurecida

4. La migración ya deja como valor por defecto el secret del demo
   (`fp-push-secret-2024-xK9m`). Si tuusas otro, actualízalo:
   ```sql
   UPDATE public.app_secrets
   SET push_webhook_secret = 'TU_SECRETO', updated_at = now()
   WHERE id = 1;
   ```

---

## 2. Estado actual: DEMO (se conservan los secretos originales)

Para este proyecto demo **no es necesario rotar** los secretos, aunque hayan estado
expuestos. El único cambio realizado es que el webhook secret ya **no viaja
dentro del bundle del cliente** (antes se inyectaba con `VITE_WEBHOOK_SECRET`).

- El webhook SÍ funciona igual: el trigger de Supabase lo lee de `app_secrets` y lo
  manda como header `x-push-webhook-secret`; la función Cloudflare lo valida contra
  su `PUSH_WEBHOOK_SECRET`.
- `.env` mantiene los valores originales (VAPID privada, webhook secret) solo para
  servidor/despliegue.

> Cuando pases a producción real, rota estos secretos (ver sección 3) y protege la
> `SERVICE_ROLE_KEY`.

---

## 3. Configurar Cloudflare Pages

Variables de entorno (Settings → Environment variables):

| Variable | Tipo | Ejemplo |
|---|---|---|
| `PUSH_WEBHOOK_SECRET` | **Secret** | valor aleatorio (coincide con `app_secrets`) |
| `VAPID_PRIVATE_KEY` | **Secret** | clave privada VAID nueva |
| `VAPID_PUBLIC_KEY` | Text | clave pública VAID |
| `ALLOWED_ORIGINS` | Text | `https://marketcoffesweet.com,http://localhost:3000` |

CORS: el default en las functions ya incluye `https://marketcoffesweet.com` y `localhost:3000`.

**Rate limiting (opcional pero recomendado):**
1. Crea un KV namespace en Cloudflare (Workers & Pages → KV).
2. Copia su `id`.
3. Descomenta y rellena en `wrangler.toml`:
   ```toml
   # [[kv_namespaces]]
   # binding = "PUSH_RATE_LIMIT_KV"
   # id = "ID_DEL_NAMESPACE"
   ```
4. Si desplegas desde el dashboard, añade el KV binding manualmente en la configuración.

---

## 4. Deploys

```bash
npm run build            # genera dist + copia functions
npx wrangler pages deploy dist --project-name=foodapp
```

---

## 5. Verificación post-deploy

- `sw.js` se regenera; revisa en DevTools → Application → Service Worker.
- `GET /api/push-notify` debe responder `{ status:'ok', authConfigured: true }`.
- `POST /api/push-notify` **sin** el header `x-push-webhook-secret` → `401 Unauthorized`.
- Desde un navegador del dominio permitido, probar registro de suscripción y una notificación push.
- Comprobar que el bundle del cliente **NO** contiene el webhook secret:
  ```bash

  # debería salir vacío
  Select-String -Path "dist\assets\*.js" -Pattern "fp-push-secret|xK9m" -SimpleMatch
  ```

---

## Notas

- Los email hardcodeados del admin siguen presentes en `schema_definitivo.sql`; se recomienda reemplazar esas `USING (auth.jwt()->>'email'=...)` por `public.is_admin_or_operator()` en un futuro ciclo.
- `store_config` ya no debe contener `push_webhook_secret`; el trigger usa `app_secrets`.