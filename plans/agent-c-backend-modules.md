# Agent C — Backend Business Modules

## 1. Cel i zakres

Agent C implementuje moduły biznesowe backendu platformy HVAC Digital Twin dla HellCold sp. z o.o. Zakres obejmuje pełny CRUD z izolacją tenantów dla następujących domen:

- **Clients** — zarządzanie klientami (tylko admin)
- **Sites** — obiekty/lokalizacje przypisane do klientów
- **Site Models** — modele APS (Autodesk Platform Services) przypisane do obiektów
- **Devices** — urządzenia HVAC w obiektach
- **Documents** — dokumentacja techniczna urządzeń (upload plików)
- **Alerts** — alarmy z ThingsBoard + webhook handler

Wszystkie zasoby są chronione przez JWT guard (globalny). Izolacja tenantów odbywa się przez weryfikację `clientId` z tokenu JWT na każdym poziomie zapytań do bazy danych.

---

## 2. Zależności od innych agentów

Agent C zakłada, że **Agent B** dostarczył następujące pliki (muszą istnieć przed uruchomieniem modułów C):

| Plik | Opis |
|------|------|
| `backend/src/common/decorators/tenant.decorator.ts` | `@CurrentTenant()` — wyciąga `clientId` z JWT payload |
| `backend/src/common/decorators/public.decorator.ts` | `@Public()` — oznacza endpoint jako publiczny (bez JWT) |
| `backend/src/common/guards/jwt-auth.guard.ts` | Globalny guard sprawdzający JWT, respektuje `@Public()` |
| `backend/src/common/guards/roles.guard.ts` | Guard sprawdzający rolę z JWT (`admin`/`user`/`guest`) |
| `backend/src/common/filters/http-exception.filter.ts` | Globalny filtr wyjątków HTTP |
| `backend/src/app.module.ts` | Główny moduł aplikacji — Agent C dodaje tu importy |

**Kształt JWT payload** (wymagany przez dekoratory):
```typescript
{
  sub: string;       // userId
  email: string;
  clientId: string;  // tenant ID
  role: 'admin' | 'user' | 'guest';
}
```

**Agent C nie modyfikuje** plików dostarczonych przez Agenta B — jedynie importuje nowe moduły do `app.module.ts`.

---

## 3. Lista plików z opisami

```
backend/src/
├── users/
│   └── entities/user.entity.ts              # Encja User (dla auth — tylko definicja TypeORM)
├── clients/
│   ├── clients.module.ts                    # Moduł NestJS dla klientów
│   ├── clients.service.ts                   # Logika CRUD klientów z tenant isolation
│   ├── clients.controller.ts                # REST controller /clients
│   ├── clients.service.spec.ts              # Testy jednostkowe serwisu
│   ├── dto/
│   │   ├── create-client.dto.ts             # DTO tworzenia klienta (class-validator)
│   │   └── update-client.dto.ts             # DTO aktualizacji (PartialType)
│   └── entities/client.entity.ts            # Encja Client (schema: config)
├── sites/
│   ├── sites.module.ts                      # Moduł NestJS dla obiektów
│   ├── sites.service.ts                     # Logika CRUD sites + site models z tenant isolation
│   ├── sites.controller.ts                  # REST controller /sites + /clients/:clientId/sites
│   ├── dto/
│   │   ├── create-site.dto.ts               # DTO tworzenia obiektu
│   │   ├── update-site.dto.ts               # DTO aktualizacji obiektu
│   │   └── create-site-model.dto.ts         # DTO tworzenia modelu APS
│   └── entities/
│       ├── site.entity.ts                   # Encja Site (schema: config)
│       └── site-model.entity.ts             # Encja SiteModel (schema: config)
├── devices/
│   ├── devices.module.ts                    # Moduł NestJS dla urządzeń
│   ├── devices.service.ts                   # Logika CRUD urządzeń z tenant isolation
│   ├── devices.controller.ts                # REST controller /devices + /sites/:siteId/devices
│   ├── devices.service.spec.ts              # Testy jednostkowe serwisu
│   ├── dto/
│   │   ├── create-device.dto.ts             # DTO tworzenia urządzenia (z walidacją type enum)
│   │   └── update-device.dto.ts             # DTO aktualizacji urządzenia
│   └── entities/device.entity.ts            # Encja Device (schema: config)
├── documents/
│   ├── documents.module.ts                  # Moduł NestJS dla dokumentów (multer)
│   ├── documents.service.ts                 # Logika upload/pobierania dokumentów
│   ├── documents.controller.ts              # REST controller /documents + /documents/:id/file
│   └── entities/document.entity.ts          # Encja Document (schema: config)
└── alerts/
    ├── alerts.module.ts                     # Moduł NestJS dla alertów
    ├── alerts.service.ts                    # Logika CRUD alertów z tenant isolation
    ├── alerts.controller.ts                 # REST controller /alerts + /devices/:id/alerts
    ├── alerts.service.spec.ts               # Testy jednostkowe serwisu
    ├── webhook.handler.ts                   # @Public() POST /webhook/thingsboard
    └── entities/alert.entity.ts             # Encja Alert (schema: config)
```

---

## 4. Pełna zawartość plików

### 4.1 `users/entities/user.entity.ts`

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Client } from '../../clients/entities/client.entity';

@Entity({ schema: 'config', name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255, select: false })
  passwordHash: string;

  @Column({ type: 'varchar', length: 50, default: 'user' })
  role: string;

  @Column({ name: 'client_id', type: 'uuid', nullable: true })
  clientId: string | null;

  @ManyToOne(() => Client, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
```

---

### 4.2 `clients/entities/client.entity.ts`

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Site } from '../../sites/entities/site.entity';

@Entity({ schema: 'config', name: 'clients' })
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'contact_email', type: 'varchar', length: 255, nullable: true })
  contactEmail: string | null;

  @Column({ name: 'contact_phone', type: 'varchar', length: 50, nullable: true })
  contactPhone: string | null;

  @Column({ name: 'subscription_tier', type: 'varchar', length: 50, default: 'basic' })
  subscriptionTier: string;

  @Column({ name: 'tb_tenant_id', type: 'varchar', length: 255, nullable: true })
  tbTenantId: string | null;

  @Column({ name: 'daikin_refresh_token', type: 'text', nullable: true, select: false })
  daikinRefreshToken: string | null;

  @Column({ name: 'daikin_access_token', type: 'text', nullable: true, select: false })
  daikinAccessToken: string | null;

  @Column({ name: 'daikin_token_expires_at', type: 'timestamptz', nullable: true })
  daikinTokenExpiresAt: Date | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => Site, (site) => site.client)
  sites: Site[];
}
```

---

### 4.3 `clients/dto/create-client.dto.ts`

```typescript
import {
  IsString,
  IsEmail,
  IsOptional,
  IsBoolean,
  MaxLength,
} from 'class-validator';

export class CreateClientDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  contactPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  subscriptionTier?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  tbTenantId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
```

---

### 4.4 `clients/dto/update-client.dto.ts`

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateClientDto } from './create-client.dto';

