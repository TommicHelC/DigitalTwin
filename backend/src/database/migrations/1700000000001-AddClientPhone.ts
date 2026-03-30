import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClientPhone1700000000001 implements MigrationInterface {
  name = 'AddClientPhone1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE config.clients
      ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE config.clients DROP COLUMN IF EXISTS contact_phone
    `);
  }
}
