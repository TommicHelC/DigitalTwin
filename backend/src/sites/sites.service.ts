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