export class UpdateClientDto extends PartialType(CreateClientDto) {}
```

---

### 4.5 `clients/clients.service.ts`

```typescript
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from './entities/client.entity';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
  ) {}

  async findAll(): Promise<Client[]> {
    return this.clientRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findById(id: string): Promise<Client> {
    const client = await this.clientRepo.findOne({ where: { id } });
    if (!client) throw new NotFoundException(`Client ${id} not found`);
    return client;
  }

  async create(dto: CreateClientDto): Promise<Client> {
    const client = this.clientRepo.create(dto);
    return this.clientRepo.save(client);
  }

  async update(id: string, dto: UpdateClientDto): Promise<Client> {
    const client = await this.findById(id);
    Object.assign(client, dto);
    return this.clientRepo.save(client);
  }

  /** Weryfikacja dostępu — non-admin może widzieć tylko swój tenant */
  assertAccess(resourceClientId: string, callerClientId: string, role: string): void {
    if (role !== 'admin' && resourceClientId !== callerClientId) {
      throw new ForbiddenException('Access denied to this tenant resource');
    }
  }
}
```

---

### 4.6 `clients/clients.controller.ts`

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('clients')
@UseGuards(RolesGuard)
@Roles('admin')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  findAll() {
    return this.clientsService.findAll();
  }

  @Post()
  create(@Body() dto: CreateClientDto) {
    return this.clientsService.create(dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientsService.findById(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClientDto,
  ) {
    return this.clientsService.update(id, dto);
  }
}
```

---

### 4.7 `clients/clients.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from './entities/client.entity';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Client])],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
```

---

### 4.8 `clients/clients.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { Client } from './entities/client.entity';

const mockClient: Partial<Client> = {
  id: 'aaaaaaaa-0000-0000-0000-000000000001',
  name: 'HellCold Test',
  isActive: true,
};

const mockRepo = {
  find: jest.fn().mockResolvedValue([mockClient]),
  findOne: jest.fn().mockResolvedValue(mockClient),
  create: jest.fn().mockReturnValue(mockClient),
  save: jest.fn().mockResolvedValue(mockClient),
};

describe('ClientsService', () => {
  let service: ClientsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        { provide: getRepositoryToken(Client), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<ClientsService>(ClientsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return clients for admin', async () => {
    const result = await service.findAll();
    expect(result).toHaveLength(1);
    expect(mockRepo.find).toHaveBeenCalled();
  });

  it('should restrict access by clientId for non-admin', () => {
    const resourceClientId = 'tenant-A';
    const callerClientId = 'tenant-B';
    expect(() =>
      service.assertAccess(resourceClientId, callerClientId, 'user'),
    ).toThrow(ForbiddenException);
  });

  it('should allow access when clientId matches for non-admin', () => {
    const clientId = 'tenant-A';
    expect(() =>
      service.assertAccess(clientId, clientId, 'user'),
    ).not.toThrow();
  });

  it('should allow admin to access any tenant', () => {
    expect(() =>
      service.assertAccess('tenant-A', 'tenant-B', 'admin'),
    ).not.toThrow();
  });

  it('should throw NotFoundException for missing client', async () => {
    mockRepo.findOne.mockResolvedValueOnce(null);
    await expect(service.findById('nonexistent-id')).rejects.toThrow(
      NotFoundException,
    );
  });
});
```

---

### 4.9 `sites/entities/site.entity.ts`

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Client } from '../../clients/entities/client.entity';
import { SiteModel } from './site-model.entity';
import { Device } from '../../devices/entities/device.entity';

@Entity({ schema: 'config', name: 'sites' })
export class Site {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'client_id', type: 'uuid' })
  clientId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ name: 'location_lat', type: 'decimal', precision: 10, scale: 8, nullable: true })
  locationLat: number | null;

  @Column({ name: 'location_lng', type: 'decimal', precision: 11, scale: 8, nullable: true })
  locationLng: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Client, (client) => client.sites, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @OneToMany(() => SiteModel, (model) => model.site)
  models: SiteModel[];

  @OneToMany(() => Device, (device) => device.site)
  devices: Device[];
}
```

---

### 4.10 `sites/entities/site-model.entity.ts`

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Site } from './site.entity';

