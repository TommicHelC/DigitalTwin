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
