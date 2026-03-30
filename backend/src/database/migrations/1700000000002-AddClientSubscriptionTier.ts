import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClientSubscriptionTier1700000000002 implements MigrationInterface {
  name = 'AddClientSubscriptionTier1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE config.clients
      ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(50) NOT NULL DEFAULT 'basic'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE config.clients DROP COLUMN IF EXISTS subscription_tier
    `);
  }
}
