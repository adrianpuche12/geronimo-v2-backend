-- Agregar nuevos campos a tabla documents
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS file_path VARCHAR(500),
ADD COLUMN IF NOT EXISTS hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS file_size INTEGER,
ADD COLUMN IF NOT EXISTS mime_type VARCHAR(50);

-- Crear índice para búsqueda por hash
CREATE INDEX IF NOT EXISTS idx_documents_hash ON documents(hash);
CREATE INDEX IF NOT EXISTS idx_documents_project_hash ON documents(project_id, hash);
