import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Alert } from './entities/alert.entity';
import { AlertsService } from './alerts.service';
import { AlertsController } from './alerts.controller';
import { WebhookHandler } from './webhook.handler';
import { DevicesModule } from '../devices/devices.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Alert]),
    DevicesModule, // potrzebny do findByTbDeviceId w WebhookHandler
  ],
  controllers: [AlertsController, WebhookHandler],
  providers: [AlertsService],
  exports: [AlertsService],
})
export class AlertsModule {}
