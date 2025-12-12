import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LLMProvider, GenerationResult, ResponseMode } from './interfaces/llm-provider.interface';
import { OpenAIProvider } from './providers/openai.provider';
import { GroqProvider } from './providers/groq.provider';
import { OllamaProvider } from './providers/ollama.provider';

@Injectable()
export class AIFactory {
  private primaryProvider: LLMProvider;
  private fallbackProvider: LLMProvider | null = null;
  private fallbackEnabled: boolean;

  constructor(
    private configService: ConfigService,
    private openAIProvider: OpenAIProvider,
    private groqProvider: GroqProvider,
    private ollamaProvider: OllamaProvider,
  ) {
    // Get primary provider from config
    const primaryProviderName = this.configService.get<string>('AI_PROVIDER') || 'groq';
    this.primaryProvider = this.getProviderByName(primaryProviderName);

    // Get fallback configuration
    this.fallbackEnabled = this.configService.get<string>('AI_FALLBACK_ENABLED') === 'true';

    if (this.fallbackEnabled) {
      const fallbackProviderName = this.configService.get<string>('AI_FALLBACK_PROVIDER');
      if (fallbackProviderName && fallbackProviderName !== primaryProviderName) {
        this.fallbackProvider = this.getProviderByName(fallbackProviderName);
      }
    }

    console.log(`[AIFactory] Primary provider: ${this.primaryProvider.getProviderInfo().name}`);
    if (this.fallbackProvider) {
      console.log(`[AIFactory] Fallback provider: ${this.fallbackProvider.getProviderInfo().name}`);
    }
  }

  /**
   * Generate an answer using the configured provider with fallback support
   */
  async generateAnswer(
    question: string,
    context: string,
    mode?: ResponseMode,
    isMultiProject: boolean = false,
  ): Promise<GenerationResult> {
    // Get mode from config if not specified
    const responseMode = mode || (this.configService.get<ResponseMode>('AI_RESPONSE_MODE') || 'expert');

    try {
      console.log(`[AIFactory] Generating answer with ${this.primaryProvider.getProviderInfo().name} in ${responseMode} mode`);

      const result = await this.primaryProvider.generateAnswer(
        question,
        context,
        responseMode,
        isMultiProject,
      );

      console.log(`[AIFactory] Success! Tokens: ${result.tokensUsed}, Time: ${result.responseTime}ms`);
      return result;

    } catch (error) {
      console.error(`[AIFactory] Primary provider failed: ${error.message}`);

      // Try fallback if enabled
      if (this.fallbackEnabled && this.fallbackProvider) {
        console.log(`[AIFactory] Trying fallback provider: ${this.fallbackProvider.getProviderInfo().name}`);

        try {
          const result = await this.fallbackProvider.generateAnswer(
            question,
            context,
            responseMode,
            isMultiProject,
          );

          console.log(`[AIFactory] Fallback success! Tokens: ${result.tokensUsed}, Time: ${result.responseTime}ms`);
          return result;

        } catch (fallbackError) {
          console.error(`[AIFactory] Fallback provider also failed: ${fallbackError.message}`);
          throw new Error(
            `Both primary and fallback providers failed. Primary: ${error.message}, Fallback: ${fallbackError.message}`,
          );
        }
      }

      // No fallback available or not enabled
      throw error;
    }
  }

  /**
   * Generate embedding using the primary provider (or fallback)
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Try primary provider if it supports embeddings
      if (this.primaryProvider.generateEmbedding) {
        return await this.primaryProvider.generateEmbedding(text);
      }

      // Fall back to OpenAI for embeddings (best quality)
      if (this.openAIProvider.generateEmbedding) {
        console.log('[AIFactory] Using OpenAI for embeddings');
        return await this.openAIProvider.generateEmbedding(text);
      }

      // Last resort: Ollama
      if (this.ollamaProvider.generateEmbedding) {
        console.log('[AIFactory] Using Ollama for embeddings');
        return await this.ollamaProvider.generateEmbedding(text);
      }

      throw new Error('No provider supports embeddings');
    } catch (error) {
      console.error(`[AIFactory] Embedding generation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Test connection to providers
   */
  async testConnections(): Promise<{
    primary: boolean;
    fallback: boolean | null;
    ollama: boolean;
  }> {
    const primaryTest = await this.primaryProvider.testConnection();
    let fallbackTest: boolean | null = null;

    if (this.fallbackProvider) {
      fallbackTest = await this.fallbackProvider.testConnection();
    }

    const ollamaTest = await this.ollamaProvider.testConnection();

    return {
      primary: primaryTest,
      fallback: fallbackTest,
      ollama: ollamaTest,
    };
  }

  /**
   * Get information about configured providers
   */
  getProvidersInfo() {
    return {
      primary: this.primaryProvider.getProviderInfo(),
      fallback: this.fallbackProvider ? this.fallbackProvider.getProviderInfo() : null,
      ollama: this.ollamaProvider.getProviderInfo(),
      fallbackEnabled: this.fallbackEnabled,
    };
  }

  /**
   * Get a provider instance by name
   */
  private getProviderByName(name: string): LLMProvider {
    switch (name.toLowerCase()) {
      case 'openai':
        return this.openAIProvider;
      case 'groq':
        return this.groqProvider;
      case 'ollama':
        return this.ollamaProvider;
      default:
        console.warn(`[AIFactory] Unknown provider: ${name}, defaulting to Groq`);
        return this.groqProvider;
    }
  }

  /**
   * Manually switch to a different provider (for testing/debugging)
   */
  switchProvider(providerName: string): void {
    this.primaryProvider = this.getProviderByName(providerName);
    console.log(`[AIFactory] Switched primary provider to: ${providerName}`);
  }

  /**
   * Get the currently active primary provider
   */
  getPrimaryProvider(): LLMProvider {
    return this.primaryProvider;
  }
}
