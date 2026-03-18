import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { TelemetryEvent } from './entities/telemetry-event.entity';
import { TelemetryQueryDto, TelemetryPoint } from './dto/telemetry-query.dto';
import { ThingsBoardService } from '../thingsboard/thingsboard.service';

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);

  constructor(
    @InjectRepository(TelemetryEvent)
    private readonly telemetryRepo: Repository<TelemetryEvent>,
    private readonly tbService: ThingsBoardService,
  ) {}

  async query(
    deviceId: string,
    tbDeviceId: string | null,
    dto: TelemetryQueryDto,
  ): Promise<TelemetryPoint[]> {
    const from = new Date(dto.from);
    const to = new Date(dto.to);
    const limit = dto.limit ?? 500;
    const metrics = dto.metrics ? dto.metrics.split(',').map((m) => m.trim()) : [];

    // Strategy 1: local telemetry_events table
    try {
      const qb = this.telemetryRepo
        .createQueryBuilder('te')
        .where('te.deviceId = :deviceId', { deviceId })
        .andWhere('te.ts BETWEEN :from AND :to', { from, to })
        .orderBy('te.ts', 'DESC')
        .limit(limit);

      if (metrics.length > 0) {
        qb.andWhere('te.metricName IN (:...metrics)', { metrics });
      }

      const rows = await qb.getMany();

      if (rows.length > 0) {
        return rows.map((r) => ({
          ts: r.ts.getTime(),
          metric: r.metricName,
          value: r.value,
        }));
      }
    } catch (err) {
      this.logger.warn(`Local telemetry query failed: ${(err as Error).message}`);
    }

    // Strategy 2: fallback to ThingsBoard REST API
    if (!tbDeviceId) {
      this.logger.debug(`No tbDeviceId for device ${deviceId}, skipping TB fallback`);
      return [];
    }

    try {
      const keys = metrics.length > 0 ? metrics : ['temperature', 'setpoint', 'humidity'];
      const tbData = await this.tbService.getTelemetry(
        tbDeviceId,
        keys,
        from.getTime(),
        to.getTime(),
        limit,
      );

      const points: TelemetryPoint[] = [];
      for (const [metric, values] of Object.entries(tbData)) {
        for (const v of values) {
          points.push({ ts: v.ts, metric, value: parseFloat(v.value) });
        }
      }

      points.sort((a, b) => b.ts - a.ts);
      return points.slice(0, limit);
    } catch (err) {
      this.logger.warn(`TB telemetry fallback failed for device ${deviceId}: ${(err as Error).message}`);
      return [];
    }
  }
}
