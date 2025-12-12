import { Module } from '@nestjs/common';
import { QueryService } from './query.service';
import { QueryController } from './query.controller';
import { AiModule } from '../ai/ai.module';
import { DocsModule } from '../docs/docs.module';
import { ProjectsModule } from '../projects/projects.module';
import { ExportModule } from '../export/export.module';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [AiModule, DocsModule, ProjectsModule, ExportModule, SecurityModule],
  controllers: [QueryController],
  providers: [QueryService],
})
export class QueryModule {}
