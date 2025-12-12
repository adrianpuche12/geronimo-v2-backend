/**
 * Response mode types
 */
export type ResponseMode = 'strict' | 'enhanced' | 'expert';

/**
 * Provider information
 */
export interface ProviderInfo {
  name: string;              // 'openai', 'groq', 'ollama'
  model: string;             // 'gpt-4-turbo', 'llama-3.3-70b'
  maxTokens: number;         // Model's maximum token limit
  costPer1KTokens?: number;  // Cost tracking (optional)
  supportsStreaming?: boolean;
}

/**
 * Generation result with metadata
 */
export interface GenerationResult {
  answer: string;
  provider: string;
  model: string;
  mode: ResponseMode;
  tokensUsed?: number;
  responseTime?: number;     // in milliseconds
}

/**
 * Common interface that all LLM providers must implement
 */
export interface LLMProvider {
  /**
   * Generate an answer based on question and context
   * @param question User's question
   * @param context Documentation context
   * @param mode Response mode (strict, enhanced, expert)
   * @returns Generated answer
   */
  generateAnswer(
    question: string,
    context: string,
    mode: ResponseMode,
    isMultiProject?: boolean,
  ): Promise<GenerationResult>;

  /**
   * Test connection to the provider
   * @returns true if connection is successful
   */
  testConnection(): Promise<boolean>;

  /**
   * Get provider information
   * @returns Provider metadata
   */
  getProviderInfo(): ProviderInfo;

  /**
   * Estimate tokens for a given text
   * @param text Text to estimate
   * @returns Approximate token count
   */
  estimateTokens(text: string): number;

  /**
   * Get maximum context tokens for this provider
   * @returns Maximum tokens
   */
  getMaxContextTokens(): number;

  /**
   * Generate embedding (optional - for RAG)
   * @param text Text to embed
   * @returns Embedding vector
   */
  generateEmbedding?(text: string): Promise<number[]>;
}