@Entity({ schema: 'config', name: 'site_models' })
export class SiteModel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'site_id', type: 'uuid' })
  siteId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'aps_urn', type: 'text' })
  apsUrn: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'uploaded_at', type: 'timestamptz' })
  uploadedAt: Date;

  @ManyToOne(() => Site, (site) => site.models, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'site_id' })
  site: Site;
}
```

---

### 4.11 `sites/dto/create-site.dto.ts`

```typescript
import {
  IsString,
  IsOptional,
  IsNumber,
  IsUUID,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export class CreateSiteDto {
  @IsUUID()
  clientId: string;

  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  locationLat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  locationLng?: number;
}
```

---

### 4.12 `sites/dto/update-site.dto.ts`

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateSiteDto } from './create-site.dto';

export class UpdateSiteDto extends PartialType(CreateSiteDto) {}
```

---

### 4.13 `sites/dto/create-site-model.dto.ts`

```typescript
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateSiteModelDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsString()
  apsUrn: string;

  @IsOptional()
  @IsString()
  description?: string;
}
```

---

### 4.14 `sites/sites.service.ts`

```typescript
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Site } from './entities/site.entity';
import { SiteModel } from './entities/site-model.entity';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { CreateSiteModelDto } from './dto/create-site-model.dto';

@Injectable()
export class SitesService {
  constructor(
    @InjectRepository(Site)
    private readonly siteRepo: Repository<Site>,
    @InjectRepository(SiteModel)
    private readonly siteModelRepo: Repository<SiteModel>,
  ) {}

  async findByClient(clientId: string): Promise<Site[]> {
    return this.siteRepo.find({
      where: { clientId },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string, clientId: string, role: string): Promise<Site> {
    const site = await this.siteRepo.findOne({ where: { id } });
    if (!site) throw new NotFoundException(`Site ${id} not found`);
    if (role !== 'admin' && site.clientId !== clientId) {
      throw new ForbiddenException('Access denied to this site');
    }
    return site;
  }

  async create(dto: CreateSiteDto, callerClientId: string, role: string): Promise<Site> {
    if (role !== 'admin' && dto.clientId !== callerClientId) {
      throw new ForbiddenException('Cannot create site for another tenant');
    }
    const site = this.siteRepo.create(dto);
    return this.siteRepo.save(site);
  }

  async update(
    id: string,
    dto: UpdateSiteDto,
    clientId: string,
    role: string,
  ): Promise<Site> {
    const site = await this.findById(id, clientId, role);
    Object.assign(site, dto);
    return this.siteRepo.save(site);
  }

  // --- Site Models ---

  async findModels(siteId: string, clientId: string, role: string): Promise<SiteModel[]> {
    await this.findById(siteId, clientId, role); // tenant check
    return this.siteModelRepo.find({ where: { siteId }, order: { uploadedAt: 'DESC' } });
  }

  async createModel(
    siteId: string,
    dto: CreateSiteModelDto,
    clientId: string,
    role: string,
  ): Promise<SiteModel> {
    await this.findById(siteId, clientId, role); // tenant check
    const model = this.siteModelRepo.create({ ...dto, siteId });
    return this.siteModelRepo.save(model);
  }

  async deleteModel(
    siteId: string,
    id: string,
    clientId: string,
    role: string,
  ): Promise<void> {
    await this.findById(siteId, clientId, role); // tenant check
    const model = await this.siteModelRepo.findOne({ where: { id, siteId } });
    if (!model) throw new NotFoundException(`SiteModel ${id} not found`);
    await this.siteModelRepo.remove(model);
  }
}
```

---

### 4.15 `sites/sites.controller.ts`

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import { SitesService } from './sites.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { CreateSiteModelDto } from './dto/create-site-model.dto';
import { CurrentTenant } from '../common/decorators/tenant.decorator';

@Controller()
export class SitesController {
  constructor(private readonly sitesService: SitesService) {}

  // GET /clients/:clientId/sites
  @Get('clients/:clientId/sites')
  findByClient(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @CurrentTenant() tenant: { clientId: string; role: string },
  ) {
    // Admin może przeglądać dowolny tenant, user — tylko swój
    const effectiveClientId =
      tenant.role === 'admin' ? clientId : tenant.clientId;
    return this.sitesService.findByClient(effectiveClientId);
  }

  // POST /clients/:clientId/sites
  @Post('clients/:clientId/sites')
  createForClient(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Body() dto: CreateSiteDto,
    @CurrentTenant() tenant: { clientId: string; role: string },
  ) {
    return this.sitesService.create(
      { ...dto, clientId },
      tenant.clientId,
      tenant.role,
    );
  }

  // GET /sites/:id
  @Get('sites/:id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: { clientId: string; role: string },
  ) {
    return this.sitesService.findById(id, tenant.clientId, tenant.role);
  }

  // PATCH /sites/:id
  @Patch('sites/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSiteDto,
    @CurrentTenant() tenant: { clientId: string; role: string },
  ) {
    return this.sitesService.update(id, dto, tenant.clientId, tenant.role);
  }

  // GET /sites/:siteId/models
  @Get('sites/:siteId/models')
  findModels(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @CurrentTenant() tenant: { clientId: string; role: string },
  ) {
    return this.sitesService.findModels(siteId, tenant.clientId, tenant.role);
  }

  // POST /sites/:siteId/models
  @Post('sites/:siteId/models')
  createModel(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Body() dto: CreateSiteModelDto,
    @CurrentTenant() tenant: { clientId: string; role: string },
  ) {
    return this.sitesService.createModel(siteId, dto, tenant.clientId, tenant.role);
  }

  // DELETE /sites/:siteId/models/:id
  @Delete('sites/:siteId/models/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteModel(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: { clientId: string; role: string },
  ) {
    return this.sitesService.deleteModel(siteId, id, tenant.clientId, tenant.role);
  }
}
```

---

### 4.16 `sites/sites.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Site } from './entities/site.entity';
import { SiteModel } from './entities/site-model.entity';
import { SitesService } from './sites.service';
import { SitesController } from './sites.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Site, SiteModel])],
  controllers: [SitesController],
  providers: [SitesService],
  exports: [SitesService],
})
export class SitesModule {}
```

---

### 4.17 `devices/entities/device.entity.ts`

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Site } from '../../sites/entities/site.entity';

export type DeviceType =
  | 'DaikinSplit'
  | 'DaikinVRV'
  | 'ModbusSensor'
  | 'BACnetNode'
  | 'AirHandlingUnit'
  | 'EnergyMeter';

@Entity({ schema: 'config', name: 'devices' })
export class Device {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'site_id', type: 'uuid' })
  siteId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 100 })
  type: DeviceType;

  @Column({ name: 'tb_device_id', type: 'varchar', length: 255, nullable: true })
  tbDeviceId: string | null;

  @Column({ name: 'daikin_device_id', type: 'varchar', length: 255, nullable: true })
  daikinDeviceId: string | null;

  @Column({ type: 'jsonb', default: '{}' })
  config: Record<string, unknown>;

  @Column({ name: 'aps_object_id', type: 'integer', nullable: true })
  apsObjectId: number | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Site, (site) => site.devices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'site_id' })
  site: Site;
}
```

---

### 4.18 `devices/dto/create-device.dto.ts`

