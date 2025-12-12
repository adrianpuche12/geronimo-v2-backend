import { Injectable, Scope } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContextData {
  tenantId: string;
  tenantSlug: string;
  schemaName: string;
  subscription: {
    plan: 'free' | 'pro' | 'enterprise';
    expiresAt: Date;
  };
  limits: {
    maxProjects: number;
    maxQueriesPerDay: number;
    maxIntegrations: number;
  };
}

@Injectable({ scope: Scope.DEFAULT })
export class TenantContext {
  private storage = new AsyncLocalStorage<TenantContextData>();

  set(context: TenantContextData): void {
    this.storage.enterWith(context);
  }

  get(): TenantContextData {
    const context = this.storage.getStore();
    if (!context) {
      throw new Error('TenantContext not initialized. Did you forget TenantMiddleware?');
    }
    return context;
  }

  getTenantId(): string {
    return this.get().tenantId;
  }

  getSchemaName(): string {
    return this.get().schemaName;
  }

  canCreateProject(): boolean {
    // TODO: Implementar lógica de validación de límites
    return true;
  }
}
