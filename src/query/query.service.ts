import { Injectable } from '@nestjs/common';
import { AIFactory } from '../ai/ai.factory';
import { DocsService } from '../docs/docs.service';
import { ProjectsService } from '../projects/projects.service';
import { SecretsDetectorService } from '../security/secrets-detector.service';

@Injectable()
export class QueryService {
  private readonly MAX_CONTEXT_CHARS = 6000 * 4;
  private readonly MAX_DOC_LENGTH = 5000;

  constructor(
    private readonly aiFactory: AIFactory,
    private readonly docsService: DocsService,
    private readonly projectsService: ProjectsService,
    private readonly secretsDetectorService: SecretsDetectorService,
  ) {}

  async query(question: string, projectId?: string, isAdmin: boolean = false) {
    console.log('QueryService - Received projectId:', projectId, 'isAdmin:', isAdmin);

    let documents;
    let projectsMap: Map<string, string> = new Map();

    if (projectId === 'all') {
      console.log('QueryService - Multi-project mode activated');
      documents = await this.docsService.findAll();

      const projects = await this.projectsService.findAll();
      projects.forEach(p => projectsMap.set(p.id, p.name));

      console.log('QueryService - Found documents across all projects:', documents.length);
    } else if (projectId) {
      documents = await this.docsService.findByProject(projectId);
      const project = await this.projectsService.findOne(projectId);
      if (project) {
        projectsMap.set(project.id, project.name);
      }
      console.log('QueryService - Found documents for project:', documents.length);
    } else {
      documents = await this.docsService.findAll();
      console.log('QueryService - Found all documents:', documents.length);
    }

    if (documents.length === 0) {
      return {
        answer: projectId === 'all'
          ? 'No hay documentación disponible en ningún proyecto.'
          : 'No hay documentación disponible en este proyecto.',
        sources: [],
      };
    }

    const { context, usedDocs } = this.buildLimitedContext(
      documents,
      projectsMap,
      projectId === 'all',
      isAdmin,
    );

    const result = await this.aiFactory.generateAnswer(
      question,
      context,
      'expert',
      projectId === 'all',
    );

    return {
      answer: result.answer,
      sources: usedDocs.map((doc) => ({
        id: doc.id,
        path: doc.path,
        title: doc.title,
        projectId: doc.projectId,
        projectName: projectsMap.get(doc.projectId) || 'Unknown',
      })),
      timestamp: new Date().toISOString(),
      totalDocuments: documents.length,
      usedDocuments: usedDocs.length,
      isMultiProject: projectId === 'all',
      provider: result.provider,
      model: result.model,
      mode: result.mode,
      tokensUsed: result.tokensUsed,
      responseTime: result.responseTime,
    };
  }

  private buildLimitedContext(
    documents: any[],
    projectsMap: Map<string, string>,
    isMultiProject: boolean,
    isAdmin: boolean,
  ): { context: string; usedDocs: any[] } {
    const usedDocs: any[] = [];
    let currentLength = 0;
    const contextParts: string[] = [];

    for (const doc of documents) {
      let content = doc.content || '';

      if (!isAdmin && doc.metadata?.hasSecrets) {
        content = this.secretsDetectorService.censorByConfidence(content, 'medium');
        console.log('[SECURITY] Censored document for non-admin user');
      }

      if (content.length > this.MAX_DOC_LENGTH) {
        content = content.substring(0, this.MAX_DOC_LENGTH) + '\n[... contenido truncado ...]';
      }

      const projectPrefix = isMultiProject
        ? '[Proyecto: ' + (projectsMap.get(doc.projectId) || 'Unknown') + '] '
        : '';

      const docText = projectPrefix + '[' + doc.path + ']:\n' + content;
      const docLength = docText.length;

      if (currentLength + docLength > this.MAX_CONTEXT_CHARS && contextParts.length > 0) {
        console.log('QueryService - Context limit reached');
        break;
      }

      contextParts.push(docText);
      usedDocs.push(doc);
      currentLength += docLength;
    }

    const context = contextParts.join('\n\n---\n\n');
    console.log('QueryService - Built context with documents:', usedDocs.length);

    return { context, usedDocs };
  }
}
