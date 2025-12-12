import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import * as crypto from 'crypto';

export class B2StorageService {
  private client: S3Client;
  private bucketName: string;
  private sizeThreshold: number;

  constructor() {
    const keyId = process.env.B2_KEY_ID!;
    const applicationKey = process.env.B2_APPLICATION_KEY!;
    const endpoint = process.env.B2_ENDPOINT!;
    this.bucketName = process.env.B2_BUCKET_NAME!;
    this.sizeThreshold = parseInt(process.env.B2_SIZE_THRESHOLD || '1048576'); // 1MB default

    this.client = new S3Client({
      region: process.env.B2_REGION || 'us-east-005',
      endpoint: `https://${endpoint}`,
      credentials: {
        accessKeyId: keyId,
        secretAccessKey: applicationKey,
      },
    });

    console.log(`[B2] Conectado a Backblaze B2 (bucket: ${this.bucketName})`);
  }

  /**
   * Guardar archivo en B2
   */
  async saveFile(tenantId: string, key: string, content: Buffer): Promise<string> {
    const fullKey = `tenant_${tenantId}/${key}`;

    await this.client.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: fullKey,
      Body: content,
    }));

    console.log(`[B2] Archivo guardado: ${fullKey}`);
    return `b2://${fullKey}`;
  }

  /**
   * Obtener archivo de B2
   */
  async getFile(tenantId: string, key: string): Promise<Buffer> {
    // Validar que la key pertenece al tenant
    if (!key.startsWith(`tenant_${tenantId}/`) && !key.startsWith('b2://tenant_' + tenantId + '/')) {
      throw new Error('Access denied: File does not belong to tenant');
    }

    // Remover prefijo b2:// si existe
    const cleanKey = key.startsWith('b2://') ? key.substring(5) : key;

    const response = await this.client.send(new GetObjectCommand({
      Bucket: this.bucketName,
      Key: cleanKey,
    }));

    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  }

  /**
   * Eliminar archivo de B2
   */
  async deleteFile(tenantId: string, key: string): Promise<void> {
    if (!key.startsWith(`tenant_${tenantId}/`)) {
      throw new Error('Access denied: File does not belong to tenant');
    }

    await this.client.send(new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    }));

    console.log(`[B2] Archivo eliminado: ${key}`);
  }

  /**
   * Verificar si un archivo debe ir a B2 basado en su tamaño
   */
  shouldUseB2(fileSize: number): boolean {
    return fileSize >= this.sizeThreshold;
  }

  /**
   * Generar key para archivo
   */
  generateKey(projectId: string, filename: string): string {
    const timestamp = Date.now();
    const hash = crypto.createHash('md5').update(filename + timestamp).digest('hex').substring(0, 8);
    return `${projectId}/${hash}_${filename}`;
  }
}

export const b2StorageService = new B2StorageService();
