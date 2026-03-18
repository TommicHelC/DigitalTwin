import { Controller, Post, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { AlertsService } from './alerts.service';
import { DevicesService } from '../devices/devices.service';

interface TbAlarmWebhookPayload {
  deviceId?: string;          // ThingsBoard device ID (tbDeviceId w DB)
  deviceName?: string;
  alarmId?: string;
  alarmType?: string;
  severity?: string;          // CRITICAL | MAJOR | MINOR | WARNING | INDETERMINATE | CLEARED
  details?: {
    message?: string;
    [key: string]: unknown;
  };
}

const TB_SEVERITY_MAP: Record<string, string> = {
  CRITICAL: 'critical',
  MAJOR: 'critical',
  MINOR: 'warning',
  WARNING: 'warning',
  INDETERMINATE: 'info',
  CLEARED: 'info',
};

@Public()
@Controller('webhook')
export class WebhookHandler {
  private readonly logger = new Logger(WebhookHandler.name);

  constructor(
    private readonly alertsService: AlertsService,
    private readonly devicesService: DevicesService,
  ) {}

  @Post('thingsboard')
  @HttpCode(HttpStatus.OK)
  async handleThingsboardAlarm(@Body() payload: TbAlarmWebhookPayload) {
    this.logger.log(
      `TB webhook received: alarmId=${payload.alarmId}, tbDeviceId=${payload.deviceId}`,
    );

    if (!payload.deviceId) {
      this.logger.warn('TB webhook: missing deviceId, skipping');
      return { status: 'ignored', reason: 'missing deviceId' };
    }

    // Szukamy urządzenia po TB device ID
    const device = await this.devicesService.findByTbDeviceId(payload.deviceId);

    if (!device) {
      this.logger.warn(
        `TB webhook: device with tbDeviceId=${payload.deviceId} not found in DB`,
      );
      return { status: 'ignored', reason: 'device not found' };
    }

    const severity = TB_SEVERITY_MAP[payload.severity?.toUpperCase() ?? ''] ?? 'info';
    const message =
      payload.details?.message ??
      payload.alarmType ??
      `Alarm from ThingsBoard: ${payload.alarmId}`;

    const alert = await this.alertsService.createFromWebhook({
      deviceId: device.id,
      severity,
      message,
      tbAlarmId: payload.alarmId,
    });

    this.logger.log(`Alert created: id=${alert.id}, severity=${severity}`);
    return { status: 'ok', alertId: alert.id };
  }
}
