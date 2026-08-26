-- ============================================================================
-- MIGRACIÓN: Actualizar zonas de delivery para Market Coffee Sweet
-- Fecha: 2026-08-26
-- Descripción: Zonas por nombre de urbanización con costos fijos
-- ============================================================================

-- ============================================================================
-- PASO 1: Actualizar zonas de delivery en store_config
-- ============================================================================

UPDATE store_config
SET delivery_zonas = '[
  {"id": "z1", "name": "Trigal / Prebo / Chimeneas", "cost": 1.00, "minKm": 0, "maxKm": 3},
  {"id": "z2", "name": "Mañongo / Trigaleña / Naguanagua / Av Bolívar", "cost": 2.00, "minKm": 3, "maxKm": 7},
  {"id": "z3", "name": "San Diego / Otras zonas", "cost": 3.00, "minKm": 7, "maxKm": 18}
]'::jsonb
WHERE id = (SELECT id FROM store_config LIMIT 1);

-- ============================================================================
-- PASO 2: Asegurar que entrega_por_zonas esté activo
-- ============================================================================

UPDATE store_config
SET entrega_por_zonas = TRUE
WHERE id = (SELECT id FROM store_config LIMIT 1);

-- ============================================================================
-- PASO 3: Verificar resultado
-- ============================================================================

DO $$
DECLARE
  v_zonas jsonb;
BEGIN
  SELECT delivery_zonas INTO v_zonas FROM store_config LIMIT 1;
  RAISE NOTICE 'Zonas actualizadas: %', v_zonas;
END $$;

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================
