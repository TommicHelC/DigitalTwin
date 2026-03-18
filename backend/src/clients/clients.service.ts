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
