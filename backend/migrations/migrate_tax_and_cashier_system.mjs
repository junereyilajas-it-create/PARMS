import { pool } from '../config/db.js';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

async function migrateTaxAndCashierSystem() {
  console.log('=== STARTING TAX DECLARATION, RPT BILLING & CASHIER MIGRATION ===');
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 1. BACKUP CURRENT STATE
    const timestamp = Date.now();
    const backupDir = path.join(process.cwd(), 'backend', 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const [existingUsers] = await conn.query('SELECT user_id, username, role FROM users');
    let existingTDs = [];
    try {
      const [tdRows] = await conn.query('SELECT * FROM tax_declarations');
      existingTDs = tdRows;
    } catch {
      // Table might not exist or be altered
    }

    const backupPayload = {
      timestamp,
      existingUsers,
      existingTDs
    };
    const backupPath = path.join(backupDir, `backup_before_tax_cashier_${timestamp}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(backupPayload, null, 2));
    console.log(`[BACKUP] Saved pre-migration snapshot to ${backupPath}`);

    // 2. EXPAND users.role ENUM TO INCLUDE 'cashier'
    console.log('[SCHEMA] Altering users.role to include cashier...');
    await conn.query(`
      ALTER TABLE users 
      MODIFY COLUMN role ENUM('super_admin', 'admin', 'assessor', 'staff', 'client', 'cashier') 
      NOT NULL DEFAULT 'staff'
    `);

    // 3. EXPAND role_permissions.role ENUM TO INCLUDE 'cashier'
    console.log('[SCHEMA] Altering role_permissions.role to include cashier...');
    await conn.query(`
      ALTER TABLE role_permissions 
      MODIFY COLUMN role ENUM('super_admin', 'admin', 'assessor', 'staff', 'client', 'cashier') 
      NOT NULL
    `);

    // 4. ADD NEW TAX & CASHIER PERMISSIONS INTO permissions TABLE
    console.log('[PERMISSIONS] Adding Tax Declaration, Billing, and Cashier permissions...');
    const newPermissions = [
      // Tax Declarations
      ['VIEW_TAX_DECLARATION', 'View property tax declarations', 'Tax Declarations'],
      ['CREATE_TAX_DECLARATION', 'Encode and prepare draft tax declarations', 'Tax Declarations'],
      ['APPROVE_TAX_DECLARATION', 'Review, approve, and issue tax declarations', 'Tax Declarations'],
      ['CANCEL_TAX_DECLARATION', 'Cancel or supersede tax declarations', 'Tax Declarations'],
      
      // Tax Billing
      ['VIEW_TAX_BILL', 'View real property tax bills and statements', 'Tax Billing'],
      ['CREATE_TAX_BILL', 'Compute and generate real property tax bills', 'Tax Billing'],
      ['APPROVE_TAX_BILL', 'Approve tax bills for cashier collection', 'Tax Billing'],
      ['ADJUST_TAX_BILL', 'Adjust or apply authorized rebates/penalties to bills', 'Tax Billing'],
      ['CANCEL_TAX_BILL', 'Cancel real property tax bills', 'Tax Billing'],

      // Cashier Collection
      ['COLLECT_TAX_PAYMENT', 'Record received payments and issue official receipts', 'Cashier Collection'],
      ['VIEW_TAX_PAYMENT', 'View collection records and official receipt history', 'Cashier Collection'],
      ['REVERSE_TAX_PAYMENT', 'Request or approve payment corrections and reversals', 'Cashier Collection'],
      ['RECONCILE_TAX_COLLECTIONS', 'Perform daily cashier collection reconciliation', 'Cashier Collection'],

      // Tax Configuration
      ['MANAGE_TAX_CONFIG', 'Configure SMV, tax rates, and assessment levels', 'Tax Configuration'],
      ['VERIFY_TAX_CONFIG', 'Verify and upload municipal legal ordinances and rules', 'Tax Configuration'],
      ['APPROVE_TAX_CONFIG', 'Approve verified municipal tax rules for billing use', 'Tax Configuration']
    ];

    for (const [permName, permDesc, permCat] of newPermissions) {
      await conn.query(`
        INSERT INTO permissions (permission_name, description, category)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE description = VALUES(description), category = VALUES(category)
      `, [permName, permDesc, permCat]);
    }

    // Super Admin:
    for (const [permName] of newPermissions) {
      await conn.query(`
        INSERT IGNORE INTO role_permissions (role, permission_name)
        VALUES ('super_admin', ?)
      `, [permName]);
    }

    // Admin / Head Assessor:
    const adminPerms = [
      'VIEW_TAX_DECLARATION', 'CREATE_TAX_DECLARATION', 'APPROVE_TAX_DECLARATION', 'CANCEL_TAX_DECLARATION',
      'VIEW_TAX_BILL', 'CREATE_TAX_BILL', 'APPROVE_TAX_BILL', 'ADJUST_TAX_BILL', 'CANCEL_TAX_BILL',
      'VIEW_TAX_PAYMENT', 'RECONCILE_TAX_COLLECTIONS',
      'MANAGE_TAX_CONFIG', 'VERIFY_TAX_CONFIG', 'APPROVE_TAX_CONFIG'
    ];
    for (const p of adminPerms) {
      await conn.query(`INSERT IGNORE INTO role_permissions (role, permission_name) VALUES ('admin', ?)`, [p]);
    }

    // Staff:
    const staffPerms = [
      'VIEW_TAX_DECLARATION', 'CREATE_TAX_DECLARATION',
      'VIEW_TAX_BILL',
      'VIEW_TAX_PAYMENT'
    ];
    for (const p of staffPerms) {
      await conn.query(`INSERT IGNORE INTO role_permissions (role, permission_name) VALUES ('staff', ?)`, [p]);
    }

    // Cashier:
    const cashierPerms = [
      'VIEW_TAX_DECLARATION',
      'VIEW_TAX_BILL',
      'COLLECT_TAX_PAYMENT', 'VIEW_TAX_PAYMENT', 'REVERSE_TAX_PAYMENT', 'RECONCILE_TAX_COLLECTIONS'
    ];
    for (const p of cashierPerms) {
      await conn.query(`INSERT IGNORE INTO role_permissions (role, permission_name) VALUES ('cashier', ?)`, [p]);
    }

    // Client / Owner:
    const clientPerms = [
      'VIEW_TAX_DECLARATION',
      'VIEW_TAX_BILL',
      'VIEW_TAX_PAYMENT'
    ];
    for (const p of clientPerms) {
      await conn.query(`INSERT IGNORE INTO role_permissions (role, permission_name) VALUES ('client', ?)`, [p]);
    }

    // 5. SEED CASHIER ACCOUNT IF NOT EXISTS
    console.log('[USERS] Ensuring official Cashier user exists...');
    const [cashierRows] = await conn.query("SELECT user_id FROM users WHERE username = 'cashier_lagonglong' OR role = 'cashier'");
    if (cashierRows.length === 0) {
      const passwordHash = await bcrypt.hash('Password123!', 10);
      await conn.query(`
        INSERT INTO users (first_name, last_name, username, email, password_hash, role, status)
        VALUES ('Lourdes', 'Magno', 'cashier_lagonglong', 'cashier@lagonglong.gov.ph', ?, 'cashier', 'active')
      `, [passwordHash]);
      console.log('  ✓ Created default Cashier account: cashier_lagonglong / Password123!');
    } else {
      console.log('  ✓ Cashier account already exists.');
    }

    // 6. ENHANCE / RESTRUCTURE tax_declarations TABLE
    console.log('[SCHEMA] Upgrading tax_declarations table...');
    await conn.query('DROP TABLE IF EXISTS tax_bill_items');
    await conn.query('DROP TABLE IF EXISTS payment_transactions');
    await conn.query('DROP TABLE IF EXISTS tax_bills');
    await conn.query('DROP TABLE IF EXISTS tax_declarations');

    await conn.query(`
      CREATE TABLE tax_declarations (
        tax_declaration_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        declaration_number VARCHAR(100) NOT NULL UNIQUE,
        property_type ENUM('lot', 'building', 'property') NOT NULL DEFAULT 'lot',
        target_id_int INT UNSIGNED NOT NULL,
        target_id_str VARCHAR(80) NOT NULL,
        property_id INT UNSIGNED NOT NULL,
        property_code VARCHAR(50) DEFAULT NULL,
        owner_id INT UNSIGNED NOT NULL,
        assessment_type ENUM('lot', 'building', 'property') NOT NULL DEFAULT 'lot',
        assessment_id INT UNSIGNED NOT NULL,
        classification VARCHAR(50) NOT NULL DEFAULT 'Residential',
        actual_use VARCHAR(80) NOT NULL DEFAULT 'Residential',
        land_area DECIMAL(14,2) DEFAULT NULL,
        building_area DECIMAL(14,2) DEFAULT NULL,
        market_value DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        assessment_level DECIMAL(6,2) NOT NULL DEFAULT 20.00,
        assessed_value DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        tax_year YEAR NOT NULL,
        effectivity_date DATE NOT NULL,
        issue_date DATE DEFAULT NULL,
        status ENUM('draft', 'pending_review', 'returned_for_correction', 'approved', 'issued', 'superseded', 'cancelled') NOT NULL DEFAULT 'draft',
        prepared_by_user_id INT UNSIGNED NOT NULL,
        approved_by_user_id INT UNSIGNED DEFAULT NULL,
        approval_date DATETIME DEFAULT NULL,
        correction_reason TEXT DEFAULT NULL,
        previous_td_id INT UNSIGNED DEFAULT NULL,
        remarks TEXT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_td_prop (property_id),
        INDEX idx_td_owner (owner_id),
        INDEX idx_td_status (status),
        INDEX idx_td_year (tax_year),
        INDEX idx_td_target (target_id_str),
        CONSTRAINT fk_td_prop FOREIGN KEY (property_id) REFERENCES properties(property_id) ON DELETE RESTRICT,
        CONSTRAINT fk_td_owner FOREIGN KEY (owner_id) REFERENCES property_owners(owner_id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 7. CREATE tax_configurations TABLE
    console.log('[SCHEMA] Creating tax_configurations table...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS tax_configurations (
        config_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        category ENUM('smv', 'assessment_level', 'tax_rate', 'sef_levy', 'discount', 'penalty_interest', 'numbering_format') NOT NULL,
        rule_code VARCHAR(80) NOT NULL UNIQUE,
        rule_name VARCHAR(150) NOT NULL,
        property_classification VARCHAR(50) DEFAULT 'ALL',
        actual_use VARCHAR(80) DEFAULT NULL,
        value_numeric DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
        value_json JSON DEFAULT NULL,
        tax_year YEAR DEFAULT NULL,
        legal_reference VARCHAR(255) DEFAULT NULL,
        source_document VARCHAR(255) DEFAULT NULL,
        verification_status ENUM('not_configured', 'awaiting_documents', 'pending_verification', 'pending_approval', 'approved', 'active', 'expired', 'superseded') NOT NULL DEFAULT 'pending_verification',
        is_demo BOOLEAN NOT NULL DEFAULT FALSE,
        verified_by_user_id INT UNSIGNED DEFAULT NULL,
        verified_at DATETIME DEFAULT NULL,
        approved_by_user_id INT UNSIGNED DEFAULT NULL,
        approved_at DATETIME DEFAULT NULL,
        effective_start_date DATE NOT NULL,
        effective_end_date DATE DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_tc_cat (category),
        INDEX idx_tc_status (verification_status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 8. SEED STANDARD STATUTORY & MUNICIPAL TAX CONFIGURATIONS
    console.log('[DATA] Seeding verified municipal tax configuration templates...');
    const defaultTaxConfigs = [
      {
        category: 'tax_rate',
        rule_code: 'RPT_BASIC_RATE_LAGONGLONG',
        rule_name: 'Basic Real Property Tax (RPT) Rate',
        property_classification: 'ALL',
        value_numeric: 0.0100, // 1%
        legal_reference: 'RA 7160 (Local Government Code) Sec. 233 / Prov. Tax Ordinance of Misamis Oriental',
        verification_status: 'approved',
        is_demo: false,
        effective_start_date: '2024-01-01',
        notes: 'Statutory 1% basic real property tax levy applicable to municipalities within provinces.'
      },
      {
        category: 'sef_levy',
        rule_code: 'SEF_ADDITIONAL_LEVY_LAGONGLONG',
        rule_name: 'Special Education Fund (SEF) Levy',
        property_classification: 'ALL',
        value_numeric: 0.0100, // 1%
        legal_reference: 'RA 7160 Sec. 235 (Additional 1% levy on real property for SEF)',
        verification_status: 'approved',
        is_demo: false,
        effective_start_date: '2024-01-01',
        notes: 'Dedicated 1% tax on the assessed value of real property exclusively accrued to the local school board.'
      },
      {
        category: 'assessment_level',
        rule_code: 'AL_RESIDENTIAL_LAND',
        rule_name: 'Residential Land Assessment Level',
        property_classification: 'Residential',
        actual_use: 'Residential',
        value_numeric: 0.2000, // 20%
        legal_reference: 'RA 7160 Sec. 218(a) / RA 12001 (RPVARA)',
        verification_status: 'approved',
        is_demo: false,
        effective_start_date: '2024-01-01',
        notes: 'Statutory assessment level for residential land (maximum 20%).'
      },
      {
        category: 'assessment_level',
        rule_code: 'AL_COMMERCIAL_LAND',
        rule_name: 'Commercial Land Assessment Level',
        property_classification: 'Commercial',
        actual_use: 'Commercial',
        value_numeric: 0.5000, // 50%
        legal_reference: 'RA 7160 Sec. 218(a)',
        verification_status: 'approved',
        is_demo: false,
        effective_start_date: '2024-01-01',
        notes: 'Statutory assessment level for commercial land (50%).'
      },
      {
        category: 'assessment_level',
        rule_code: 'AL_AGRICULTURAL_LAND',
        rule_name: 'Agricultural Land Assessment Level',
        property_classification: 'Agricultural',
        actual_use: 'Agricultural',
        value_numeric: 0.4000, // 40%
        legal_reference: 'RA 7160 Sec. 218(a)',
        verification_status: 'approved',
        is_demo: false,
        effective_start_date: '2024-01-01',
        notes: 'Statutory assessment level for agricultural land (40%).'
      },
      {
        category: 'assessment_level',
        rule_code: 'AL_INDUSTRIAL_LAND',
        rule_name: 'Industrial Land Assessment Level',
        property_classification: 'Industrial',
        actual_use: 'Industrial',
        value_numeric: 0.5000, // 50%
        legal_reference: 'RA 7160 Sec. 218(a)',
        verification_status: 'approved',
        is_demo: false,
        effective_start_date: '2024-01-01',
        notes: 'Statutory assessment level for industrial land (50%).'
      },
      {
        category: 'discount',
        rule_code: 'PROMPT_PAYMENT_DISCOUNT',
        rule_name: 'Early / Prompt Payment Discount (Q1 Full Pay)',
        property_classification: 'ALL',
        value_numeric: 0.1000, // 10%
        legal_reference: 'RA 7160 Sec. 251 / Municipal Revenue Code',
        verification_status: 'approved',
        is_demo: false,
        effective_start_date: '2024-01-01',
        notes: '10% discount on basic tax and SEF when paid promptly in advance on or before March 31.'
      },
      {
        category: 'penalty_interest',
        rule_code: 'DELINQUENCY_INTEREST_RATE',
        rule_name: 'Monthly Delinquency Surcharge & Interest',
        property_classification: 'ALL',
        value_numeric: 0.0200, // 2% per month
        legal_reference: 'RA 7160 Sec. 255 (Failure to pay RPT on time: 2% per month, max 72% / 36 mos)',
        verification_status: 'approved',
        is_demo: false,
        effective_start_date: '2024-01-01',
        notes: '2% monthly interest on unpaid tax balances until fully satisfied.'
      },
      {
        category: 'smv',
        rule_code: 'SMV_LAGONGLONG_CURRENT',
        rule_name: 'Schedule of Base Market Values - Lagonglong',
        property_classification: 'ALL',
        value_numeric: 1.0000,
        legal_reference: 'Provincial Ordinance No. 2023-01 / BLGF Valuation Guidelines',
        verification_status: 'pending_verification',
        is_demo: false,
        effective_start_date: '2024-01-01',
        notes: 'Official Schedule of Market Values submitted to Sangguniang Panlalawigan for RPVARA alignment.'
      }
    ];

    for (const cfg of defaultTaxConfigs) {
      await conn.query(`
        INSERT INTO tax_configurations 
          (category, rule_code, rule_name, property_classification, actual_use, value_numeric, legal_reference, verification_status, is_demo, effective_start_date, notes)
        VALUES 
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          rule_name = VALUES(rule_name),
          value_numeric = VALUES(value_numeric),
          legal_reference = VALUES(legal_reference),
          notes = VALUES(notes)
      `, [
        cfg.category, cfg.rule_code, cfg.rule_name, cfg.property_classification || 'ALL', 
        cfg.actual_use || null, cfg.value_numeric, cfg.legal_reference, cfg.verification_status, 
        cfg.is_demo, cfg.effective_start_date, cfg.notes
      ]);
    }

    // 9. CREATE tax_bills TABLE
    console.log('[SCHEMA] Creating tax_bills table...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS tax_bills (
        bill_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        bill_number VARCHAR(100) NOT NULL UNIQUE,
        tax_declaration_id INT UNSIGNED NOT NULL,
        property_id INT UNSIGNED NOT NULL,
        property_code VARCHAR(50) DEFAULT NULL,
        owner_id INT UNSIGNED NOT NULL,
        tax_year YEAR NOT NULL,
        due_date DATE NOT NULL,
        assessed_value DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        basic_tax_rate DECIMAL(6,4) NOT NULL DEFAULT 0.0100,
        basic_tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        sef_tax_rate DECIMAL(6,4) NOT NULL DEFAULT 0.0100,
        sef_tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        other_levies_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        penalty_interest_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        prior_delinquency_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        total_amount_due DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        amount_paid DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        remaining_balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        bill_status ENUM('draft', 'pending_approval', 'approved', 'partially_paid', 'paid', 'overdue', 'cancelled', 'adjusted') NOT NULL DEFAULT 'draft',
        is_demo BOOLEAN NOT NULL DEFAULT FALSE,
        rule_version_snapshot JSON NOT NULL,
        prepared_by_user_id INT UNSIGNED NOT NULL,
        approved_by_user_id INT UNSIGNED DEFAULT NULL,
        approved_at DATETIME DEFAULT NULL,
        adjustment_reason TEXT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_tb_td (tax_declaration_id),
        INDEX idx_tb_prop (property_id),
        INDEX idx_tb_owner (owner_id),
        INDEX idx_tb_status (bill_status),
        INDEX idx_tb_year (tax_year),
        CONSTRAINT fk_tb_td FOREIGN KEY (tax_declaration_id) REFERENCES tax_declarations(tax_declaration_id) ON DELETE RESTRICT,
        CONSTRAINT fk_tb_prop FOREIGN KEY (property_id) REFERENCES properties(property_id) ON DELETE RESTRICT,
        CONSTRAINT fk_tb_owner FOREIGN KEY (owner_id) REFERENCES property_owners(owner_id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 10. CREATE tax_bill_items TABLE
    console.log('[SCHEMA] Creating tax_bill_items table...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS tax_bill_items (
        item_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        bill_id INT UNSIGNED NOT NULL,
        charge_type ENUM('basic_rpt', 'sef', 'other_levy', 'discount', 'penalty', 'interest', 'prior_year') NOT NULL,
        description VARCHAR(150) NOT NULL,
        rate DECIMAL(6,4) NOT NULL DEFAULT 0.0000,
        amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        period_covered VARCHAR(50) DEFAULT NULL,
        INDEX idx_tbi_bill (bill_id),
        CONSTRAINT fk_tbi_bill FOREIGN KEY (bill_id) REFERENCES tax_bills(bill_id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 11. CREATE payment_transactions TABLE
    console.log('[SCHEMA] Creating payment_transactions table...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS payment_transactions (
        transaction_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        transaction_number VARCHAR(100) NOT NULL UNIQUE,
        bill_id INT UNSIGNED NOT NULL,
        owner_id INT UNSIGNED NOT NULL,
        cashier_user_id INT UNSIGNED NOT NULL,
        or_number VARCHAR(100) NOT NULL UNIQUE,
        amount_due_at_payment DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        amount_paid DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        balance_after_payment DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        payment_method ENUM('cash', 'check', 'bank_transfer', 'manager_check', 'online_authorized', 'demo_simulation') NOT NULL DEFAULT 'cash',
        payment_date DATE NOT NULL,
        payment_time TIME NOT NULL,
        transaction_reference VARCHAR(150) DEFAULT NULL,
        is_partial BOOLEAN NOT NULL DEFAULT FALSE,
        is_demo BOOLEAN NOT NULL DEFAULT FALSE,
        status ENUM('completed', 'voided', 'reversed', 'reconciled') NOT NULL DEFAULT 'completed',
        void_reason TEXT DEFAULT NULL,
        voided_by_user_id INT UNSIGNED DEFAULT NULL,
        voided_at DATETIME DEFAULT NULL,
        reversal_approved_by INT UNSIGNED DEFAULT NULL,
        remarks TEXT DEFAULT NULL,
        idempotency_key VARCHAR(100) DEFAULT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_pt_bill (bill_id),
        INDEX idx_pt_cashier (cashier_user_id),
        INDEX idx_pt_date (payment_date),
        INDEX idx_pt_status (status),
        CONSTRAINT fk_pt_bill FOREIGN KEY (bill_id) REFERENCES tax_bills(bill_id) ON DELETE RESTRICT,
        CONSTRAINT fk_pt_owner FOREIGN KEY (owner_id) REFERENCES property_owners(owner_id) ON DELETE RESTRICT,
        CONSTRAINT fk_pt_cashier FOREIGN KEY (cashier_user_id) REFERENCES users(user_id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 12. CREATE cashier_reconciliations TABLE
    console.log('[SCHEMA] Creating cashier_reconciliations table...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS cashier_reconciliations (
        reconciliation_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        reconciliation_date DATE NOT NULL,
        cashier_user_id INT UNSIGNED NOT NULL,
        total_transactions_count INT NOT NULL DEFAULT 0,
        total_cash_collected DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        total_check_collected DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        total_other_collected DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        gross_collection DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        total_voided_reversed DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        net_collection DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        actual_remitted_amount DECIMAL(15,2) DEFAULT NULL,
        discrepancy_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        status ENUM('pending', 'verified', 'discrepancy_flagged', 'reconciled') NOT NULL DEFAULT 'pending',
        verified_by_user_id INT UNSIGNED DEFAULT NULL,
        remarks TEXT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_cr_date (reconciliation_date),
        INDEX idx_cr_cashier (cashier_user_id),
        CONSTRAINT fk_cr_cashier FOREIGN KEY (cashier_user_id) REFERENCES users(user_id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 13. CREATE tax_audit_events TABLE
    console.log('[SCHEMA] Creating tax_audit_events table...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS tax_audit_events (
        event_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        role VARCHAR(50) NOT NULL,
        entity_type ENUM('tax_declaration', 'tax_configuration', 'tax_bill', 'payment', 'reconciliation') NOT NULL,
        entity_id VARCHAR(100) NOT NULL,
        action VARCHAR(60) NOT NULL,
        previous_state JSON DEFAULT NULL,
        new_state JSON DEFAULT NULL,
        reason TEXT DEFAULT NULL,
        ip_address VARCHAR(60) DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_tae_user (user_id),
        INDEX idx_tae_entity (entity_type, entity_id),
        INDEX idx_tae_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 14. INITIALIZE SEQUENCE GENERATORS FOR TAX MODULE IN id_sequences
    console.log('[SEQUENCES] Initializing tax sequence counters...');
    await conn.query(`
      INSERT INTO id_sequences (sequence_key, current_val)
      VALUES 
        ('tax_declaration_2026', 0),
        ('tax_bill_2026', 0),
        ('payment_transaction_2026', 0),
        ('official_receipt_2026', 1000)
      ON DUPLICATE KEY UPDATE current_val = current_val
    `);

    await conn.commit();
    console.log('\n=== MIGRATION COMPLETED SUCCESSFULLY! ===');
  } catch (err) {
    await conn.rollback();
    console.error('FATAL MIGRATION ERROR:', err);
    process.exit(1);
  } finally {
    conn.release();
    process.exit(0);
  }
}

migrateTaxAndCashierSystem();
