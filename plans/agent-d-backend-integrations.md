# Agent D — Backend Integrations: Sub-plan

**Projekt:** HVAC Digital Twin Platform — HellCold sp. z o.o.
**Repo:** https://github.com/HellCold-Sp-z-o-o/DigitalHellColdTwin.git
**Data:** 2026-03-18
**Agent:** D — Backend Integrations

---

## 1. Cel i zakres

Agent D odpowiada za implementację wszystkich integracji backendowych:

- **ThingsBoard** — komunikacja z brokerem IoT (JWT auth, cache tokenu, telemetria, alarmy, CRUD urządzeń)
- **Telemetry** — endpoint zapytań o dane historyczne (lokalny DB + fallback TB)
- **Daikin Onecta API** — cykliczne pobieranie stanów urządzeń HVAC co 5 minut, odświeżanie tokenów OAuth2
- **Microsoft Dataverse / D365** — tworzenie przypadków serwisowych (incidents) w CRM na podstawie alertów
- **Viewer (APS)** — zarządzanie rekordami modeli 3D powiązanych ze stanowiskami (bez konwersji plików)

Zakres NIE obejmuje: warstwy auth, encji bazodanowych (te dostarcza Agent C), konfiguracji modułu głównego app.module.ts (tylko instrukcja aktualizacji).

---

## 2. Zależności od innych agentów

| Agent | Dostarcza | Wymagane przez |
|-------|-----------|----------------|
| Agent B | `app.module.ts`, `common/`, `auth/` (Guard, Decorator, ConfigModule) | Wszystkie moduły Agenta D |
| Agent C | Encje: `Device` (pola: `tbDeviceId`, `daikinDeviceId`, `siteId`), `Client` (pola: `daikinRefreshToken`, `daikinAccessToken`, `daikinTokenExpiresAt`), `Alert`, `Site`, `SiteModel` | ThingsBoard, Daikin, Dataverse, Viewer |

### Wymagane zmienne środowiskowe

```
THINGSBOARD_URL=http://thingsboard:9090
THINGSBOARD_ADMIN_EMAIL=sysadmin@thingsboard.org
THINGSBOARD_ADMIN_PASSWORD=sysadmin

DAIKIN_CLIENT_ID=<wartość>
DAIKIN_CLIENT_SECRET=<wartość>
DAIKIN_REDIRECT_URI=<wartość>

D365_ORG_URI=https://yourorg.crm4.dynamics.com
AZURE_TENANT_ID=<wartość>
AZURE_CLIENT_ID=<wartość>
AZURE_CLIENT_SECRET=<wartość>
```

---

## 3. Lista plików z opisami

```
backend/src/
├── thingsboard/
│   ├── thingsboard.module.ts          # Moduł NestJS, eksportuje ThingsBoardService
│   ├── thingsboard.service.ts         # Serwis HTTP do TB REST API z cache tokenu
│   ├── thingsboard.service.spec.ts    # Testy jednostkowe ThingsBoardService
│   └── dto/
│       └── tb-telemetry.dto.ts        # DTO i interfejsy dla danych TB
├── telemetry/
│   ├── telemetry.module.ts            # Moduł NestJS telemetrii
│   ├── telemetry.service.ts           # Logika zapytań: lokalny DB + fallback TB
│   ├── telemetry.controller.ts        # GET /api/devices/:id/telemetry
│   └── dto/
│       └── telemetry-query.dto.ts     # DTO zapytania (from, to, metrics, limit)
├── integrations/
│   ├── daikin/
│   │   ├── daikin.module.ts           # Moduł NestJS integracji Daikin
│   │   ├── daikin.service.ts          # Logika OAuth2 + pobieranie danych HVAC
│   │   ├── daikin.scheduler.ts        # @Cron co 5 minut — sync wszystkich klientów
│   │   └── daikin.service.spec.ts     # Testy: mock axios, verify token refresh + telemetry
│   └── dataverse/
│       ├── dataverse.module.ts        # Moduł NestJS integracji Dataverse
│       ├── dataverse.service.ts       # Azure AD auth, token cache
│       ├── case.service.ts            # CRUD przypadków serwisowych w D365
│       └── case.service.spec.ts       # Testy CaseService
└── viewer/
    ├── viewer.module.ts               # Moduł NestJS managementu modeli APS
    ├── viewer.service.ts              # Operacje CRUD na SiteModel w DB
    └── viewer.controller.ts          # REST endpoints dla modeli 3D
```

