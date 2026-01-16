import { Injectable, Logger } from '@nestjs/common';
import { IntegrationProvider } from '../../../interfaces/integration-provider.interface';
import { SyncResult } from '../../../interfaces/sync-result.interface';
import { GmailConfig } from './gmail.types';
import { google } from 'googleapis';
import * as crypto from 'crypto';

@Injectable()
export class GmailProvider implements IntegrationProvider {
  private readonly logger = new Logger(GmailProvider.name);

  getProviderName(): string {
    return 'Gmail';
  }

  async sync(config: GmailConfig): Promise<SyncResult> {
    const startTime = new Date();
    this.logger.log('Starting Gmail email sync');

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: config.accessToken,
      refresh_token: config.refreshToken,
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const items: any[] = [];
    let itemsFetched = 0;
    let itemsCreated = 0;
    let itemsFailed = 0;
    const errors: string[] = [];

    try {
      const labels = config.labels || ['INBOX'];
      const maxResults = config.maxResults || 50;

      for (const labelName of labels) {
        try {
          this.logger.log(`Fetching emails from label: ${labelName}`);

          // List messages
          const messagesResponse = await gmail.users.messages.list({
            userId: 'me',
            labelIds: [labelName],
            maxResults,
          });

          const messages = messagesResponse.data.messages || [];
          this.logger.log(`Found ${messages.length} messages in ${labelName}`);

          for (const message of messages) {
            try {
              // Get full message details
              const fullMessage = await gmail.users.messages.get({
                userId: 'me',
                id: message.id!,
                format: 'full',
              });

              const headers = fullMessage.data.payload?.headers || [];
              const subject = this.getHeader(headers, 'Subject') || '(No Subject)';
              const from = this.getHeader(headers, 'From') || '';
              const to = this.getHeader(headers, 'To') || '';
              const date = this.getHeader(headers, 'Date') || '';
              const messageId = this.getHeader(headers, 'Message-ID') || message.id!;

              // Extract body
              let body = '';
              if (fullMessage.data.payload?.parts) {
                // Multipart message
                for (const part of fullMessage.data.payload.parts) {
                  if (part.mimeType === 'text/plain' && part.body?.data) {
                    body = Buffer.from(part.body.data, 'base64').toString('utf-8');
                    break;
                  }
                }
                // If no plain text, try HTML
                if (!body) {
                  for (const part of fullMessage.data.payload.parts) {
                    if (part.mimeType === 'text/html' && part.body?.data) {
                      body = Buffer.from(part.body.data, 'base64').toString('utf-8');
                      break;
                    }
                  }
                }
              } else if (fullMessage.data.payload?.body?.data) {
                // Simple message
                body = Buffer.from(fullMessage.data.payload.body.data, 'base64').toString('utf-8');
              }

              // Truncate body for preview
              const contentPreview = body.substring(0, 500);

              // Calculate content hash
              const contentHash = crypto
                .createHash('sha256')
                .update(subject + from + date + body)
                .digest('hex');

              items.push({
                externalId: message.id!,
                itemType: 'email',
                title: subject,
                description: `From: ${from}`,
                url: `https://mail.google.com/mail/u/0/#inbox/${message.id}`,
                content: body,
                contentHash,
                metadata: {
                  from,
                  to,
                  date,
                  messageId,
                  labels: fullMessage.data.labelIds || [],
                  snippet: fullMessage.data.snippet || '',
                  threadId: fullMessage.data.threadId,
                  internalDate: fullMessage.data.internalDate,
                },
              });

              itemsCreated++;
              itemsFetched++;
            } catch (error) {
              this.logger.error(`Error fetching message ${message.id}: ${error.message}`);
              itemsFailed++;
              errors.push(`Message ${message.id}: ${error.message}`);
            }
          }
        } catch (error) {
          this.logger.error(`Error fetching label ${labelName}: ${error.message}`);
          errors.push(`Label ${labelName}: ${error.message}`);
        }
      }

      const endTime = new Date();
      this.logger.log(`Gmail sync completed. Fetched: ${itemsFetched}, Created: ${itemsCreated}, Failed: ${itemsFailed}`);

      return {
        success: itemsFailed < itemsFetched,
        itemsFetched,
        itemsCreated,
        itemsUpdated: 0,
        itemsFailed,
        errors,
        items,
        metadata: {
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          provider: 'gmail',
          labels,
          maxResults,
        },
      };
    } catch (error) {
      this.logger.error(`Gmail sync failed: ${error.message}`, error.stack);

      return {
        success: false,
        itemsFetched,
        itemsCreated,
        itemsUpdated: 0,
        itemsFailed,
        errors: [...errors, error.message],
        items,
        metadata: {
          startTime: startTime.toISOString(),
          endTime: new Date().toISOString(),
          provider: 'gmail',
          error: error.message,
        },
      };
    }
  }

  async testConnection(config: GmailConfig): Promise<boolean> {
    try {
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({
        access_token: config.accessToken,
        refresh_token: config.refreshToken,
      });

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      // Test by getting user profile
      await gmail.users.getProfile({ userId: 'me' });

      this.logger.log('Gmail connection test successful');
      return true;
    } catch (error) {
      this.logger.error(`Gmail connection test failed: ${error.message}`);
      return false;
    }
  }

  validateConfig(config: any): boolean {
    return !!(config && config.accessToken);
  }

  private getHeader(headers: any[], name: string): string | null {
    const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
    return header ? header.value : null;
  }
}
