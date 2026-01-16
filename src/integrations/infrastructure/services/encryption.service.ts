import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * Encryption Service for sensitive data (OAuth tokens)
 * Uses AES-256-GCM for authenticated encryption
 */
@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly encryptionKey: Buffer;

  constructor(private configService: ConfigService) {
    const key = this.configService.get<string>('INTEGRATION_ENCRYPTION_KEY');

    if (!key || key.length !== 64) {
      // 32 bytes = 64 hex characters
      throw new Error(
        'INTEGRATION_ENCRYPTION_KEY must be 32 bytes (64 hex characters)',
      );
    }

    this.encryptionKey = Buffer.from(key, 'hex');
  }

  /**
   * Encrypt sensitive data (OAuth tokens)
   * @param plaintext - Data to encrypt (string or object)
   * @returns Object with encrypted data and IV
   */
  encrypt(plaintext: string | object): { encrypted: string; iv: string } {
    const text =
      typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext);

    // Generate random IV (12 bytes for GCM mode)
    const iv = crypto.randomBytes(12);

    // Create cipher
    const cipher = crypto.createCipheriv(
      this.algorithm,
      this.encryptionKey,
      iv,
    );

    // Encrypt
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get authentication tag (16 bytes for GCM)
    const authTag = cipher.getAuthTag();

    // Return encrypted data with auth tag appended
    return {
      encrypted: encrypted + authTag.toString('hex'),
      iv: iv.toString('hex'),
    };
  }

  /**
   * Decrypt encrypted data
   * @param encrypted - Encrypted string (includes auth tag)
   * @param iv - Initialization vector (hex string)
   * @returns Decrypted plaintext
   */
  decrypt(encrypted: string, iv: string): string {
    // Extract auth tag (last 16 bytes = 32 hex characters)
    const authTag = Buffer.from(encrypted.slice(-32), 'hex');
    const ciphertext = encrypted.slice(0, -32);

    // Create decipher
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.encryptionKey,
      Buffer.from(iv, 'hex'),
    );

    decipher.setAuthTag(authTag);

    // Decrypt
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Decrypt and parse as JSON
   * @param encrypted - Encrypted string
   * @param iv - Initialization vector
   * @returns Parsed JSON object
   */
  decryptJSON<T = any>(encrypted: string, iv: string): T {
    const decrypted = this.decrypt(encrypted, iv);
    return JSON.parse(decrypted) as T;
  }
}
