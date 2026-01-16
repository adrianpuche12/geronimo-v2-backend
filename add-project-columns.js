require('dotenv').config();
const { Client } = require('pg');

async function migrate() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    const sql = `
      ALTER TABLE tenant_default_001.projects 
        ADD COLUMN IF NOT EXISTS template VARCHAR(50),
        ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);
    `;
    
    await client.query(sql);
    console.log('✅ Columns added to projects table');
    
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'tenant_default_001' 
        AND table_name = 'projects'
      ORDER BY ordinal_position;
    `);
    
    console.log('\n📋 All columns in projects table:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