---

## 4. Pełna zawartość plików kodu

### 4.1 ThingsBoard

#### `backend/src/thingsboard/dto/tb-telemetry.dto.ts`

```typescript
export interface TbDevice {
  id: {
    id: string;
    entityType: string;
  };
  name: string;
  type: string;
  tenantId: {
    id: string;
  };
}

export interface TbDeviceCredentials {
  credentialsType: string;
  credentialsId: string; // device token for HTTP API
}

export interface TbAlarm {
  id: {
    id: string;
    entityType: string;
  };
  type: string;
  severity: string;
  status: string;
  originator: {
    id: string;
    entityType: string;
  };
  details: Record<string, unknown>;
  createdTime: number;
}

export interface TbTelemetryValue {
  ts: number;
  value: string;
}

export type TbTelemetryResponse = Record<string, TbTelemetryValue[]>;
```

#### `backend/src/thingsboard/thingsboard.module.ts`

```typescript
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
```

#### `backend/src/thingsboard/thingsboard.service.ts`

```typescript
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
```

#### `backend/src/thingsboard/thingsboard.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of } from 'rxjs';
import { ThingsBoardService } from './thingsboard.service';

const mockHttpService = {
  post: jest.fn(),
  get: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string, fallback?: string) => {
    const values: Record<string, string> = {
      THINGSBOARD_URL: 'http://localhost:9090',
      THINGSBOARD_ADMIN_EMAIL: 'sysadmin@thingsboard.org',
      THINGSBOARD_ADMIN_PASSWORD: 'sysadmin',
    };
    return values[key] ?? fallback;
  }),
};

