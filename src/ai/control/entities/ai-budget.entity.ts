export interface AIBudget {
  id: string;
  tenant_id: string;
  monthly_budget_usd: number;
  alert_threshold: number; // 0.8 = 80%
  hard_limit: boolean;
  alert_email?: string;
  alert_webhook?: string;
  last_alert_sent?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CreateBudgetDto {
  tenant_id: string;
  monthly_budget_usd: number;
  alert_threshold?: number;
  hard_limit?: boolean;
  alert_email?: string;
  alert_webhook?: string;
}

export interface UpdateBudgetDto {
  monthly_budget_usd?: number;
  alert_threshold?: number;
  hard_limit?: boolean;
  alert_email?: string;
  alert_webhook?: string;
}
