/**
 * Factory para crear mocks de servicios
 * Útil para tests unitarios
 */

import { GenerationResult, ResponseMode } from '../../src/ai/interfaces/llm-provider.interface';

export class MockFactory {
  /**
   * Mock de OpenAI Provider
   */
  static createMockOpenAIProvider() {
    return {
      generateAnswer: jest.fn().mockResolvedValue({
        answer: 'Mocked OpenAI response',
        provider: 'openai',
        model: 'gpt-4-turbo-preview',
        mode: 'expert' as ResponseMode,
        tokensUsed: 500,
        responseTime: 2000,
      } as GenerationResult),
      
      testConnection: jest.fn().mockResolvedValue(true),
      
      getProviderInfo: jest.fn().mockReturnValue({
        name: 'openai',
        model: 'gpt-4-turbo-preview',
        maxTokens: 8000,
        costPer1KTokens: 0.01,
        supportsStreaming: true,
      }),
      
      estimateTokens: jest.fn().mockReturnValue(100),
      
      getMaxContextTokens: jest.fn().mockReturnValue(8000),
      
      generateEmbedding: jest.fn().mockResolvedValue(
        Array(1536).fill(0).map(() => Math.random())
      ),
    };
  }

  /**
   * Mock de Groq Provider
   */
  static createMockGroqProvider() {
    return {
      generateAnswer: jest.fn().mockResolvedValue({
        answer: 'Mocked Groq response',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        mode: 'expert' as ResponseMode,
        tokensUsed: 800,
        responseTime: 1500,
      } as GenerationResult),
      
      testConnection: jest.fn().mockResolvedValue(true),
      
      getProviderInfo: jest.fn().mockReturnValue({
        name: 'groq',
        model: 'llama-3.3-70b-versatile',
        maxTokens: 6000,
        costPer1KTokens: 0,
        supportsStreaming: true,
      }),
      
      estimateTokens: jest.fn().mockReturnValue(100),
      
      getMaxContextTokens: jest.fn().mockReturnValue(6000),
    };
  }

  /**
   * Mock de Ollama Provider
   */
  static createMockOllamaProvider() {
    return {
      generateAnswer: jest.fn().mockResolvedValue({
        answer: 'Mocked Ollama response',
        provider: 'ollama',
        model: 'qwen2.5:7b',
        mode: 'enhanced' as ResponseMode,
        tokensUsed: 600,
        responseTime: 3000,
      } as GenerationResult),
      
      testConnection: jest.fn().mockResolvedValue(true),
      
      getProviderInfo: jest.fn().mockReturnValue({
        name: 'ollama',
        model: 'qwen2.5:7b',
        maxTokens: 4096,
        costPer1KTokens: 0,
        supportsStreaming: true,
      }),
      
      estimateTokens: jest.fn().mockReturnValue(100),
      
      getMaxContextTokens: jest.fn().mockReturnValue(4096),
      
      generateEmbedding: jest.fn().mockResolvedValue(
        Array(768).fill(0).map(() => Math.random())
      ),
    };
  }

  /**
   * Mock de Redis Service
   */
  static createMockRedisService() {
    const store = new Map<string, any>();
    
    return {
      get: jest.fn().mockImplementation((tenantId: string, key: string) => {
        const fullKey = `${tenantId}:${key}`;
        return Promise.resolve(store.get(fullKey) || null);
      }),
      
      set: jest.fn().mockImplementation((tenantId: string, key: string, value: any) => {
        const fullKey = `${tenantId}:${key}`;
        store.set(fullKey, value);
        return Promise.resolve();
      }),
      
      del: jest.fn().mockImplementation((tenantId: string, key: string) => {
        const fullKey = `${tenantId}:${key}`;
        store.delete(fullKey);
        return Promise.resolve();
      }),
      
      delete: jest.fn().mockImplementation((tenantId: string, key: string) => {
        const fullKey = `${tenantId}:${key}`;
        store.delete(fullKey);
        return Promise.resolve();
      }),
      
      cacheQuery: jest.fn().mockResolvedValue(undefined),
      getCachedQuery: jest.fn().mockResolvedValue(null),
      incrementRateLimit: jest.fn().mockResolvedValue(1),
      flushTenant: jest.fn().mockResolvedValue(undefined),
    };
  }

  /**
   * Mock de ConfigService
   */
  static createMockConfigService(overrides: Record<string, any> = {}) {
    const defaultConfig = {
      OPENAI_API_KEY: 'test-openai-key',
      OPENAI_MODEL: 'gpt-4-turbo-preview',
      OPENAI_MAX_TOKENS: '8000',
      GROQ_API_KEY: 'test-groq-key',
      GROQ_MODEL: 'llama-3.3-70b-versatile',
      GROQ_MAX_TOKENS: '6000',
      OLLAMA_URL: 'http://localhost:11434',
      OLLAMA_MODEL: 'qwen2.5:7b',
      OLLAMA_MAX_TOKENS: '4096',
      AI_PROVIDER: 'groq',
      AI_FALLBACK_ENABLED: 'true',
      AI_FALLBACK_PROVIDER: 'ollama',
      AI_RESPONSE_MODE: 'expert',
      ...overrides,
    };

    return {
      get: jest.fn().mockImplementation((key: string) => {
        return defaultConfig[key];
      }),
    };
  }
}
