export type PlanType = "free" | "starter" | "pro" | "enterprise";

export interface PlanLimits {
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  maxTokensPerRequest: number;
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  free: {
    requestsPerMinute: 5,
    requestsPerHour: 50,
    requestsPerDay: 200,
    maxTokensPerRequest: 2000,
  },
  starter: {
    requestsPerMinute: 15,
    requestsPerHour: 200,
    requestsPerDay: 1000,
    maxTokensPerRequest: 4000,
  },
  pro: {
    requestsPerMinute: 60,
    requestsPerHour: 1000,
    requestsPerDay: 5000,
    maxTokensPerRequest: 8000,
  },
  enterprise: {
    requestsPerMinute: 300,
    requestsPerHour: 5000,
    requestsPerDay: 50000,
    maxTokensPerRequest: 32000,
  },
};

export function getPlanLimits(plan: string): PlanLimits {
  const planType = plan as PlanType;
  return PLAN_LIMITS[planType] || PLAN_LIMITS.free;
}
