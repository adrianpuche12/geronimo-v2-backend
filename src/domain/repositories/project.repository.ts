import { Injectable } from '@nestjs/common';
import { Project } from '../entities/project.entity';
import { databaseService } from '../../storage/database.service';
import { TenantContext } from '../../infrastructure/database/tenant-context';

@Injectable()
export class ProjectRepository {
  constructor(private tenantContext: TenantContext) {}

  async create(data: { name: string; description?: string; user_id?: string; metadata?: any }): Promise<Project> {
    const result = await databaseService.query(
      'INSERT INTO projects (name, description, user_id, metadata) VALUES ($1, $2, $3, $4) RETURNING *',
      [data.name, data.description || null, data.user_id || null, data.metadata ? JSON.stringify(data.metadata) : null]
    );
    return result.rows[0];
  }

  async findAll(): Promise<Project[]> {
    const result = await databaseService.query(
      'SELECT * FROM projects ORDER BY created_at DESC'
    );
    return result.rows;
  }


  async findAllWithDocuments(): Promise<Project[]> {
    const projectsResult = await databaseService.query(
      'SELECT * FROM projects ORDER BY created_at DESC'
    );

    const projects = projectsResult.rows;

    // For each project, get its documents
    for (const project of projects) {
      const docsResult = await databaseService.query(
        'SELECT id, project_id, path, title, file_path, hash, file_size, storage_location, user_id, created_at, updated_at, mime_type, metadata FROM documents WHERE project_id = $1 ORDER BY created_at DESC',
        [project.id]
      );
      project.documents = docsResult.rows;
    }

    return projects;
  }

  async findById(id: string): Promise<Project | null> {
    const result = await databaseService.query(
      'SELECT * FROM projects WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async findByIdWithDocuments(id: string): Promise<Project | null> {
    const projectResult = await databaseService.query(
      'SELECT * FROM projects WHERE id = $1',
      [id]
    );

    if (projectResult.rows.length === 0) {
      return null;
    }

    const project = projectResult.rows[0];

    const docsResult = await databaseService.query(
      'SELECT id, project_id, path, title, file_path, hash, file_size, storage_location, user_id, created_at, updated_at, mime_type, metadata FROM documents WHERE project_id = $1 ORDER BY created_at DESC',
      [id]
    );

    project.documents = docsResult.rows;

    return project;
  }

  async update(id: string, data: Partial<Project>): Promise<Project | null> {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (data.name) {
      fields.push(`name = \$${paramCount++}`);
      values.push(data.name);
    }
    if (data.description !== undefined) {
      fields.push(`description = \$${paramCount++}`);
      values.push(data.description);
    }
    if (data.metadata) {
      fields.push(`metadata = \$${paramCount++}`);
      values.push(JSON.stringify(data.metadata));
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await databaseService.query(
      `UPDATE projects SET ${fields.join(', ')} WHERE id = \$${paramCount} RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  async delete(id: string): Promise<void> {
    await databaseService.query('DELETE FROM projects WHERE id = $1', [id]);
  }
}
