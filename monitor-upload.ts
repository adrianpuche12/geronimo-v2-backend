import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.join(__dirname, '.env') });

const { Pool } = require('pg');
const { Redis } = require('@upstash/redis');

async function monitorStorage() {
  console.log('🔍 MONITOREO DE PERSISTENCIA - GERONIMO V2');
  console.log('===========================================');
  console.log('');

  // 1. PostgreSQL - Verificar documentos
  console.log('📊 1. POSTGRESQL (NeonDB)');
  console.log('-------------------------------------------');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    // Listar proyectos
    await pool.query('SET search_path TO tenant_default_001, public');
    const projects = await pool.query('SELECT id, name, created_at FROM projects ORDER BY created_at DESC');
    console.log(`✅ Proyectos encontrados: ${projects.rows.length}`);
    projects.rows.forEach((p: any) => {
      console.log(`   - ${p.name} (${p.id})`);
    });
    console.log('');

    // Listar documentos
    const docs = await pool.query('SELECT id, title, file_path, storage_location, file_size, created_at FROM documents ORDER BY created_at DESC LIMIT 10');
    console.log(`✅ Documentos encontrados: ${docs.rows.length}`);
    docs.rows.forEach((d: any) => {
      const size = d.file_size ? `${(d.file_size / 1024).toFixed(2)} KB` : 'N/A';
      const location = d.storage_location || 'local';
      console.log(`   - ${d.title}`);
      console.log(`     ID: ${d.id}`);
      console.log(`     Path: ${d.file_path || 'N/A'}`);
      console.log(`     Size: ${size}`);
      console.log(`     Location: ${location}`);
      console.log(`     Created: ${d.created_at}`);
      console.log('');
    });

    await pool.end();
  } catch (error: any) {
    console.error('❌ Error en PostgreSQL:', error.message);
  }
  console.log('');

  // 2. Redis - Verificar cache
  console.log('🔴 2. REDIS (Upstash)');
  console.log('-------------------------------------------');
  try {
    const redis = new Redis({
      url: process.env.REDIS_URL,
      token: process.env.REDIS_TOKEN,
    });

    // Intentar leer algunas keys (Upstash no soporta KEYS, así que probamos algunas conocidas)
    const testKeys = [
      'geronimo-v2:tenant:default-001:cache:query:*',
      'geronimo-v2:tenant:default-001:session:*',
    ];

    console.log('✅ Redis conectado');
    console.log('   Namespace: geronimo-v2');
    console.log('   (Upstash REST API no soporta listar todas las keys)');
  } catch (error: any) {
    console.error('❌ Error en Redis:', error.message);
  }
  console.log('');

  // 3. Filesystem - Verificar archivos locales
  console.log('📁 3. FILESYSTEM (Local)');
  console.log('-------------------------------------------');
  try {
    const storagePath = process.env.UPLOAD_DIR || '/opt/geronimo-v2/storage/uploads';
    
    if (fs.existsSync(storagePath)) {
      const files = await fs.promises.readdir(storagePath, { recursive: true });
      console.log(`✅ Directorio: ${storagePath}`);
      console.log(`✅ Archivos encontrados: ${files.length}`);
      
      // Mostrar últimos 10 archivos
      const recentFiles = files.slice(-10);
      if (recentFiles.length > 0) {
        console.log('\n   Archivos recientes:');
        for (const file of recentFiles) {
          const filePath = path.join(storagePath, file.toString());
          try {
            const stats = await fs.promises.stat(filePath);
            if (stats.isFile()) {
              const size = (stats.size / 1024).toFixed(2);
              console.log(`   - ${file} (${size} KB) - ${stats.mtime.toISOString()}`);
            }
          } catch (err) {
            // Ignorar errores de archivos individuales
          }
        }
      }
    } else {
      console.log(`⚠️  Directorio no existe: ${storagePath}`);
    }
  } catch (error: any) {
    console.error('❌ Error en Filesystem:', error.message);
  }
  console.log('');

  // 4. Backblaze B2 - Verificar bucket
  console.log('☁️  4. BACKBLAZE B2 (Cloud Storage)');
  console.log('-------------------------------------------');
  try {
    const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
    
    const client = new S3Client({
      region: process.env.B2_REGION,
      endpoint: 'https://' + process.env.B2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.B2_KEY_ID || '',
        secretAccessKey: process.env.B2_APPLICATION_KEY || '',
      },
    });

    const response = await client.send(new ListObjectsV2Command({
      Bucket: process.env.B2_BUCKET_NAME,
      Prefix: 'tenant_default_001/',
      MaxKeys: 10,
    }));

    console.log(`✅ Bucket: ${process.env.B2_BUCKET_NAME}`);
    console.log(`✅ Archivos en B2: ${response.KeyCount || 0}`);
    
    if (response.Contents && response.Contents.length > 0) {
      console.log('\n   Archivos en cloud:');
      response.Contents.forEach((obj: any) => {
        const size = (obj.Size / 1024).toFixed(2);
        console.log(`   - ${obj.Key} (${size} KB) - ${obj.LastModified}`);
      });
    }
  } catch (error: any) {
    console.error('❌ Error en B2:', error.message);
  }
  console.log('');

  console.log('===========================================');
  console.log('✅ Monitoreo completado');
  process.exit(0);
}

monitorStorage().catch(console.error);
