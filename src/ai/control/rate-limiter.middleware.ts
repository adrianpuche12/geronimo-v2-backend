import { Injectable, NestMiddleware, HttpException, HttpStatus } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { RateLimiterService, RateLimitResult } from "./rate-limiter.service";

@Injectable()
export class RateLimiterMiddleware implements NestMiddleware {
  constructor(private readonly rateLimiterService: RateLimiterService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const tenantId = this.extractTenantId(req);
    const plan = this.extractPlan(req);

    const result = await this.rateLimiterService.checkAndConsume(tenantId, plan);

    this.setRateLimitHeaders(res, result);

    if (!result.allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: result.reason || "Rate limit exceeded",
          remaining: result.remaining,
          resetAt: {
            minute: result.resetAt.minute.toISOString(),
            hour: result.resetAt.hour.toISOString(),
            day: result.resetAt.day.toISOString(),
          },
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    next();
  }

  private extractTenantId(req: Request): string {
    return (
      (req.headers["x-tenant-id"] as string) ||
      (req.query.tenantId as string) ||
      "default"
    );
  }

  private extractPlan(req: Request): string {
    return (
      (req.headers["x-plan"] as string) ||
      (req.query.plan as string) ||
      "free"
    );
  }

  private setRateLimitHeaders(res: Response, result: RateLimitResult): void {
    const limits = this.rateLimiterService.getPlanLimits(result.plan);

    res.setHeader("X-RateLimit-Limit-Minute", limits.requestsPerMinute);
    res.setHeader("X-RateLimit-Remaining-Minute", Math.max(0, result.remaining.minute));
    res.setHeader("X-RateLimit-Reset-Minute", result.resetAt.minute.toISOString());

    res.setHeader("X-RateLimit-Limit-Hour", limits.requestsPerHour);
    res.setHeader("X-RateLimit-Remaining-Hour", Math.max(0, result.remaining.hour));
    res.setHeader("X-RateLimit-Reset-Hour", result.resetAt.hour.toISOString());

    res.setHeader("X-RateLimit-Limit-Day", limits.requestsPerDay);
    res.setHeader("X-RateLimit-Remaining-Day", Math.max(0, result.remaining.day));
    res.setHeader("X-RateLimit-Reset-Day", result.resetAt.day.toISOString());

    res.setHeader("X-RateLimit-Plan", result.plan);
  }
}
