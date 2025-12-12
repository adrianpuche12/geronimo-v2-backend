import * as dotenv from 'dotenv';
import * as path from 'path';

// Cargar .env
dotenv.config({ path: path.join(__dirname, '.env') });

console.log('🔧 Configuración cargada:');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
console.log('REDIS_URL:', process.env.REDIS_URL);
console.log('REDIS_TOKEN:', process.env.REDIS_TOKEN ? 'SET' : 'NOT SET');
console.log('B2_KEY_ID:', process.env.B2_KEY_ID);
console.log('B2_BUCKET_NAME:', process.env.B2_BUCKET_NAME);
console.log('');

async function testNeonDB() {
  console.log('📊 Testing NeonDB PostgreSQL...');
  const { Pool } = require('pg');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const result = await pool.query('SELECT NOW() as current_time, current_database() as database');
    console.log('✅ NeonDB Conectado!', result.rows[0]);
    
    const tenants = await pool.query('SELECT * FROM shared.tenants LIMIT 1');
    console.log('✅ Tenants encontrados:', tenants.rows.length);
    
    await pool.end();
  } catch (error: any) {
    console.error('❌ NeonDB Error:', error.message);
  }
  console.log('');
}

async function testUpstashRedis() {
  console.log('🔴 Testing Upstash Redis...');
  const { Redis } = require('@upstash/redis');

  try {
    const redis = new Redis({
      url: process.env.REDIS_URL,
      token: process.env.REDIS_TOKEN,
    });

    await redis.set('test-key', 'Hello Geronimo V2!');
    console.log('✅ Redis SET: OK');
    
    const value = await redis.get('test-key');
    console.log('✅ Redis GET:', value);
    
    await redis.del('test-key');
    console.log('✅ Redis DEL: OK');
  } catch (error: any) {
    console.error('❌ Redis Error:', error.message);
  }
  console.log('');
}

async function testBackblazeB2() {
  console.log('☁️  Testing Backblaze B2...');
  const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');

  try {
    const client = new S3Client({
      region: process.env.B2_REGION,
      endpoint: 'https://' + process.env.B2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.B2_KEY_ID || '',
        secretAccessKey: process.env.B2_APPLICATION_KEY || '',
      },
    });

    const response = await client.send(new ListBucketsCommand({}));
    console.log('✅ B2 Conectado! Buckets encontrados:', response.Buckets?.length || 0);
    if (response.Buckets && response.Buckets.length > 0) {
      console.log('   Buckets:', response.Buckets.map((b: any) => b.Name).join(', '));
    }
  } catch (error: any) {
    console.error('❌ B2 Error:', error.message);
  }
  console.log('');
}

async function runTests() {
  console.log('🚀 Probando conexiones a infraestructura distribuida...');
  console.log('');
  
  await testNeonDB();
  await testUpstashRedis();
  await testBackblazeB2();
  
  console.log('🎉 Pruebas completadas!');
  process.exit(0);
}

runTests().catch(console.error);
