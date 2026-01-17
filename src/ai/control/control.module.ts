import { Module, MiddlewareConsumer, RequestMethod } from "@nestjs/common";
import { RateLimiterService } from "./rate-limiter.service";
import { RateLimiterMiddleware } from "./rate-limiter.middleware";
import { CostTrackerService } from "./cost-tracker.service";
import { BudgetAlertService } from "./budget-alert.service";
import { AIMetricsService } from "./ai-metrics.service";
import { MetricsController } from "./metrics.controller";

@Module({
  controllers: [MetricsController],
  providers: [
    RateLimiterService,
    CostTrackerService,
    BudgetAlertService,
    AIMetricsService,
  ],
  exports: [
    RateLimiterService,
    CostTrackerService,
    BudgetAlertService,
    AIMetricsService,
  ],
})
export class ControlModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RateLimiterMiddleware)
      .forRoutes(
        { path: "api/query", method: RequestMethod.ALL },
        { path: "api/ai/*", method: RequestMethod.ALL }
      );
  }
}
