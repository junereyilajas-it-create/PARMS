import { pool } from '../config/db.js';

export const BARANGAY_CODES = {
  'lumbo': 'L',
  'poblacion': 'P',
  'banglay': 'B',
  'dampil': 'D',
  'gaston': 'G',
  'kabulawan': 'KB',
  'kauswagan': 'KW',
  'mabini': 'MB',
  'manaol': 'M',
  'tabok': 'T',
  'umagos': 'U',
  'unknown': 'X'
};

export function resolveBarangayCode(barangayName) {
  if (!barangayName) return 'P';
  const clean = String(barangayName).trim().toLowerCase();
  for (const [name, code] of Object.entries(BARANGAY_CODES)) {
    if (clean.includes(name)) return code;
  }
  return clean.slice(0, 2).toUpperCase() || 'P';
}

/**
 * Concurrency-safe atomic sequence generator using database transactions
 * and row-level locking (SELECT ... FOR UPDATE).
 */
export async function getNextSequence(connectionOrPool, sequenceKey, initialStart = 1) {
  const conn = connectionOrPool;
  // Ensure record exists
  await conn.query(`
    INSERT INTO id_sequences (sequence_key, current_val)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE current_val = current_val
  `, [sequenceKey, initialStart - 1]);

  // Lock row and increment
  const [rows] = await conn.query(`
    SELECT current_val FROM id_sequences WHERE sequence_key = ? FOR UPDATE
  `, [sequenceKey]);

  let currentVal = rows && rows[0] ? rows[0].current_val : initialStart - 1;
  if (currentVal < initialStart - 1) {
    currentVal = initialStart - 1;
  }
  const nextVal = currentVal + 1;

  await conn.query(`
    UPDATE id_sequences SET current_val = ? WHERE sequence_key = ?
  `, [nextVal, sequenceKey]);

  return nextVal;
}

/**
 * Generate standard Property ID: PROP_{Seq}
 */
export async function generatePropertyId(connection) {
  const seq = await getNextSequence(connection, 'property', 1);
  return `PROP_${seq}`;
}

/**
 * Preview next available Property ID without permanently incrementing sequence
 */
export async function previewNextPropertyId(connectionOrPool) {
  const [rows] = await connectionOrPool.query(`
    SELECT current_val FROM id_sequences WHERE sequence_key = 'property'
  `);
  const currentVal = rows && rows[0] ? rows[0].current_val : 0;
  return `PROP_${currentVal + 1}`;
}

/**
 * Generate standard Lot ID: LOT_{BrgyCode}-{Seq}
 * Lumbo starts at 474, Poblacion at 317, others at 101
 */
export async function generateLotId(connection, barangayName) {
  const brgyCode = resolveBarangayCode(barangayName);
  const initialMap = {
    'L': 474,
    'P': 317
  };
  const startSeq = initialMap[brgyCode] || 101;
  const seq = await getNextSequence(connection, `lot_${brgyCode}`, startSeq);
  return `LOT_${brgyCode}-${seq}`;
}

/**
 * Generate standard Building ID: BUILDING_{BrgyCode}-{Seq}
 * Sequence starts at 1001 for all barangays
 */
export async function generateBuildingId(connection, barangayName) {
  const brgyCode = resolveBarangayCode(barangayName);
  const seq = await getNextSequence(connection, `building_${brgyCode}`, 1001);
  return `BUILDING_${brgyCode}-${seq}`;
}

/**
 * Generate standard Tax Declaration Number: TD-{Year}-{BrgyCode}-{Seq}
 */
export async function generateTaxDeclarationNumber(connection, barangayName, year = new Date().getFullYear()) {
  const brgyCode = resolveBarangayCode(barangayName);
  const seq = await getNextSequence(connection, `tax_declaration_${year}_${brgyCode}`, 1);
  return `TD-${year}-${brgyCode}-${String(seq).padStart(4, '0')}`;
}

/**
 * Generate standard RPT Bill Number: RPT-{Year}-{Seq}
 */
export async function generateBillNumber(connection, year = new Date().getFullYear()) {
  const seq = await getNextSequence(connection, `tax_bill_${year}`, 1);
  return `RPT-${year}-${String(seq).padStart(4, '0')}`;
}

/**
 * Generate standard Payment Transaction Number: PAY-{Year}-{Seq}
 */
export async function generateTransactionNumber(connection, year = new Date().getFullYear()) {
  const seq = await getNextSequence(connection, `payment_transaction_${year}`, 1);
  return `PAY-${year}-${String(seq).padStart(5, '0')}`;
}

/**
 * Generate standard Official Receipt Number: OR-{Year}-{Seq} or DEMO-OR-...
 */
export async function generateOrNumber(connection, year = new Date().getFullYear(), isDemo = false) {
  const seqKey = isDemo ? `demo_or_${year}` : `official_receipt_${year}`;
  const startSeq = isDemo ? 1 : 1001;
  const seq = await getNextSequence(connection, seqKey, startSeq);
  const prefix = isDemo ? 'DEMO-OR' : 'OR';
  return `${prefix}-${year}-${String(seq).padStart(6, '0')}`;
}
