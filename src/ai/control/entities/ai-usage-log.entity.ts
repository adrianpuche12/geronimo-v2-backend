export interface AIUsageLog {
  id: string;
  tenant_id: string;
  user_id?: string;
  provider: string;
  model: string;
  operation: "query" | "embedding" | "indexing" | "chat";
  tokens_input: number;
  tokens_output: number;
  cost_usd: number;
  response_time_ms: number;
  success: boolean;
  error_message?: string;
  metadata?: Record<string, any>;
  created_at: Date;
}

export interface CreateUsageLogDto {
  tenant_id: string;
  user_id?: string;
  provider: string;
  model: string;
  operation: "query" | "embedding" | "indexing" | "chat";
  tokens_input: number;
  tokens_output: number;
  cost_usd: number;
  response_time_ms: number;
  success: boolean;
  error_message?: string;
  metadata?: Record<string, any>;
}
