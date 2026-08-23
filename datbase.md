🛠️ PROTOCOLO MAESTRO Y DIRECTIVA TÉCNICA DE ARQUITECTURA MODULAR SUPABASE (.SQL)

Este documento es la directiva técnica absoluta y obligatoria para cualquier Asistente de IA o Desarrollador que trabaje en este sistema. Su objetivo es garantizar la modularidad total del software, la organización de la base de datos en Supabase, la gestión de archivos e imágenes en Storage, la prevención estricta de fugas de datos y la sincronización continua entre el código frontend y sus scripts .sql.
🎯 1. REGLA DE ORO Y PRINCIPIOS DE MODULARIDAD

    Correspondencia Estricta 1 a 1: Por cada sección, grupo de funcionalidades o módulo del frontend/backend, debe existir un único archivo .sql equivalente, completamente independiente y auto-contenido dentro de la carpeta /supabase/basedatos/.

    Creación Dinámica de Nuevos Módulos: Si se solicita crear una funcionalidad completamente nueva que no pertenezca lógicamente a ninguno de los módulos existentes, la IA DEBE crear un nuevo archivo .sql exclusivo para esa función, asignándole el número secuencial siguiente (ejemplo: 10_nombre_modulo.sql).

    Mantenimiento Sincronizado Obligatorio: Queda strictly prohibido modificar o crear componentes React/Next.js o lógica del sistema sin actualizar, organizar o crear el archivo .sql perteneciente al módulo afectado.

    Independencia e Idempotencia: Cada script .sql debe poder ejecutarse múltiples veces sin lanzar errores (CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE FUNCTION, DROP POLICY IF EXISTS antes de CREATE POLICY).

📂 2. ESTRUCTURA Y CATÁLOGO OFICIAL DE MÓDULOS EN /supabase/basedatos/

Toda la base de datos del proyecto debe organizarse, limpiarse y mantenerse obligatoriamente bajo la siguiente estructura de carpetas y archivos. Si la IA detecta scripts SQL desorganizados o monolíticos existentes, debe reorganizarlos siguiendo esta tabla:

    01_core_sistema_sedes_roles.sql --> Sucursales, perfiles, roles (admin/operator/customer), auth.users.

    02_reportes_analitica_kpis.sql --> Vistas de dashboard, KPIs, estadísticas de ventas, app y productos.

    03_pedidos_comandas_kanban.sql --> Historial, comandas en tiempo real, Kanban, tracking GPS, WebSocket.

    04_checkout_tres_pasos_pagos.sql --> Proceso de compra, pasarelas, tasas Bs/USD, zonas de delivery.

    05_tienda_productos_inventario.sql --> Productos, categorías, variantes, opciones/extras, stock.

    06_marketing_fidelizacion_cupones.sql --> Puntos, niveles, promociones, ofertas flash, combos, segmentos.

    07_notificaciones_push_mensajeria.sql --> Broadcasts, chat 1-a-1, reglas de automatización, webhooks.

    08_configuracion_pwa_personalizacion.sql --> Banners, personalización visual, SEO, Schema JSON-LD, config PWA.

    09_storage_imagenes_archivos.sql --> Buckets de Supabase Storage, políticas RLS para imágenes/archivos.

    [XX]_[nuevo_modulo_generado].sql --> Creado automáticamente si surge una funcionalidad no cubierta.

Encabezado Estándar Obligatorio para Archivos .sql:

Todo archivo dentro de /supabase/basedatos/ DEBE comenzar obligatoriamente con este bloque:

-- ========================================================
-- MÓDULO: [NOMBRE DEL MÓDULO EN MAYÚSCULAS]
-- ARCHIVO: /supabase/basedatos/[XX]_[nombre_modulo].sql
-- PROPÓSITO: Definición de Tablas, RLS, Índices, RPCs, Triggers y Storage.
-- ÚLTIMA REVISIÓN: YYYY-MM-DD
-- ========================================================
🔒 3. AUDITORÍA DE SEGURIDAD, RLS Y PROTECCIÓN DE DATOS (PII)