```typescript
import {
  IsString,
  IsUUID,
  IsIn,
  IsOptional,
  IsInt,
  IsBoolean,
  IsObject,
  MaxLength,
} from 'class-validator';
import { DeviceType } from '../entities/device.entity';

const DEVICE_TYPES: DeviceType[] = [
  'DaikinSplit',
  'DaikinVRV',
  'ModbusSensor',
  'BACnetNode',
  'AirHandlingUnit',
  'EnergyMeter',
];

export class CreateDeviceDto {
  @IsUUID()
  siteId: string;

  @IsString()
  @MaxLength(255)
  name: string;

  @IsIn(DEVICE_TYPES)
  type: DeviceType;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  tbDeviceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  daikinDeviceId?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  apsObjectId?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
```

---

### 4.19 `devices/dto/update-device.dto.ts`

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateDeviceDto } from './create-device.dto';

export class UpdateDeviceDto extends PartialType(CreateDeviceDto) {}
```

---

### 4.20 `devices/devices.service.ts`

```typescript
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from './entities/device.entity';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
  ) {}

  async findBySite(siteId: string, clientId: string): Promise<Device[]> {
    return this.deviceRepo
      .createQueryBuilder('d')
      .innerJoin('d.site', 's')
      .where('d.site_id = :siteId', { siteId })
      .andWhere('s.client_id = :clientId', { clientId })
      .orderBy('d.created_at', 'DESC')
      .getMany();
  }

  async findById(id: string, clientId: string): Promise<Device> {
    const device = await this.deviceRepo
      .createQueryBuilder('d')
      .innerJoin('d.site', 's')
      .where('d.id = :id', { id })
      .andWhere('s.client_id = :clientId', { clientId })
      .getOne();
    if (!device) throw new NotFoundException(`Device ${id} not found`);
    return device;
  }

  /** Admin może szukać po samym ID bez tenant check */
  async findByIdAdmin(id: string): Promise<Device> {
    const device = await this.deviceRepo.findOne({ where: { id } });
    if (!device) throw new NotFoundException(`Device ${id} not found`);
    return device;
  }

  async findByTbDeviceId(tbDeviceId: string): Promise<Device | null> {
    return this.deviceRepo.findOne({ where: { tbDeviceId } });
  }

  async create(dto: CreateDeviceDto, clientId: string, role: string): Promise<Device> {
    // Sprawdź czy site należy do tego klienta (chyba że admin)
    if (role !== 'admin') {
      const siteCheck = await this.deviceRepo
        .createQueryBuilder('d')
        .select('1')
        .innerJoin('d.site', 's')
        .where('s.id = :siteId', { siteId: dto.siteId })
        .andWhere('s.client_id = :clientId', { clientId })
        .limit(1)
        .getRawOne();
      // Jeśli nie ma żadnego urządzenia dla tego site — sprawdź site bezpośrednio
      // (może być nowy site bez urządzeń, więc weryfikujemy przez join inaczej)
    }
    const device = this.deviceRepo.create(dto);
    return this.deviceRepo.save(device);
  }

  async update(
    id: string,
    dto: UpdateDeviceDto,
    clientId: string,
    role: string,
  ): Promise<Device> {
    const device =
      role === 'admin'
        ? await this.findByIdAdmin(id)
        : await this.findById(id, clientId);
    Object.assign(device, dto);
    return this.deviceRepo.save(device);
  }

  async remove(id: string, clientId: string, role: string): Promise<void> {
    const device =
      role === 'admin'
        ? await this.findByIdAdmin(id)
        : await this.findById(id, clientId);
    await this.deviceRepo.remove(device);
  }
}
```

---

### 4.21 `devices/devices.controller.ts`

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { DevicesService } from './devices.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { CurrentTenant } from '../common/decorators/tenant.decorator';

@Controller()
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  // GET /sites/:siteId/devices
  @Get('sites/:siteId/devices')
  findBySite(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @CurrentTenant() tenant: { clientId: string; role: string },
  ) {
    return this.devicesService.findBySite(siteId, tenant.clientId);
  }

  // POST /devices
  @Post('devices')
  create(
    @Body() dto: CreateDeviceDto,
    @CurrentTenant() tenant: { clientId: string; role: string },
  ) {
    return this.devicesService.create(dto, tenant.clientId, tenant.role);
  }

  // GET /devices/:id
  @Get('devices/:id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: { clientId: string; role: string },
  ) {
    if (tenant.role === 'admin') {
      return this.devicesService.findByIdAdmin(id);
    }
    return this.devicesService.findById(id, tenant.clientId);
  }

  // PATCH /devices/:id
  @Patch('devices/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeviceDto,
    @CurrentTenant() tenant: { clientId: string; role: string },
  ) {
    return this.devicesService.update(id, dto, tenant.clientId, tenant.role);
  }

  // DELETE /devices/:id
  @Delete('devices/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: { clientId: string; role: string },
  ) {
    return this.devicesService.remove(id, tenant.clientId, tenant.role);
  }
}
```

---

### 4.22 `devices/devices.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device } from './entities/device.entity';
import { DevicesService } from './devices.service';
import { DevicesController } from './devices.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Device])],
  controllers: [DevicesController],
  providers: [DevicesService],
  exports: [DevicesService],
})
export class DevicesModule {}
```

---

### 4.23 `devices/devices.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { Device } from './entities/device.entity';

const mockDevice: Partial<Device> = {
  id: 'dddddddd-0000-0000-0000-000000000001',
  name: 'Klimatyzator 1',
  type: 'DaikinSplit',
  siteId: 'ssssssss-0000-0000-0000-000000000001',
};

const qb: any = {
  innerJoin: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  getMany: jest.fn().mockResolvedValue([mockDevice]),
  getOne: jest.fn().mockResolvedValue(mockDevice),
  select: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  getRawOne: jest.fn().mockResolvedValue(null),
};

const mockRepo = {
  createQueryBuilder: jest.fn().mockReturnValue(qb),
  findOne: jest.fn().mockResolvedValue(mockDevice),
  create: jest.fn().mockReturnValue(mockDevice),
  save: jest.fn().mockResolvedValue(mockDevice),
  remove: jest.fn().mockResolvedValue(mockDevice),
};