describe('ThingsBoardService', () => {
  let service: ThingsBoardService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockHttpService.post.mockReturnValue(of({ data: { token: 'test-jwt-token' } }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThingsBoardService,
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<ThingsBoardService>(ThingsBoardService);
    await service.onModuleInit();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should login and cache token on init', () => {
    expect(mockHttpService.post).toHaveBeenCalledWith(
      'http://localhost:9090/api/auth/login',
      { username: 'sysadmin@thingsboard.org', password: 'sysadmin' },
    );
  });

  it('should publish telemetry with auth header', async () => {
    mockHttpService.post.mockReturnValue(of({ data: {} }));

    await service.publishTelemetry('device-123', { temperature: 22.5 });

    expect(mockHttpService.post).toHaveBeenCalledWith(
      'http://localhost:9090/api/plugins/telemetry/DEVICE/device-123/timeseries/values',
      { temperature: 22.5 },
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-jwt-token' }),
      }),
    );
  });

  it('should not throw when TB is unavailable at startup', async () => {
    mockHttpService.post.mockReturnValue(
      new (require('rxjs').throwError)(() => new Error('Connection refused')),
    );
    const localModule = await Test.createTestingModule({
      providers: [
        ThingsBoardService,
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();
    const localService = localModule.get<ThingsBoardService>(ThingsBoardService);
    await expect(localService.onModuleInit()).resolves.not.toThrow();
  });
});
```

---

### 4.2 Telemetry

#### `backend/src/telemetry/dto/telemetry-query.dto.ts`

```typescript
import { IsISO8601, IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class TelemetryQueryDto {
  @IsISO8601()
  from: string;

  @IsISO8601()
  to: string;

  @IsOptional()
  @IsString()
  metrics?: string; // comma-separated: "temperature,setpoint"

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5000)
  limit?: number = 500;
}

export interface TelemetryPoint {
  ts: number; // Unix ms
  metric: string;
  value: number;
}
```

#### `backend/src/telemetry/telemetry.module.ts`

```typescript
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
```

#### `backend/src/telemetry/entities/telemetry-event.entity.ts`

```typescript
import { Column, Entity } from 'typeorm';

// Partition table — no @PrimaryGeneratedColumn, composite PK defined in migration
@Entity({ schema: 'telemetry', name: 'telemetry_events' })
export class TelemetryEvent {
  @Column('uuid')
  deviceId: string;

  @Column({ name: 'metric_name' })
  metricName: string;

  @Column('float8')
  value: number;

  @Column({ type: 'timestamptz', primary: true })
  ts: Date;
}
```

#### `backend/src/telemetry/telemetry.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { TelemetryEvent } from './entities/telemetry-event.entity';
import { TelemetryQueryDto, TelemetryPoint } from './dto/telemetry-query.dto';
import { ThingsBoardService } from '../thingsboard/thingsboard.service';

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);

  constructor(
    @InjectRepository(TelemetryEvent)
    private readonly telemetryRepo: Repository<TelemetryEvent>,
    private readonly tbService: ThingsBoardService,
  ) {}

  async query(
    deviceId: string,
    tbDeviceId: string | null,
    dto: TelemetryQueryDto,
  ): Promise<TelemetryPoint[]> {
    const from = new Date(dto.from);
    const to = new Date(dto.to);
    const limit = dto.limit ?? 500;
    const metrics = dto.metrics ? dto.metrics.split(',').map((m) => m.trim()) : [];

    // Strategy 1: local telemetry_events table
    try {
      const qb = this.telemetryRepo
        .createQueryBuilder('te')
        .where('te.deviceId = :deviceId', { deviceId })
        .andWhere('te.ts BETWEEN :from AND :to', { from, to })
        .orderBy('te.ts', 'DESC')
        .limit(limit);

      if (metrics.length > 0) {
        qb.andWhere('te.metricName IN (:...metrics)', { metrics });
      }

      const rows = await qb.getMany();

      if (rows.length > 0) {
        return rows.map((r) => ({
          ts: r.ts.getTime(),
          metric: r.metricName,
          value: r.value,
        }));
      }
    } catch (err) {
      this.logger.warn(`Local telemetry query failed: ${(err as Error).message}`);
    }

    // Strategy 2: fallback to ThingsBoard REST API
    if (!tbDeviceId) {
      this.logger.debug(`No tbDeviceId for device ${deviceId}, skipping TB fallback`);
      return [];
    }

    try {
      const keys = metrics.length > 0 ? metrics : ['temperature', 'setpoint', 'humidity'];
      const tbData = await this.tbService.getTelemetry(
        tbDeviceId,
        keys,
        from.getTime(),
        to.getTime(),
        limit,
      );

      const points: TelemetryPoint[] = [];
      for (const [metric, values] of Object.entries(tbData)) {
        for (const v of values) {
          points.push({ ts: v.ts, metric, value: parseFloat(v.value) });
        }
      }

      points.sort((a, b) => b.ts - a.ts);
      return points.slice(0, limit);
    } catch (err) {
      this.logger.warn(`TB telemetry fallback failed for device ${deviceId}: ${(err as Error).message}`);
      return [];
    }
  }
}
```

#### `backend/src/telemetry/telemetry.controller.ts`

```typescript
import { Controller, Get, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // dostarczany przez Agent B
import { TelemetryService } from './telemetry.service';
import { TelemetryQueryDto } from './dto/telemetry-query.dto';
import { DevicesService } from '../devices/devices.service'; // dostarczany przez Agent C

@Controller('api/devices')
@UseGuards(JwtAuthGuard)
export class TelemetryController {
  constructor(
    private readonly telemetryService: TelemetryService,
    private readonly devicesService: DevicesService,
  ) {}

  @Get(':id/telemetry')
  async getTelemetry(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() dto: TelemetryQueryDto,
  ) {
    const device = await this.devicesService.findOne(id);
    return this.telemetryService.query(id, device?.tbDeviceId ?? null, dto);
  }
}
```

---

### 4.3 Daikin Integration

#### `backend/src/integrations/daikin/daikin.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { DaikinService } from './daikin.service';
import { DaikinScheduler } from './daikin.scheduler';
import { ThingsBoardModule } from '../../thingsboard/thingsboard.module';
import { Client } from '../../clients/entities/client.entity'; // Agent C
import { Device } from '../../devices/entities/device.entity'; // Agent C

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([Client, Device]),
    ThingsBoardModule,
  ],
  providers: [DaikinService, DaikinScheduler],
  exports: [DaikinService],
})
export class DaikinModule {}
```

#### `backend/src/integrations/daikin/daikin.service.ts`

```typescript
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
```

#### `backend/src/integrations/daikin/daikin.scheduler.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { Client } from '../../clients/entities/client.entity';
import { DaikinService } from './daikin.service';

