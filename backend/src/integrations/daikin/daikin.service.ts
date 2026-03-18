import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { Client } from '../../clients/entities/client.entity';
import { Device } from '../../devices/entities/device.entity';
import { ThingsBoardService } from '../../thingsboard/thingsboard.service';

export interface DaikinDevice {
  id: string;
  managementPoints: DaikinManagementPoint[];
}

export interface DaikinManagementPoint {
  embeddedId: string;
  operationMode?: { value: string };
  temperatureControl?: {
    value?: {
      operationModes?: {
        cooling?: {
          setpoints?: {
            roomTemperature?: { value: number };
          };
        };
      };
    };
  };
  sensoryData?: {
    value?: {
      roomTemperature?: { value: number };
    };
  };
  onOffMode?: { value: string };
}

interface DaikinTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

@Injectable()
export class DaikinService {
  private readonly logger = new Logger(DaikinService.name);
  private readonly apiBase = 'https://api.onecta.daikineurope.com/v1';
  private readonly idpBase = 'https://idp.onecta.daikineurope.com/v1/oidc';

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
    private readonly tbService: ThingsBoardService,
  ) {}

  async refreshToken(clientId: string): Promise<string | null> {
    const client = await this.clientRepo.findOne({ where: { id: clientId } });
    if (!client?.daikinRefreshToken) {
      this.logger.warn(`Client ${clientId} has no daikinRefreshToken`);
      return null;
    }

    try {
      const response = await firstValueFrom(
        this.http.post<DaikinTokenResponse>(
          `${this.idpBase}/token`,
          new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: client.daikinRefreshToken,
            client_id: this.config.get<string>('DAIKIN_CLIENT_ID', ''),
            client_secret: this.config.get<string>('DAIKIN_CLIENT_SECRET', ''),
          }).toString(),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          },
        ),
      );

      const { access_token, refresh_token, expires_in } = response.data;
      const expiresAt = new Date(Date.now() + expires_in * 1000);

      await this.clientRepo.update(clientId, {
        daikinAccessToken: access_token,
        daikinRefreshToken: refresh_token,
        daikinTokenExpiresAt: expiresAt,
      });

      this.logger.debug(`Refreshed Daikin token for client ${clientId}`);
      return access_token;
    } catch (err) {
      this.logger.error(`Failed to refresh Daikin token for client ${clientId}: ${(err as Error).message}`);
      return null;
    }
  }

  async fetchDevices(accessToken: string): Promise<DaikinDevice[]> {
    const response = await firstValueFrom(
      this.http.get<DaikinDevice[]>(`${this.apiBase}/gateway-devices`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    );
    return response.data ?? [];
  }

  private extractTelemetry(
    managementPoints: DaikinManagementPoint[],
  ): Record<string, number> {
    const telemetry: Record<string, number> = {};
    const cc = managementPoints.find((mp) => mp.embeddedId === 'climateControl');
    if (!cc) return telemetry;

    const roomTemp = cc.sensoryData?.value?.roomTemperature?.value;
    if (roomTemp !== undefined) telemetry['roomTemperature'] = roomTemp;

    const setpoint =
      cc.temperatureControl?.value?.operationModes?.cooling?.setpoints?.roomTemperature?.value;
    if (setpoint !== undefined) telemetry['setpointTemperature'] = setpoint;

    const onOff = cc.onOffMode?.value;
    if (onOff !== undefined) telemetry['onOffMode'] = onOff === 'on' ? 1 : 0;

    const opMode = cc.operationMode?.value;
    const opModeMap: Record<string, number> = {
      cooling: 1,
      heating: 2,
      fan: 3,
      dry: 4,
      auto: 5,
    };
    if (opMode && opModeMap[opMode] !== undefined) {
      telemetry['operationMode'] = opModeMap[opMode];
    }

    return telemetry;
  }

  async syncClientDevices(client: Client): Promise<void> {
    const accessToken = await this.refreshToken(client.id);
    if (!accessToken) return;

    let daikinDevices: DaikinDevice[];
    try {
      daikinDevices = await this.fetchDevices(accessToken);
    } catch (err) {
      this.logger.error(`Failed to fetch Daikin devices for client ${client.id}: ${(err as Error).message}`);
      return;
    }

    for (const daikinDevice of daikinDevices) {
      const device = await this.deviceRepo.findOne({
        where: { daikinDeviceId: daikinDevice.id },
      });

      if (!device?.tbDeviceId) {
        this.logger.debug(`No TB device mapped for Daikin device ${daikinDevice.id}, skipping`);
        continue;
      }

      const telemetry = this.extractTelemetry(daikinDevice.managementPoints);
      if (Object.keys(telemetry).length === 0) {
        this.logger.debug(`No telemetry extracted for Daikin device ${daikinDevice.id}`);
        continue;
      }

      try {
        await this.tbService.publishTelemetry(device.tbDeviceId, telemetry);
        this.logger.debug(`Published telemetry for device ${device.id} (TB: ${device.tbDeviceId})`);
      } catch (err) {
        this.logger.warn(`Failed to publish telemetry for device ${device.id}: ${(err as Error).message}`);
      }
    }
  }
}
