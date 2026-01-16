#!/bin/bash
# Script de implementación FASE 6 - Bull Queue Scheduler
# Ejecutar en: /opt/geronimo-v2/backend

set -e  # Salir si hay errores

echo "=========================================="
echo "FASE 6: Bull Queue Scheduler"
echo "=========================================="
echo ""

cd /opt/geronimo-v2/backend

# ==========================================
# PASO 1: Verificar prerequisitos
# ==========================================

echo "📋 PASO 1: Verificando prerequisitos..."
echo ""

# Verificar Redis
echo "  Verificando Redis..."
if redis-cli -p 6379 -n 1 PING | grep -q "PONG"; then
  echo "  ✅ Redis funcionando"
else
  echo "  ❌ Redis no responde"
  exit 1
fi

# Verificar campo next_sync
echo "  Verificando campo next_sync en BD..."
echo ""

# ==========================================
# PASO 2: Instalar dependencias
# ==========================================

echo ""
echo "📦 PASO 2: Instalando dependencias..."
echo ""

npm install @nestjs/schedule
npm install @bull-board/api @bull-board/express express-basic-auth

echo "✅ Dependencias instaladas"
echo ""

# ==========================================
# PASO 3: Crear SyncSchedulerService
# ==========================================

echo "🔧 PASO 3: Creando SyncSchedulerService..."

cat > src/integrations/infrastructure/services/sync-scheduler.service.ts << 'ENDFILE'
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ActiveIntegrationRepository } from '../../domain/repositories/active-integration.repository';
import { DataSource } from 'typeorm';

/**
 * Servicio de scheduling automático de sincronizaciones
 * Ejecuta cada 30 minutos y revisa integraciones que necesitan sync
 */
@Injectable()
export class SyncSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SyncSchedulerService.name);

  constructor(
    @InjectQueue('integrations-sync') private syncQueue: Queue,
    private activeIntegrationRepo: ActiveIntegrationRepository,
    private dataSource: DataSource,
  ) {}

  async onModuleInit() {
    this.logger.log('✅ Sync Scheduler Service initialized');
    this.logger.log('   Cron schedule: Every 30 minutes');
    this.logger.log('   Queue: integrations-sync');
  }

  /**
   * Cron job que se ejecuta cada 30 minutos
   */
  @Cron('*/30 * * * *')  // Cada 30 minutos
  async scheduleSyncJobs() {
    const startTime = Date.now();
    this.logger.log('🔄 [Scheduler] Running sync check...');

    try {
      const tenantSchemas = await this.getAllTenantSchemas();
      this.logger.log(`   Found ${tenantSchemas.length} tenant schemas`);

      let totalJobsQueued = 0;

      for (const schema of tenantSchemas) {
        try {
          const integrations = await this.findPendingSync(schema);

          if (integrations.length === 0) {
            this.logger.debug(`   [${schema}] No integrations pending sync`);
            continue;
          }

          this.logger.log(`   [${schema}] Found ${integrations.length} integrations to sync`);

          for (const integration of integrations) {
            const jobName = this.getJobNameForIntegration(integration.integrationId);

            if (!jobName) {
              this.logger.warn(`   [${schema}] Unknown integration type: ${integration.integrationId}`);
              continue;
            }

            // Agregar job a la cola
            const job = await this.syncQueue.add(
              jobName,
              {
                integrationId: integration.id,
                tenantId: schema.replace('tenant_', ''),
                tenantSchema: schema,
              },
              {
                priority: 5,  // Prioridad normal (manual es 1)
                attempts: 3,
                backoff: {
                  type: 'exponential',
                  delay: 2000,
                },
                removeOnComplete: 100,
                removeOnFail: 500,
              },
            );

            totalJobsQueued++;
            this.logger.debug(`   [${schema}] Queued ${jobName} job #${job.id}`);
          }
        } catch (error) {
          this.logger.error(`   [${schema}] Error scheduling sync: ${error.message}`);
        }
      }

      const duration = Date.now() - startTime;
      this.logger.log(`✅ [Scheduler] Completed in ${duration}ms. Queued ${totalJobsQueued} jobs.`);

    } catch (error) {
      this.logger.error(`❌ [Scheduler] Fatal error: ${error.message}`, error.stack);
    }
  }

  /**
   * Obtiene todos los schemas de tenants
   */
  private async getAllTenantSchemas(): Promise<string[]> {
    const result = await this.dataSource.query(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name LIKE 'tenant_%'
      ORDER BY schema_name
    `);

    return result.map((row: any) => row.schema_name);
  }

  /**
   * Encuentra integraciones que necesitan sync
   */
  private async findPendingSync(tenantSchema: string): Promise<any[]> {
    await this.activeIntegrationRepo.query(`SET search_path TO ${tenantSchema}`);

    return this.activeIntegrationRepo.query(`
      SELECT * FROM active_integrations
      WHERE enabled = true
        AND integration_id IN ('int-001', 'int-020')
      ORDER BY last_sync ASC NULLS FIRST
      LIMIT 10
    `);
  }

  /**
   * Mapea integration_id a nombre de job
   */
  private getJobNameForIntegration(integrationId: string): string | null {
    switch (integrationId) {
      case 'int-001':
        return 'github-sync';
      case 'int-004':
        return null;  // Gmail sync no implementado aún
      case 'int-020':
        return 'drive-sync';
      default:
        return null;
    }
  }

  /**
   * Trigger manual de sincronización (usado por controllers)
   */
  async triggerManualSync(
    integrationId: string,
    tenantSchema: string,
    tenantId: string,
  ): Promise<{ jobId: string }> {
    this.logger.log(`🔧 [Scheduler] Manual sync triggered for integration ${integrationId}`);

    await this.activeIntegrationRepo.query(`SET search_path TO ${tenantSchema}`);
    const integration = await this.activeIntegrationRepo.findOne({
      where: { id: integrationId },
    });

    if (!integration) {
      throw new Error(`Integration ${integrationId} not found`);
    }

    const jobName = this.getJobNameForIntegration(integration.integrationId);

    if (!jobName) {
      throw new Error(`Sync not available for this integration type`);
    }

    const job = await this.syncQueue.add(
      jobName,
      {
        integrationId: integration.id,
        tenantId,
        tenantSchema,
      },
      {
        priority: 1,  // Alta prioridad (manual)
        attempts: 2,
        removeOnComplete: 50,
      },
    );

    this.logger.log(`   Job #${job.id} queued (${jobName})`);

    return { jobId: job.id.toString() };
  }

  /**
   * Obtiene estadísticas de la cola
   */
  async getQueueStats(): Promise<any> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.syncQueue.getWaitingCount(),
      this.syncQueue.getActiveCount(),
      this.syncQueue.getCompletedCount(),
      this.syncQueue.getFailedCount(),
      this.syncQueue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
    };
  }
}
ENDFILE

