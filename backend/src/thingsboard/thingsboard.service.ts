import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { TbAlarm, TbDevice, TbDeviceCredentials, TbTelemetryResponse } from './dto/tb-telemetry.dto';

@Injectable()
export class ThingsBoardService implements OnModuleInit {
  private readonly logger = new Logger(ThingsBoardService.name);
  private token: string | null = null;
  private tokenExpiresAt: number = 0;
  private readonly TOKEN_TTL_MS = 45 * 60 * 1000; // 45 minutes

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureToken();
      this.logger.log('ThingsBoard authentication successful');
    } catch (err) {
      // Graceful fail — TB may not be available at startup (e.g., during tests or cold start)
      this.logger.warn(`ThingsBoard not available at startup: ${(err as Error).message}`);
    }
  }

  private get baseUrl(): string {
    return this.config.get<string>('THINGSBOARD_URL', 'http://thingsboard:9090');
  }

  private async ensureToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiresAt) {
      return this.token;
    }
    return this.login();
  }

  private async login(): Promise<string> {
    const email = this.config.get<string>('THINGSBOARD_ADMIN_EMAIL', 'sysadmin@thingsboard.org');
    const password = this.config.get<string>('THINGSBOARD_ADMIN_PASSWORD', 'sysadmin');

    const response = await firstValueFrom(
      this.http.post<{ token: string }>(
        `${this.baseUrl}/api/auth/login`,
        { username: email, password },
      ),
    );

    this.token = response.data.token;
    this.tokenExpiresAt = Date.now() + this.TOKEN_TTL_MS;
    this.logger.debug('ThingsBoard token refreshed');
    return this.token;
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const token = await this.ensureToken();
    return { Authorization: `Bearer ${token}` };
  }

  async getDevicesByTenantId(tbTenantId: string): Promise<TbDevice[]> {
    const headers = await this.authHeaders();
    const response = await firstValueFrom(
      this.http.get<{ data: TbDevice[] }>(
        `${this.baseUrl}/api/tenant/devices?pageSize=1000&page=0`,
        { headers },
      ),
    );
    return response.data.data ?? [];
  }

  async getDeviceToken(tbDeviceId: string): Promise<string> {
    const headers = await this.authHeaders();
    const response = await firstValueFrom(
      this.http.get<TbDeviceCredentials>(
        `${this.baseUrl}/api/device/${tbDeviceId}/credentials`,
        { headers },
      ),
    );
    return response.data.credentialsId;
  }

  async publishTelemetry(tbDeviceId: string, data: Record<string, number>): Promise<void> {
    const headers = await this.authHeaders();
    await firstValueFrom(
      this.http.post(
        `${this.baseUrl}/api/plugins/telemetry/DEVICE/${tbDeviceId}/timeseries/values`,
        data,
        { headers },
      ),
    );
  }

  async getAlarmsByTenant(tbTenantId: string): Promise<TbAlarm[]> {
    const headers = await this.authHeaders();
    const response = await firstValueFrom(
      this.http.get<{ data: TbAlarm[] }>(
        `${this.baseUrl}/api/alarms?pageSize=100&page=0`,
        { headers },
      ),
    );
    return response.data.data ?? [];
  }

  async createDevice(tenantId: string, name: string, type: string): Promise<string> {
    const headers = await this.authHeaders();
    const response = await firstValueFrom(
      this.http.post<TbDevice>(
        `${this.baseUrl}/api/device`,
        {
          name,
          type,
          tenantId: { id: tenantId, entityType: 'TENANT' },
        },
        { headers },
      ),
    );
    return response.data.id.id;
  }

  async getTelemetry(
    tbDeviceId: string,
    keys: string[],
    startTs: number,
    endTs: number,
    limit: number,
  ): Promise<TbTelemetryResponse> {
    const headers = await this.authHeaders();
    const keysParam = keys.join(',');
    const response = await firstValueFrom(
      this.http.get<TbTelemetryResponse>(
        `${this.baseUrl}/api/plugins/telemetry/DEVICE/${tbDeviceId}/values/timeseries`,
        {
          headers,
          params: { keys: keysParam, startTs, endTs, limit },
        },
      ),
    );
    return response.data;
  }
}
