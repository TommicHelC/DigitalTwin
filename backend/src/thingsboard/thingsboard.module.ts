import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { ThingsBoardService } from './thingsboard.service';

@Module({
  imports: [
    HttpModule,
    ConfigModule,
  ],
  providers: [ThingsBoardService],
  exports: [ThingsBoardService],
})
export class ThingsBoardModule {}
