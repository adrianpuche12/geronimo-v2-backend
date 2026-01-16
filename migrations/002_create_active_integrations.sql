-- Migración: 002_create_active_integrations.sql
-- Descripción: Crear tabla de integraciones activas por tenant
-- NOTA: Esta migración debe ejecutarse en cada schema de tenant
-- Fecha: 25 Diciembre 2025

CREATE TABLE IF NOT EXISTS active_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id VARCHAR(50) NOT NULL,        -- FK a shared.integrations_catalog
  enabled BOOLEAN DEFAULT true,

  -- Configuración encriptada (JSON con tokens OAuth2)
  encrypted_config TEXT NOT NULL,             -- AES-256-GCM encrypted JSON
  encryption_iv VARCHAR(32) NOT NULL,         -- Initialization Vector

  -- Estado de sincronización
  last_sync TIMESTAMP,
  next_sync TIMESTAMP,
  sync_status VARCHAR(50) DEFAULT 'pending',  -- 'pending', 'running', 'success', 'failed'
  sync_errors JSONB DEFAULT '[]'::jsonb,

  -- Metadatos
  metadata JSONB DEFAULT '{}'::jsonb,         -- { totalItems: 0, lastError: null }

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_active_integrations_integration_id ON active_integrations(integration_id);
CREATE INDEX IF NOT EXISTS idx_active_integrations_enabled ON active_integrations(enabled);
CREATE INDEX IF NOT EXISTS idx_active_integrations_next_sync ON active_integrations(next_sync);
CREATE INDEX IF NOT EXISTS idx_active_integrations_sync_status ON active_integrations(sync_status);