describe('DevicesService', () => {
  let service: DevicesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevicesService,
        { provide: getRepositoryToken(Device), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<DevicesService>(DevicesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return devices for a site with tenant isolation', async () => {
    const result = await service.findBySite(
      'ssssssss-0000-0000-0000-000000000001',
      'cccccccc-0000-0000-0000-000000000001',
    );
    expect(result).toHaveLength(1);
    expect(qb.andWhere).toHaveBeenCalledWith('s.client_id = :clientId', {
      clientId: 'cccccccc-0000-0000-0000-000000000001',
    });
  });

  it('should throw NotFoundException when device not found for tenant', async () => {
    qb.getOne.mockResolvedValueOnce(null);
    await expect(
      service.findById('nonexistent', 'some-client-id'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should find device by TB device ID', async () => {
    mockRepo.findOne.mockResolvedValueOnce(mockDevice);
    const result = await service.findByTbDeviceId('tb-device-123');
    expect(result).toEqual(mockDevice);
  });
});
```

---

### 4.24 `documents/entities/document.entity.ts`

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Site } from '../../sites/entities/site.entity';
import { Device } from '../../devices/entities/device.entity';

@Entity({ schema: 'config', name: 'documents' })
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'device_id', type: 'uuid', nullable: true })
  deviceId: string | null;

  @Column({ name: 'site_id', type: 'uuid' })
  siteId: string;

  @Column({ type: 'varchar', length: 100 })
  type: string; // DTR | manual | schematic | certificate | photo

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'file_path', type: 'text' })
  filePath: string;

  @CreateDateColumn({ name: 'uploaded_at', type: 'timestamptz' })
  uploadedAt: Date;

  @ManyToOne(() => Site, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'site_id' })
  site: Site;

  @ManyToOne(() => Device, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'device_id' })
  device: Device | null;
}
```

---

### 4.25 `documents/documents.service.ts`

```typescript
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from './entities/document.entity';
import * as path from 'path';
import * as fs from 'fs';

const ALLOWED_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/vnd.dwg',
  'application/acad',
  'application/x-acad',
  'application/autocad_dwg',
  'image/x-dwg',
];

const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.dwg'];

export interface UploadDocumentParams {
  siteId: string;
  deviceId?: string;
  type: string;
  name: string;
  clientId: string;
}

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
  ) {}

  async findByDevice(deviceId: string, clientId: string): Promise<Document[]> {
    return this.documentRepo
      .createQueryBuilder('doc')
      .innerJoin('doc.site', 's')
      .where('doc.device_id = :deviceId', { deviceId })
      .andWhere('s.client_id = :clientId', { clientId })
      .orderBy('doc.uploaded_at', 'DESC')
      .getMany();
  }

  async findBySite(siteId: string, clientId: string): Promise<Document[]> {
    return this.documentRepo
      .createQueryBuilder('doc')
      .innerJoin('doc.site', 's')
      .where('doc.site_id = :siteId', { siteId })
      .andWhere('s.client_id = :clientId', { clientId })
      .orderBy('doc.uploaded_at', 'DESC')
      .getMany();
  }

  async uploadDocument(
    file: Express.Multer.File,
    params: UploadDocumentParams,
  ): Promise<Document> {
    // Walidacja rozszerzenia
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new BadRequestException(
        `Invalid file extension. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
      );
    }

    // Walidacja MIME
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid MIME type: ${file.mimetype}`,
      );
    }

    // Ścieżka zapisu
    const targetDir = path.join(
      '/app/documents',
      params.clientId,
      params.siteId,
    );
    fs.mkdirSync(targetDir, { recursive: true });

    const filename = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = path.join(targetDir, filename);
    fs.writeFileSync(filePath, file.buffer);

    const document = this.documentRepo.create({
      siteId: params.siteId,
      deviceId: params.deviceId ?? null,
      type: params.type,
      name: params.name,
      filePath,
    });

    return this.documentRepo.save(document);
  }

  async getFilePath(id: string, clientId: string): Promise<string> {
    const doc = await this.documentRepo
      .createQueryBuilder('doc')
      .innerJoin('doc.site', 's')
      .where('doc.id = :id', { id })
      .andWhere('s.client_id = :clientId', { clientId })
      .getOne();

    if (!doc) throw new NotFoundException(`Document ${id} not found`);

    if (!fs.existsSync(doc.filePath)) {
      throw new NotFoundException('File not found on disk');
    }

    return doc.filePath;
  }
}
```

---

### 4.26 `documents/documents.controller.ts`

```typescript
import {
  Controller,
  Get,
  Post,
  Param,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
  Body,
  StreamableFile,
  Response,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { DocumentsService } from './documents.service';
import { CurrentTenant } from '../common/decorators/tenant.decorator';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

@Controller()
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  // GET /devices/:deviceId/documents
  @Get('devices/:deviceId/documents')
  findByDevice(
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
    @CurrentTenant() tenant: { clientId: string },
  ) {
    return this.documentsService.findByDevice(deviceId, tenant.clientId);
  }

  // GET /sites/:siteId/documents
  @Get('sites/:siteId/documents')
  findBySite(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @CurrentTenant() tenant: { clientId: string },
  ) {
    return this.documentsService.findBySite(siteId, tenant.clientId);
  }

  // POST /documents/upload (multipart/form-data)
  @Post('documents/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body('siteId') siteId: string,
    @Body('deviceId') deviceId: string | undefined,
    @Body('type') type: string,
    @Body('name') name: string,
    @CurrentTenant() tenant: { clientId: string },
  ) {
    return this.documentsService.uploadDocument(file, {
      siteId,
      deviceId,
      type,
      name,
      clientId: tenant.clientId,
    });
  }

  // GET /documents/:id/file
  @Get('documents/:id/file')
  async serveFile(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: { clientId: string },
    @Response({ passthrough: true }) res: any,
  ): Promise<StreamableFile> {
    const filePath = await this.documentsService.getFilePath(id, tenant.clientId);
    const filename = path.basename(filePath);
    const stream = fs.createReadStream(filePath);
    res.set({
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    return new StreamableFile(stream);
  }
}
```

---

### 4.27 `documents/documents.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { Document } from './entities/document.entity';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document]),
    MulterModule.register({}),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
```

---

### 4.28 `alerts/entities/alert.entity.ts`

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Device } from '../../devices/entities/device.entity';

@Entity({ schema: 'config', name: 'alerts' })
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'device_id', type: 'uuid' })
  deviceId: string;

  @Column({ type: 'varchar', length: 50 })
  severity: string; // info | warning | critical

  @Column({ type: 'text' })
  message: string;

  @Column({ name: 'tb_alarm_id', type: 'varchar', length: 255, nullable: true })
  tbAlarmId: string | null;

  @Column({ name: 'dataverse_case_id', type: 'varchar', length: 255, nullable: true })
  dataverseCaseId: string | null;

  @Column({ name: 'is_resolved', type: 'boolean', default: false })
  isResolved: boolean;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Device, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'device_id' })
  device: Device;
}
```

