const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;
const schema = process.env.DB_DEFAULT_SCHEMA || 'tenant_default_001';

async function migrate() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  
  try {
    await client.connect();
    console.log('✅ Conectado a NeonDB');
    
    // Establecer schema
    await client.query(`SET search_path TO ${schema}, public`);
    console.log(`✅ Schema configurado: ${schema}`);
    
    // 1. Agregar columna content_text
    await client.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS content_text TEXT`);
    console.log('✅ Columna content_text agregada');
    
    // 2. Migrar datos existentes
    const result = await client.query(`
      UPDATE documents 
      SET content_text = content 
      WHERE content IS NOT NULL AND content_text IS NULL
    `);
    console.log(`✅ Migrados ${result.rowCount} registros (content -> content_text)`);
    
    // 3. Verificar estructura
    const tableInfo = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = '${schema}' AND table_name = 'documents'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📊 Estructura de tabla documents:');
    tableInfo.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
    });
    
    console.log('\n✅ Migración completada exitosamente');
    
  } catch (error) {
    console.error('❌ Error en migración:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

migrate();
