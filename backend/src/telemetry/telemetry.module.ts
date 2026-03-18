import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelemetryService } from './telemetry.service';
import { TelemetryController } from './telemetry.controller';
import { TelemetryEvent } from './entities/telemetry-event.entity';
import { ThingsBoardModule } from '../thingsboard/thingsboard.module';
import { DevicesModule } from '../devices/devices.module'; // dostarczany przez Agent C

@Module({
  imports: [
    TypeOrmModule.forFeature([TelemetryEvent]),
    ThingsBoardModule,
    DevicesModule,
  ],
  providers: [TelemetryService],
  controllers: [TelemetryController],
  exports: [TelemetryService],
})
export class TelemetryModule {}
