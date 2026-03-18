import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataverseService } from './dataverse.service';
import { CaseService } from './case.service';
import { Alert } from '../../alerts/entities/alert.entity'; // Agent C
import { Device } from '../../devices/entities/device.entity'; // Agent C
import { Client } from '../../clients/entities/client.entity'; // Agent C

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Alert, Device, Client]),
  ],
  providers: [DataverseService, CaseService],
  exports: [CaseService],
})
export class DataverseModule {}
