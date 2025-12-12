import { Module } from '@nestjs/common';
import { CliController } from './cli.controller';
import { DocsModule } from '../docs/docs.module';
import { ProjectsModule } from '../projects/projects.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, DocsModule, ProjectsModule],
  controllers: [CliController],
})
export class CliModule {}
