import { Injectable, Logger } from '@nestjs/common';
import { Octokit } from '@octokit/rest';
import * as crypto from 'crypto';
import { IntegrationProvider } from '../../../interfaces/integration-provider.interface';
import { SyncResult, SyncedItem } from '../../../interfaces/sync-result.interface';
import { GitHubConfig } from './github.types';

@Injectable()
export class GitHubProvider implements IntegrationProvider {
  private readonly logger = new Logger(GitHubProvider.name);

  getProviderName(): string {
    return 'github';
  }

  async sync(config: GitHubConfig): Promise<SyncResult> {
    this.logger.log('Starting GitHub sync...');

    if (!this.validateConfig(config)) {
      throw new Error('Invalid GitHub configuration');
    }

    const octokit = new Octokit({ auth: config.accessToken });
    const items: SyncedItem[] = [];
    const errors: string[] = [];

    try {
      for (const repoFullName of config.repos) {
        const [owner, repo] = repoFullName.split('/');

        if (!owner || !repo) {
          errors.push(`Invalid repository format: ${repoFullName}`);
          continue;
        }

        this.logger.log(`Syncing repository: ${repoFullName}`);

        // Sync README
        if (config.syncReadme !== false) {
          try {
            const readmeItems = await this.syncReadme(octokit, owner, repo);
            items.push(...readmeItems);
          } catch (error) {
            errors.push(`Error syncing README for ${repoFullName}: ${error.message}`);
          }
        }

        // Sync /docs folder
        if (config.syncDocs !== false) {
          try {
            const docsItems = await this.syncDocsFolder(octokit, owner, repo);
            items.push(...docsItems);
          } catch (error) {
            errors.push(`Error syncing docs for ${repoFullName}: ${error.message}`);
          }
        }

        // Sync commits
        if (config.syncCommits !== false) {
          try {
            const commitItems = await this.syncCommits(octokit, owner, repo, config.maxCommits || 50);
            items.push(...commitItems);
          } catch (error) {
            errors.push(`Error syncing commits for ${repoFullName}: ${error.message}`);
          }
        }

        // Sync issues
        if (config.syncIssues !== false) {
          try {
            const issueItems = await this.syncIssues(octokit, owner, repo, config.maxIssues || 100);
            items.push(...issueItems);
          } catch (error) {
            errors.push(`Error syncing issues for ${repoFullName}: ${error.message}`);
          }
        }

        // Sync pull requests
        if (config.syncPullRequests !== false) {
          try {
            const prItems = await this.syncPullRequests(octokit, owner, repo, config.maxPRs || 50);
            items.push(...prItems);
          } catch (error) {
            errors.push(`Error syncing PRs for ${repoFullName}: ${error.message}`);
          }
        }
      }

      this.logger.log(`GitHub sync completed. Items: ${items.length}, Errors: ${errors.length}`);

      return {
        success: errors.length === 0,
        itemsFetched: items.length,
        itemsCreated: 0,
        itemsUpdated: 0,
        itemsFailed: errors.length,
        errors,
        items,
      };
    } catch (error) {
      this.logger.error(`GitHub sync failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async testConnection(config: GitHubConfig): Promise<boolean> {
    try {
      const octokit = new Octokit({ auth: config.accessToken });
      await octokit.rest.users.getAuthenticated();
      return true;
    } catch (error) {
      this.logger.error(`GitHub connection test failed: ${error.message}`);
      return false;
    }
  }

  validateConfig(config: any): boolean {
    return (
      config &&
      typeof config.accessToken === 'string' &&
      config.accessToken.length > 0 &&
      Array.isArray(config.repos) &&
      config.repos.length > 0
    );
  }

  private async syncReadme(
    octokit: Octokit,
    owner: string,
    repo: string,
  ): Promise<SyncedItem[]> {
    try {
      const { data } = await octokit.rest.repos.getReadme({ owner, repo });

      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      const contentHash = this.hashContent(content);

      return [
        {
          externalId: `${owner}/${repo}/README.md`,
          title: `README - ${repo}`,
          content,
          contentHash,
          itemType: 'readme',
          url: data.html_url,
          metadata: {
            repository: `${owner}/${repo}`,
            path: data.path,
            sha: data.sha,
            size: data.size,
          },
        },
      ];
    } catch (error) {
      if (error.status === 404) {
        this.logger.warn(`No README found for ${owner}/${repo}`);
        return [];
      }
      throw error;
    }
  }

  private async syncDocsFolder(
    octokit: Octokit,
    owner: string,
    repo: string,
  ): Promise<SyncedItem[]> {
    try {
      const { data } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: 'docs',
      });

      if (!Array.isArray(data)) {
        return [];
      }

      const items: SyncedItem[] = [];

      for (const file of data) {
        if (file.type === 'file' && this.isDocumentFile(file.name)) {
          try {
            const { data: fileData } = await octokit.rest.repos.getContent({
              owner,
              repo,
              path: file.path,
            });

            if ('content' in fileData) {
              const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
              const contentHash = this.hashContent(content);

              items.push({
                externalId: `${owner}/${repo}/${file.path}`,
                title: `${file.name} - ${repo}`,
                content,
                contentHash,
                itemType: 'documentation',
                url: fileData.html_url,
                metadata: {
                  repository: `${owner}/${repo}`,
                  path: file.path,
                  sha: fileData.sha,
                  size: fileData.size,
                },
              });
            }
          } catch (error) {
            this.logger.warn(`Error reading file ${file.path}: ${error.message}`);
          }
        }
      }

      return items;
    } catch (error) {
      if (error.status === 404) {
        this.logger.warn(`No docs folder found for ${owner}/${repo}`);
        return [];
      }
      throw error;
    }
  }

  private async syncCommits(
    octokit: Octokit,
    owner: string,
    repo: string,
    maxCommits: number,
  ): Promise<SyncedItem[]> {
    try {
      const { data } = await octokit.rest.repos.listCommits({
        owner,
        repo,
        per_page: Math.min(maxCommits, 100),
      });

      return data.map((commit) => {
        const content = `Commit: ${commit.commit.message}\n\nAuthor: ${commit.commit.author?.name} <${commit.commit.author?.email}>\nDate: ${commit.commit.author?.date}\n\nSHA: ${commit.sha}`;
        const contentHash = this.hashContent(content);

        return {
          externalId: `${owner}/${repo}/commit/${commit.sha}`,
          title: commit.commit.message.split('\n')[0].substring(0, 200),
          content,
          contentHash,
          itemType: 'commit',
          url: commit.html_url,
          metadata: {
            repository: `${owner}/${repo}`,
            sha: commit.sha,
            author: commit.commit.author?.name,
            authorEmail: commit.commit.author?.email,
            date: commit.commit.author?.date,
            stats: commit.stats,
          },
        };
      });
    } catch (error) {
      this.logger.error(`Error syncing commits for ${owner}/${repo}: ${error.message}`);
      throw error;
    }
  }

  private async syncIssues(
    octokit: Octokit,
    owner: string,
    repo: string,
    maxIssues: number,
  ): Promise<SyncedItem[]> {
    try {
      const { data } = await octokit.rest.issues.listForRepo({
        owner,
        repo,
        state: 'all',
        per_page: Math.min(maxIssues, 100),
        sort: 'updated',
        direction: 'desc',
      });

      const issues = data.filter((item) => !item.pull_request);

      return issues.map((issue) => {
        const content = `# Issue #${issue.number}: ${issue.title}\n\n${issue.body || 'No description'}\n\n---\nState: ${issue.state}\nCreated: ${issue.created_at}\nUpdated: ${issue.updated_at}\nComments: ${issue.comments}`;
        const contentHash = this.hashContent(content);

        return {
          externalId: `${owner}/${repo}/issue/${issue.number}`,
          title: `Issue #${issue.number}: ${issue.title}`,
          content,
          contentHash,
          itemType: 'issue',
          url: issue.html_url,
          metadata: {
            repository: `${owner}/${repo}`,
            number: issue.number,
            state: issue.state,
            author: issue.user?.login,
            labels: issue.labels.map((l) => (typeof l === 'string' ? l : l.name)),
            assignees: issue.assignees?.map((a) => a.login) || [],
            createdAt: issue.created_at,
            updatedAt: issue.updated_at,
            commentsCount: issue.comments,
          },
          externalCreatedAt: new Date(issue.created_at),
          externalUpdatedAt: new Date(issue.updated_at),
        };
      });
    } catch (error) {
      this.logger.error(`Error syncing issues for ${owner}/${repo}: ${error.message}`);
      throw error;
    }
  }

  private async syncPullRequests(
    octokit: Octokit,
    owner: string,
    repo: string,
    maxPRs: number,
  ): Promise<SyncedItem[]> {
    try {
      const { data: pullRequests } = await octokit.rest.pulls.list({
        owner,
        repo,
        state: 'all',
        per_page: Math.min(maxPRs, 100),
        sort: 'updated',
        direction: 'desc',
      });

      const items: SyncedItem[] = [];

      for (const pr of pullRequests) {
        try {
          const { data: prDetails } = await octokit.rest.pulls.get({
            owner,
            repo,
            pull_number: pr.number,
          });

          const content = `# Pull Request #${prDetails.number}: ${prDetails.title}\n\n${prDetails.body || 'No description'}\n\n---\nState: ${prDetails.state}\nMerged: ${prDetails.merged_at ? 'Yes' : 'No'}\nCreated: ${prDetails.created_at}\nUpdated: ${prDetails.updated_at}\nComments: ${prDetails.comments}\nCommits: ${prDetails.commits}\nChanges: +${prDetails.additions} -${prDetails.deletions}`;
          const contentHash = this.hashContent(content);

          items.push({
            externalId: `${owner}/${repo}/pull/${prDetails.number}`,
            title: `PR #${prDetails.number}: ${prDetails.title}`,
            content,
            contentHash,
            itemType: 'pull_request',
            url: prDetails.html_url,
            metadata: {
              repository: `${owner}/${repo}`,
              number: prDetails.number,
              state: prDetails.state,
              author: prDetails.user?.login,
              labels: prDetails.labels.map((l) => l.name),
              assignees: prDetails.assignees?.map((a) => a.login) || [],
              createdAt: prDetails.created_at,
              updatedAt: prDetails.updated_at,
              mergedAt: prDetails.merged_at,
              commentsCount: prDetails.comments,
              commits: prDetails.commits,
              additions: prDetails.additions,
              deletions: prDetails.deletions,
              changedFiles: prDetails.changed_files,
            },
            externalCreatedAt: new Date(prDetails.created_at),
            externalUpdatedAt: new Date(prDetails.updated_at),
          });
        } catch (error) {
          this.logger.warn(`Error fetching details for PR #${pr.number}: ${error.message}`);
        }
      }

      return items;
    } catch (error) {
      this.logger.error(`Error syncing PRs for ${owner}/${repo}: ${error.message}`);
      throw error;
    }
  }

  private isDocumentFile(filename: string): boolean {
    const docExtensions = ['.md', '.txt', '.rst', '.adoc', '.pdf'];
    return docExtensions.some((ext) => filename.toLowerCase().endsWith(ext));
  }

  private hashContent(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}