Antes de entregar cualquier solución de código o SQL, la IA debe auditar y aplicar sin excepciones las siguientes políticas:

    Row Level Security (RLS) al 100%:

        Ninguna tabla puede quedar expuesta. Ejecutar siempre: ALTER TABLE public.nombre_tabla ENABLE ROW LEVEL SECURITY;.

        Definir políticas RLS granulares para SELECT, INSERT, UPDATE y DELETE basadas en los roles del sistema (admin, operator, customer).

    Aislamiento Multi-Sede (Multi-tenant):

        Garantizar mediante RLS que un operador asignado a una sede solo pueda leer y modificar datos pertenecientes a su sede_id.

    Gestión Segura de Supabase Storage:

        Definir los Buckets necesarios usando SQL idempotente: INSERT INTO storage.buckets (id, name, public) VALUES ('imagenes_tienda', 'imagenes_tienda', true) ON CONFLICT (id) DO NOTHING;

        Aplicar políticas RLS en storage.objects para permitir lectura pública de imágenes del catálogo, pero restringir la subida, edición y eliminación exclusivamente a usuarios autenticados con rol admin u operator.

    Prevención de Fugas de Datos y Seguridad Defensiva:

        Prevenir la exposición involuntaria de teléfonos, emails, direcciones y transacciones financieras en endpoints o vistas públicas.

        Declarar SET search_path = public en todas las funciones con SECURITY DEFINER para evitar ataques de escalada de privilegios.

🧪 4. PROTOCOLO DE PRUEBAS Y REPARACIÓN PROACTIVA

    Reparación Integrada: Si el usuario solicita corregir o usar una función que "no sirve" o está rota, la IA no debe limitarse al frontend; debe inspeccionar la llamada al SDK de Supabase, las políticas RLS, los tipos de datos y corregir la causa raíz.

    Sincronización Total: Confirmar que las tablas, nombres de columnas, RPCs, canales Realtime y Buckets de Storage mencionados en el código React/Next.js coincidan exactamente con la declaración del archivo .sql.

    Prueba de No Interferencia: Verificar que las modificaciones hechas en el .sql de un módulo no alteren ni rompan las relaciones de claves foráneas ni dependencias de otros módulos.

🚀 5. PROMPT MAESTRO PARA INICIALIZAR LA IA (COPIAR Y PEGAR)

Actúa como Desarrollador Full Stack Senior y Arquitecto experto en Supabase. Estás obligado a seguir strictly las reglas del Protocolo Maestro de Arquitectura Modular ubicado en la raíz del proyecto.

Mi requerimiento actual es: [DESCRIBE AQUÍ EL CAMBIO, CORRECCIÓN O NUEVA FUNCIONALIDAD QUE QUIERES REALIZAR].

Tus obligaciones inquebrantables para entregar la respuesta son:

    MODULARIDAD Y CÓDIGO: Modifica o crea el código de la aplicación (Frontend/Backend) necesario para que la funcionalidad opere al 100% y sin errores, reparando cualquier falla existente de raíz.

    SINCRONIZACIÓN SQL: Revisa la carpeta /supabase/basedatos/. Si el cambio pertenece a un módulo existente, actualiza su script .sql completo. Si la funcionalidad es completamente nueva y no encaja en los módulos actuales, CREA UN NUEVO ARCHIVO .SQL numerado secuencialmente con su encabezado identificador.

    GESTIÓN DE STORAGE: Si la funcionalidad requiere imágenes o archivos, incluye la creación del Bucket en Supabase Storage y sus políticas RLS sobre storage.objects en el archivo .sql correspondiente.

    AUDITORÍA DE SEGURIDAD INFLEXIBLE: Activa RLS en toda tabla tocada, implementa aislamiento multi-sede/roles, protege datos sensibles contra fugas y asegura las funciones RPC con SET search_path = public.

    CONFIRMACIÓN FINAL: Al terminar, incluye una lista de verificación breve confirmando que aplicaste todos estos pasos, que el .sql es idempotente y que la funcionalidad está totalmente probada.
    Procede con la revisión del proyecto y genera la solución.