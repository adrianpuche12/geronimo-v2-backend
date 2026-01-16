-- Migración: 003_create_integration_sync_logs.sql
-- Descripción: Crear tabla de logs de sincronización por tenant
-- NOTA: Esta migración debe ejecutarse en cada schema de tenant
-- Fecha: 25 Diciembre 2025

CREATE TABLE IF NOT EXISTS integration_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL,               -- FK a active_integrations
  tenant_id VARCHAR(100) NOT NULL,            -- Para audit trail

  -- Timing
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMP,
  duration_seconds INTEGER,

  -- Resultado
  status VARCHAR(20) NOT NULL,                -- 'in_progress', 'success', 'partial', 'failed'
  items_fetched INTEGER DEFAULT 0,
  items_created INTEGER DEFAULT 0,
  items_updated INTEGER DEFAULT 0,
  items_deleted INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,

  -- Error handling
  error_message TEXT,
  error_stack TEXT,

  -- Bull Queue
  job_id VARCHAR(255),                        -- Bull Queue Job ID

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_sync_logs_integration_id ON integration_sync_logs(integration_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_tenant_id ON integration_sync_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON integration_sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_sync_logs_started_at ON integration_sync_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_logs_job_id ON integration_sync_logs(job_id);
