import { Pool } from 'pg';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '../.env') });

// Configurar PostgreSQL con DATABASE_URL (NeonDB)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Configurar B2 (compatible con S3)
const s3Client = new S3Client({
  region: process.env.B2_REGION || 'us-east-005',
  endpoint: \`https://\${process.env.B2_ENDPOINT || 's3.us-east-005.backblazeb2.com'}\`,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID!,
    secretAccessKey: process.env.B2_APPLICATION_KEY!,
  },
});

const bucketName = process.env.B2_BUCKET_NAME || 'geronimo-V2';

async function extractContentFromB2() {
  console.log('🚀 Iniciando extracción de contenido desde B2 Storage (NeonDB)...\n');

  try {
    // 1. Buscar en el schema tenant_default_001
    await pool.query('SET search_path TO tenant_default_001, public');
    
    const result = await pool.query(\`
      SELECT id, project_id, path, title, file_path, mime_type, file_size, content
      FROM documents
      WHERE file_path IS NOT NULL
        AND file_path LIKE 'b2://%'
        AND (content IS NULL OR content = '')
      ORDER BY created_at DESC
    \`);

    const documents = result.rows;
    console.log(\`📁 Encontrados \${documents.length} documentos en B2 sin contenido extraído\n\`);

    if (documents.length === 0) {
      console.log('✅ No hay documentos pendientes de procesar');
      return;
    }

    let processed = 0;
    let errors = 0;

    for (const doc of documents) {
      try {
        console.log(\`\n📄 Procesando: \${doc.title || doc.path}\`);
        console.log(\`   ID: \${doc.id}\`);
        console.log(\`   Ruta B2: \${doc.file_path}\`);
        console.log(\`   Tamaño: \${(doc.file_size / 1024).toFixed(2)} KB\`);
        console.log(\`   MIME: \${doc.mime_type}\`);

        // 2. Descargar archivo desde B2
        const b2Key = doc.file_path.replace('b2://', '');
        console.log(\`   Descargando desde: \${b2Key}\`);

        const command = new GetObjectCommand({
          Bucket: bucketName,
          Key: b2Key,
        });

        const response = await s3Client.send(command);

        // 3. Convertir stream a buffer
        const chunks: Uint8Array[] = [];
        for await (const chunk of response.Body as any) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        console.log(\`   ✅ Descargado: \${buffer.length} bytes\`);

        // 4. Extraer contenido según tipo
        let content: string | null = null;
        const ext = path.extname(doc.path || doc.title || '').toLowerCase();

        if (isTextFile(ext, doc.mime_type)) {
          content = buffer.toString('utf-8');
          console.log(\`   ✅ Contenido extraído: \${content.length} caracteres\`);
        } else {
          console.log(\`   ⚠️  Tipo no soportado para extracción: \${ext}\`);
          content = \`[Binary file: \${ext}]\`;
        }

        // 5. Actualizar en base de datos
        if (content) {
          await pool.query(
            'UPDATE documents SET content = $1, updated_at = NOW() WHERE id = $2',
            [content, doc.id]
          );
          console.log(\`   ✅ Contenido guardado en NeonDB\`);
          processed++;
        }

      } catch (error: any) {
        console.error(\`   ❌ Error procesando \${doc.title}:\`, error.message);
        errors++;
      }
    }

    console.log(\`\n\n📊 RESUMEN:\`);
    console.log(\`   ✅ Procesados exitosamente: \${processed}\`);
    console.log(\`   ❌ Errores: \${errors}\`);
    console.log(\`   📁 Total: \${documents.length}\`);

  } catch (error) {
    console.error('❌ Error fatal:', error);
  } finally {
    await pool.end();
  }
}

function isTextFile(ext: string, mimeType: string): boolean {
  const textExtensions = ['.txt', '.md', '.json', '.xml', '.csv', '.log', '.yml', '.yaml', '.js', '.ts', '.py', '.java', '.c', '.cpp', '.h'];
  const textMimeTypes = ['text/', 'application/json', 'application/xml', 'application/octet-stream'];

  return (
    textExtensions.includes(ext) ||
    textMimeTypes.some(type => mimeType?.startsWith(type))
  );
}

// Ejecutar
extractContentFromB2()
  .then(() => {
    console.log('\n✅ Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  });
