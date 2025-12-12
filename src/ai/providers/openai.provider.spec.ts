import { OpenAIProvider } from './openai.provider';
import { ConfigService } from '@nestjs/config';
import testContexts from '../../../test/fixtures/test-contexts';
import testQuestions from '../../../test/fixtures/test-questions';
import * as dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;
  let configService: ConfigService;

  beforeAll(() => {
    if (!process.env.OPENAI_API_KEY) {
      console.warn('⚠️  OPENAI_API_KEY not found. Some tests will be skipped.');
    }
  });

  beforeEach(() => {
    configService = new ConfigService({
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'test-key',
      OPENAI_MODEL: 'gpt-4-turbo-preview',
      OPENAI_MAX_TOKENS: '4096',
    });
    
    if (process.env.OPENAI_API_KEY) {
      provider = new OpenAIProvider(configService);
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('testConnection', () => {
    it('should connect successfully to OpenAI API', async () => {
      if (!process.env.OPENAI_API_KEY) {
        console.log('⏭️  Skipping: OPENAI_API_KEY not configured');
        return;
      }

      const result = await provider.testConnection();
      expect(result).toBe(true);
    }, 10000);
  });

  describe('generateAnswer - Strict Mode', () => {
    it('should generate answer in strict mode', async () => {
      if (!process.env.OPENAI_API_KEY) {
        console.log('⏭️  Skipping: OPENAI_API_KEY not configured');
        return;
      }

      const result = await provider.generateAnswer(
        testQuestions.simple,
        testContexts.authentication,
        'strict',
        false
      );

      expect(result).toBeDefined();
      expect(result.answer).toBeDefined();
      expect(result.provider).toBe('openai');
      expect(result.mode).toBe('strict');
      expect(result.tokensUsed).toBeGreaterThan(0);
    }, 15000);
  });

  describe('generateEmbedding', () => {
    it('should generate embeddings successfully', async () => {
      if (!process.env.OPENAI_API_KEY) {
        console.log('⏭️  Skipping: OPENAI_API_KEY not configured');
        return;
      }

      const text = 'Test document for embedding';
      const embedding = await provider.generateEmbedding(text);

      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(1536);
    }, 10000);
  });

  describe('getProviderInfo', () => {
    it('should return correct provider information', () => {
      if (!process.env.OPENAI_API_KEY) {
        console.log('⏭️  Skipping: OPENAI_API_KEY not configured');
        return;
      }

      const info = provider.getProviderInfo();

      expect(info.name).toBe('openai');
      expect(info.model).toBe('gpt-4-turbo-preview');
      expect(info.maxTokens).toBe(4096);
    });
  });
});
