import { Injectable, Logger } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import { calculateCost } from "../../config/ai-pricing.config";
import { AIUsageLog, CreateUsageLogDto } from "./entities/ai-usage-log.entity";
import { AIBudget, CreateBudgetDto, UpdateBudgetDto } from "./entities/ai-budget.entity";

export interface CostSummary {
  totalCostUsd: number;
  totalTokensInput: number;
  totalTokensOutput: number;
  totalRequests: number;
  successRate: number;
  avgResponseTimeMs: number;
  byProvider: Record<string, { costUsd: number; requests: number }>;
  byOperation: Record<string, { costUsd: number; requests: number }>;
}

export interface BudgetStatus {
  budget: AIBudget | null;
  currentSpend: number;
  percentUsed: number;
  remaining: number;
  isOverBudget: boolean;
  isNearThreshold: boolean;
}

@Injectable()
export class CostTrackerService {
  private readonly logger = new Logger(CostTrackerService.name);
  
  // In-memory storage (replace with database in production)
  private usageLogs: Map<string, AIUsageLog[]> = new Map();
  private budgets: Map<string, AIBudget> = new Map();

  async logUsage(dto: CreateUsageLogDto): Promise<AIUsageLog> {
    const log: AIUsageLog = {
      id: uuidv4(),
      ...dto,
      created_at: new Date(),
    };

    const tenantLogs = this.usageLogs.get(dto.tenant_id) || [];
    tenantLogs.push(log);
    this.usageLogs.set(dto.tenant_id, tenantLogs);

    this.logger.debug(
      "Usage logged: " + dto.provider + "/" + dto.model + 
      " - $" + dto.cost_usd.toFixed(6) + " for tenant " + dto.tenant_id
    );

    return log;
  }

  calculateCost(model: string, tokensInput: number, tokensOutput: number): number {
    return calculateCost(model, tokensInput, tokensOutput);
  }

  async getMonthlyUsage(tenantId: string, year?: number, month?: number): Promise<CostSummary> {
    const now = new Date();
    const targetYear = year || now.getFullYear();
    const targetMonth = month || now.getMonth() + 1;

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

    return this.getUsageByDateRange(tenantId, startDate, endDate);
  }

  async getUsageByDateRange(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<CostSummary> {
    const tenantLogs = this.usageLogs.get(tenantId) || [];
    
    const filteredLogs = tenantLogs.filter(
      log => log.created_at >= startDate && log.created_at <= endDate
    );

    const summary: CostSummary = {
      totalCostUsd: 0,
      totalTokensInput: 0,
      totalTokensOutput: 0,
      totalRequests: filteredLogs.length,
      successRate: 0,
      avgResponseTimeMs: 0,
      byProvider: {},
      byOperation: {},
    };

    if (filteredLogs.length === 0) {
      return summary;
    }

    let successCount = 0;
    let totalResponseTime = 0;

    for (const log of filteredLogs) {
      summary.totalCostUsd += log.cost_usd;
      summary.totalTokensInput += log.tokens_input;
      summary.totalTokensOutput += log.tokens_output;
      totalResponseTime += log.response_time_ms;
      
      if (log.success) successCount++;

      // By provider
      if (!summary.byProvider[log.provider]) {
        summary.byProvider[log.provider] = { costUsd: 0, requests: 0 };
      }
      summary.byProvider[log.provider].costUsd += log.cost_usd;
      summary.byProvider[log.provider].requests++;

      // By operation
      if (!summary.byOperation[log.operation]) {
        summary.byOperation[log.operation] = { costUsd: 0, requests: 0 };
      }
      summary.byOperation[log.operation].costUsd += log.cost_usd;
      summary.byOperation[log.operation].requests++;
    }

    summary.successRate = (successCount / filteredLogs.length) * 100;
    summary.avgResponseTimeMs = totalResponseTime / filteredLogs.length;

    return summary;
  }

  async setBudget(dto: CreateBudgetDto): Promise<AIBudget> {
    const existing = this.budgets.get(dto.tenant_id);
    
    const budget: AIBudget = {
      id: existing?.id || uuidv4(),
      tenant_id: dto.tenant_id,
      monthly_budget_usd: dto.monthly_budget_usd,
      alert_threshold: dto.alert_threshold ?? 0.8,
      hard_limit: dto.hard_limit ?? false,
      alert_email: dto.alert_email,
      alert_webhook: dto.alert_webhook,
      last_alert_sent: existing?.last_alert_sent,
      created_at: existing?.created_at || new Date(),
      updated_at: new Date(),
    };

    this.budgets.set(dto.tenant_id, budget);
    this.logger.log("Budget set for tenant " + dto.tenant_id + ": $" + dto.monthly_budget_usd);

    return budget;
  }

  async updateBudget(tenantId: string, dto: UpdateBudgetDto): Promise<AIBudget | null> {
    const existing = this.budgets.get(tenantId);
    if (!existing) return null;

    const updated: AIBudget = {
      ...existing,
      ...dto,
      updated_at: new Date(),
    };

    this.budgets.set(tenantId, updated);
    return updated;
  }

  async getBudget(tenantId: string): Promise<AIBudget | null> {
    return this.budgets.get(tenantId) || null;
  }

  async getBudgetStatus(tenantId: string): Promise<BudgetStatus> {
    const budget = await this.getBudget(tenantId);
    const monthlyUsage = await this.getMonthlyUsage(tenantId);

    if (!budget) {
      return {
        budget: null,
        currentSpend: monthlyUsage.totalCostUsd,
        percentUsed: 0,
        remaining: Infinity,
        isOverBudget: false,
        isNearThreshold: false,
      };
    }

    const percentUsed = (monthlyUsage.totalCostUsd / budget.monthly_budget_usd) * 100;
    const remaining = Math.max(0, budget.monthly_budget_usd - monthlyUsage.totalCostUsd);

    return {
      budget,
      currentSpend: monthlyUsage.totalCostUsd,
      percentUsed,
      remaining,
      isOverBudget: monthlyUsage.totalCostUsd >= budget.monthly_budget_usd,
      isNearThreshold: percentUsed >= budget.alert_threshold * 100,
    };
  }

  async canMakeRequest(tenantId: string): Promise<{ allowed: boolean; reason?: string }> {
    const status = await this.getBudgetStatus(tenantId);

    if (!status.budget) {
      return { allowed: true };
    }

    if (status.budget.hard_limit && status.isOverBudget) {
      return {
        allowed: false,
        reason: "Monthly budget exceeded. Current spend: $" + 
                status.currentSpend.toFixed(2) + " / $" + 
                status.budget.monthly_budget_usd.toFixed(2),
      };
    }

    return { allowed: true };
  }

  async checkBudget(tenantId: string): Promise<BudgetStatus> {
    const status = await this.getBudgetStatus(tenantId);
    
    if (status.isNearThreshold && status.budget) {
      this.logger.warn(
        "Budget threshold reached for tenant " + tenantId + 
        ": " + status.percentUsed.toFixed(1) + "% used"
      );
    }

    return status;
  }

  async updateLastAlertSent(tenantId: string): Promise<void> {
    const budget = this.budgets.get(tenantId);
    if (budget) {
      budget.last_alert_sent = new Date();
      this.budgets.set(tenantId, budget);
    }
  }
}
