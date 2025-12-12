export interface Project {
  id: string;
  name: string;
  description?: string;
  user_id?: string;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at?: Date;
  documents?: Document[];
}

export interface Document {
  id: string;
  project_id: string;
  path: string;
  title?: string;
  content?: string;
  file_path?: string;
  hash?: string;
  file_size?: number;
  storage_location?: 'local' | 'b2';
  mime_type?: string;
  metadata?: Record<string, any>;
  user_id?: string;
  created_at: Date;
  updated_at?: Date;
}
