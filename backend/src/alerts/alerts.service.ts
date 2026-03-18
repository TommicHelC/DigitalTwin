import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert } from './entities/alert.entity';

export interface FindAlertsOptions {
  clientId: string;
  severity?: string;
  resolved?: boolean;
  limit?: number;
}

export interface CreateAlertData {
  deviceId: string;
  severity: string;
  message: string;
  tbAlarmId?: string;
}

@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(Alert)
    private readonly alertRepo: Repository<Alert>,
  ) {}

  async findByClient(opts: FindAlertsOptions): Promise<Alert[]> {
    const qb = this.alertRepo
      .createQueryBuilder('a')
      .innerJoin('a.device', 'd')
      .innerJoin('d.site', 's')
      .where('s.client_id = :clientId', { clientId: opts.clientId })
      .orderBy('a.created_at', 'DESC')
      .take(opts.limit ?? 50);

    if (opts.severity) {
      qb.andWhere('a.severity = :severity', { severity: opts.severity });
    }
    if (opts.resolved !== undefined) {
      qb.andWhere('a.is_resolved = :resolved', { resolved: opts.resolved });
    }

    return qb.getMany();
  }

  async findByDevice(
    deviceId: string,
    clientId: string,
    limit = 20,
    resolved?: boolean,
  ): Promise<Alert[]> {
    const qb = this.alertRepo
      .createQueryBuilder('a')
      .innerJoin('a.device', 'd')
      .innerJoin('d.site', 's')
      .where('a.device_id = :deviceId', { deviceId })
      .andWhere('s.client_id = :clientId', { clientId })
      .orderBy('a.created_at', 'DESC')
      .take(limit);

    if (resolved !== undefined) {
      qb.andWhere('a.is_resolved = :resolved', { resolved });
    }

    return qb.getMany();
  }

  async resolve(id: string, clientId: string): Promise<Alert> {
    const alert = await this.alertRepo
      .createQueryBuilder('a')
      .innerJoin('a.device', 'd')
      .innerJoin('d.site', 's')
      .where('a.id = :id', { id })
      .andWhere('s.client_id = :clientId', { clientId })
      .getOne();

    if (!alert) throw new NotFoundException(`Alert ${id} not found`);

    alert.isResolved = true;
    alert.resolvedAt = new Date();
    return this.alertRepo.save(alert);
  }

  async createFromWebhook(data: CreateAlertData): Promise<Alert> {
    const alert = this.alertRepo.create({
      deviceId: data.deviceId,
      severity: data.severity,
      message: data.message,
      tbAlarmId: data.tbAlarmId ?? null,
    });
    return this.alertRepo.save(alert);
  }
}
