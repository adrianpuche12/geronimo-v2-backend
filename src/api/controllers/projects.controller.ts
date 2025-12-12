import {
  Controller, Get, Post, Put, Delete,
  Param, Body, HttpCode, HttpStatus
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CreateProjectUseCase } from '../../application/use-cases/create-project.use-case';
import { ListProjectsUseCase } from '../../application/use-cases/list-projects.use-case';
import { GetProjectUseCase } from '../../application/use-cases/get-project.use-case';
import { CreateProjectDto, UpdateProjectDto } from '../../application/dto/project.dto';
import { ProjectRepository } from '../../domain/repositories/project.repository';

@ApiTags('Projects')
@Controller('api/projects')
export class ProjectsController {
  constructor(
    private createProjectUseCase: CreateProjectUseCase,
    private listProjectsUseCase: ListProjectsUseCase,
    private getProjectUseCase: GetProjectUseCase,
    private projectRepository: ProjectRepository,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new project' })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateProjectDto) {
    const project = await this.createProjectUseCase.execute(dto);
    return project;
  }

  @Get()
  @ApiOperation({ summary: 'List all projects' })
  async list() {
    const result = await this.listProjectsUseCase.execute();
    return result.projects;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project by ID with documents' })
  async getById(@Param('id') id: string) {
    return await this.getProjectUseCase.execute(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update project' })
  async update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return await this.projectRepository.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete project' })
  async delete(@Param('id') id: string) {
    await this.projectRepository.delete(id);
  }
}
