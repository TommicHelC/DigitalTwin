import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { Client } from '../../clients/entities/client.entity';
import { DaikinService } from './daikin.service';

@Injectable()
export class DaikinScheduler {
  private readonly logger = new Logger(DaikinScheduler.name);

  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    private readonly daikinService: DaikinService,
  ) {}

  @Cron('0 */5 * * * *') // every 5 minutes
  async syncAllClients(): Promise<void> {
    this.logger.debug('Starting Daikin sync for all clients...');

    const clients = await this.clientRepo.find({
      where: { daikinRefreshToken: Not(IsNull()) },
    });

    this.logger.debug(`Found ${clients.length} clients with Daikin tokens`);

    const results = await Promise.allSettled(
      clients.map((client) => this.daikinService.syncClientDevices(client)),
    );

    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0) {
      this.logger.warn(`Daikin sync: ${failed}/${clients.length} clients failed`);
    } else {
      this.logger.debug(`Daikin sync completed for ${clients.length} clients`);
    }
  }
}
