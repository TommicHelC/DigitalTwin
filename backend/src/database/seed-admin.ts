import 'dotenv/config';
import { AppDataSource } from './data-source';
import * as bcrypt from 'bcrypt';

async function seedAdmin() {
  await AppDataSource.initialize();

  const email = process.env.ADMIN_EMAIL ?? 'admin@hellcold.pl';
  const password = process.env.ADMIN_PASSWORD ?? 'ChangeMe123!';
  const passwordHash = await bcrypt.hash(password, 12);

  await AppDataSource.query(`
    INSERT INTO config.users (email, password_hash, role, client_id, is_active)
    VALUES ($1, $2, 'admin', NULL, TRUE)
    ON CONFLICT (email) DO NOTHING
  `, [email, passwordHash]);

  console.log(`Admin user ready: ${email}`);
  await AppDataSource.destroy();
}

seedAdmin().catch((err) => {
  console.error(err);
  process.exit(1);
});