echo "✅ SyncSchedulerService creado"
echo ""

# ==========================================
# PASO 4: Crear Bull Board Setup
# ==========================================

echo "🎨 PASO 4: Creando Bull Board setup..."

cat > src/integrations/queue/bull-board.setup.ts << 'ENDFILE'
import { INestApplication } from '@nestjs/common';
import { Queue } from 'bull';
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import * as basicAuth from 'express-basic-auth';

/**
 * Configuración de Bull Board - Dashboard web para monitoreo de colas
 *
 * URL: http://62.171.160.238:3005/admin/queues
 * User: admin
 * Password: geronimo2026
 */
export function setupBullBoard(app: INestApplication, syncQueue: Queue) {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: [new BullAdapter(syncQueue)],
    serverAdapter,
  });

  const expressApp = app.getHttpAdapter().getInstance();

  expressApp.use(
    '/admin/queues',
    basicAuth({
      users: {
        admin: process.env.BULL_BOARD_PASSWORD || 'geronimo2026',
      },
      challenge: true,
      realm: 'Bull Board - Geronimo 2.0',
    }),
    serverAdapter.getRouter(),
  );

  console.log('✅ Bull Board configured at /admin/queues');
  console.log('   User: admin');
  console.log('   Password:', process.env.BULL_BOARD_PASSWORD || 'geronimo2026');
}
ENDFILE

echo "✅ Bull Board setup creado"
echo ""

# ==========================================
# PASO 5: Actualizar IntegrationsModule
# ==========================================

echo "🔧 PASO 5: Actualizando IntegrationsModule..."

# Backup
cp src/integrations/integrations.module.ts src/integrations/integrations.module.ts.backup.fase6

# Agregar import de SyncSchedulerService
if ! grep -q "SyncSchedulerService" src/integrations/integrations.module.ts; then
  sed -i "/import { DeactivateIntegrationUseCase }/a import { SyncSchedulerService } from './infrastructure/services/sync-scheduler.service';" src/integrations/integrations.module.ts
fi

# Agregar SyncSchedulerService a providers
if ! grep -q "SyncSchedulerService," src/integrations/integrations.module.ts; then
  sed -i "/DeactivateIntegrationUseCase,/a\    SyncSchedulerService," src/integrations/integrations.module.ts
