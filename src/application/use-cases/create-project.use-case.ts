import { Injectable } from '@nestjs/common';
import { ProjectRepository } from '../../domain/repositories/project.repository';
import { CreateProjectDto } from '../dto/project.dto';
import { Project } from '../../domain/entities/project.entity';

@Injectable()
export class CreateProjectUseCase {
  constructor(private projectRepository: ProjectRepository) {}

  async execute(dto: CreateProjectDto): Promise<Project> {
    return await this.projectRepository.create({
      name: dto.name,
      description: dto.description,
    });
  }
}
