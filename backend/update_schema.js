import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'database.sql');
let sql = fs.readFileSync(dbPath, 'utf8');

// 1. Add property_history table right before activity_logs if it doesn't exist
const propertyHistoryTable = `
CREATE TABLE property_history (
  history_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  property_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  action VARCHAR(80) NOT NULL,
  previous_value TEXT,
  new_value TEXT,
  history_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_property_history_property FOREIGN KEY (property_id) REFERENCES properties(property_id),
  CONSTRAINT fk_property_history_user FOREIGN KEY (user_id) REFERENCES users(user_id)
) ENGINE=InnoDB;
`;

if (!sql.includes('CREATE TABLE property_history')) {
    sql = sql.replace('CREATE TABLE activity_logs', propertyHistoryTable + '\nCREATE TABLE activity_logs');
}

// 2. Update activity_logs to include role, record_affected, and description
const oldActivityLogs = `CREATE TABLE activity_logs (
  log_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL, module_name VARCHAR(80) NOT NULL, activity TEXT NOT NULL,
  activity_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, ip_address VARCHAR(45),
  CONSTRAINT fk_logs_user FOREIGN KEY (user_id) REFERENCES users(user_id)
) ENGINE=InnoDB;`;

const newActivityLogs = `CREATE TABLE activity_logs (
  log_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  role VARCHAR(50),
  action VARCHAR(80) NOT NULL,
  module_name VARCHAR(80) NOT NULL,
  record_affected VARCHAR(255),
  activity TEXT NOT NULL,
  activity_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  CONSTRAINT fk_logs_user FOREIGN KEY (user_id) REFERENCES users(user_id)
) ENGINE=InnoDB;`;

