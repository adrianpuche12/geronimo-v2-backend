import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OpenAIProvider } from './providers/openai.provider';
import { GroqProvider } from './providers/groq.provider';
import { OllamaProvider } from './providers/ollama.provider';
import { AIFactory } from './ai.factory';

@Module({
  imports: [ConfigModule],
  providers: [
    // AI Providers
    OpenAIProvider,
    GroqProvider,
    OllamaProvider,
    // AI Factory (main orchestrator)
    AIFactory,
  ],
  exports: [
    // Export factory (primary interface)
    AIFactory,
    // Export individual providers (if needed directly)
    OpenAIProvider,
    GroqProvider,
    OllamaProvider,
  ],
})
export class AiModule {}