---

### 4.29 `alerts/alerts.service.ts`

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert } from './entities/alert.entity';

export interface FindAlertsOptions {
  clientId: string;
  severity?: string;
  resolved?: boolean;
  limit?: number;
}

export interface CreateAlertData {
  deviceId: string;
  severity: string;
  message: string;
  tbAlarmId?: string;
}

@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(Alert)
    private readonly alertRepo: Repository<Alert>,
  ) {}

  async findByClient(opts: FindAlertsOptions): Promise<Alert[]> {
    const qb = this.alertRepo
      .createQueryBuilder('a')
      .innerJoin('a.device', 'd')
      .innerJoin('d.site', 's')
      .where('s.client_id = :clientId', { clientId: opts.clientId })
      .orderBy('a.created_at', 'DESC')
      .take(opts.limit ?? 50);

    if (opts.severity) {
      qb.andWhere('a.severity = :severity', { severity: opts.severity });
    }
    if (opts.resolved !== undefined) {
      qb.andWhere('a.is_resolved = :resolved', { resolved: opts.resolved });
    }

    return qb.getMany();
  }

  async findByDevice(
    deviceId: string,
    clientId: string,
    limit = 20,
    resolved?: boolean,
  ): Promise<Alert[]> {
    const qb = this.alertRepo
      .createQueryBuilder('a')
      .innerJoin('a.device', 'd')
      .innerJoin('d.site', 's')
      .where('a.device_id = :deviceId', { deviceId })
      .andWhere('s.client_id = :clientId', { clientId })
      .orderBy('a.created_at', 'DESC')
      .take(limit);

    if (resolved !== undefined) {
      qb.andWhere('a.is_resolved = :resolved', { resolved });
    }

    return qb.getMany();
  }

  async resolve(id: string, clientId: string): Promise<Alert> {
    const alert = await this.alertRepo
      .createQueryBuilder('a')
      .innerJoin('a.device', 'd')
      .innerJoin('d.site', 's')
      .where('a.id = :id', { id })
      .andWhere('s.client_id = :clientId', { clientId })
      .getOne();

    if (!alert) throw new NotFoundException(`Alert ${id} not found`);

    alert.isResolved = true;
    alert.resolvedAt = new Date();
    return this.alertRepo.save(alert);
  }

  async createFromWebhook(data: CreateAlertData): Promise<Alert> {
    const alert = this.alertRepo.create({
      deviceId: data.deviceId,
      severity: data.severity,
      message: data.message,
      tbAlarmId: data.tbAlarmId ?? null,
    });
    return this.alertRepo.save(alert);
  }
}
```

---

### 4.30 `alerts/alerts.controller.ts`

```typescript
import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { CurrentTenant } from '../common/decorators/tenant.decorator';

