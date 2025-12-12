import { Redis } from '@upstash/redis';

export class RedisService {
  private client: Redis;
  private namespace: string;

  constructor() {
    const url = process.env.REDIS_URL || 'https://possible-lemur-9573.upstash.io';
    const token = process.env.REDIS_TOKEN || '';
    this.namespace = process.env.REDIS_NAMESPACE || 'geronimo-v2';

    this.client = new Redis({
      url,
      token,
    });

    console.log(`[Redis] Conectado a Upstash (namespace: ${this.namespace})`);
  }

  /**
   * Generar key con namespace de tenant
   */
  private getKey(tenantId: string, key: string): string {
    return `${this.namespace}:tenant:${tenantId}:${key}`;
  }

  /**
   * Set con namespace
   */
  async set(tenantId: string, key: string, value: any, ttlSeconds?: number): Promise<void> {
    const namespacedKey = this.getKey(tenantId, key);
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);

    if (ttlSeconds) {
      await this.client.set(namespacedKey, serialized, { ex: ttlSeconds });
    } else {
      await this.client.set(namespacedKey, serialized);
    }
  }

  /**
   * Get con namespace
   */
  async get(tenantId: string, key: string): Promise<any> {
    const namespacedKey = this.getKey(tenantId, key);
    const value = await this.client.get(namespacedKey);

    if (!value) return null;

    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }

    return value;
  }

  /**
   * Delete con namespace
   */
  async del(tenantId: string, key: string): Promise<void> {
    const namespacedKey = this.getKey(tenantId, key);
    await this.client.del(namespacedKey);
  }

  /**
   * Delete con namespace (alias for del)
   */
  async delete(tenantId: string, key: string): Promise<void> {
    return await this.del(tenantId, key);
  }

  /**
   * Cachear query de IA
   */
  async cacheQuery(tenantId: string, queryHash: string, result: any, ttl: number = 3600): Promise<void> {
    await this.set(tenantId, `cache:query:${queryHash}`, result, ttl);
  }

  /**
   * Obtener query cacheada
   */
  async getCachedQuery(tenantId: string, queryHash: string): Promise<any> {
    return await this.get(tenantId, `cache:query:${queryHash}`);
  }

  /**
   * Rate limiting
   */
  async incrementRateLimit(tenantId: string, userId: string, windowSeconds: number = 60): Promise<number> {
    const key = this.getKey(tenantId, `ratelimit:${userId}`);
    const current = await this.client.incr(key);

    if (current === 1) {
      await this.client.expire(key, windowSeconds);
    }

    return current;
  }

  /**
   * Eliminar todas las keys de un tenant usando scan
   */
  async flushTenant(tenantId: string): Promise<void> {
    const pattern = `${this.namespace}:tenant:${tenantId}:*`;
    let cursor: string | number = '0';
    let deletedCount = 0;

    do {
      const result = await this.client.scan(cursor, { match: pattern, count: 100 });
      cursor = result[0];
      const keys = result[1];

      if (keys && keys.length > 0) {
        await this.client.del(...keys);
        deletedCount += keys.length;
      }
    } while (cursor !== '0' && cursor !== 0);

    console.log(`[Redis] Flush tenant ${tenantId} - ${deletedCount} keys deleted`);
  }
}

export const redisService = new RedisService();
