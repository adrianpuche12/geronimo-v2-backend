import { Controller, Get, Post, Body, Patch, Param, Delete, Headers } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { DocsService } from '../docs/docs.service';
import * as jwt from 'jsonwebtoken';

@Controller('api/projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly docsService: DocsService,
  ) {}

  private extractIsAdmin(authorization?: string): boolean {
    if (!authorization || !authorization.startsWith('Bearer ')) {
      console.log('[ProjectsController] No authorization header or invalid format');
      return false;
    }

    try {
      const token = authorization.substring(7);
      const decoded: any = jwt.decode(token);

      if (decoded) {
        const realmRoles = decoded.realm_access?.roles || [];
        const isAdmin = realmRoles.includes('admin');
        console.log('[ProjectsController] User:', decoded.preferred_username, 'Roles:', realmRoles, 'IsAdmin:', isAdmin);
        return isAdmin;
      }
    } catch (error) {
      console.error('[ProjectsController] Error decoding JWT:', error);
    }

    return false;
  }

  @Post()
  create(@Body() createProjectDto: { name: string; description?: string; template?: string }) {
    return this.projectsService.create(createProjectDto);
  }

  @Get()
  async findAll(@Headers('authorization') authorization?: string) {
    const isAdmin = this.extractIsAdmin(authorization);
    const projects = await this.projectsService.findAll();
    
    // Censurar documentos en cada proyecto si no es admin
    if (!isAdmin) {
      return projects.map(project => {
        if (project.documents && project.documents.length > 0) {
          return {
            ...project,
            documents: project.documents.map(doc => {
              if (doc.content && doc.metadata?.hasSecrets) {
                return {
                  ...doc,
                  content: this.docsService.getCensoredContent(doc, isAdmin),
                };
              }
              return doc;
            }),
          };
        }
        return project;
      });
    }
    
    return projects;
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ) {
    const isAdmin = this.extractIsAdmin(authorization);
    const project = await this.projectsService.findOne(id);
    
    // Censurar documentos del proyecto si no es admin
    if (!isAdmin && project.documents && project.documents.length > 0) {
      project.documents = project.documents.map(doc => {
        if (doc.content && doc.metadata?.hasSecrets) {
          return {
            ...doc,
            content: this.docsService.getCensoredContent(doc, isAdmin),
          };
        }
        return doc;
      });
    }
    
    return project;
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProjectDto: { name?: string; description?: string; template?: string }) {
    return this.projectsService.update(id, updateProjectDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.projectsService.remove(id);
  }
}
