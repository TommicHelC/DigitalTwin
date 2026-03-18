import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Site } from '../../sites/entities/site.entity';
import { Device } from '../../devices/entities/device.entity';

@Entity({ schema: 'config', name: 'documents' })
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'device_id', type: 'uuid', nullable: true })
  deviceId: string | null;

  @Column({ name: 'site_id', type: 'uuid' })
  siteId: string;

  @Column({ type: 'varchar', length: 100 })
  type: string; // DTR | manual | schematic | certificate | photo

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'file_path', type: 'text' })
  filePath: string;

  @CreateDateColumn({ name: 'uploaded_at', type: 'timestamptz' })
  uploadedAt: Date;

  @ManyToOne(() => Site, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'site_id' })
  site: Site;

  @ManyToOne(() => Device, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'device_id' })
  device: Device | null;
}
