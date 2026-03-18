import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DaikinService } from './daikin.service';
import { DaikinScheduler } from './daikin.scheduler';
import { ThingsBoardModule } from '../../thingsboard/thingsboard.module';
import { Client } from '../../clients/entities/client.entity'; // Agent C
import { Device } from '../../devices/entities/device.entity'; // Agent C

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    TypeOrmModule.forFeature([Client, Device]),
    ThingsBoardModule,
  ],
  providers: [DaikinService, DaikinScheduler],
  exports: [DaikinService],
})
export class DaikinModule {}
