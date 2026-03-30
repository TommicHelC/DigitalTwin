import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from './entities/device.entity';
import { Site } from '../sites/entities/site.entity';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
    @InjectRepository(Site)
    private readonly siteRepo: Repository<Site>,
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
    if (role !== 'admin') {
      const site = await this.siteRepo.findOne({ where: { id: dto.siteId } });
      if (!site) throw new NotFoundException(`Site ${dto.siteId} not found`);
      if (site.clientId !== clientId) {
        throw new ForbiddenException(`Site ${dto.siteId} does not belong to your account`);
      }
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
