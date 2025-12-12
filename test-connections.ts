import { databaseService } from './src/storage/database.service';
import { redisService } from './src/storage/redis.service';
import { b2StorageService } from './src/storage/b2.service';

async function testConnections() {
  console.log('🚀 Probando conexiones a infraestructura distribuida...');
  console.log('');

  // 1. Test NeonDB
  console.log('📊 1. Testing NeonDB PostgreSQL...');
  try {
    const result = await databaseService.query('SELECT NOW() as current_time');
    console.log('✅ NeonDB: Conectado!', result.rows[0]);
    
    const tenant = await databaseService.getTenantBySlug('default-001');
    console.log('✅ Tenant encontrado:', tenant ? tenant.name : 'No encontrado');
  } catch (error: any) {
    console.error('❌ NeonDB Error:', error.message);
  }
  console.log('');

  // 2. Test Upstash Redis
  console.log('🔴 2. Testing Upstash Redis...');
  try {
    const testKey = 'test-connection';
    const testValue = { message: 'Hello from Geronimo V2!', timestamp: new Date().toISOString() };
    
    await redisService.set('default-001', testKey, testValue, 60);
    console.log('✅ Redis SET: OK');
    
    const retrieved = await redisService.get('default-001', testKey);
    console.log('✅ Redis GET:', retrieved);
    
    await redisService.del('default-001', testKey);
    console.log('✅ Redis DEL: OK');
  } catch (error: any) {
    console.error('❌ Redis Error:', error.message);
  }
  console.log('');

  // 3. Test Backblaze B2
  console.log('☁️  3. Testing Backblaze B2...');
  try {
    const testContent = Buffer.from('Hello from Geronimo V2!');
    const testKey = b2StorageService.generateKey('test-project', 'test.txt');
    
    const path = await b2StorageService.saveFile('default-001', testKey, testContent);
    console.log('✅ B2 Upload: OK', path);
    
    const retrieved = await b2StorageService.getFile('default-001', path);
    console.log('✅ B2 Download: OK', retrieved.toString());
    
    await b2StorageService.deleteFile('default-001', path.replace('b2://', ''));
    console.log('✅ B2 Delete: OK');
  } catch (error: any) {
    console.error('❌ B2 Error:', error.message);
  }
  console.log('');

  console.log('🎉 Pruebas completadas!');
  process.exit(0);
}

testConnections().catch(console.error);
