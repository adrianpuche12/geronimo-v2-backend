import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';

@Injectable()
export class GroqService {
  private groq: Groq;
  private readonly model: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get('GROQ_API_KEY');
    if (!apiKey) {
      throw new Error('GROQ_API_KEY is not configured');
    }
    
    this.groq = new Groq({ apiKey });
    this.model = this.configService.get('GROQ_MODEL') || 'llama-3.3-70b-versatile';
  }

  async generateAnswer(question: string, context: string): Promise<string> {
    const prompt = this.buildRAGPrompt(question, context);

    try {
      const completion = await this.groq.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a technical documentation assistant. Only answer based on provided documentation. Do not use general knowledge.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.5,
        max_tokens: 1024,
        top_p: 0.9,
      });

      return completion.choices[0]?.message?.content || 'No response generated';
    } catch (error) {
      console.error('Groq generate error:', error);
      throw new Error(`Failed to generate answer from Groq: ${error.message}`);
    }
  }

  private buildRAGPrompt(question: string, context: string): string {
    return `You are a technical documentation assistant.

FUNDAMENTAL RULE: Only answer based on the provided documentation.
DO NOT use general knowledge. DO NOT invent information.
If the documentation does not contain the answer, say I did not find information about this in the documentation.

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
      const completion = await this.groq.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10,
      });
      return !!completion.choices[0]?.message?.content;
    } catch (error) {
      console.error('Groq connection test failed:', error);
      return false;
    }
  }
}
