import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';
import { OAuthTokens, OAuthState } from '../../interfaces/oauth-config.interface';
import * as crypto from 'crypto';

/**
 * OAuth Service for managing OAuth2 flows
 */
@Injectable()
export class OAuthService {
  constructor(
    private configService: ConfigService,
    private encryptionService: EncryptionService,
  ) {}

  /**
   * Generate random state for OAuth2 CSRF protection
   * @param tenantId - Tenant ID making the request
   * @param integrationId - Integration ID being activated
   * @param redirectUrl - Optional redirect URL after OAuth
   * @returns Base64-encoded state string
   */
  generateState(
    tenantId: string,
    integrationId: string,
    redirectUrl?: string,
  ): string {
    const stateData: OAuthState = {
      state: crypto.randomBytes(16).toString('hex'),
      tenantId,
      integrationId,
      redirectUrl,
    };

    // Encode state as base64 (not encrypted, just encoded)
    return Buffer.from(JSON.stringify(stateData)).toString('base64');
  }

  /**
   * Validate and decode OAuth state parameter
   * @param stateString - State from OAuth callback
   * @returns Decoded state data
   * @throws UnauthorizedException if state is invalid
   */
  validateState(stateString: string): OAuthState {
    try {
      const decoded = Buffer.from(stateString, 'base64').toString('utf8');
      const stateData: OAuthState = JSON.parse(decoded);

      if (
        !stateData.state ||
        !stateData.tenantId ||
        !stateData.integrationId
      ) {
        throw new UnauthorizedException('Invalid OAuth state: missing fields');
      }

      return stateData;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid OAuth state: malformed data');
    }
  }

  /**
   * Encrypt OAuth tokens before storing in database
   * @param tokens - OAuth tokens to encrypt
   * @returns Encrypted config and IV
   */
  encryptTokens(tokens: OAuthTokens): { encrypted: string; iv: string } {
    return this.encryptionService.encrypt(tokens);
  }

  /**
   * Decrypt OAuth tokens from database
   * @param encrypted - Encrypted string
   * @param iv - Initialization vector
   * @returns Decrypted OAuth tokens
   */
  decryptTokens(encrypted: string, iv: string): OAuthTokens {
    return this.encryptionService.decryptJSON<OAuthTokens>(encrypted, iv);
  }

  /**
   * Check if access token is expired or about to expire
   * @param expiresAt - Expiration date
   * @param bufferMinutes - Buffer time in minutes (default: 5)
   * @returns true if expired or expires soon
   */
  isTokenExpired(expiresAt: Date, bufferMinutes: number = 5): boolean {
    const now = new Date();
    const bufferMs = bufferMinutes * 60 * 1000;
    const expirationWithBuffer = new Date(expiresAt.getTime() - bufferMs);

    return now >= expirationWithBuffer;
  }

  /**
   * Calculate expiration date from seconds
   * @param expiresIn - Seconds until expiration
   * @returns Date when token expires
   */
  calculateExpiresAt(expiresIn: number): Date {
    return new Date(Date.now() + expiresIn * 1000);
  }
}
