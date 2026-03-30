import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1700000000000 implements MigrationInterface {
  name = 'InitSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Schemas ─────────────────────────────────────────────────────────────
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS config`);
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS telemetry`);

    // ── clients ─────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS config.clients (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name            VARCHAR(255) NOT NULL,
        nip             VARCHAR(20),
        contact_email   VARCHAR(255),
        contact_phone   VARCHAR(50),
        daikin_access_token   TEXT,
        daikin_refresh_token  TEXT,
        daikin_token_expires_at TIMESTAMPTZ,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── users ────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS config.users (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email           VARCHAR(255) NOT NULL UNIQUE,
        password_hash   VARCHAR(255) NOT NULL,
        role            VARCHAR(50)  NOT NULL DEFAULT 'user',
        client_id       UUID REFERENCES config.clients(id) ON DELETE SET NULL,
        is_active       BOOLEAN NOT NULL DEFAULT TRUE,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── sites ────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS config.sites (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name            VARCHAR(255) NOT NULL,
        address         VARCHAR(500),
        latitude        DECIMAL(10,7),
        longitude       DECIMAL(10,7),
        client_id       UUID NOT NULL REFERENCES config.clients(id) ON DELETE CASCADE,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── site_models ──────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS config.site_models (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id         UUID NOT NULL REFERENCES config.sites(id) ON DELETE CASCADE,
        name            VARCHAR(255) NOT NULL,
        aps_urn         VARCHAR(500) NOT NULL,
        is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── devices ──────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS config.devices (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name            VARCHAR(255) NOT NULL,
        type            VARCHAR(100) NOT NULL,
        serial_number   VARCHAR(255),
        tb_device_id    VARCHAR(255),
        daikin_device_id VARCHAR(255),
        site_id         UUID NOT NULL REFERENCES config.sites(id) ON DELETE CASCADE,
        config          JSONB NOT NULL DEFAULT '{}',
        is_active       BOOLEAN NOT NULL DEFAULT TRUE,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── documents ────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS config.documents (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name            VARCHAR(255) NOT NULL,
        filename        VARCHAR(500) NOT NULL,
        mime_type       VARCHAR(100),
        size_bytes      INTEGER,
        site_id         UUID REFERENCES config.sites(id) ON DELETE CASCADE,
        device_id       UUID REFERENCES config.devices(id) ON DELETE CASCADE,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── alerts ───────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS config.alerts (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        device_id       UUID NOT NULL REFERENCES config.devices(id) ON DELETE CASCADE,
        severity        VARCHAR(50) NOT NULL,
        message         TEXT NOT NULL,
        tb_alarm_id     VARCHAR(255),
        d365_case_id    VARCHAR(255),
        resolved_at     TIMESTAMPTZ,
        resolved_by     VARCHAR(255),
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── telemetry_events ─────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS telemetry.telemetry_events (
        device_id       UUID NOT NULL,
        metric_name     VARCHAR(100) NOT NULL,
        value           FLOAT8 NOT NULL,
        recorded_at     TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (device_id, metric_name, recorded_at)
      ) PARTITION BY RANGE (recorded_at)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_telemetry_device_time
        ON telemetry.telemetry_events (device_id, recorded_at DESC)
    `);

    // ── Indexes ──────────────────────────────────────────────────────────────
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_devices_site ON config.devices(site_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_devices_tb ON config.devices(tb_device_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_alerts_device ON config.alerts(device_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_alerts_severity ON config.alerts(severity)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_sites_client ON config.sites(client_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP SCHEMA telemetry CASCADE`);
    await queryRunner.query(`DROP SCHEMA config CASCADE`);
  }
}
