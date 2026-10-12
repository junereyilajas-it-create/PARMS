import { pool } from '../config/db.js';

export async function up() {
  const [cols] = await pool.query('DESCRIBE generated_certificates');
  const existingCols = cols.map(c => c.Field);

  if (!existingCols.includes('custom_owner_name')) {
    await pool.query('ALTER TABLE generated_certificates ADD COLUMN custom_owner_name VARCHAR(255) NULL');
  }
  if (!existingCols.includes('custom_tax_declaration_no')) {
    await pool.query('ALTER TABLE generated_certificates ADD COLUMN custom_tax_declaration_no VARCHAR(100) NULL');
  }
  if (!existingCols.includes('signer_name')) {
    await pool.query('ALTER TABLE generated_certificates ADD COLUMN signer_name VARCHAR(150) NULL');
  }
  if (!existingCols.includes('signer_title')) {
    await pool.query('ALTER TABLE generated_certificates ADD COLUMN signer_title VARCHAR(150) NULL');
  }
  if (!existingCols.includes('or_number')) {
    await pool.query('ALTER TABLE generated_certificates ADD COLUMN or_number VARCHAR(100) NULL');
  }
}
