import { Injectable } from '@nestjs/common';
import { IntegrationProvider } from '../../interfaces/integration-provider.interface';
import { GitHubProvider } from '../providers/github/github.provider';
import { GmailProvider } from '../providers/gmail/gmail.provider';
import { GoogleDriveProvider } from '../providers/google-drive/google-drive.provider';

@Injectable()
export class IntegrationFactory {
  constructor(
    private readonly githubProvider: GitHubProvider,
    private readonly gmailProvider: GmailProvider,
    private readonly googleDriveProvider: GoogleDriveProvider,
  ) {}

  getProvider(integrationId: string): IntegrationProvider {
    switch (integrationId) {
      case 'int-001':
        return this.githubProvider;
      case 'int-004':
        return this.gmailProvider;
      case 'int-020':
        return this.googleDriveProvider;
      default:
        throw new Error('Integration provider not found: ' + integrationId);
    }
  }

  getAvailableProviderIds(): string[] {
    return ['int-001', 'int-004', 'int-020'];
  }

  isProviderImplemented(integrationId: string): boolean {
    return ['int-001', 'int-004', 'int-020'].includes(integrationId);
  }
}
