-- Agregar userId a documents y projects
ALTER TABLE documents ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
