import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import {
  LLMProvider,
  ProviderInfo,
  ResponseMode,
  GenerationResult,
} from '../interfaces/llm-provider.interface';
import { PromptBuilder } from '../prompts/prompt.builder';

@Injectable()
export class GroqProvider implements LLMProvider {
  private groq: Groq;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GROQ_API_KEY');
    if (!apiKey) {
      throw new Error('GROQ_API_KEY is not configured');
    }

    this.groq = new Groq({ apiKey });
    this.model = this.configService.get<string>('GROQ_MODEL') || 'llama-3.3-70b-versatile';
    this.maxTokens = parseInt(this.configService.get<string>('GROQ_MAX_TOKENS') || '6000');
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

      const completion = await this.groq.chat.completions.create({
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
        provider: 'groq',
        model: this.model,
        mode,
        tokensUsed,
        responseTime,
      };
    } catch (error) {
      console.error('Groq generate error:', error);
      throw new Error(`Failed to generate answer from Groq: ${error.message}`);
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const completion = await this.groq.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: 'Test' }],
        max_tokens: 5,
      });
      return !!completion.choices[0]?.message?.content;
    } catch (error) {
      console.error('Groq connection test failed:', error);
      return false;
    }
  }

  getProviderInfo(): ProviderInfo {
    return {
      name: 'groq',
      model: this.model,
      maxTokens: this.maxTokens,
      costPer1KTokens: 0, // Groq is currently free
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

  // Groq doesn't provide embeddings, so we don't implement this method
}
