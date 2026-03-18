import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import { SitesService } from './sites.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { CreateSiteModelDto } from './dto/create-site-model.dto';
import { CurrentTenant } from '../common/decorators/tenant.decorator';

@Controller()
export class SitesController {
  constructor(private readonly sitesService: SitesService) {}

  // GET /clients/:clientId/sites
  @Get('clients/:clientId/sites')
  findByClient(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @CurrentTenant() tenant: { clientId: string; role: string },
  ) {
    // Admin może przeglądać dowolny tenant, user — tylko swój
    const effectiveClientId =
      tenant.role === 'admin' ? clientId : tenant.clientId;
    return this.sitesService.findByClient(effectiveClientId);
  }

  // POST /clients/:clientId/sites
  @Post('clients/:clientId/sites')
  createForClient(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Body() dto: CreateSiteDto,
    @CurrentTenant() tenant: { clientId: string; role: string },
  ) {
    return this.sitesService.create(
      { ...dto, clientId },
      tenant.clientId,
      tenant.role,
    );
  }

  // GET /sites/:id
  @Get('sites/:id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: { clientId: string; role: string },
  ) {
    return this.sitesService.findById(id, tenant.clientId, tenant.role);
  }

  // PATCH /sites/:id
  @Patch('sites/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSiteDto,
    @CurrentTenant() tenant: { clientId: string; role: string },
  ) {
    return this.sitesService.update(id, dto, tenant.clientId, tenant.role);
  }

  // GET /sites/:siteId/models
  @Get('sites/:siteId/models')
  findModels(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @CurrentTenant() tenant: { clientId: string; role: string },
  ) {
    return this.sitesService.findModels(siteId, tenant.clientId, tenant.role);
  }

  // POST /sites/:siteId/models
  @Post('sites/:siteId/models')
  createModel(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Body() dto: CreateSiteModelDto,
    @CurrentTenant() tenant: { clientId: string; role: string },
  ) {
    return this.sitesService.createModel(siteId, dto, tenant.clientId, tenant.role);
  }

  // DELETE /sites/:siteId/models/:id
  @Delete('sites/:siteId/models/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteModel(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: { clientId: string; role: string },
  ) {
    return this.sitesService.deleteModel(siteId, id, tenant.clientId, tenant.role);
  }
}
