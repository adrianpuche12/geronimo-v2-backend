import { AIFactory } from '../../../src/ai/ai.factory';
import { OpenAIProvider } from '../../../src/ai/providers/openai.provider';
import { GroqProvider } from '../../../src/ai/providers/groq.provider';
import { OllamaProvider } from '../../../src/ai/providers/ollama.provider';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../src/storage/redis.service';
import testContexts from '../../fixtures/test-contexts';
import testQuestions from '../../fixtures/test-questions';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config();

describe('CAPA 1 + CAPA 2 Integration Tests', () => {
  let aiFactory: AIFactory;
  let redisService: RedisService;
  let configService: ConfigService;
  const testTenantId = 'test-tenant-integration';

  beforeAll(async () => {
    configService = new ConfigService();
    redisService = new RedisService();
    
    const openaiProvider = new OpenAIProvider(configService);
    const groqProvider = new GroqProvider(configService);
    const ollamaProvider = new OllamaProvider(configService);
    
    aiFactory = new AIFactory(
      configService,
      openaiProvider,
      groqProvider,
      ollamaProvider
    );

    console.log('Integration test setup complete');
  });

  beforeEach(async () => {
    // Limpiar cache antes de cada test para evitar interferencias
    await redisService.flushTenant(testTenantId);
  });

  afterAll(async () => {
    await redisService.flushTenant(testTenantId);
    console.log('Integration test cleanup complete');
  });

  describe('AI Generation + Redis Cache', () => {
    it('should generate answer and cache in Redis', async () => {
      const question = testQuestions.simple;
      const context = testContexts.authentication;
      
      const queryHash = crypto
        .createHash('md5')
        .update(question + context)
        .digest('hex');
      
      const cacheKey = 'cache:query:' + queryHash;

      const cachedBefore = await redisService.get(testTenantId, cacheKey);
      expect(cachedBefore).toBeNull();

      const result = await aiFactory.generateAnswer(question, context, 'expert');
      
      expect(result).toBeDefined();
      expect(result.answer).toBeDefined();
      expect(result.answer.length).toBeGreaterThan(0);
      expect(result.provider).toBeDefined();
      expect(result.tokensUsed).toBeGreaterThan(0);

      await redisService.cacheQuery(testTenantId, queryHash, result, 3600);

      const cachedAfter = await redisService.getCachedQuery(testTenantId, queryHash);
      
      expect(cachedAfter).toBeDefined();
      expect(cachedAfter.answer).toBe(result.answer);
      expect(cachedAfter.provider).toBe(result.provider);

      console.log('Query cached successfully. Provider:', result.provider);
    }, 30000);
  });

  describe('Multiple Tenants Isolation', () => {
    it('should isolate cache between tenants', async () => {
      const tenant1 = 'tenant-001';
      const tenant2 = 'tenant-002';
      const question = testQuestions.simple;
      const context = testContexts.authentication;

      const result = await aiFactory.generateAnswer(question, context);
      const queryHash = crypto.createHash('md5').update(question + context).digest('hex');

      await redisService.cacheQuery(tenant1, queryHash, {
        ...result,
        answer: 'Response for tenant 1'
      });

      await redisService.cacheQuery(tenant2, queryHash, {
        ...result,
        answer: 'Response for tenant 2'
      });

      const cached1 = await redisService.getCachedQuery(tenant1, queryHash);
      const cached2 = await redisService.getCachedQuery(tenant2, queryHash);

      expect(cached1.answer).toBe('Response for tenant 1');
      expect(cached2.answer).toBe('Response for tenant 2');
      expect(cached1.answer).not.toBe(cached2.answer);

      await redisService.delete(tenant1, 'cache:query:' + queryHash);
      await redisService.delete(tenant2, 'cache:query:' + queryHash);

      console.log('Tenant isolation verified');
    }, 30000);
  });

  describe('Performance Validation', () => {
    it('should have acceptable response times', async () => {
      const question = testQuestions.simple;
      const context = testContexts.authentication;

      const startTime = Date.now();
      const result = await aiFactory.generateAnswer(question, context, 'strict');
      const endTime = Date.now();

      const totalTime = endTime - startTime;

      expect(result).toBeDefined();
      expect(totalTime).toBeLessThan(15000);

      console.log('Total response time:', totalTime, 'ms');
      console.log('Provider:', result.provider);
    }, 20000);
  });
});
