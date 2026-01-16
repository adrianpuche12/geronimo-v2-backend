/**
 * OAuth2 tokens returned by providers
 */
export interface OAuthTokens {
  /** Access token for API calls */
  accessToken: string;

  /** Refresh token to renew access token (optional) */
  refreshToken?: string;

  /** When the access token expires (optional) */
  expiresAt?: Date;

  /** OAuth scopes granted (optional) */
  scope?: string;
}

/**
 * OAuth2 state parameter (CSRF protection)
 */
export interface OAuthState {
  /** Random state string */
  state: string;

  /** Tenant ID making the OAuth request */
  tenantId: string;

  /** Integration ID being activated */
  integrationId: string;

  /** Optional redirect URL after OAuth completion */
  redirectUrl?: string;
}

/**
 * OAuth2 configuration for a provider
 */
export interface OAuthConfig {
  /** Client ID from OAuth app */
  clientId: string;

  /** Client secret from OAuth app */
  clientSecret: string;

  /** Callback URL for OAuth redirect */
  callbackUrl: string;

  /** OAuth scopes to request */
  scopes: string[];
}
