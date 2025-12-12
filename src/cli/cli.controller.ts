import { Controller, Post, Get, Body, UseGuards, Request, Query, Param, Delete } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DocsService } from '../docs/docs.service';
import { ProjectsService } from '../projects/projects.service';

@Controller('api/cli')
@UseGuards(JwtAuthGuard)
export class CliController {
  constructor(
    private readonly docsService: DocsService,
    private readonly projectsService: ProjectsService,
  ) {}

  @Post('sync')
  async sync(@Request() req, @Body() syncDto: {
    projectId: string;
    documents: Array<{ path: string; content: string; title?: string }>;
  }) {
    const userId = req.user.userId;
    
    // Verificar que el proyecto existe y pertenece al usuario
    const project = await this.projectsService.findOne(syncDto.projectId);
    if (!project) {
      throw new Error('Project not found');
    }
    
    // Sync documents (agrega userId automáticamente)
    const results = await this.docsService.sync(syncDto.projectId, syncDto.documents);
    
    return {
      ...results,
      userId,
      username: req.user.username,
    };
  }

  @Post('projects')
  async createProject(@Request() req, @Body() createProjectDto: {
    name: string;
    description?: string;
  }) {
    const userId = req.user.userId;
    
    const project = await this.projectsService.create({
      ...createProjectDto,
      userId,
    });
    
    return project;
  }

  @Get('projects')
  async getProjects(@Request() req) {
    // Solo devuelve proyectos del usuario autenticado
    const projects = await this.projectsService.findAll();
    return projects;
  }

  @Get('docs')
  async getDocs(@Request() req, @Query('projectId') projectId?: string) {
    return this.docsService.findAll(projectId);
  }

  @Delete('docs/:id')
  async deleteDoc(@Request() req, @Param('id') id: string) {
    const doc = await this.docsService.findOne(id);
    const userId = req.user.userId;
    
    // Solo permite borrar si es el autor
    if (doc.userId !== userId) {
      throw new Error('Unauthorized: You can only delete your own documents');
    }
    
    await this.docsService.remove(id);
    return { message: 'Document deleted successfully' };
  }

  @Get('status')
  async status(@Request() req) {
    return {
      authenticated: true,
      user: {
        userId: req.user.userId,
        username: req.user.username,
        email: req.user.email,
      },
      server: 'Geronimo API CLI',
      timestamp: new Date().toISOString(),
    };
  }
}
