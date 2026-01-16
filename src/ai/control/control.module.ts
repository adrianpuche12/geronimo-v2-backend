import { Module, MiddlewareConsumer, RequestMethod } from "@nestjs/common";
import { RateLimiterService } from "./rate-limiter.service";
import { RateLimiterMiddleware } from "./rate-limiter.middleware";
import { CostTrackerService } from "./cost-tracker.service";
import { BudgetAlertService } from "./budget-alert.service";

@Module({
  providers: [
    RateLimiterService,
    CostTrackerService,
    BudgetAlertService,
  ],
  exports: [
    RateLimiterService,
    CostTrackerService,
    BudgetAlertService,
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