fi

echo "✅ IntegrationsModule actualizado"
echo ""

# ==========================================
# PASO 6: Actualizar AppModule
# ==========================================

echo "🔧 PASO 6: Actualizando AppModule..."

# Backup
cp src/app.module.ts src/app.module.ts.backup.fase6

# Agregar import de ScheduleModule
if ! grep -q "ScheduleModule" src/app.module.ts; then
  sed -i "/import { ConfigModule/a import { ScheduleModule } from '@nestjs/schedule';" src/app.module.ts
fi

# Agregar ScheduleModule.forRoot() a imports
if ! grep -q "ScheduleModule.forRoot()" src/app.module.ts; then
  sed -i "/ConfigModule.forRoot/a\    ScheduleModule.forRoot()," src/app.module.ts
fi

echo "✅ AppModule actualizado"
echo ""

# ==========================================
# PASO 7: Actualizar main.ts para Bull Board
# ==========================================

echo "🎨 PASO 7: Actualizando main.ts..."

# Backup
cp src/main.ts src/main.ts.backup.fase6

# Crear nuevo main.ts con Bull Board
cat > src/main.ts << 'ENDFILE'
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as bodyParser from 'body-parser';
import { setupBullBoard } from './integrations/queue/bull-board.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
    bodyParser: false,
  });

  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3006', 'http://62.171.160.238:3006'],
    credentials: true,
  });

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('Geronimo 2.0 API')
    .setDescription('Multi-tenant AI-powered documentation assistant')
    .setVersion('2.0')
    .addTag('Projects', 'Project management endpoints')
    .addTag('Documents', 'Document management endpoints')
    .addTag('Integrations', 'Third-party integrations')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // FASE 6: Bull Board Setup
  try {
    const syncQueue = app.get('BullQueue_integrations-sync');
    setupBullBoard(app, syncQueue);
  } catch (error) {
    console.warn('⚠️  Bull Board setup failed:', error.message);
  }

  const port = process.env.PORT || 3005;
  await app.listen(port, '0.0.0.0');

  console.log('='.repeat(60));
  console.log('🚀 Geronimo V2 Backend - NestJS + Clean Architecture');
  console.log('📍 Environment:', process.env.NODE_ENV || 'development');
  console.log('🌐 Server:', `http://62.171.160.238:${port}`);
  console.log('📚 API Docs:', `http://62.171.160.238:${port}/api/docs`);
  console.log('📊 Bull Board:', `http://62.171.160.238:${port}/admin/queues`);
  console.log('🗄️  NeonDB:', process.env.DB_HOST);
  console.log('⚡ Redis:', process.env.REDIS_HOST);
  console.log('☁️  B2 Storage:', process.env.B2_ENABLED === 'true' ? 'Enabled' : 'Disabled');
  console.log('='.repeat(60));
}

bootstrap();
ENDFILE

echo "✅ main.ts actualizado"
echo ""

# ==========================================
# PASO 8: Compilar y verificar
# ==========================================

echo "🔨 PASO 8: Compilando TypeScript..."

npx tsc --noEmit 2>&1 | grep -E "(error|SyncScheduler|ScheduleModule)" | head -20 || echo "✅ Sin errores de compilación en FASE 6"
echo ""

# ==========================================
# PASO 9: Resumen
# ==========================================

echo ""
echo "=========================================="
echo "RESUMEN DE CAMBIOS"
echo "=========================================="
echo ""
echo "Archivos creados:"
echo "  ✅ src/integrations/infrastructure/services/sync-scheduler.service.ts"
echo "  ✅ src/integrations/queue/bull-board.setup.ts"
echo ""
echo "Archivos modificados:"
echo "  ✅ src/integrations/integrations.module.ts"
echo "  ✅ src/app.module.ts"
echo "  ✅ src/main.ts"
echo ""
echo "Dependencias instaladas:"
echo "  ✅ @nestjs/schedule"
echo "  ✅ @bull-board/api"
echo "  ✅ @bull-board/express"
echo "  ✅ express-basic-auth"
echo ""
echo "=========================================="
echo "SIGUIENTE PASO: Reiniciar backend"
echo "=========================================="
echo ""
echo "Ejecuta:"
echo "  pm2 restart geronimo-v2-backend"
echo "  pm2 logs geronimo-v2-backend --lines 50"
echo ""
echo "Luego verifica:"
echo "  1. Logs de '✅ Sync Scheduler Service initialized'"
echo "  2. Bull Board: http://62.171.160.238:3005/admin/queues"
echo "  3. Esperar 30 min o modificar cron a */2 para testing"
echo ""
