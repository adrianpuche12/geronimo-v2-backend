import { Injectable, NotFoundException } from '@nestjs/common';
import { ProjectRepository } from '../../domain/repositories/project.repository';

@Injectable()
export class GetProjectUseCase {
  constructor(private projectRepository: ProjectRepository) {}

  async execute(id: string) {
    const project = await this.projectRepository.findByIdWithDocuments(id);
    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }
    return project;
  }
}
