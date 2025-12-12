import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule} from '@nestjs/config';

// Middleware
import { TenantMiddleware } from './api/middleware/tenant.middleware';

// Controllers
import { ProjectsController } from './api/controllers/projects.controller';
import { DocsController } from './api/controllers/docs.controller';

// Use Cases
import { CreateProjectUseCase } from './application/use-cases/create-project.use-case';
import { ListProjectsUseCase } from './application/use-cases/list-projects.use-case';
import { GetProjectUseCase } from './application/use-cases/get-project.use-case';
import { CreateDocumentUseCase } from './application/use-cases/create-document.use-case';

// Repositories
import { ProjectRepository } from './domain/repositories/project.repository';
import { DocumentRepository } from './domain/repositories/document.repository';

// Infrastructure
import { TenantContext } from './infrastructure/database/tenant-context';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],
  controllers: [
    ProjectsController,
    DocsController,
  ],
  providers: [
    // Context
    TenantContext,

    // Repositories
    ProjectRepository,
    DocumentRepository,

    // Use Cases
    CreateProjectUseCase,
    ListProjectsUseCase,
    GetProjectUseCase,
    CreateDocumentUseCase,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .forRoutes('api/*');
  }
}
