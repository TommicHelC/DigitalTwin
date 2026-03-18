import { Column, Entity } from 'typeorm';

// Partition table — no @PrimaryGeneratedColumn, composite PK defined in migration
@Entity({ schema: 'telemetry', name: 'telemetry_events' })
export class TelemetryEvent {
  @Column('uuid')
  deviceId: string;

  @Column({ name: 'metric_name' })
  metricName: string;

  @Column('float8')
  value: number;

  @Column({ type: 'timestamptz', primary: true })
  ts: Date;
}
