import { Module, MiddlewareConsumer, RequestMethod } from "@nestjs/common";
import { RateLimiterService } from "./rate-limiter.service";
import { RateLimiterMiddleware } from "./rate-limiter.middleware";

@Module({
  providers: [RateLimiterService],
  exports: [RateLimiterService],
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
