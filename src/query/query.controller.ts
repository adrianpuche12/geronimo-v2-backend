import { Controller, Post, Body, Res, Headers } from '@nestjs/common';
import type { Response } from 'express';
import { QueryService } from './query.service';
import { ExportService } from '../export/export.service';
import * as jwt from 'jsonwebtoken';

@Controller('api/query')
export class QueryController {
  constructor(
    private readonly queryService: QueryService,
    private readonly exportService: ExportService,
  ) {}

  @Post()
  async query(
    @Body() body: { question: string; projectId?: string },
    @Headers('authorization') authorization?: string,
  ) {
    let isAdmin = false;

    // Intentar extraer rol del JWT token
    if (authorization && authorization.startsWith('Bearer ')) {
      try {
        const token = authorization.substring(7);
        const decoded: any = jwt.decode(token);

        if (decoded) {
          const realmRoles = decoded.realm_access?.roles || [];
          isAdmin = realmRoles.includes('admin');

          console.log('[QueryController] User roles:', realmRoles);
          console.log('[QueryController] Is admin:', isAdmin);
          console.log('[QueryController] Username:', decoded.preferred_username);
        }
      } catch (error) {
        console.error('[QueryController] Error decoding JWT:', error);
      }
    } else {
      console.log('[QueryController] No authorization header present');
    }

    return this.queryService.query(body.question, body.projectId, isAdmin);
  }

  @Post('export')
  async exportQuery(
    @Body() body: {
      question: string;
      answer: string;
      sources?: any[];
      format?: 'txt' | 'md' | 'html' | 'json';
      title?: string;
      metadata?: Record<string, any>;
    },
    @Res() res: Response,
  ) {
    const format = body.format || 'txt';
    const sources = body.sources || [];

    const exported = this.exportService.exportResponse(
      body.question,
      body.answer,
      sources,
      {
        format,
        title: body.title,
        metadata: body.metadata,
      },
    );

    res.setHeader('Content-Type', exported.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
    res.send(exported.content);
  }
}
