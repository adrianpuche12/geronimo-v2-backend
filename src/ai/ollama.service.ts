import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class OllamaService {
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get('OLLAMA_BASE_URL') || 'http://localhost:11434';
    this.model = this.configService.get('OLLAMA_MODEL') || 'qwen2.5:7b';
  }

  async generateAnswer(question: string, context: string): Promise<string> {
    const prompt = this.buildRAGPrompt(question, context);

    try {
      const response = await axios.post(`${this.baseUrl}/api/generate`, {
        model: this.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.5,
          top_p: 0.9,
          num_predict: 1024,
        },
      });

      return response.data.response;
    } catch (error) {
      console.error('Ollama generate error:', error);
      throw new Error('Failed to generate answer from Ollama');
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await axios.post(`${this.baseUrl}/api/embeddings`, {
        model: this.model,
        prompt: text,
      });

      return response.data.embedding;
    } catch (error) {
      console.error('Ollama embedding error:', error);
      throw new Error('Failed to generate embedding from Ollama');
    }
  }

  private buildRAGPrompt(question: string, context: string): string {
    return `You are a technical documentation assistant.

FUNDAMENTAL RULE: Only answer based on the provided documentation.
DO NOT use general knowledge. DO NOT invent information.
If the documentation does not contain the answer, say "I did not find information about this in the documentation".

Available documentation:
${context}

Developer question: ${question}

Instructions:
- Answer concisely and technically
- Reference specific sections if relevant
- Include code examples if they are in the documentation
- Answer in the same language as the question
- If multiple projects, indicate which information comes from which

Answer based ONLY on the documentation:`;
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await axios.post(`${this.baseUrl}/api/generate`, {
        model: this.model,
        prompt: 'Hello',
        stream: false,
      });
      return !!response.data.response;
    } catch (error) {
      return false;
    }
  }
}