@Injectable()
export class DaikinScheduler {
  private readonly logger = new Logger(DaikinScheduler.name);

  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    private readonly daikinService: DaikinService,
  ) {}

  @Cron('0 */5 * * * *') // every 5 minutes
  async syncAllClients(): Promise<void> {
    this.logger.debug('Starting Daikin sync for all clients...');

    const clients = await this.clientRepo.find({
      where: { daikinRefreshToken: Not(IsNull()) },
    });

    this.logger.debug(`Found ${clients.length} clients with Daikin tokens`);

    const results = await Promise.allSettled(
      clients.map((client) => this.daikinService.syncClientDevices(client)),
    );

    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0) {
      this.logger.warn(`Daikin sync: ${failed}/${clients.length} clients failed`);
    } else {
      this.logger.debug(`Daikin sync completed for ${clients.length} clients`);
    }
  }
}
```

#### `backend/src/integrations/daikin/daikin.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { of } from 'rxjs';
import { DaikinService } from './daikin.service';
import { Client } from '../../clients/entities/client.entity';
import { Device } from '../../devices/entities/device.entity';
import { ThingsBoardService } from '../../thingsboard/thingsboard.service';

const mockClient: Partial<Client> = {
  id: 'client-uuid-1',
  daikinRefreshToken: 'old-refresh-token',
  daikinAccessToken: 'old-access-token',
  daikinTokenExpiresAt: new Date(Date.now() - 1000),
};

const mockDevice: Partial<Device> = {
  id: 'device-uuid-1',
  daikinDeviceId: 'daikin-gw-001',
  tbDeviceId: 'tb-device-uuid-1',
};

const mockDaikinGatewayResponse = [
  {
    id: 'daikin-gw-001',
    managementPoints: [
      {
        embeddedId: 'climateControl',
        operationMode: { value: 'cooling' },
        onOffMode: { value: 'on' },
        sensoryData: { value: { roomTemperature: { value: 24.5 } } },
        temperatureControl: {
          value: {
            operationModes: {
              cooling: { setpoints: { roomTemperature: { value: 22.0 } } },
            },
          },
        },
      },
    ],
  },
];

