import { ConfigService } from '@nestjs/config';
import { OpenAIProvider } from '../ai/providers/openai.provider';
import { GroqProvider } from '../ai/providers/groq.provider';
import { OllamaProvider } from '../ai/providers/ollama.provider';
import { AIFactory } from '../ai/ai.factory';
import * as dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

async function testProviders() {
  console.log('='.repeat(60));
  console.log('🧪 TEST DE PROVIDERS AI - CAPA 1');
  console.log('='.repeat(60));
  console.log('');

  const configService = new ConfigService();

  // Test context and question
  const testContext = `
# Authentication System

The application uses JWT tokens for authentication.

## Token Types
- Access Token: 15 minutes validity
- Refresh Token: 7 days validity

## Login Flow
1. User sends credentials to /api/auth/login
2. Server validates credentials
3. Server generates JWT tokens
4. Tokens are sent back to client

## Protected Routes
All routes under /api/users require a valid access token.
`;

  const testQuestion = 'How does authentication work in this system?';

  console.log('📝 Test Question:', testQuestion);
  console.log('📄 Context size:', testContext.length, 'characters');
  console.log('');

  // TEST: Groq Provider (Primary)
  console.log('[TEST] Groq Provider (Primary)');
  console.log('-'.repeat(60));
  try {
    const groqProvider = new GroqProvider(configService);
    const info = groqProvider.getProviderInfo();
    console.log('✅ Provider Info:', JSON.stringify(info, null, 2));

    console.log('⏳ Testing connection...');
    const connected = await groqProvider.testConnection();
    console.log(connected ? '✅ Connection successful' : '❌ Connection failed');

    if (connected) {
      console.log('⏳ Generating answer...');
      const result = await groqProvider.generateAnswer(
        testQuestion,
        testContext,
        'expert',
        false
      );
      console.log('✅ Answer generated!');
      console.log('  Tokens used:', result.tokensUsed);
      console.log('  Response time:', result.responseTime, 'ms');
      console.log('  Answer preview:', result.answer.substring(0, 200) + '...');
      console.log('');
      console.log('Full Answer:');
      console.log(result.answer);
    }
  } catch (error) {
    console.error('❌ Groq Error:', error.message);
  }
  console.log('');

  console.log('='.repeat(60));
  console.log('✅ TEST COMPLETED');
  console.log('='.repeat(60));
}

// Ejecutar tests
testProviders().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
