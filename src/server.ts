import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3005;
const API_VERSION = process.env.API_VERSION || 'v2';

// ============================================
// MIDDLEWARES
// ============================================

// Seguridad
app.use(helmet());

// CORS
const corsOptions = {
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
};
app.use(cors(corsOptions));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// RUTAS DE PRUEBA
// ============================================

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    version: API_VERSION,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// Verificar configuración de Keycloak
app.get('/api/v2/auth/config', (req: Request, res: Response) => {
  res.json({
    keycloakUrl: process.env.KEYCLOAK_URL,
    realm: process.env.KEYCLOAK_REALM,
    clientId: process.env.KEYCLOAK_CLIENT_ID,
    publicKeyUrl: process.env.KEYCLOAK_PUBLIC_KEY_URL,
  });
});

// Verificar conexión a base de datos
app.get('/api/v2/db/status', (req: Request, res: Response) => {
  res.json({
    database: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      name: process.env.DB_NAME,
      status: 'not_connected',
    },
  });
});

// Verificar conexión a Redis
app.get('/api/v2/cache/status', (req: Request, res: Response) => {
  res.json({
    redis: {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      status: 'not_connected',
    },
  });
});

// Verificar conexión a ChromaDB
app.get('/api/v2/vector/status', (req: Request, res: Response) => {
  res.json({
    chroma: {
      url: process.env.CHROMA_URL,
      status: 'not_connected',
    },
  });
});

// Ruta raíz
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'Geronimo V2 Backend',
    version: API_VERSION,
    message: 'Backend V2 corriendo correctamente',
    endpoints: {
      health: '/health',
      authConfig: '/api/v2/auth/config',
      dbStatus: '/api/v2/db/status',
      cacheStatus: '/api/v2/cache/status',
      vectorStatus: '/api/v2/vector/status',
    },
  });
});

// ============================================
// 404 HANDLER
// ============================================
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
  });
});

// ============================================
// ERROR HANDLER
// ============================================
app.use((err: Error, req: Request, res: Response) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('🚀 Geronimo V2 Backend');
  console.log('📍 Environment: ' + process.env.NODE_ENV);
  console.log('🌐 Server running on: http://62.171.160.238:' + PORT);
  console.log('📋 API Version: ' + API_VERSION);
  console.log('🔐 Keycloak: ' + process.env.KEYCLOAK_URL);
  console.log('🏢 Realm: ' + process.env.KEYCLOAK_REALM);
  console.log('='.repeat(50));
});

export default app;
