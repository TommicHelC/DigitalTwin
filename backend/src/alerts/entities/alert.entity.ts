import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Device } from '../../devices/entities/device.entity';

@Entity({ schema: 'config', name: 'alerts' })
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'device_id', type: 'uuid' })
  deviceId: string;

  @Column({ type: 'varchar', length: 50 })
  severity: string; // info | warning | critical

  @Column({ type: 'text' })
  message: string;

  @Column({ name: 'tb_alarm_id', type: 'varchar', length: 255, nullable: true })
  tbAlarmId: string | null;

  @Column({ name: 'dataverse_case_id', type: 'varchar', length: 255, nullable: true })
  dataverseCaseId: string | null;

  @Column({ name: 'is_resolved', type: 'boolean', default: false })
  isResolved: boolean;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Device, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'device_id' })
  device: Device;
}
