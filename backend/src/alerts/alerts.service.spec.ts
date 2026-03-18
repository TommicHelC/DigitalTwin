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