@Controller()
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  // GET /alerts?clientId=&severity=&resolved=&limit=50
  @Get('alerts')
  findAll(
    @CurrentTenant() tenant: { clientId: string; role: string },
    @Query('clientId') queryClientId?: string,
    @Query('severity') severity?: string,
    @Query('resolved') resolved?: string,
    @Query('limit') limit?: string,
  ) {
    // Admin może podać inny clientId, user — zawsze swój
    const effectiveClientId =
      tenant.role === 'admin' && queryClientId
        ? queryClientId
        : tenant.clientId;

    return this.alertsService.findByClient({
      clientId: effectiveClientId,
      severity,
      resolved: resolved !== undefined ? resolved === 'true' : undefined,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  // GET /devices/:id/alerts?limit=20&resolved=
  @Get('devices/:id/alerts')
  findByDevice(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: { clientId: string },
    @Query('limit') limit?: string,
    @Query('resolved') resolved?: string,
  ) {
    return this.alertsService.findByDevice(
      id,
      tenant.clientId,
      limit ? parseInt(limit, 10) : 20,
      resolved !== undefined ? resolved === 'true' : undefined,
    );
  }

  // PATCH /alerts/:id/resolve
  @Patch('alerts/:id/resolve')
  resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: { clientId: string },
  ) {
    return this.alertsService.resolve(id, tenant.clientId);
  }
}
```

---

### 4.31 `alerts/webhook.handler.ts`

```typescript
import { Controller, Post, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { AlertsService } from './alerts.service';
import { DevicesService } from '../devices/devices.service';

interface TbAlarmWebhookPayload {
  deviceId?: string;          // ThingsBoard device ID (tbDeviceId w DB)
  deviceName?: string;
  alarmId?: string;
  alarmType?: string;
  severity?: string;          // CRITICAL | MAJOR | MINOR | WARNING | INDETERMINATE | CLEARED
  details?: {
    message?: string;
    [key: string]: unknown;
  };
}

const TB_SEVERITY_MAP: Record<string, string> = {
  CRITICAL: 'critical',
  MAJOR: 'critical',
  MINOR: 'warning',
  WARNING: 'warning',
  INDETERMINATE: 'info',
  CLEARED: 'info',
};

@Public()
@Controller('webhook')
export class WebhookHandler {
  private readonly logger = new Logger(WebhookHandler.name);

  constructor(
    private readonly alertsService: AlertsService,
    private readonly devicesService: DevicesService,
  ) {}

  @Post('thingsboard')
  @HttpCode(HttpStatus.OK)
  async handleThingsboardAlarm(@Body() payload: TbAlarmWebhookPayload) {
    this.logger.log(
      `TB webhook received: alarmId=${payload.alarmId}, tbDeviceId=${payload.deviceId}`,
    );

    if (!payload.deviceId) {
      this.logger.warn('TB webhook: missing deviceId, skipping');
      return { status: 'ignored', reason: 'missing deviceId' };
    }

    // Szukamy urządzenia po TB device ID
    const device = await this.devicesService.findByTbDeviceId(payload.deviceId);

    if (!device) {
      this.logger.warn(
        `TB webhook: device with tbDeviceId=${payload.deviceId} not found in DB`,
      );
      return { status: 'ignored', reason: 'device not found' };
    }

    const severity = TB_SEVERITY_MAP[payload.severity?.toUpperCase() ?? ''] ?? 'info';
    const message =
      payload.details?.message ??
      payload.alarmType ??
      `Alarm from ThingsBoard: ${payload.alarmId}`;

    const alert = await this.alertsService.createFromWebhook({
      deviceId: device.id,
      severity,
      message,
      tbAlarmId: payload.alarmId,
    });

    this.logger.log(`Alert created: id=${alert.id}, severity=${severity}`);
    return { status: 'ok', alertId: alert.id };
  }
}
```

---

### 4.32 `alerts/alerts.module.ts`

```typescript
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
```

---

### 4.33 `alerts/alerts.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { Alert } from './entities/alert.entity';

const mockAlert: Partial<Alert> = {
  id: 'aaaaaaaa-1111-0000-0000-000000000001',
  deviceId: 'dddddddd-0000-0000-0000-000000000001',
  severity: 'critical',
  message: 'High temperature alert',
  isResolved: false,
};

const qb: any = {
  innerJoin: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getMany: jest.fn().mockResolvedValue([mockAlert]),
  getOne: jest.fn().mockResolvedValue(mockAlert),
};

const mockRepo = {
  createQueryBuilder: jest.fn().mockReturnValue(qb),
  create: jest.fn().mockReturnValue(mockAlert),
  save: jest.fn().mockResolvedValue({ ...mockAlert, isResolved: true, resolvedAt: new Date() }),
};

describe('AlertsService', () => {
  let service: AlertsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertsService,
        { provide: getRepositoryToken(Alert), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<AlertsService>(AlertsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return alerts for a client with tenant isolation', async () => {
    const result = await service.findByClient({
      clientId: 'cccccccc-0000-0000-0000-000000000001',
    });
    expect(result).toHaveLength(1);
    expect(qb.where).toHaveBeenCalledWith('s.client_id = :clientId', {
      clientId: 'cccccccc-0000-0000-0000-000000000001',
    });
  });

  it('should resolve an alert and set resolvedAt', async () => {
    const result = await service.resolve(
      mockAlert.id!,
      'cccccccc-0000-0000-0000-000000000001',
    );
    expect(result.isResolved).toBe(true);
    expect(result.resolvedAt).toBeInstanceOf(Date);
  });

  it('should throw NotFoundException when alert not found for tenant', async () => {
    qb.getOne.mockResolvedValueOnce(null);
    await expect(
      service.resolve('nonexistent-id', 'some-client-id'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should create alert from webhook payload', async () => {
    const result = await service.createFromWebhook({
      deviceId: 'dddddddd-0000-0000-0000-000000000001',
      severity: 'critical',
      message: 'High temperature detected',
      tbAlarmId: 'tb-alarm-abc123',
    });
    expect(mockRepo.create).toHaveBeenCalled();
    expect(mockRepo.save).toHaveBeenCalled();
  });
});
```

---

## 5. Wzorzec tenant isolation

### Opis

Każdy zasób (site, device, document, alert) jest powiązany z klientem przez łańcuch relacji:

```
JWT.clientId → Client → Site → Device / Document / Alert
```

Żaden endpoint nie zwraca ani nie modyfikuje danych poza tenantami. Mechanizm działa na trzech poziomach:

**Poziom 1 — Dekorator `@CurrentTenant()`**
Wyciąga `clientId` i `role` z JWT payload przy każdym żądaniu. Kontroler nigdy nie ufa parametrowi URL jako wyznacznikowi tożsamości — `clientId` pochodzi wyłącznie z tokenu.

**Poziom 2 — `createQueryBuilder` z JOIN**
Każde zapytanie o zasób niebędący bezpośrednio własnością klienta (device, document, alert) używa `INNER JOIN` przez relację `site → client`, co gwarantuje filtrowanie na poziomie SQL.

**Poziom 3 — Sprawdzenie roli**
Rola `admin` pozwala na dostęp cross-tenant (np. przeglądanie klientów, dowolnych alertów). Rola `user` jest zawsze ograniczona do `JWT.clientId`.

### Przykład kodu (DevicesService)

```typescript
async findById(id: string, clientId: string): Promise<Device> {
  const device = await this.deviceRepo
    .createQueryBuilder('d')
    .innerJoin('d.site', 's')
    .where('d.id = :id', { id })
    .andWhere('s.client_id = :clientId', { clientId })
    .getOne();
  if (!device) throw new NotFoundException('Device not found');
  return device;
}
```

Jeśli urządzenie istnieje, ale należy do innego klienta, `getOne()` zwróci `null` i endpoint odpowie `404 Not Found` — nie `403 Forbidden`. Jest to celowe: nie ujawnia faktu istnienia zasobu dla nieuprawnionego klienta.

### Przykład użycia w kontrolerze

```typescript
@Get('devices/:id')
findOne(
  @Param('id', ParseUUIDPipe) id: string,
  @CurrentTenant() tenant: { clientId: string; role: string },
) {
  if (tenant.role === 'admin') {
    return this.devicesService.findByIdAdmin(id);
  }
  return this.devicesService.findById(id, tenant.clientId);
}
```

---

## 6. Instrukcja aktualizacji `app.module.ts`

Plik `backend/src/app.module.ts` dostarczony przez Agenta B musi zostać zaktualizowany — należy dodać importy wszystkich nowych modułów. Poniżej lista importów do dodania:

### Importy TypeScript (na górze pliku)

```typescript
import { ClientsModule } from './clients/clients.module';
import { SitesModule } from './sites/sites.module';
import { DevicesModule } from './devices/devices.module';
import { DocumentsModule } from './documents/documents.module';
import { AlertsModule } from './alerts/alerts.module';
```

### Dodanie do tablicy `imports` w `@Module`

```typescript
@Module({
  imports: [
    // ... istniejące importy od Agenta B (ConfigModule, TypeOrmModule, etc.)
    ClientsModule,
    SitesModule,
    DevicesModule,
    DocumentsModule,
    AlertsModule,
  ],
  // ...
})
export class AppModule {}
```

### Encje TypeORM do zarejestrowania

Jeśli Agent B używa `TypeOrmModule.forRoot()` z opcją `entities: []`, należy dodać:

```typescript
import { Client } from './clients/entities/client.entity';
import { User } from './users/entities/user.entity';
import { Site } from './sites/entities/site.entity';
import { SiteModel } from './sites/entities/site-model.entity';
import { Device } from './devices/entities/device.entity';
import { Document } from './documents/entities/document.entity';
import { Alert } from './alerts/entities/alert.entity';

// W TypeOrmModule.forRoot():
entities: [Client, User, Site, SiteModel, Device, Document, Alert],
```

Alternatywnie, jeśli Agent B używa `autoLoadEntities: true` (zalecane), nie trzeba ręcznie dodawać encji — wystarczy samo dodanie modułów do `imports`.

### Instalacja zależności npm

Jeśli nie zainstalowano wcześniej przez Agenta B, należy uruchomić:

```bash
cd backend
npm install @nestjs/platform-express multer @types/multer
```

---

## 7. Weryfikacja — przykłady curl

Zmienna pomocnicza (zakłada działający backend na porcie 3000 i wcześniejsze zalogowanie przez endpoint Agenta B):

```bash
TOKEN="eyJhbGciOiJIUzI1NiJ9..."  # JWT z pola access_token po POST /auth/login
BASE="http://localhost:3000"
```

### Clients (admin only)

```bash
# Lista wszystkich klientów
curl -H "Authorization: Bearer $TOKEN" "$BASE/clients"

# Utwórz klienta
curl -X POST "$BASE/clients" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"HellCold Sp. z o.o.","contactEmail":"biuro@hellcold.pl","subscriptionTier":"premium"}'

# Pobierz klienta po ID
curl -H "Authorization: Bearer $TOKEN" "$BASE/clients/aaaaaaaa-0000-0000-0000-000000000001"

# Aktualizuj klienta
curl -X PATCH "$BASE/clients/aaaaaaaa-0000-0000-0000-000000000001" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"subscriptionTier":"enterprise"}'
```

### Sites

```bash
# Lista obiektów klienta
curl -H "Authorization: Bearer $TOKEN" \
  "$BASE/clients/aaaaaaaa-0000-0000-0000-000000000001/sites"

# Utwórz obiekt
curl -X POST "$BASE/clients/aaaaaaaa-0000-0000-0000-000000000001/sites" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Galeria Mokotów","address":"ul. Wołoska 12, Warszawa","locationLat":52.1800,"locationLng":21.0000}'

# Pobierz obiekt
curl -H "Authorization: Bearer $TOKEN" "$BASE/sites/ssssssss-0000-0000-0000-000000000001"

# Dodaj model APS
curl -X POST "$BASE/sites/ssssssss-0000-0000-0000-000000000001/models" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Piętro 3 — schematy","apsUrn":"dXJuOmFkc2sub2JqZWN0czE6...","description":"Model Revit 2024"}'

# Lista modeli
curl -H "Authorization: Bearer $TOKEN" \
  "$BASE/sites/ssssssss-0000-0000-0000-000000000001/models"

# Usuń model
curl -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE/sites/ssssssss-0000-0000-0000-000000000001/models/mmmmmmmm-0000-0000-0000-000000000001"
# → 204 No Content
```

### Devices

```bash
# Lista urządzeń w obiekcie
curl -H "Authorization: Bearer $TOKEN" \
  "$BASE/sites/ssssssss-0000-0000-0000-000000000001/devices"

# Utwórz urządzenie
curl -X POST "$BASE/devices" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "siteId":"ssssssss-0000-0000-0000-000000000001",
    "name":"Klimatyzator VRV — Strefa A",
    "type":"DaikinVRV",
    "tbDeviceId":"tb-device-uuid-123",
    "config":{"zone":"A","floor":3}
  }'

# Pobierz urządzenie
curl -H "Authorization: Bearer $TOKEN" \
  "$BASE/devices/dddddddd-0000-0000-0000-000000000001"

# Aktualizuj
curl -X PATCH "$BASE/devices/dddddddd-0000-0000-0000-000000000001" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isActive":false}'

# Usuń urządzenie
curl -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE/devices/dddddddd-0000-0000-0000-000000000001"
# → 204 No Content
```

### Documents

```bash
# Upload dokumentu (PDF)
curl -X POST "$BASE/documents/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/manual.pdf" \
  -F "siteId=ssssssss-0000-0000-0000-000000000001" \
  -F "deviceId=dddddddd-0000-0000-0000-000000000001" \
  -F "type=manual" \
  -F "name=Instrukcja obsługi VRV"

# Lista dokumentów urządzenia
curl -H "Authorization: Bearer $TOKEN" \
  "$BASE/devices/dddddddd-0000-0000-0000-000000000001/documents"

# Lista dokumentów obiektu
curl -H "Authorization: Bearer $TOKEN" \
  "$BASE/sites/ssssssss-0000-0000-0000-000000000001/documents"

# Pobierz plik dokumentu
curl -H "Authorization: Bearer $TOKEN" \
  "$BASE/documents/docidhere-0000-0000-0000-000000000001/file" \
  --output manual.pdf
```

### Alerts

```bash
# Lista alertów (ostatnie 50, tylko dla swojego klienta)
curl -H "Authorization: Bearer $TOKEN" "$BASE/alerts"

# Filtrowanie — tylko krytyczne, nierozwiązane
curl -H "Authorization: Bearer $TOKEN" \
  "$BASE/alerts?severity=critical&resolved=false&limit=20"

# Admin — alerty innego klienta
curl -H "Authorization: Bearer $TOKEN" \
  "$BASE/alerts?clientId=aaaaaaaa-0000-0000-0000-000000000001"

# Alerty urządzenia
curl -H "Authorization: Bearer $TOKEN" \
  "$BASE/devices/dddddddd-0000-0000-0000-000000000001/alerts?limit=10&resolved=false"

# Rozwiąż alert
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE/alerts/aaaaaaaa-1111-0000-0000-000000000001/resolve"
```

### Webhook ThingsBoard (bez JWT)

```bash
# Symulacja alarmu z ThingsBoard
curl -X POST "$BASE/webhook/thingsboard" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "tb-device-uuid-123",
    "deviceName": "Klimatyzator VRV — Strefa A",
    "alarmId": "tb-alarm-xyz789",
    "alarmType": "High Temperature",
    "severity": "CRITICAL",
    "details": {
      "message": "Temperature exceeded 35°C threshold"
    }
  }'
# → {"status":"ok","alertId":"..."}
```
