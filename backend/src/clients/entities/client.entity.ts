import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Site } from '../../sites/entities/site.entity';

@Entity({ schema: 'config', name: 'clients' })
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'contact_email', type: 'varchar', length: 255, nullable: true })
  contactEmail: string | null;

  @Column({ name: 'contact_phone', type: 'varchar', length: 50, nullable: true })
  contactPhone: string | null;

  @Column({ name: 'subscription_tier', type: 'varchar', length: 50, default: 'basic' })
  subscriptionTier: string;

  @Column({ name: 'tb_tenant_id', type: 'varchar', length: 255, nullable: true })
  tbTenantId: string | null;

  @Column({ name: 'daikin_refresh_token', type: 'text', nullable: true, select: false })
  daikinRefreshToken: string | null;

  @Column({ name: 'daikin_access_token', type: 'text', nullable: true, select: false })
  daikinAccessToken: string | null;

  @Column({ name: 'daikin_token_expires_at', type: 'timestamptz', nullable: true })
  daikinTokenExpiresAt: Date | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => Site, (site) => site.client)
  sites: Site[];
}
