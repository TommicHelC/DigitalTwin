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
