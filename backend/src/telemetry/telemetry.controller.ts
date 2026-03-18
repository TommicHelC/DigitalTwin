import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { CurrentTenant } from '../common/decorators/tenant.decorator';
import { DevicesService } from '../devices/devices.service';
import { TelemetryQueryDto } from './dto/telemetry-query.dto';
import { TelemetryService } from './telemetry.service';

@Controller('devices')
export class TelemetryController {
  constructor(
    private readonly telemetryService: TelemetryService,
    private readonly devicesService: DevicesService,
  ) {}

  @Get(':id/telemetry')
  async getTelemetry(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() dto: TelemetryQueryDto,
    @CurrentTenant() tenant: { clientId: string; role: string },
  ) {
    const device =
      tenant.role === 'admin'
        ? await this.devicesService.findByIdAdmin(id)
        : await this.devicesService.findById(id, tenant.clientId);

    return this.telemetryService.query(id, device.tbDeviceId ?? null, dto);
  }
}