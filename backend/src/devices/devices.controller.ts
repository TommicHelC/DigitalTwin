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
} from '@nestjs/common';
import { DevicesService } from './devices.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { CurrentTenant } from '../common/decorators/tenant.decorator';

@Controller()
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  // GET /sites/:siteId/devices
  @Get('sites/:siteId/devices')
  findBySite(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @CurrentTenant() tenant: { clientId: string; role: string },
  ) {
    return this.devicesService.findBySite(siteId, tenant.clientId);
  }

  // POST /devices
  @Post('devices')
  create(
    @Body() dto: CreateDeviceDto,
    @CurrentTenant() tenant: { clientId: string; role: string },
  ) {
    return this.devicesService.create(dto, tenant.clientId, tenant.role);
  }

  // GET /devices/:id
  @Get('devices/:id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: { clientId: string; role: string },
  ) {
    if (tenant.role === 'admin') {
      return this.devicesService.findByIdAdmin(id);
    }
    return this.devicesService.findById(id, tenant.clientId);
  }

  // PATCH /devices/:id
  @Patch('devices/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeviceDto,
    @CurrentTenant() tenant: { clientId: string; role: string },
  ) {
    return this.devicesService.update(id, dto, tenant.clientId, tenant.role);
  }

  // DELETE /devices/:id
  @Delete('devices/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: { clientId: string; role: string },
  ) {
    return this.devicesService.remove(id, tenant.clientId, tenant.role);
  }
}
