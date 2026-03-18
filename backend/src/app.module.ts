import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { SitesModule } from './sites/sites.module';
import { DevicesModule } from './devices/devices.module';
import { DocumentsModule } from './documents/documents.module';
import { AlertsModule } from './alerts/alerts.module';
import { ThingsBoardModule } from './thingsboard/thingsboard.module';
import { TelemetryModule } from './telemetry/telemetry.module';
import { DaikinModule } from './integrations/daikin/daikin.module';
import { DataverseModule } from './integrations/dataverse/dataverse.module';
import { ViewerModule } from './viewer/viewer.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USER', 'hvac_user'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME', 'hvac'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: false,
        logging: configService.get<string>('NODE_ENV') === 'development',
        ssl:
          configService.get<string>('NODE_ENV') === 'production'
            ? { rejectUnauthorized: false }
            : false,
        extra: {
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
        },
      }),
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    ClientsModule,
    SitesModule,
    DevicesModule,
    DocumentsModule,
    AlertsModule,
    ThingsBoardModule,
    TelemetryModule,
    DaikinModule,
    DataverseModule,
    ViewerModule,
  ],
  controllers: [AppController],
})
export class AppModule {}