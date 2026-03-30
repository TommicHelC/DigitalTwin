import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixSchemaSync1700000000003 implements MigrationInterface {
  name = 'FixSchemaSync1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── clients: missing columns ─────────────────────────────────────────────
    await queryRunner.query(`ALTER TABLE config.clients ADD COLUMN IF NOT EXISTS tb_tenant_id VARCHAR(255)`);
    await queryRunner.query(`ALTER TABLE config.clients ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE`);

    // ── sites: rename latitude/longitude → location_lat/location_lng ─────────
    await queryRunner.query(`ALTER TABLE config.sites RENAME COLUMN latitude TO location_lat`);
    await queryRunner.query(`ALTER TABLE config.sites RENAME COLUMN longitude TO location_lng`);

    // ── devices: remove serial_number (not in entity), add aps_object_id ─────
    await queryRunner.query(`ALTER TABLE config.devices DROP COLUMN IF EXISTS serial_number`);
    await queryRunner.query(`ALTER TABLE config.devices ADD COLUMN IF NOT EXISTS aps_object_id INTEGER`);

    // ── alerts: fix column mismatches ────────────────────────────────────────
    // d365_case_id → dataverse_case_id
    await queryRunner.query(`ALTER TABLE config.alerts RENAME COLUMN d365_case_id TO dataverse_case_id`);
    // resolved_by → is_resolved
    await queryRunner.query(`ALTER TABLE config.alerts DROP COLUMN IF EXISTS resolved_by`);
    await queryRunner.query(`ALTER TABLE config.alerts ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN NOT NULL DEFAULT FALSE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE config.alerts ADD COLUMN IF NOT EXISTS resolved_by VARCHAR(255)`);
    await queryRunner.query(`ALTER TABLE config.alerts DROP COLUMN IF EXISTS is_resolved`);
    await queryRunner.query(`ALTER TABLE config.alerts RENAME COLUMN dataverse_case_id TO d365_case_id`);
    await queryRunner.query(`ALTER TABLE config.devices DROP COLUMN IF EXISTS aps_object_id`);
    await queryRunner.query(`ALTER TABLE config.devices ADD COLUMN IF NOT EXISTS serial_number VARCHAR(255)`);
    await queryRunner.query(`ALTER TABLE config.sites RENAME COLUMN location_lat TO latitude`);
    await queryRunner.query(`ALTER TABLE config.sites RENAME COLUMN location_lng TO longitude`);
    await queryRunner.query(`ALTER TABLE config.clients DROP COLUMN IF EXISTS tb_tenant_id`);
    await queryRunner.query(`ALTER TABLE config.clients DROP COLUMN IF EXISTS is_active`);
  }
}
