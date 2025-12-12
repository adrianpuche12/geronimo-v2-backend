import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { TenantContext } from "../../infrastructure/database/tenant-context";

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private tenantContext: TenantContext) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    // Por ahora siempre usamos tenant por defecto
    const defaultTenant = {
      tenantId: "default-001",
      tenantSlug: "default-001",
      schemaName: "tenant_default_001",
      subscription: {
        plan: "pro" as const,
        expiresAt: new Date("2026-12-31"),
      },
      limits: {
        maxProjects: 100,
        maxQueriesPerDay: 1000,
        maxIntegrations: 20,
      },
    };

    this.tenantContext.set(defaultTenant);
    (req as any).tenant = defaultTenant;
    next();
  }
}
