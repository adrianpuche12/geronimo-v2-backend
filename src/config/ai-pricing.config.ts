export interface ModelPricing {
  input: number;  // USD per 1K tokens
  output: number; // USD per 1K tokens
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // OpenAI models
  "gpt-4-turbo-preview": { input: 0.01, output: 0.03 },
  "gpt-4-turbo": { input: 0.01, output: 0.03 },
  "gpt-4": { input: 0.03, output: 0.06 },
  "gpt-4o": { input: 0.005, output: 0.015 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "gpt-3.5-turbo": { input: 0.0005, output: 0.0015 },
  "text-embedding-3-small": { input: 0.00002, output: 0 },
  "text-embedding-3-large": { input: 0.00013, output: 0 },
  "text-embedding-ada-002": { input: 0.0001, output: 0 },
  
  // Groq models (free tier)
  "llama-3.3-70b-versatile": { input: 0, output: 0 },
  "llama-3.1-70b-versatile": { input: 0, output: 0 },
  "llama-3.1-8b-instant": { input: 0, output: 0 },
  "mixtral-8x7b-32768": { input: 0, output: 0 },
  
  // Ollama models (local, free)
  "qwen2.5:7b": { input: 0, output: 0 },
  "llama3.2": { input: 0, output: 0 },
  "mistral": { input: 0, output: 0 },
};

export function getModelPricing(model: string): ModelPricing {
  return MODEL_PRICING[model] || { input: 0, output: 0 };
}

export function calculateCost(
  model: string,
  tokensInput: number,
  tokensOutput: number
): number {
  const pricing = getModelPricing(model);
  const inputCost = (tokensInput / 1000) * pricing.input;
  const outputCost = (tokensOutput / 1000) * pricing.output;
  return inputCost + outputCost;
}
