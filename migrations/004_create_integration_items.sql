-- Migración: 004_create_integration_items.sql
-- Descripción: Crear tabla de items sincronizados por tenant
-- NOTA: Esta migración debe ejecutarse en cada schema de tenant
-- Fecha: 25 Diciembre 2025

CREATE TABLE IF NOT EXISTS integration_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID,                        -- FK a active_integrations (nullable para items de N8N)
  tenant_id VARCHAR(100) NOT NULL,

  -- Identificación del item
  external_id VARCHAR(500) NOT NULL,          -- ID en el provider externo
  item_type VARCHAR(50) NOT NULL,             -- 'file', 'commit', 'email', 'document', 'issue', 'pull_request'

  -- Contenido
  title TEXT,
  description TEXT,
  url TEXT,
  size_bytes BIGINT,
  content TEXT,                               -- Texto completo o NULL si está en B2
  content_hash VARCHAR(64),                   -- SHA-256 hash para detectar cambios

  -- Storage
  storage_location VARCHAR(10) DEFAULT 'database', -- 'database' o 'b2'
  b2_file_path TEXT,                          -- Path en Backblaze B2 si aplica

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,         -- Metadata específica del provider

  -- Estado
  status VARCHAR(20) DEFAULT 'active',        -- 'active', 'deleted', 'error'

  -- Timestamps
  external_created_at TIMESTAMP,              -- Fecha de creación en el provider
  external_updated_at TIMESTAMP,              -- Última modificación en el provider
  synced_at TIMESTAMP DEFAULT NOW(),          -- Última sincronización
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_integration_items_integration_id ON integration_items(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_items_tenant_id ON integration_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_integration_items_external_id ON integration_items(external_id);
CREATE INDEX IF NOT EXISTS idx_integration_items_item_type ON integration_items(item_type);
CREATE INDEX IF NOT EXISTS idx_integration_items_content_hash ON integration_items(content_hash);
CREATE INDEX IF NOT EXISTS idx_integration_items_synced_at ON integration_items(synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_items_status ON integration_items(status);

-- Constraint único: un external_id por integration
CREATE UNIQUE INDEX IF NOT EXISTS uq_integration_external_id 
  ON integration_items(integration_id, external_id) 
  WHERE integration_id IS NOT NULL;