describe('DaikinService', () => {
  let service: DaikinService;
  let mockHttpService: { post: jest.Mock; get: jest.Mock };
  let mockClientRepo: { findOne: jest.Mock; update: jest.Mock; find: jest.Mock };
  let mockDeviceRepo: { findOne: jest.Mock };
  let mockTbService: { publishTelemetry: jest.Mock };

  beforeEach(async () => {
    mockHttpService = {
      post: jest.fn(),
      get: jest.fn(),
    };
    mockClientRepo = {
      findOne: jest.fn().mockResolvedValue(mockClient),
      update: jest.fn().mockResolvedValue(undefined),
      find: jest.fn(),
    };
    mockDeviceRepo = {
      findOne: jest.fn().mockResolvedValue(mockDevice),
    };
    mockTbService = {
      publishTelemetry: jest.fn().mockResolvedValue(undefined),
    };

    mockHttpService.post.mockReturnValue(
      of({
        data: {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
        },
      }),
    );

    mockHttpService.get.mockReturnValue(of({ data: mockDaikinGatewayResponse }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DaikinService,
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('mock-value') } },
        { provide: getRepositoryToken(Client), useValue: mockClientRepo },
        { provide: getRepositoryToken(Device), useValue: mockDeviceRepo },
        { provide: ThingsBoardService, useValue: mockTbService },
      ],
    }).compile();

    service = module.get<DaikinService>(DaikinService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('refreshToken', () => {
    it('should call Daikin IDP token endpoint with refresh_token grant', async () => {
      const token = await service.refreshToken('client-uuid-1');

      expect(token).toBe('new-access-token');
      expect(mockHttpService.post).toHaveBeenCalledWith(
        'https://idp.onecta.daikineurope.com/v1/oidc/token',
        expect.stringContaining('grant_type=refresh_token'),
        expect.objectContaining({
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );
    });

    it('should save new tokens to the client record', async () => {
      await service.refreshToken('client-uuid-1');

      expect(mockClientRepo.update).toHaveBeenCalledWith(
        'client-uuid-1',
        expect.objectContaining({
          daikinAccessToken: 'new-access-token',
          daikinRefreshToken: 'new-refresh-token',
        }),
      );
    });

    it('should return null when client has no refreshToken', async () => {
      mockClientRepo.findOne.mockResolvedValueOnce({ id: 'client-uuid-2', daikinRefreshToken: null });
      const token = await service.refreshToken('client-uuid-2');
      expect(token).toBeNull();
    });
  });

  describe('syncClientDevices', () => {
    it('should refresh token, fetch devices and publish telemetry to ThingsBoard', async () => {
      await service.syncClientDevices(mockClient as Client);

      // Verify token was refreshed
      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.stringContaining('token'),
        expect.any(String),
        expect.any(Object),
      );

      // Verify devices were fetched
      expect(mockHttpService.get).toHaveBeenCalledWith(
        'https://api.onecta.daikineurope.com/v1/gateway-devices',
        expect.objectContaining({
          headers: { Authorization: 'Bearer new-access-token' },
        }),
      );

      // Verify telemetry was published to TB with correct data
      expect(mockTbService.publishTelemetry).toHaveBeenCalledWith(
        'tb-device-uuid-1',
        expect.objectContaining({
          roomTemperature: 24.5,
          setpointTemperature: 22.0,
          onOffMode: 1,
          operationMode: 1, // cooling = 1
        }),
      );
    });

    it('should skip device if no tbDeviceId is mapped', async () => {
      mockDeviceRepo.findOne.mockResolvedValueOnce({ id: 'device-2', daikinDeviceId: 'daikin-gw-001', tbDeviceId: null });

      await service.syncClientDevices(mockClient as Client);

      expect(mockTbService.publishTelemetry).not.toHaveBeenCalled();
    });

    it('should not throw when fetch devices fails', async () => {
      mockHttpService.get.mockReturnValueOnce(
        new (require('rxjs').throwError)(() => new Error('Network error')),
      );

      await expect(service.syncClientDevices(mockClient as Client)).resolves.not.toThrow();
    });
  });
});
```

---

### 4.4 Dataverse Integration

#### `backend/src/integrations/dataverse/dataverse.module.ts`

```typescript
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
```

#### `backend/src/integrations/dataverse/dataverse.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientSecretCredential } from '@azure/identity';

@Injectable()
export class DataverseService {
  private readonly logger = new Logger(DataverseService.name);
  private credential: ClientSecretCredential;
  private cachedToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(private readonly config: ConfigService) {
    this.credential = new ClientSecretCredential(
      this.config.get<string>('AZURE_TENANT_ID', ''),
      this.config.get<string>('AZURE_CLIENT_ID', ''),
      this.config.get<string>('AZURE_CLIENT_SECRET', ''),
    );
  }

  get orgUri(): string {
    return this.config.get<string>('D365_ORG_URI', '');
  }

  async getBearerToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.tokenExpiresAt) {
      return this.cachedToken;
    }

    const scope = `${this.orgUri}/.default`;
    const tokenResponse = await this.credential.getToken(scope);

    this.cachedToken = tokenResponse.token;
    // Azure tokens are valid for ~1h; cache for 55 min
    this.tokenExpiresAt = Date.now() + 55 * 60 * 1000;
    this.logger.debug('Dataverse Bearer token refreshed');
    return this.cachedToken;
  }

  buildHeaders(token: string): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
    };
  }
}
```

#### `backend/src/integrations/dataverse/case.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { DataverseService } from './dataverse.service';
import { Alert } from '../../alerts/entities/alert.entity';
import { Device } from '../../devices/entities/device.entity';
import { Client } from '../../clients/entities/client.entity';

export interface D365Case {
  incidentid: string;
  title: string;
  statecode: number;
  createdon: string;
}

@Injectable()
export class CaseService {
  private readonly logger = new Logger(CaseService.name);

  constructor(private readonly dataverseService: DataverseService) {}

