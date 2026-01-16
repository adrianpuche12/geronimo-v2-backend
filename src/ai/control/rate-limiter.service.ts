import { Injectable, Logger } from "@nestjs/common";
import { Redis } from "ioredis";
import { getPlanLimits, PlanLimits, PlanType } from "../../config/ai-limits.config";

export interface RateLimitResult {
  allowed: boolean;
  remaining: {
    minute: number;
    hour: number;
    day: number;
  };
  resetAt: {
    minute: Date;
    hour: Date;
    day: Date;
  };
  plan: string;
  reason?: string;
}

@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);
  private redis: Redis;
  private readonly keyPrefix = "ai-ratelimit:";

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD,
    });
    this.logger.log("RateLimiterService initialized with Redis");
  }

  async checkAndConsume(tenantId: string, plan: string = "free"): Promise<RateLimitResult> {
    const limits = getPlanLimits(plan);
    const now = new Date();

    const minuteKey = this.getMinuteKey(tenantId, now);
    const hourKey = this.getHourKey(tenantId, now);
    const dayKey = this.getDayKey(tenantId, now);

    try {
      const [minuteCount, hourCount, dayCount] = await Promise.all([
        this.redis.get(minuteKey),
        this.redis.get(hourKey),
        this.redis.get(dayKey),
      ]);

      const currentMinute = parseInt(minuteCount || "0");
      const currentHour = parseInt(hourCount || "0");
      const currentDay = parseInt(dayCount || "0");

      const result: RateLimitResult = {
        allowed: true,
        remaining: {
          minute: Math.max(0, limits.requestsPerMinute - currentMinute - 1),
          hour: Math.max(0, limits.requestsPerHour - currentHour - 1),
          day: Math.max(0, limits.requestsPerDay - currentDay - 1),
        },
        resetAt: {
          minute: this.getMinuteReset(now),
          hour: this.getHourReset(now),
          day: this.getDayReset(now),
        },
        plan,
      };

      if (currentMinute >= limits.requestsPerMinute) {
        result.allowed = false;
        result.reason = "Rate limit exceeded: too many requests per minute";
        result.remaining.minute = 0;
        return result;
      }

      if (currentHour >= limits.requestsPerHour) {
        result.allowed = false;
        result.reason = "Rate limit exceeded: too many requests per hour";
        result.remaining.hour = 0;
        return result;
      }

      if (currentDay >= limits.requestsPerDay) {
        result.allowed = false;
        result.reason = "Rate limit exceeded: too many requests per day";
        result.remaining.day = 0;
        return result;
      }

      await Promise.all([
        this.incrementWithTTL(minuteKey, 60),
        this.incrementWithTTL(hourKey, 3600),
        this.incrementWithTTL(dayKey, 86400),
      ]);

      return result;
    } catch (error) {
      this.logger.error("Rate limit check failed: " + error);
      return {
        allowed: true,
        remaining: { minute: -1, hour: -1, day: -1 },
        resetAt: {
          minute: this.getMinuteReset(now),
          hour: this.getHourReset(now),
          day: this.getDayReset(now),
        },
        plan,
        reason: "Rate limit check failed, allowing request",
      };
    }
  }

  async check(tenantId: string, plan: string = "free"): Promise<RateLimitResult> {
    const limits = getPlanLimits(plan);
    const now = new Date();

    const minuteKey = this.getMinuteKey(tenantId, now);
    const hourKey = this.getHourKey(tenantId, now);
    const dayKey = this.getDayKey(tenantId, now);

    try {
      const [minuteCount, hourCount, dayCount] = await Promise.all([
        this.redis.get(minuteKey),
        this.redis.get(hourKey),
        this.redis.get(dayKey),
      ]);

      const currentMinute = parseInt(minuteCount || "0");
      const currentHour = parseInt(hourCount || "0");
      const currentDay = parseInt(dayCount || "0");

      return {
        allowed: currentMinute < limits.requestsPerMinute &&
                 currentHour < limits.requestsPerHour &&
                 currentDay < limits.requestsPerDay,
        remaining: {
          minute: Math.max(0, limits.requestsPerMinute - currentMinute),
          hour: Math.max(0, limits.requestsPerHour - currentHour),
          day: Math.max(0, limits.requestsPerDay - currentDay),
        },
        resetAt: {
          minute: this.getMinuteReset(now),
          hour: this.getHourReset(now),
          day: this.getDayReset(now),
        },
        plan,
      };
    } catch (error) {
      this.logger.error("Rate limit check failed: " + error);
      return {
        allowed: true,
        remaining: { minute: -1, hour: -1, day: -1 },
        resetAt: {
          minute: this.getMinuteReset(now),
          hour: this.getHourReset(now),
          day: this.getDayReset(now),
        },
        plan,
      };
    }
  }

  getPlanLimits(plan: string): PlanLimits {
    return getPlanLimits(plan);
  }

  private async incrementWithTTL(key: string, ttlSeconds: number): Promise<void> {
    const multi = this.redis.multi();
    multi.incr(key);
    multi.expire(key, ttlSeconds);
    await multi.exec();
  }

  private getMinuteKey(tenantId: string, date: Date): string {
    const timestamp = date.toISOString().slice(0, 16).replace(/[-:T]/g, "");
    return this.keyPrefix + tenantId + ":minute:" + timestamp;
  }

  private getHourKey(tenantId: string, date: Date): string {
    const timestamp = date.toISOString().slice(0, 13).replace(/[-:T]/g, "");
    return this.keyPrefix + tenantId + ":hour:" + timestamp;
  }

  private getDayKey(tenantId: string, date: Date): string {
    const timestamp = date.toISOString().slice(0, 10).replace(/-/g, "");
    return this.keyPrefix + tenantId + ":day:" + timestamp;
  }

  private getMinuteReset(now: Date): Date {
    const reset = new Date(now);
    reset.setSeconds(0, 0);
    reset.setMinutes(reset.getMinutes() + 1);
    return reset;
  }

  private getHourReset(now: Date): Date {
    const reset = new Date(now);
    reset.setMinutes(0, 0, 0);
    reset.setHours(reset.getHours() + 1);
    return reset;
  }

  private getDayReset(now: Date): Date {
    const reset = new Date(now);
    reset.setHours(0, 0, 0, 0);
    reset.setDate(reset.getDate() + 1);
    return reset;
  }
}
