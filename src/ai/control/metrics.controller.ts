import { Controller, Get, Header, Res } from '@nestjs/common';
import { Response } from 'express';
import { AIMetricsService } from './ai-metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: AIMetricsService) {}

  /**
   * GET /metrics - Returns all metrics in Prometheus format
   * This includes default Node.js metrics and AI-specific metrics
   */
  @Get()
  async getMetrics(@Res() res: Response): Promise<void> {
    const metrics = await this.metricsService.getMetrics();
    res.set('Content-Type', this.metricsService.getContentType());
    res.send(metrics);
  }

  /**
   * GET /metrics/ai - Returns AI-specific metrics summary in JSON
   */
  @Get('ai')
  @Header('Content-Type', 'application/json')
  async getAIMetrics(): Promise<{
    status: string;
    timestamp: string;
    metrics: {
      totalRequests: number;
      totalErrors: number;
      totalTokens: { input: number; output: number };
      providerHealth: Record<string, boolean>;
    };
  }> {
    const summary = await this.metricsService.getAIMetricsSummary();
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      metrics: summary,
    };
  }

  /**
   * GET /metrics/health - Health check for monitoring system
   */
  @Get('health')
  @Header('Content-Type', 'application/json')
  async getHealth(): Promise<{
    status: string;
    timestamp: string;
    uptime: number;
  }> {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