  async createCase(alert: Alert, device: Device, client: Client): Promise<string> {
    const token = await this.dataverseService.getBearerToken();
    const headers = this.dataverseService.buildHeaders(token);

    const payload = {
      title: `[HVAC Alert] ${alert.severity.toUpperCase()}: ${device.name}`,
      description: [
        `Device: ${device.name}`,
        `Site: ${device.site?.name ?? 'Unknown'}`,
        `Message: ${alert.message}`,
        `Timestamp: ${alert.createdAt?.toISOString() ?? new Date().toISOString()}`,
      ].join('\n'),
      prioritycode: alert.severity === 'critical' ? 1 : 2,
    };

    const url = `${this.dataverseService.orgUri}/api/data/v9.2/incidents`;

    try {
      const response = await axios.post<{ incidentid: string }>(url, payload, { headers });
      const caseId = response.data.incidentid;
      this.logger.log(`Created D365 case ${caseId} for alert ${alert.id}`);
      return caseId;
    } catch (err) {
      this.logger.error(`Failed to create D365 case for alert ${alert.id}: ${(err as Error).message}`);
      throw err;
    }
  }

  async getCasesByDeviceId(daikinDeviceId: string): Promise<D365Case[]> {
    const token = await this.dataverseService.getBearerToken();
    const headers = this.dataverseService.buildHeaders(token);

    const filter = encodeURIComponent(`contains(description,'${daikinDeviceId}')`);
    const select = 'incidentid,title,statecode,createdon';
    const url = `${this.dataverseService.orgUri}/api/data/v9.2/incidents?$filter=${filter}&$select=${select}`;

    try {
      const response = await axios.get<{ value: D365Case[] }>(url, { headers });
      return response.data.value ?? [];
    } catch (err) {
      this.logger.warn(`Failed to get D365 cases for device ${daikinDeviceId}: ${(err as Error).message}`);
      return [];
    }
  }
}
```

#### `backend/src/integrations/dataverse/case.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { CaseService } from './case.service';
import { DataverseService } from './dataverse.service';
import axios from 'axios';
import { Alert } from '../../alerts/entities/alert.entity';
import { Device } from '../../devices/entities/device.entity';
import { Client } from '../../clients/entities/client.entity';
import { Site } from '../../sites/entities/site.entity';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const mockDataverseService = {
  getBearerToken: jest.fn().mockResolvedValue('mock-d365-token'),
  buildHeaders: jest.fn().mockReturnValue({
    Authorization: 'Bearer mock-d365-token',
    'Content-Type': 'application/json',
  }),
  orgUri: 'https://testorg.crm4.dynamics.com',
};

const mockAlert: Partial<Alert> = {
  id: 'alert-uuid-1',
  severity: 'critical',
  message: 'High temperature detected',
  createdAt: new Date('2026-03-18T10:00:00Z'),
};

const mockSite: Partial<Site> = { name: 'Main Office' };
const mockDevice: Partial<Device> = {
  id: 'device-uuid-1',
  name: 'AC Unit #1',
  daikinDeviceId: 'daikin-001',
  site: mockSite as Site,
};
const mockClient: Partial<Client> = { id: 'client-uuid-1' };

describe('CaseService', () => {
  let service: CaseService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaseService,
        { provide: DataverseService, useValue: mockDataverseService },
      ],
    }).compile();

    service = module.get<CaseService>(CaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createCase', () => {
    it('should POST to D365 incidents endpoint with correct payload', async () => {
      mockedAxios.post.mockResolvedValue({ data: { incidentid: 'case-uuid-123' } });

      const caseId = await service.createCase(
        mockAlert as Alert,
        mockDevice as Device,
        mockClient as Client,
      );

      expect(caseId).toBe('case-uuid-123');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://testorg.crm4.dynamics.com/api/data/v9.2/incidents',
        expect.objectContaining({
          title: '[HVAC Alert] CRITICAL: AC Unit #1',
          prioritycode: 1,
        }),
        expect.any(Object),
      );
    });

    it('should set prioritycode=2 for non-critical alerts', async () => {
      mockedAxios.post.mockResolvedValue({ data: { incidentid: 'case-uuid-456' } });

      await service.createCase(
        { ...mockAlert, severity: 'warning' } as Alert,
        mockDevice as Device,
        mockClient as Client,
      );

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ prioritycode: 2 }),
        expect.any(Object),
      );
    });

    it('should throw when D365 returns an error', async () => {
      mockedAxios.post.mockRejectedValue(new Error('D365 unavailable'));

      await expect(
        service.createCase(mockAlert as Alert, mockDevice as Device, mockClient as Client),
      ).rejects.toThrow('D365 unavailable');
    });
  });

  describe('getCasesByDeviceId', () => {
    it('should GET incidents filtered by daikinDeviceId', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { value: [{ incidentid: 'case-1', title: 'Test', statecode: 0, createdon: '2026-01-01' }] },
      });

      const cases = await service.getCasesByDeviceId('daikin-001');

      expect(cases).toHaveLength(1);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('incidents'),
        expect.any(Object),
      );
    });

    it('should return empty array when D365 fails', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      const cases = await service.getCasesByDeviceId('daikin-001');
      expect(cases).toEqual([]);
    });
  });
});
```

---

### 4.5 Viewer (APS model management)

#### `backend/src/viewer/viewer.module.ts`

```typescript
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
```

#### `backend/src/viewer/viewer.service.ts`

```typescript
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SiteModel } from '../sites/entities/site-model.entity';

