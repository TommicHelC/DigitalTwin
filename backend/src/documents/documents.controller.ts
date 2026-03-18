import {
  Controller,
  Get,
  Post,
  Param,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
  Body,
  StreamableFile,
  Response,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { DocumentsService } from './documents.service';
import { CurrentTenant } from '../common/decorators/tenant.decorator';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

@Controller()
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  // GET /devices/:deviceId/documents
  @Get('devices/:deviceId/documents')
  findByDevice(
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
    @CurrentTenant() tenant: { clientId: string },
  ) {
    return this.documentsService.findByDevice(deviceId, tenant.clientId);
  }

  // GET /sites/:siteId/documents
  @Get('sites/:siteId/documents')
  findBySite(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @CurrentTenant() tenant: { clientId: string },
  ) {
    return this.documentsService.findBySite(siteId, tenant.clientId);
  }

  // POST /documents/upload (multipart/form-data)
  @Post('documents/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body('siteId') siteId: string,
    @Body('deviceId') deviceId: string | undefined,
    @Body('type') type: string,
    @Body('name') name: string,
    @CurrentTenant() tenant: { clientId: string },
  ) {
    return this.documentsService.uploadDocument(file, {
      siteId,
      deviceId,
      type,
      name,
      clientId: tenant.clientId,
    });
  }

  // GET /documents/:id/file
  @Get('documents/:id/file')
  async serveFile(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: { clientId: string },
    @Response({ passthrough: true }) res: any,
  ): Promise<StreamableFile> {
    const filePath = await this.documentsService.getFilePath(id, tenant.clientId);
    const filename = path.basename(filePath);
    const stream = fs.createReadStream(filePath);
    res.set({
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    return new StreamableFile(stream);
  }
}
