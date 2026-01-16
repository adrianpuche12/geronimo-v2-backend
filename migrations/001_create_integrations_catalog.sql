-- Migración: 001_create_integrations_catalog.sql
-- Descripción: Crear tabla de catálogo global de integraciones en schema compartido
-- Fecha: 25 Diciembre 2025

CREATE SCHEMA IF NOT EXISTS shared;

CREATE TABLE IF NOT EXISTS shared.integrations_catalog (
  id VARCHAR(50) PRIMARY KEY,                 -- 'int-001', 'int-002', etc.
  name VARCHAR(100) NOT NULL,                 -- 'GitHub', 'Gmail', 'Google Drive'
  category VARCHAR(50) NOT NULL,              -- 'development', 'email', 'storage'
  description TEXT,
  icon_url VARCHAR(500),
  for_industry VARCHAR(100) DEFAULT 'all',    -- 'all', 'tech', 'automotive', 'sales'
  auth_type VARCHAR(50) NOT NULL,             -- 'oauth2', 'api_key', 'basic'
  config_schema JSONB,                        -- JSON Schema de configuración esperada
  sync_frequency VARCHAR(50) DEFAULT 'hourly',
  requires_webhook BOOLEAN DEFAULT false,
  documentation_url VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  is_beta BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insertar integraciones core (GitHub, Gmail, Google Drive)
INSERT INTO shared.integrations_catalog (id, name, category, description, auth_type, config_schema, for_industry, documentation_url) VALUES
('int-001', 'GitHub', 'development', 'Sync GitHub repositories, issues, PRs, and commits', 'oauth2',
  '{"type":"object","properties":{"repos":{"type":"array","items":{"type":"string"}}},"required":["repos"]}'::jsonb,
  'tech', 'https://docs.github.com/en/rest'),
  
('int-004', 'Gmail', 'email', 'Sync Gmail inbox emails and labels', 'oauth2',
  '{"type":"object","properties":{"labels":{"type":"array","items":{"type":"string"}}},"required":[]}'::jsonb,
  'all', 'https://developers.google.com/gmail/api'),
  
('int-020', 'Google Drive', 'storage', 'Sync Google Drive files and folders', 'oauth2',
  '{"type":"object","properties":{"folders":{"type":"array","items":{"type":"string"}}},"required":[]}'::jsonb,
  'all', 'https://developers.google.com/drive/api')
ON CONFLICT (id) DO NOTHING;

-- Índices
CREATE INDEX IF NOT EXISTS idx_integrations_catalog_category ON shared.integrations_catalog(category);
CREATE INDEX IF NOT EXISTS idx_integrations_catalog_industry ON shared.integrations_catalog(for_industry);
CREATE INDEX IF NOT EXISTS idx_integrations_catalog_active ON shared.integrations_catalog(is_active);