sql = sql.replace(oldActivityLogs, newActivityLogs);
if (sql.includes('module_name VARCHAR(80) NOT NULL, activity TEXT NOT NULL,')) {
    // regex fallback
    sql = sql.replace(/CREATE TABLE activity_logs \([\s\S]*?ENGINE=InnoDB;/m, newActivityLogs);
}

// 3. Replace all INSERTs starting from INSERT INTO property_owners
const insertStartIdx = sql.indexOf('INSERT INTO property_owners');
if (insertStartIdx !== -1) {
    sql = sql.substring(0, insertStartIdx);
}

const newSeed = `
INSERT INTO property_owners (owner_id, first_name, last_name, email) VALUES
  (1, 'Carla', 'Delatorre', 'carla@gmail.com'),
  (2, 'Lloyd', 'Pabualan', 'lloyd@gmail.com'),
  (3, 'Jaymark', 'Achas', 'jaymark@gmail.com'),
  (4, 'Ryan', 'Uyan', 'ryan@gmail.com'),
  (5, 'Prince', 'Galabin', 'prince@gmail.com'),
  (6, 'Joken', 'Jailo', 'joken@gmail.com'),
  (7, 'Joshua', 'Disgrasya', 'joshua@gmail.com'),
  (8, 'Riel', 'Grasyaan', 'riel@gmail.com'),
  (9, 'Janrel', 'Bana', 'janrel@gmail.com');

INSERT INTO users (user_id, owner_id, first_name, last_name, username, password_hash, email, role) VALUES
  (1, NULL, 'Junerey', 'Admin', 'junerey', '$2b$10$sbk8Jid9rqBoVMbhlWCarudmc0JOfwr/vh1lYZkSx/PmAWwq73eye', 'junerey@gmail.com', 'admin'),
  (2, NULL, 'Randrei', 'LLacuna', 'randrei', '$2b$10$IhJcAZhA8qCpQ1Sehot.JOT.a.79FcEQSy.NTlLoPq2cyAtHuEBqy', 'randrei@gmail.com', 'assessor'),
  (3, NULL, 'Jovan', 'Achas', 'jovan', '$2b$10$R28kMbEPDqAkAHPS7YRhr.oA6GeDh.7C2Xlcj7GAEQ7fEEIH4egQG', 'jovan@gmail.com', 'assessor'),
  (4, NULL, 'Raymark', 'Acierto', 'raymark', '$2b$10$fR0.6hbHmeY5pb852bnzROHjejH6ZyOV6KWyjurhhGQ.TcvWAdFKK', 'raymark@gmail.com', 'staff'),
  (5, NULL, 'Ating', 'Roa', 'ating', '$2b$10$H6bFMdllIbRTykvN8z9YDOC6oZvGDr2vo.YYR8yAb/O8.BEQju29u', 'ating@gmail.com', 'staff'),
  (6, NULL, 'Ianjade', 'Lugtanan', 'ianjade', '$2b$10$gIUgDCaM.MI5rIEVL7U2ke6GyePRqnPMrTjTiFNDn4YiBcynDcqkW', 'ianjade@gmail.com', 'staff'),
  (7, 1, 'Carla', 'Delatorre', 'carla', '$2b$10$jqvv.E7bhgi2lbTW5j21f.N.HWgINmEbNmG7LeJGb5tchnl5YTRSi', 'carla@gmail.com', 'client'),
  (8, 2, 'Lloyd', 'Pabualan', 'lloyd', '$2b$10$hYfzEDx8rTfhtb0ERPfm/eiJgV4M5xOG3o4dWD8wd8iuUaPFgC2L6', 'lloyd@gmail.com', 'client'),
  (9, 3, 'Jaymark', 'Achas', 'jaymark', '$2b$10$bCRYAuRoVN2yCKedfnQFu.IRZE0hD4pKuadcGgJMbwqwNNPZx1xAa', 'jaymark@gmail.com', 'client'),
  (10, 4, 'Ryan', 'Uyan', 'ryan', '$2b$10$wm.0k.CH.yKHDMZv6hCc7uMYIj4MoBtommczqxFNQBIszZWAzkw7a', 'ryan@gmail.com', 'client'),
  (11, 5, 'Prince', 'Galabin', 'prince', '$2b$10$UNUXMqPRuy9hWfdoMNCehufcP4BHFH7pWK57jFJoAGEPadQE3fTvW', 'prince@gmail.com', 'client'),
  (12, 6, 'Joken', 'Jailo', 'joken', '$2b$10$cr5QfdVqd0Klr4hbFuLCC.ga5dvUHy/Max8XbNK8QUeDad0S7W3yO', 'joken@gmail.com', 'client'),
  (13, 7, 'Joshua', 'Disgrasya', 'joshua', '$2b$10$15/ngqet/6jpc6PJXfqD.edCnIG7dL2iLl8c4ZkIVf7HLxk35S8Qe', 'joshua@gmail.com', 'client'),
  (14, 8, 'Riel', 'Grasyaan', 'riel', '$2b$10$xQwy5bREDwv1NmPFikdnCORlCEHv4BxT1RGOgfX6OqhByqUZzMAOC', 'riel@gmail.com', 'client'),
  (15, 9, 'Janrel', 'Bana', 'janrel', '$2b$10$BD7wUgFBEe5Yy.GII/9a3ejFhL7NFBwL0wEimC7csZQ9IhhvDORC2', 'janrel@gmail.com', 'client');

INSERT INTO provinces (province_id, province_name) VALUES (1, 'Misamis Oriental');
INSERT INTO municipalities (municipality_id, province_id, municipality_name) VALUES (1, 1, 'Lagonglong');
INSERT INTO barangays (barangay_id, municipality_id, barangay_name) VALUES 
(1, 1, 'Banglay'), (2, 1, 'Dampil'), (3, 1, 'Gaston'), (4, 1, 'Kabulawan');

INSERT INTO addresses (address_id, house_number, street, barangay_id, postal_code) VALUES
  (1, '101', 'Kabulawan St', 4, '9006'),
  (2, '102', 'Kabulawan St', 4, '9006'),
  (3, '103', 'Kabulawan St', 4, '9006'),
  (4, '104', 'Kabulawan St', 4, '9006'),
  (5, '105', 'Kabulawan St', 4, '9006'),
  (6, '106', 'Kabulawan St', 4, '9006'),
  (7, '107', 'Kabulawan St', 4, '9006'),
  (8, '108', 'Kabulawan St', 4, '9006'),
  (9, '109', 'Kabulawan St', 4, '9006');

INSERT INTO owner_addresses (owner_id, address_id) VALUES 
  (1, 1), (2, 2), (3, 3), (4, 4), (5, 5), (6, 6), (7, 7), (8, 8), (9, 9);

-- Create Properties
INSERT INTO properties (property_id, owner_id, address_id, property_type_id, classification_id, property_status) VALUES
  (1, 1, 1, 1, 1, 'active'), -- Carla (Group A)
  (2, 2, 2, 1, 1, 'active'), -- Lloyd (Group A)
  (3, 3, 3, 1, 1, 'active'), -- Jaymark (Group A)
  (4, 4, 4, 1, 1, 'active'), -- Ryan (Group B)
  (5, 5, 5, 1, 1, 'active'), -- Prince (Group B)
  (6, 6, 6, 1, 1, 'active'), -- Joken (Group C)
  (7, 7, 7, 1, 1, 'active'), -- Joshua (Group C)
  (8, 8, 8, 1, 1, 'active'), -- Riel (Group D)
  (9, 9, 9, 1, 1, 'active'); -- Janrel (Group D)

-- Create Lots (Total 9: 7 Assessed, 2 Unassessed)
-- Group A (3 assessed)
-- Group B (2 assessed)
-- Group C (4 lots: 2 assessed, 2 unassessed)
INSERT INTO property_lots (lot_id, property_id, lot_number, title_number, lot_area, lot_status) VALUES
  (1, 1, 'LOT-A1', 'TCT-A1', 500, 'active'),
  (2, 2, 'LOT-A2', 'TCT-A2', 500, 'active'),
  (3, 3, 'LOT-A3', 'TCT-A3', 500, 'active'),
  (4, 4, 'LOT-B1', 'TCT-B1', 500, 'active'),
  (5, 5, 'LOT-B2', 'TCT-B2', 500, 'active'),
  (6, 6, 'LOT-C1-1', 'TCT-C1-1', 500, 'active'), -- Assessed
  (7, 6, 'LOT-C1-2', 'TCT-C1-2', 500, 'active'), -- Unassessed
  (8, 7, 'LOT-C2-1', 'TCT-C2-1', 500, 'active'), -- Assessed
  (9, 7, 'LOT-C2-2', 'TCT-C2-2', 500, 'active'); -- Unassessed

-- Create Buildings (Total 10: 7 Assessed, 3 Unassessed)
-- Group A (3 assessed)
-- Group D (4 buildings: 2 assessed, 2 unassessed)
-- Oops wait, total should be 10 buildings. 3 (A) + 4 (D) = 7 buildings. Wait.
-- Requirement:
-- Group A: 3 buildings (all assessed)
-- Group D: 4 buildings (2 assessed, 2 unassessed)
-- That makes 7 buildings. How do we get to 10 buildings?
-- "Total Buildings: 10 (7 assessed, 3 unassessed)"
-- Let's add 3 more buildings to Group A or C to make up 10.
-- Wait, let's look at the requirements again:
-- Group A: Carla, Lloyd, Jaymark (each has 1 building, assessed) = 3 buildings (3 assessed)
-- Group B: Ryan, Prince (0 buildings) = 0 buildings
-- Group C: Joken, Joshua (0 buildings) = 0 buildings
-- Group D: Riel, Janrel (each has 2 buildings, 1 assessed, 1 unassessed) = 4 buildings (2 assessed, 2 unassessed)
-- Total requested explicitly: 3 + 4 = 7 buildings.
-- Why did the prompt say "Total Buildings: 10, Assessed: 7, Unassessed: 3"?
-- Maybe there are 3 additional placeholder buildings needed? Let's just create 3 more buildings to hit the exact numbers. Let's give Carla 1 more assessed building (4 assessed total), Lloyd 1 more unassessed building (3 unassessed total), and Jaymark 1 more assessed building (5 assessed total).
-- Wait, the prompt said:
-- Assessed Buildings: 7. Unassessed: 3.
-- Currently explicitly allocated: 3 (Group A) + 2 (Group D) = 5 Assessed. And 2 (Group D) = 2 Unassessed.
-- So we need 2 more Assessed and 1 more Unassessed building to reach 7 Assessed and 3 Unassessed.
-- I'll assign these extra 3 buildings to Group A (Carla, Lloyd, Jaymark) to exactly match the requirement.
INSERT INTO property_buildings (building_id, property_id, building_name, building_type, floor_area, floor_count, building_status) VALUES
  (1, 1, 'Carla Bldg 1', 'Residential', 150, 1, 'active'), -- Assessed
  (2, 2, 'Lloyd Bldg 1', 'Residential', 150, 1, 'active'), -- Assessed
  (3, 3, 'Jaymark Bldg 1', 'Residential', 150, 1, 'active'), -- Assessed
  (4, 8, 'Riel Bldg 1', 'Residential', 150, 1, 'active'), -- Assessed
  (5, 8, 'Riel Bldg 2', 'Residential', 150, 1, 'active'), -- Unassessed
  (6, 9, 'Janrel Bldg 1', 'Residential', 150, 1, 'active'), -- Assessed
  (7, 9, 'Janrel Bldg 2', 'Residential', 150, 1, 'active'), -- Unassessed
  -- Extra 3 buildings to reach 10 total (7 assessed, 3 unassessed):
  (8, 1, 'Carla Bldg 2', 'Residential', 100, 1, 'active'), -- Assessed
  (9, 2, 'Lloyd Bldg 2', 'Residential', 100, 1, 'active'), -- Assessed
  (10, 3, 'Jaymark Bldg 2', 'Residential', 100, 1, 'active'); -- Unassessed

-- Lot Assessments (7 assessed, 2 unassessed)
-- Lots 1-6, and 8 are assessed. Lots 7 and 9 are unassessed.
INSERT INTO lot_assessment_history (lot_id, assessor_user_id, assessor_level, market_value, assessed_value, assessment_date) VALUES 
  (1, 2, 20.00, 1000000, 200000, CURDATE()),
  (2, 2, 20.00, 1000000, 200000, CURDATE()),
  (3, 2, 20.00, 1000000, 200000, CURDATE()),
  (4, 2, 20.00, 1000000, 200000, CURDATE()),
  (5, 2, 20.00, 1000000, 200000, CURDATE()),
  (6, 2, 20.00, 1000000, 200000, CURDATE()),
  (8, 2, 20.00, 1000000, 200000, CURDATE());

-- Building Assessments (7 assessed, 3 unassessed)
-- Buildings 1,2,3,4,6,8,9 are assessed. Buildings 5,7,10 are unassessed.
INSERT INTO building_assessment_history (building_id, assessor_user_id, assessor_level, market_value, assessed_value, assessment_date) VALUES 
  (1, 2, 20.00, 2000000, 400000, CURDATE()),
  (2, 2, 20.00, 2000000, 400000, CURDATE()),
  (3, 2, 20.00, 2000000, 400000, CURDATE()),
  (4, 2, 20.00, 2000000, 400000, CURDATE()),
  (6, 2, 20.00, 2000000, 400000, CURDATE()),
  (8, 2, 20.00, 2000000, 400000, CURDATE()),
  (9, 2, 20.00, 2000000, 400000, CURDATE());

-- Property Assessments
-- Properties 1,2,3,4,5,6,7,8,9 all have some assessment. 
-- For simplicity, let's give them property_assessments records so they are considered "assessed" at the property level if they have any assessed component.
INSERT INTO property_assessments (property_id, assessor_user_id, assessor_level, market_value, assessed_value, assessment_date) VALUES
  (1, 2, 20.00, 3000000, 600000, CURDATE()),
  (2, 2, 20.00, 3000000, 600000, CURDATE()),
  (3, 2, 20.00, 3000000, 600000, CURDATE()),
  (4, 2, 20.00, 1000000, 200000, CURDATE()),
  (5, 2, 20.00, 1000000, 200000, CURDATE()),
  (6, 2, 20.00, 1000000, 200000, CURDATE()),
  (7, 2, 20.00, 1000000, 200000, CURDATE()),
  (8, 2, 20.00, 2000000, 400000, CURDATE()),
  (9, 2, 20.00, 2000000, 400000, CURDATE());

SET FOREIGN_KEY_CHECKS = 1;
`;

sql += newSeed;

fs.writeFileSync(dbPath, sql);
console.log('Successfully updated database.sql');
