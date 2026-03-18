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
