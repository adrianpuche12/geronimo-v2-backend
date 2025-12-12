import { Injectable } from '@nestjs/common';
import { ProjectRepository } from '../../domain/repositories/project.repository';

@Injectable()
export class ListProjectsUseCase {
  constructor(private projectRepository: ProjectRepository) {}

  async execute(): Promise<any> {
    const projects = await this.projectRepository.findAllWithDocuments();
    return { projects, total: projects.length };
  }
}