export class CreateSiteModelDto {
  urn: string; // APS model URN (base64 encoded)
  name: string;
  description?: string;
}

@Injectable()
export class ViewerService {
  private readonly logger = new Logger(ViewerService.name);

  constructor(
    @InjectRepository(SiteModel)
    private readonly siteModelRepo: Repository<SiteModel>,
  ) {}

  async getModelsForSite(siteId: string, clientId: string): Promise<SiteModel[]> {
    return this.siteModelRepo.find({
      where: { siteId, clientId },
      order: { createdAt: 'DESC' },
    });
  }

  async addModel(
    siteId: string,
    clientId: string,
    dto: CreateSiteModelDto,
  ): Promise<SiteModel> {
    const model = this.siteModelRepo.create({
      siteId,
      clientId,
      urn: dto.urn,
      name: dto.name,
      description: dto.description,
    });
    const saved = await this.siteModelRepo.save(model);
    this.logger.log(`Added model ${saved.id} for site ${siteId}`);
    return saved;
  }

  async removeModel(modelId: string, clientId: string): Promise<void> {
    const model = await this.siteModelRepo.findOne({ where: { id: modelId } });

    if (!model) {
      throw new NotFoundException(`Model ${modelId} not found`);
    }
    if (model.clientId !== clientId) {
      throw new ForbiddenException(`Access denied to model ${modelId}`);
    }

    await this.siteModelRepo.remove(model);
    this.logger.log(`Removed model ${modelId}`);
  }
}
```

#### `backend/src/viewer/viewer.controller.ts`

```typescript
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // Agent B
import { CurrentUser } from '../auth/current-user.decorator'; // Agent B
import { ViewerService, CreateSiteModelDto } from './viewer.service';

interface AuthUser {
  id: string;
  clientId: string;
}

@Controller('sites/:siteId/models')
@UseGuards(JwtAuthGuard)
export class ViewerController {
  constructor(private readonly viewerService: ViewerService) {}

  @Get()
  getModels(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.viewerService.getModelsForSite(siteId, user.clientId);
  }

