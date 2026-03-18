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
