import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { CurrentTenant } from '../common/decorators/tenant.decorator';
import { CreateSiteModelDto, ViewerService } from './viewer.service';

@Controller('viewer/sites/:siteId/models')
export class ViewerController {
  constructor(private readonly viewerService: ViewerService) {}

  @Get()
  getModels(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @CurrentTenant() tenant: { clientId: string },
  ) {
    return this.viewerService.getModelsForSite(siteId, tenant.clientId);
  }

  @Post()
  addModel(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Body() dto: CreateSiteModelDto,
    @CurrentTenant() tenant: { clientId: string },
  ) {
    return this.viewerService.addModel(siteId, tenant.clientId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeModel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: { clientId: string },
  ) {
    return this.viewerService.removeModel(id, tenant.clientId);
  }
}