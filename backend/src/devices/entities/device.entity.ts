import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Site } from '../../sites/entities/site.entity';

export type DeviceType =
  | 'DaikinSplit'
  | 'DaikinVRV'
  | 'ModbusSensor'
  | 'BACnetNode'
  | 'AirHandlingUnit'
  | 'EnergyMeter';

@Entity({ schema: 'config', name: 'devices' })
export class Device {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'site_id', type: 'uuid' })
  siteId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 100 })
  type: DeviceType;

  @Column({ name: 'tb_device_id', type: 'varchar', length: 255, nullable: true })
  tbDeviceId: string | null;

  @Column({ name: 'daikin_device_id', type: 'varchar', length: 255, nullable: true })
  daikinDeviceId: string | null;

  @Column({ type: 'jsonb', default: '{}' })
  config: Record<string, unknown>;

  @Column({ name: 'aps_object_id', type: 'integer', nullable: true })
  apsObjectId: number | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Site, (site) => site.devices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'site_id' })
  site: Site;
}
