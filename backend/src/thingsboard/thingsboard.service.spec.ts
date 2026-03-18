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
