import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SiteModel } from '../sites/entities/site-model.entity';

export class CreateSiteModelDto {
  urn: string;
  name: string;
  description?: string;
}

@Injectable()
export class ViewerService {
  private readonly logger = new Logger(ViewerService.name);

  constructor(
    @InjectRepository(SiteModel)
    private readonly siteModelRepo: Repository<SiteModel>,
  ) {}

  async getModelsForSite(siteId: string, clientId: string): Promise<SiteModel[]> {
    return this.siteModelRepo
      .createQueryBuilder('model')
      .innerJoinAndSelect('model.site', 'site')
      .where('model.site_id = :siteId', { siteId })
      .andWhere('site.client_id = :clientId', { clientId })
      .orderBy('model.uploaded_at', 'DESC')
      .getMany();
  }

  async addModel(
    siteId: string,
    clientId: string,
    dto: CreateSiteModelDto,
  ): Promise<SiteModel> {
    const existingSite = await this.siteModelRepo
      .createQueryBuilder('model')
      .innerJoin('model.site', 'site')
      .select('site.id', 'id')
      .where('site.id = :siteId', { siteId })
      .andWhere('site.client_id = :clientId', { clientId })
      .limit(1)
      .getRawOne();

    if (!existingSite) {
      throw new ForbiddenException(`Access denied to site ${siteId}`);
    }

    const model = this.siteModelRepo.create({
      siteId,
      apsUrn: dto.urn,
      name: dto.name,
      description: dto.description ?? null,
    });
    const saved = await this.siteModelRepo.save(model);
    this.logger.log(`Added model ${saved.id} for site ${siteId}`);
    return saved;
  }

  async removeModel(modelId: string, clientId: string): Promise<void> {
    const model = await this.siteModelRepo
      .createQueryBuilder('model')
      .innerJoinAndSelect('model.site', 'site')
      .where('model.id = :modelId', { modelId })
      .andWhere('site.client_id = :clientId', { clientId })
      .getOne();

    if (!model) {
      throw new NotFoundException(`Model ${modelId} not found`);
    }

    await this.siteModelRepo.remove(model);
    this.logger.log(`Removed model ${modelId}`);
  }
}