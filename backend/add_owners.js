import { pool } from './config/db.js';

async function main() {
  const newOwners = [
    { first: 'Alberto', last: 'Reyes' },
    { first: 'Maria', last: 'Santos' },
    { first: 'Roberto', last: 'Dela Cruz' },
    { first: 'Elena', last: 'Garcia' },
    { first: 'Manuel', last: 'Flores' },
    { first: 'Teresa', last: 'Ramos' },
    { first: 'Antonio', last: 'Mendoza' },
    { first: 'Cristina', last: 'Bautista' },
    { first: 'Daniel', last: 'Navarro' },
    { first: 'Lourdes', last: 'Villanueva' }
  ];

  const assignedCounts = [2, 1, 2, 0, 1, 2, 1, 0, 2, 1];

  let ownerIds = [];

  for (const owner of newOwners) {
    // Check if exists
    const [existing] = await pool.query('SELECT owner_id FROM property_owners WHERE first_name = ? AND last_name = ?', [owner.first, owner.last]);
    if (existing.length > 0) {
      console.log(`Owner ${owner.first} ${owner.last} already exists.`);
      ownerIds.push(existing[0].owner_id);
    } else {
      const [res] = await pool.query('INSERT INTO property_owners (first_name, last_name) VALUES (?, ?)', [owner.first, owner.last]);
      ownerIds.push(res.insertId);
      console.log(`Created owner ${owner.first} ${owner.last} with ID ${res.insertId}.`);
    }
  }

  // Assign properties
  // Find properties to reassign
  const [properties] = await pool.query('SELECT property_id FROM properties LIMIT 20');
  
  if (properties.length < 12) {
    console.log("Not enough properties to assign! Found: ", properties.length);
  }

  let propertyIndex = 0;
  for (let i = 0; i < ownerIds.length; i++) {
    const ownerId = ownerIds[i];
    const count = assignedCounts[i];
    for (let c = 0; c < count; c++) {
      if (propertyIndex < properties.length) {
        const propId = properties[propertyIndex].property_id;
        await pool.query('UPDATE properties SET owner_id = ? WHERE property_id = ?', [ownerId, propId]);
        console.log(`Assigned property ${propId} to owner ${ownerId}.`);
        propertyIndex++;
      }
    }
  }

  pool.end();
}
main();
