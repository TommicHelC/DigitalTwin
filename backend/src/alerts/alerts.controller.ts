import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { CurrentTenant } from '../common/decorators/tenant.decorator';

@Controller()
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  // GET /alerts?clientId=&severity=&resolved=&limit=50
  @Get('alerts')
  findAll(
    @CurrentTenant() tenant: { clientId: string; role: string },
    @Query('clientId') queryClientId?: string,
    @Query('severity') severity?: string,
    @Query('resolved') resolved?: string,
    @Query('limit') limit?: string,
  ) {
    // Admin może podać inny clientId, user — zawsze swój
    const effectiveClientId =
      tenant.role === 'admin' && queryClientId
        ? queryClientId
        : tenant.clientId;

    return this.alertsService.findByClient({
      clientId: effectiveClientId,
      severity,
      resolved: resolved !== undefined ? resolved === 'true' : undefined,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  // GET /devices/:id/alerts?limit=20&resolved=
  @Get('devices/:id/alerts')
  findByDevice(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: { clientId: string },
    @Query('limit') limit?: string,
    @Query('resolved') resolved?: string,
  ) {
    return this.alertsService.findByDevice(
      id,
      tenant.clientId,
      limit ? parseInt(limit, 10) : 20,
      resolved !== undefined ? resolved === 'true' : undefined,
    );
  }

  // PATCH /alerts/:id/resolve
  @Patch('alerts/:id/resolve')
  resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: { clientId: string },
  ) {
    return this.alertsService.resolve(id, tenant.clientId);
  }
}
