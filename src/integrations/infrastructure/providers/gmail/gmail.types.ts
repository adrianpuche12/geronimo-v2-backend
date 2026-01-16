export interface GmailConfig {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  labels?: string[];
  maxResults?: number;
}

export enum GmailItemType {
  EMAIL = "email",
}

export class GmailQuotaError extends Error {}
export class GmailAuthError extends Error {}
export class GmailHeaderParser {
  static getHeader(headers: any[], name: string): string | null { return null; }
  static parseAddresses(addr: string): any[] { return []; }
}
