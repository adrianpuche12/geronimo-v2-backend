import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  LLMProvider,
  ProviderInfo,
  ResponseMode,
  GenerationResult,
} from '../interfaces/llm-provider.interface';
import { PromptBuilder } from '../prompts/prompt.builder';

@Injectable()
export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    this.client = new OpenAI({ apiKey });
    this.model = this.configService.get<string>('OPENAI_MODEL') || 'gpt-4-turbo-preview';
    this.maxTokens = parseInt(this.configService.get<string>('OPENAI_MAX_TOKENS') || '4096');
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

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        temperature: mode === 'strict' ? 0.3 : mode === 'enhanced' ? 0.5 : 0.7,
        max_tokens: this.maxTokens,
        top_p: 0.9,
      });

      const answer = completion.choices[0]?.message?.content || 'No response generated';
      const tokensUsed = completion.usage?.total_tokens || 0;
      const responseTime = Date.now() - startTime;

      return {
        answer,
        provider: 'openai',
        model: this.model,
        mode,
        tokensUsed,
        responseTime,
      };
    } catch (error) {
      console.error('OpenAI generate error:', error);
      throw new Error(`Failed to generate answer from OpenAI: ${error.message}`);
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: 'Test' }],
        max_tokens: 5,
      });
      return !!completion.choices[0]?.message?.content;
    } catch (error) {
      console.error('OpenAI connection test failed:', error);
      return false;
    }
  }

  getProviderInfo(): ProviderInfo {
    return {
      name: 'openai',
      model: this.model,
      maxTokens: this.maxTokens,
      costPer1KTokens: this.getCostPer1KTokens(),
      supportsStreaming: true,
    };
  }

  estimateTokens(text: string): number {
    // Rough estimation: 1 token ~= 4 characters for English
    // For more accuracy, you could use tiktoken library
    return Math.ceil(text.length / 4);
  }

  getMaxContextTokens(): number {
    return this.maxTokens;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.client.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error('OpenAI embedding error:', error);
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  private getCostPer1KTokens(): number {
    // Pricing as of 2025 (approximate - update as needed)
    const pricing: Record<string, number> = {
      'gpt-4-turbo-preview': 0.01,
      'gpt-4-turbo': 0.01,
      'gpt-4': 0.03,
      'gpt-3.5-turbo': 0.0015,
    };
    return pricing[this.model] || 0.01;
  }
}
