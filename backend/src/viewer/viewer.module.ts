import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ViewerService } from './viewer.service';
import { ViewerController } from './viewer.controller';
import { SiteModel } from '../sites/entities/site-model.entity'; // Agent C

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([SiteModel]),
  ],
  providers: [ViewerService],
  controllers: [ViewerController],
  exports: [ViewerService],
})
export class ViewerModule {}
