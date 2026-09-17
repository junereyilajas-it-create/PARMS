DROP DATABASE IF EXISTS property_management_db;
CREATE DATABASE property_management_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE property_management_db;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE users (
  user_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  owner_id INT UNSIGNED NULL,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  username VARCHAR(60) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  role ENUM('admin', 'assessor', 'staff', 'client') NOT NULL DEFAULT 'staff',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_owner FOREIGN KEY (owner_id) REFERENCES property_owners(owner_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE property_owners (
  owner_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(80) NOT NULL,
  middle_name VARCHAR(80),
  last_name VARCHAR(80) NOT NULL,
  contact_number VARCHAR(30),
  email VARCHAR(120),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE provinces (
  province_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  province_name VARCHAR(120) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE municipalities (
  municipality_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  province_id INT UNSIGNED NOT NULL,
  municipality_name VARCHAR(120) NOT NULL,
  UNIQUE KEY uq_municipality_province (province_id, municipality_name),
  CONSTRAINT fk_municipalities_province FOREIGN KEY (province_id) REFERENCES provinces(province_id)
) ENGINE=InnoDB;

CREATE TABLE barangays (
  barangay_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  municipality_id INT UNSIGNED NOT NULL,
  barangay_name VARCHAR(120) NOT NULL,
  UNIQUE KEY uq_barangay_municipality (municipality_id, barangay_name),
  CONSTRAINT fk_barangays_municipality FOREIGN KEY (municipality_id) REFERENCES municipalities(municipality_id)
) ENGINE=InnoDB;

CREATE TABLE addresses (
  address_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  house_number VARCHAR(40), 
  street VARCHAR(120), 
  barangay_id INT UNSIGNED NOT NULL,
  postal_code VARCHAR(15),
  CONSTRAINT fk_addresses_barangay FOREIGN KEY (barangay_id) REFERENCES barangays(barangay_id)
) ENGINE=InnoDB;

CREATE TABLE owner_addresses (
  owner_address_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  owner_id INT UNSIGNED NOT NULL, address_id INT UNSIGNED NOT NULL,
  UNIQUE KEY uq_owner_address (owner_id, address_id),
  CONSTRAINT fk_owner_addresses_owner FOREIGN KEY (owner_id) REFERENCES property_owners(owner_id),
  CONSTRAINT fk_owner_addresses_address FOREIGN KEY (address_id) REFERENCES addresses(address_id)
) ENGINE=InnoDB;

CREATE TABLE property_types (
  property_type_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  property_type_name VARCHAR(80) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE property_classifications (
  classification_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  classification_name VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE properties (
  property_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  owner_id INT UNSIGNED NOT NULL,
  address_id INT UNSIGNED NOT NULL,
  property_type_id INT UNSIGNED NOT NULL,
  classification_id INT UNSIGNED NOT NULL,
  property_status ENUM('active','inactive','pending') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_properties_owner FOREIGN KEY (owner_id) REFERENCES property_owners(owner_id),
  CONSTRAINT fk_properties_address FOREIGN KEY (address_id) REFERENCES addresses(address_id),
  CONSTRAINT fk_properties_type FOREIGN KEY (property_type_id) REFERENCES property_types(property_type_id),
  CONSTRAINT fk_properties_classification FOREIGN KEY (classification_id) REFERENCES property_classifications(classification_id)
) ENGINE=InnoDB;

CREATE TABLE property_lots (
  lot_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  property_id INT UNSIGNED NOT NULL,
  lot_number VARCHAR(80) NOT NULL UNIQUE,
  title_number VARCHAR(80) UNIQUE,
  lot_area DECIMAL(12,2),
  lot_status ENUM('active','inactive','pending') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_lots_property FOREIGN KEY (property_id) REFERENCES properties(property_id)
) ENGINE=InnoDB;

CREATE TABLE property_buildings (
  building_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  property_id INT UNSIGNED NOT NULL,
  building_name VARCHAR(255),
  building_type VARCHAR(120),
  floor_area DECIMAL(12,2),
  floor_count TINYINT UNSIGNED,
  construction_type VARCHAR(120),
  year_constructed YEAR,
  building_status ENUM('active','inactive','pending') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_buildings_property FOREIGN KEY (property_id) REFERENCES properties(property_id)
) ENGINE=InnoDB;

CREATE TABLE lot_history (
  lot_history_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lot_id INT UNSIGNED NOT NULL,
  owner_id INT UNSIGNED NOT NULL,
  ownership_type VARCHAR(80),
  transfer_reason VARCHAR(255),
  transfer_date DATE NOT NULL,
  end_date DATE,
  registered_by_user_id INT UNSIGNED,
  remarks TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_lot_history_lot FOREIGN KEY (lot_id) REFERENCES property_lots(lot_id),
  CONSTRAINT fk_lot_history_owner FOREIGN KEY (owner_id) REFERENCES property_owners(owner_id),
  CONSTRAINT fk_lot_history_registrar FOREIGN KEY (registered_by_user_id) REFERENCES users(user_id)
) ENGINE=InnoDB;



CREATE TABLE lot_assessment_history (
  lot_assessment_history_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lot_id INT UNSIGNED NOT NULL,
  assessor_user_id INT UNSIGNED NOT NULL,
  assessor_level DECIMAL(5,2) NOT NULL,
  market_value DECIMAL(15,2) NOT NULL,
  assessed_value DECIMAL(15,2) NOT NULL,
  assessment_date DATE NOT NULL,
  assessment_reason TEXT,
  remarks TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_lot_assessment_history_lot FOREIGN KEY (lot_id) REFERENCES property_lots(lot_id),
  CONSTRAINT fk_lot_assessment_history_assessor FOREIGN KEY (assessor_user_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE building_history (
  building_history_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  building_id INT UNSIGNED NOT NULL,
  owner_id INT UNSIGNED NOT NULL,
  ownership_type VARCHAR(80),
  transfer_reason VARCHAR(255),
  transfer_date DATE NOT NULL,
  end_date DATE,
  registered_by_user_id INT UNSIGNED,
  remarks TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_building_history_building FOREIGN KEY (building_id) REFERENCES property_buildings(building_id),
  CONSTRAINT fk_building_history_owner FOREIGN KEY (owner_id) REFERENCES property_owners(owner_id),
  CONSTRAINT fk_building_history_registrar FOREIGN KEY (registered_by_user_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE building_assessment_history (
  building_assessment_history_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  building_id INT UNSIGNED NOT NULL,
  assessor_user_id INT UNSIGNED NOT NULL,
  assessor_level DECIMAL(5,2) NOT NULL,
  market_value DECIMAL(15,2) NOT NULL,
  assessed_value DECIMAL(15,2) NOT NULL,
  assessment_date DATE NOT NULL,
  assessment_reason TEXT,
  remarks TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_building_assessment_history_building FOREIGN KEY (building_id) REFERENCES property_buildings(building_id),
  CONSTRAINT fk_building_assessment_history_assessor FOREIGN KEY (assessor_user_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE property_assessments (
  assessment_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  property_id INT UNSIGNED NOT NULL, assessor_user_id INT UNSIGNED NOT NULL,
  assessor_level DECIMAL(5,2) NOT NULL, market_value DECIMAL(15,2) NOT NULL,
  assessed_value DECIMAL(15,2) NOT NULL,
  assessment_date DATE NOT NULL,
  remarks TEXT,
  CONSTRAINT fk_assessments_property FOREIGN KEY (property_id) REFERENCES properties(property_id),
  CONSTRAINT fk_assessments_user FOREIGN KEY (assessor_user_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE tax_declarations (
  tax_declaration_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  property_id INT UNSIGNED NOT NULL, assessment_id INT UNSIGNED NOT NULL,
  declaration_number VARCHAR(80) NOT NULL UNIQUE, tax_year YEAR NOT NULL, issue_date DATE NOT NULL,
  CONSTRAINT fk_declarations_property FOREIGN KEY (property_id) REFERENCES properties(property_id),
  CONSTRAINT fk_declarations_assessment FOREIGN KEY (assessment_id) REFERENCES property_assessments(assessment_id)
) ENGINE=InnoDB;


CREATE TABLE gis_locations (
  gis_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  property_id VARCHAR(80) NOT NULL,
  lot_id VARCHAR(80) NULL,
  building_id VARCHAR(80) NULL,
  geometry_type VARCHAR(50) NOT NULL DEFAULT 'Polygon',
  coordinates JSON NOT NULL,
  area_sqm DECIMAL(15,2),
  perimeter_m DECIMAL(15,2),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_gis_prop FOREIGN KEY (property_id) REFERENCES properties(property_id) ON DELETE CASCADE,
  CONSTRAINT fk_gis_lot FOREIGN KEY (lot_id) REFERENCES property_lots(lot_id) ON DELETE CASCADE,
  CONSTRAINT fk_gis_bldg FOREIGN KEY (building_id) REFERENCES property_buildings(building_id) ON DELETE CASCADE
) ENGINE=InnoDB;


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

CREATE TABLE activity_logs (
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
) ENGINE=InnoDB;

CREATE TABLE certificate_requests (
  request_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  property_id INT UNSIGNED,
  certificate_type VARCHAR(100) NOT NULL,
  purpose VARCHAR(255) NOT NULL,
  remarks TEXT,
  status ENUM('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'READY_FOR_CLAIMING', 'COMPLETED', 'CANCELLED') DEFAULT 'PENDING',
  rejection_reason TEXT,
  requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP NULL,
  reviewed_by INT UNSIGNED,
  completed_at TIMESTAMP NULL,
  CONSTRAINT fk_cert_req_user FOREIGN KEY (user_id) REFERENCES users(user_id),
  CONSTRAINT fk_cert_req_property FOREIGN KEY (property_id) REFERENCES properties(property_id),
  CONSTRAINT fk_cert_req_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE generated_certificates (
  certificate_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  certificate_number VARCHAR(100) NOT NULL UNIQUE,
  certificate_type VARCHAR(100) NOT NULL,
  owner_id INT UNSIGNED NOT NULL,
  property_id INT UNSIGNED,
  requestor_name VARCHAR(200) NOT NULL,
  purpose VARCHAR(255) NOT NULL,
  status ENUM('Generated', 'Cancelled') DEFAULT 'Generated',
  issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  issued_by_user_id INT UNSIGNED NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES property_owners(owner_id),
  FOREIGN KEY (property_id) REFERENCES properties(property_id),
  FOREIGN KEY (issued_by_user_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

INSERT INTO property_types (property_type_name) VALUES ('Residential'), ('Commercial'), ('Agricultural'), ('Industrial');
INSERT INTO property_classifications (classification_name) VALUES ('Residential Lot'), ('Commercial Lot'), ('Agricultural Land'), ('Industrial Lot');


CREATE TABLE ownership_transfers (
  transfer_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, property_id INT UNSIGNED NOT NULL,
  previous_owner_id INT UNSIGNED NOT NULL, new_owner_id INT UNSIGNED NOT NULL,
  transfer_reason ENUM('sale','donation','inheritance','court_order','other') NOT NULL,
  transfer_date DATE NOT NULL, reference_number VARCHAR(100), remarks TEXT,
  processed_by_user_id INT UNSIGNED, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES properties(property_id),
  FOREIGN KEY (previous_owner_id) REFERENCES property_owners(owner_id),
  FOREIGN KEY (new_owner_id) REFERENCES property_owners(owner_id),
  FOREIGN KEY (processed_by_user_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE property_inspections (
  inspection_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, property_id INT UNSIGNED NOT NULL,
  inspector_user_id INT UNSIGNED, scheduled_at DATETIME NOT NULL, completed_at DATETIME,
  inspection_status ENUM('scheduled','completed','cancelled','for_report') DEFAULT 'scheduled',
  property_condition VARCHAR(100), remarks TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES properties(property_id), FOREIGN KEY (inspector_user_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE inspection_photos (
  photo_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, inspection_id INT UNSIGNED NOT NULL,
  file_path VARCHAR(500) NOT NULL, caption VARCHAR(255), uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (inspection_id) REFERENCES property_inspections(inspection_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE assessment_appeals (
  appeal_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, property_id INT UNSIGNED NOT NULL,
  assessment_id INT UNSIGNED, appellant_owner_id INT UNSIGNED NOT NULL, appeal_reason TEXT NOT NULL,
  assigned_assessor_id INT UNSIGNED, appeal_status ENUM('submitted','under_review','approved','rejected','resolved') DEFAULT 'submitted',
  resolution TEXT, submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, resolved_at TIMESTAMP NULL,
  FOREIGN KEY (property_id) REFERENCES properties(property_id), FOREIGN KEY (assessment_id) REFERENCES property_assessments(assessment_id),
  FOREIGN KEY (appellant_owner_id) REFERENCES property_owners(owner_id), FOREIGN KEY (assigned_assessor_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE certified_copy_issuances (
  issuance_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, property_id INT UNSIGNED NOT NULL,
  certification_number VARCHAR(100) NOT NULL UNIQUE, document_type ENUM('tax_declaration','property_record','assessment_record') NOT NULL,
  requestor_name VARCHAR(200) NOT NULL, issued_by_user_id INT UNSIGNED NOT NULL,
  issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, purpose VARCHAR(255),
  FOREIGN KEY (property_id) REFERENCES properties(property_id), FOREIGN KEY (issued_by_user_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE database_backups (
  backup_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL, file_size_bytes BIGINT UNSIGNED, checksum VARCHAR(128),
  backup_status ENUM('created','verified','failed') DEFAULT 'created', created_by_user_id INT UNSIGNED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (created_by_user_id) REFERENCES users(user_id)
) ENGINE=InnoDB;


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
