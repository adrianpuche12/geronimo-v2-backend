import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  Registry,
  Counter,
  Histogram,
  Gauge,
  collectDefaultMetrics,
} from 'prom-client';

export interface RequestMetrics {
  provider: string;
  model: string;
  operation: string;
  status: 'success' | 'error';
  durationMs: number;
  tokensInput: number;
  tokensOutput: number;
  errorType?: string;
}

@Injectable()
export class AIMetricsService implements OnModuleInit {
  private registry: Registry;

  // Counters
  private requestsTotal: Counter<string>;
  private errorsTotal: Counter<string>;
  private tokensTotal: Counter<string>;

  // Histograms
  private requestDuration: Histogram<string>;
  private tokensPerRequest: Histogram<string>;

  // Gauges
  private activeRequests: Gauge<string>;
  private providerHealth: Gauge<string>;

  constructor() {
    this.registry = new Registry();
    this.initializeMetrics();
  }

  onModuleInit() {
    // Collect default Node.js metrics (memory, CPU, etc.)
    collectDefaultMetrics({ register: this.registry });
  }

  private initializeMetrics(): void {
    // Counter: Total AI requests
    this.requestsTotal = new Counter({
      name: 'ai_requests_total',
      help: 'Total number of AI requests',
      labelNames: ['provider', 'model', 'operation', 'status'],
      registers: [this.registry],
    });

    // Counter: Total errors
    this.errorsTotal = new Counter({
      name: 'ai_errors_total',
      help: 'Total number of AI errors',
      labelNames: ['provider', 'error_type'],
      registers: [this.registry],
    });

    // Counter: Total tokens processed
    this.tokensTotal = new Counter({
      name: 'ai_tokens_total',
      help: 'Total tokens processed',
      labelNames: ['provider', 'direction'],
      registers: [this.registry],
    });

    // Histogram: Request duration in seconds
    this.requestDuration = new Histogram({
      name: 'ai_request_duration_seconds',
      help: 'AI request duration in seconds',
      labelNames: ['provider', 'model', 'operation'],
      buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60],
      registers: [this.registry],
    });

    // Histogram: Tokens per request
    this.tokensPerRequest = new Histogram({
      name: 'ai_tokens_per_request',
      help: 'Tokens per AI request',
      labelNames: ['provider', 'direction'],
      buckets: [10, 50, 100, 250, 500, 1000, 2000, 4000, 8000, 16000],
      registers: [this.registry],
    });

    // Gauge: Active requests
    this.activeRequests = new Gauge({
      name: 'ai_active_requests',
      help: 'Number of active AI requests',
      labelNames: ['provider'],
      registers: [this.registry],
    });

    // Gauge: Provider health (1=healthy, 0=unhealthy)
    this.providerHealth = new Gauge({
      name: 'ai_provider_health',
      help: 'Health status of AI providers (1=healthy, 0=unhealthy)',
      labelNames: ['provider'],
      registers: [this.registry],
    });

    // Initialize provider health to 1 (healthy) for known providers
    ['openai', 'groq', 'ollama'].forEach((provider) => {
      this.providerHealth.labels(provider).set(1);
    });
  }

  /**
   * Called when a request starts
   */
  startRequest(provider: string): void {
    this.activeRequests.labels(provider).inc();
  }

  /**
   * Called when a request ends to decrement active count
   */
  endRequest(provider: string): void {
    this.activeRequests.labels(provider).dec();
  }

  /**
   * Record a completed AI request
   */
  recordRequest(metrics: RequestMetrics): void {
    const { provider, model, operation, status, durationMs, tokensInput, tokensOutput, errorType } = metrics;

    // Increment request counter
    this.requestsTotal.labels(provider, model, operation, status).inc();

    // Record duration
    this.requestDuration.labels(provider, model, operation).observe(durationMs / 1000);

    // Record tokens
    if (tokensInput > 0) {
      this.tokensTotal.labels(provider, 'input').inc(tokensInput);
      this.tokensPerRequest.labels(provider, 'input').observe(tokensInput);
    }
    if (tokensOutput > 0) {
      this.tokensTotal.labels(provider, 'output').inc(tokensOutput);
      this.tokensPerRequest.labels(provider, 'output').observe(tokensOutput);
    }

    // Record error if applicable
    if (status === 'error' && errorType) {
      this.errorsTotal.labels(provider, errorType).inc();
    }

    // Decrement active requests
    this.activeRequests.labels(provider).dec();
  }

  /**
   * Record an error
   */
  recordError(provider: string, errorType: string): void {
    this.errorsTotal.labels(provider, errorType).inc();
  }

  /**
   * Set provider health status
   */
  setProviderHealth(provider: string, healthy: boolean): void {
    this.providerHealth.labels(provider).set(healthy ? 1 : 0);
  }

  /**
   * Get all metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * Get metrics content type
   */
  getContentType(): string {
    return this.registry.contentType;
  }

  /**
   * Get AI-specific metrics summary
   */
  async getAIMetricsSummary(): Promise<{
    totalRequests: number;
    totalErrors: number;
    totalTokens: { input: number; output: number };
    providerHealth: Record<string, boolean>;
  }> {
    const metrics = await this.registry.getMetricsAsJSON();
    
    let totalRequests = 0;
    let totalErrors = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    const providerHealth: Record<string, boolean> = {};

    for (const metric of metrics) {
      if (metric.name === 'ai_requests_total' && metric.values) {
        for (const value of metric.values) {
          totalRequests += value.value;
        }
      }
      if (metric.name === 'ai_errors_total' && metric.values) {
        for (const value of metric.values) {
          totalErrors += value.value;
        }
      }
      if (metric.name === 'ai_tokens_total' && metric.values) {
        for (const value of metric.values) {
          if (value.labels.direction === 'input') {
            inputTokens += value.value;
          } else if (value.labels.direction === 'output') {
            outputTokens += value.value;
          }
        }
      }
      if (metric.name === 'ai_provider_health' && metric.values) {
        for (const value of metric.values) {
          providerHealth[value.labels.provider] = value.value === 1;
        }
      }
    }

    return {
      totalRequests,
      totalErrors,
      totalTokens: { input: inputTokens, output: outputTokens },
      providerHealth,
    };
  }
}
