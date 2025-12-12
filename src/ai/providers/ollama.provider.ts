import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  LLMProvider,
  ProviderInfo,
  ResponseMode,
  GenerationResult,
} from '../interfaces/llm-provider.interface';
import { PromptBuilder } from '../prompts/prompt.builder';

@Injectable()
export class OllamaProvider implements LLMProvider {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly embeddingModel: string;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('OLLAMA_URL') || 'http://localhost:11434';
    this.model = this.configService.get<string>('OLLAMA_MODEL') || 'qwen2.5:7b';
    this.maxTokens = parseInt(this.configService.get<string>('OLLAMA_MAX_TOKENS') || '4096');
    this.embeddingModel = this.configService.get<string>('OLLAMA_EMBEDDING_MODEL') || 'nomic-embed-text';
  }

  async generateAnswer(
    question: string,
    context: string,
    mode: ResponseMode,
    isMultiProject: boolean = false,
  ): Promise<GenerationResult> {
    const startTime = Date.now();

    try {
      const { systemPrompt, userPrompt } = PromptBuilder.buildPrompt(
        question,
        context,
        mode,
        isMultiProject,
      );

      // Ollama combines system and user prompts
      const combinedPrompt = `${systemPrompt}

${userPrompt}`;

      const response = await axios.post(
        `${this.baseUrl}/api/generate`,
        {
          model: this.model,
          prompt: combinedPrompt,
          stream: false,
          options: {
            temperature: mode === 'strict' ? 0.3 : mode === 'enhanced' ? 0.5 : 0.7,
            top_p: 0.9,
            num_predict: this.maxTokens,
          },
        },
        {
          timeout: 120000, // 2 minutes
        }
      );

      const answer = response.data.response || 'No response generated';
      const tokensUsed = response.data.eval_count || 0;
      const responseTime = Date.now() - startTime;

      return {
        answer,
        provider: 'ollama',
        model: this.model,
        mode,
        tokensUsed,
        responseTime,
      };
    } catch (error) {
      console.error('Ollama generate error:', error);
      throw new Error(`Failed to generate answer from Ollama: ${error.message}`);
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/generate`,
        {
          model: this.model,
          prompt: 'Test',
          stream: false,
        },
        {
          timeout: 10000,
        }
      );
      return !!response.data.response;
    } catch (error) {
      console.error('Ollama connection test failed:', error);
      return false;
    }
  }

  getProviderInfo(): ProviderInfo {
    return {
      name: 'ollama',
      model: this.model,
      maxTokens: this.maxTokens,
      costPer1KTokens: 0, // Self-hosted, no API cost
      supportsStreaming: true,
    };
  }

  estimateTokens(text: string): number {
    // Rough estimation: 1 token ~= 4 characters
    return Math.ceil(text.length / 4);
  }

  getMaxContextTokens(): number {
    return this.maxTokens;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/embeddings`,
        {
          model: this.embeddingModel,
          prompt: text,
        },
        {
          timeout: 30000,
        }
      );

      return response.data.embedding;
    } catch (error) {
      console.error('Ollama embedding error:', error);
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }
}
