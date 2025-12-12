import { Pool, PoolClient } from 'pg';

export class DatabaseService {
  private pool: Pool;
  private defaultSchema: string;

  constructor() {
    const connectionString = process.env.DATABASE_URL || '';
    this.defaultSchema = process.env.DB_DEFAULT_SCHEMA || 'tenant_default_001';

    this.pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    console.log('[Database] Pool creado con schema:', this.defaultSchema);
  }

  async getClient(tenantSchema?: string): Promise<PoolClient> {
    const client = await this.pool.connect();
    const schema = tenantSchema || this.defaultSchema;
    await client.query('SET search_path TO ' + schema + ', public');
    return client;
  }

  async query(text: string, params?: any[], tenantSchema?: string) {
    const client = await this.getClient(tenantSchema);
    try {
      return await client.query(text, params);
    } finally {
      client.release();
    }
  }

  async getTenantBySlug(slug: string) {
    const client = await this.pool.connect();
    try {
      await client.query('SET search_path TO shared, public');
      const result = await client.query(
        'SELECT * FROM tenants WHERE slug = $1 AND status = $2',
        [slug, 'active']
      );
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }
}

export const databaseService = new DatabaseService();