  @Post()
  addModel(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Body() dto: CreateSiteModelDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.viewerService.addModel(siteId, user.clientId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeModel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.viewerService.removeModel(id, user.clientId);
  }
}
```

---

## 5. Obsługa błędów — wytyczne

### ThingsBoard — graceful fail przy starcie

Serwis implementuje `OnModuleInit`. Metoda `onModuleInit()` przechwytuje błąd logowania i loguje ostrzeżenie zamiast rzucać wyjątek. Dzięki temu aplikacja uruchamia się poprawnie nawet gdy TB nie jest dostępny (cold start w Docker Compose, testy jednostkowe).

Strategia retry dla produkcji (opcjonalna — poza zakresem tego agenta): dodać bibliotekę `retry` lub `p-retry` do `ensureToken()` z wykładniczym backoffem.

### Daikin — izolacja błędów per klient

`DaikinScheduler.syncAllClients()` używa `Promise.allSettled()` — błąd synchronizacji jednego klienta nie przerywa synchronizacji pozostałych. Każdy `syncClientDevices()` ma wewnętrzny try/catch dla fazy fetch i fazy publish.

### Telemetria — strategia fallback

`TelemetryService.query()` próbuje najpierw lokalnej bazy (TimescaleDB / PostgreSQL). Jeśli brak rekordów LUB zapytanie rzuci wyjątek — przechodzi do TB REST API. Brak TB nie rzuca 500 — zwraca pustą tablicę z ostrzeżeniem w logach.

### Dataverse — nie blokuje przetwarzania alertów

`CaseService.createCase()` rzuca błąd — konsumer (np. AlertsService z Agenta C) powinien obsłużyć go jako niekrytyczny (log + kontynuacja). `getCasesByDeviceId()` nigdy nie rzuca — zwraca `[]` przy błędzie.

### Ogólne zasady
- Każdy serwis ma własny Logger (`new Logger(ClassName.name)`)
- Błędy sieciowe logowane na poziomie `warn` lub `error`, nie rzucają dalej chyba że jest to wymagane
- Tokeny trzymane w pamięci procesu (nie Redis) — wystarczy dla jednej instancji; przy skalowaniu horyzontalnym wymagana zewnętrzna cache

---

## 6. Instrukcja aktualizacji `app.module.ts`

Agent B zarządza plikiem `app.module.ts`. Po dostarczeniu modułów przez Agenta D należy dodać następujące importy:

```typescript
// app.module.ts — dodać do tablicy imports:
import { ThingsBoardModule } from './thingsboard/thingsboard.module';
import { TelemetryModule } from './telemetry/telemetry.module';
import { DaikinModule } from './integrations/daikin/daikin.module';
import { DataverseModule } from './integrations/dataverse/dataverse.module';
import { ViewerModule } from './viewer/viewer.module';

@Module({
  imports: [
    // ... istniejące importy Agenta B ...
    ThingsBoardModule,
    TelemetryModule,
    DaikinModule,
    DataverseModule,
    ViewerModule,
  ],
})
export class AppModule {}
```

### Wymagania dla `package.json`

Upewnić się, że następujące pakiety są zainstalowane:

```bash
# Już obecne w NestJS:
# @nestjs/axios, @nestjs/schedule, @nestjs/typeorm, @nestjs/config

# Wymagane dodatkowe:
npm install @azure/identity axios
npm install --save-dev @types/node
```

`ScheduleModule.forRoot()` jest importowany wewnątrz `DaikinModule` — jeśli Agent B już importuje go globalnie w `AppModule`, należy usunąć duplikat z `DaikinModule`.

---

## 7. Weryfikacja

### Testy jednostkowe

```bash
cd "D:\DEV-LOCAL\DigitalTwin Platform\backend"

# Uruchom testy Agenta D
npx jest --testPathPattern="thingsboard|telemetry|daikin|case" --coverage
```

Oczekiwane pokrycie: min. 70% dla serwisów integracyjnych.

### Smoke test (lokalny Docker Compose)

1. **ThingsBoard ping:**
   ```bash
   curl -X POST http://localhost:9090/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"sysadmin@thingsboard.org","password":"sysadmin"}'
   # Oczekiwane: {"token":"..."}
   ```

2. **Endpoint telemetrii:**
   ```bash
   curl -H "Authorization: Bearer <jwt>" \
     "http://localhost:3000/api/devices/<uuid>/telemetry?from=2026-01-01T00:00:00Z&to=2026-03-18T23:59:59Z&metrics=temperature&limit=10"
   # Oczekiwane: [] lub tablica TelemetryPoint
   ```

3. **Modele Viewer:**
   ```bash
   curl -H "Authorization: Bearer <jwt>" \
     "http://localhost:3000/sites/<siteId>/models"
   # Oczekiwane: []
   ```

4. **Scheduler Daikin** — weryfikacja w logach:
   ```
   [DaikinScheduler] Starting Daikin sync for all clients...
   [DaikinScheduler] Daikin sync completed for N clients
   ```

### Checklist przed merge

- [ ] Wszystkie pliki z sekcji 3 istnieją w `backend/src/`
- [ ] `npx jest` przechodzi bez błędów
- [ ] `npx tsc --noEmit` nie zgłasza błędów typów
- [ ] `app.module.ts` zaktualizowany przez Agenta B
- [ ] Zmienne środowiskowe zdefiniowane w `.env` / docker-compose
- [ ] `TelemetryEvent` entity zarejestrowana w TypeORM (przez `TelemetryModule`)
- [ ] `ScheduleModule.forRoot()` zaimportowany dokładnie raz w całej aplikacji
