import { INestApplication } from '@nestjs/common';
import { Queue } from 'bull';
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import basicAuth = require('express-basic-auth');

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
