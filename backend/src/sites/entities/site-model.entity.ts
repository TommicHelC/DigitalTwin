import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Site } from './site.entity';

@Entity({ schema: 'config', name: 'site_models' })
export class SiteModel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'site_id', type: 'uuid' })
  siteId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'aps_urn', type: 'text' })
  apsUrn: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'uploaded_at', type: 'timestamptz' })
  uploadedAt: Date;

  @ManyToOne(() => Site, (site) => site.models, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'site_id' })
  site: Site;
}
