CREATE DATABASE IF NOT EXISTS property_management_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE property_management_db;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE users (
  user_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  username VARCHAR(60) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  role ENUM('admin', 'assessor', 'staff') NOT NULL DEFAULT 'staff',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
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

CREATE TABLE addresses (
  address_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  house_number VARCHAR(40), street VARCHAR(120), barangay VARCHAR(120) NOT NULL,
  municipality VARCHAR(120) NOT NULL, province VARCHAR(120) NOT NULL, postal_code VARCHAR(15)
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
  location VARCHAR(255) NOT NULL,
  lot_area DECIMAL(12,2),
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
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
  market_value DECIMAL(15,2),
  assessed_value DECIMAL(15,2),
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
  is_current_owner BOOLEAN NOT NULL DEFAULT FALSE,
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
  assessment_level_id INT UNSIGNED NOT NULL,
  market_value DECIMAL(15,2) NOT NULL,
  assessed_value DECIMAL(15,2) NOT NULL,
  assessment_date DATE NOT NULL,
  assessment_reason TEXT,
  remarks TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_lot_assessment_history_lot FOREIGN KEY (lot_id) REFERENCES property_lots(lot_id),
  CONSTRAINT fk_lot_assessment_history_assessor FOREIGN KEY (assessor_user_id) REFERENCES users(user_id),
  CONSTRAINT fk_lot_assessment_history_level FOREIGN KEY (assessment_level_id) REFERENCES assessment_levels(assessment_level_id)
) ENGINE=InnoDB;

CREATE TABLE building_history (
  building_history_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  building_id INT UNSIGNED NOT NULL,
  owner_id INT UNSIGNED NOT NULL,
  ownership_type VARCHAR(80),
  transfer_reason VARCHAR(255),
  transfer_date DATE NOT NULL,
  end_date DATE,
  is_current_owner BOOLEAN NOT NULL DEFAULT FALSE,
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
  assessment_level_id INT UNSIGNED NOT NULL,
  market_value DECIMAL(15,2) NOT NULL,
  assessed_value DECIMAL(15,2) NOT NULL,
  assessment_date DATE NOT NULL,
  assessment_reason TEXT,
  remarks TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_building_assessment_history_building FOREIGN KEY (building_id) REFERENCES property_buildings(building_id),
  CONSTRAINT fk_building_assessment_history_assessor FOREIGN KEY (assessor_user_id) REFERENCES users(user_id),
  CONSTRAINT fk_building_assessment_history_level FOREIGN KEY (assessment_level_id) REFERENCES assessment_levels(assessment_level_id)
) ENGINE=InnoDB;

CREATE TABLE assessment_levels (
  assessment_level_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  classification_id INT UNSIGNED NOT NULL,
  assessment_percentage DECIMAL(5,2) NOT NULL,
  UNIQUE KEY uq_assessment_classification (classification_id),
  CONSTRAINT chk_assessment_percentage CHECK (assessment_percentage BETWEEN 0 AND 100),
  CONSTRAINT fk_levels_classification FOREIGN KEY (classification_id) REFERENCES property_classifications(classification_id)
) ENGINE=InnoDB;

CREATE TABLE property_assessments (
  assessment_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  property_id INT UNSIGNED NOT NULL, assessor_user_id INT UNSIGNED NOT NULL,
  assessment_level_id INT UNSIGNED NOT NULL, market_value DECIMAL(15,2) NOT NULL,
  assessed_value DECIMAL(15,2) NOT NULL, assessment_date DATE NOT NULL,
  remarks TEXT,
  CONSTRAINT fk_assessments_property FOREIGN KEY (property_id) REFERENCES properties(property_id),
  CONSTRAINT fk_assessments_user FOREIGN KEY (assessor_user_id) REFERENCES users(user_id),
  CONSTRAINT fk_assessments_level FOREIGN KEY (assessment_level_id) REFERENCES assessment_levels(assessment_level_id)
) ENGINE=InnoDB;

CREATE TABLE tax_declarations (
  tax_declaration_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  property_id INT UNSIGNED NOT NULL, assessment_id INT UNSIGNED NOT NULL,
  declaration_number VARCHAR(80) NOT NULL UNIQUE, tax_year YEAR NOT NULL, issue_date DATE NOT NULL,
  CONSTRAINT fk_declarations_property FOREIGN KEY (property_id) REFERENCES properties(property_id),
  CONSTRAINT fk_declarations_assessment FOREIGN KEY (assessment_id) REFERENCES property_assessments(assessment_id)
) ENGINE=InnoDB;

CREATE TABLE ai_predictions (
  prediction_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  property_id INT UNSIGNED NOT NULL, predicted_market_value DECIMAL(15,2) NOT NULL,
  predicted_assessed_value DECIMAL(15,2) NOT NULL, confidence_score DECIMAL(5,2) NOT NULL,
  prediction_reason TEXT, prediction_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_by_user_id INT UNSIGNED, prediction_status ENUM('pending','approved','edited','rejected') NOT NULL DEFAULT 'pending',
  CONSTRAINT fk_predictions_property FOREIGN KEY (property_id) REFERENCES properties(property_id),
  CONSTRAINT fk_predictions_approver FOREIGN KEY (approved_by_user_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE gis_locations (
  location_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  property_id INT UNSIGNED NOT NULL UNIQUE, latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL, gps_accuracy DECIMAL(8,2),
  last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_gis_property FOREIGN KEY (property_id) REFERENCES properties(property_id)
) ENGINE=InnoDB;

CREATE TABLE activity_logs (
  log_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL, module_name VARCHAR(80) NOT NULL, activity TEXT NOT NULL,
  activity_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, ip_address VARCHAR(45),
  CONSTRAINT fk_logs_user FOREIGN KEY (user_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

INSERT INTO property_types (property_type_name) VALUES ('Residential'), ('Commercial'), ('Agricultural'), ('Industrial');
INSERT INTO property_classifications (classification_name) VALUES ('Residential Lot'), ('Commercial Lot'), ('Agricultural Land'), ('Industrial Lot');
INSERT INTO assessment_levels (classification_id, assessment_percentage) VALUES (1, 20.00), (2, 50.00), (3, 40.00), (4, 50.00);

-- Operational modules: retain immutable history wherever an official record changes.
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

-- Development records. The three linked record sets below allow every module to
-- be exercised immediately after importing this file. Default login: admin / password
INSERT INTO users (user_id, first_name, last_name, username, password_hash, email, role) VALUES
  (1,'System','Administrator','admin','$2b$10$O.Zklw4nZCFWrv7drvsn.uFiMqzm8.xFSwQYyNPFh9d3PR/ma9ure','admin@example.test','admin'),
  (2,'Ana','Reyes','areyes','$2b$10$O.Zklw4nZCFWrv7drvsn.uFiMqzm8.xFSwQYyNPFh9d3PR/ma9ure','ana.reyes@example.test','assessor'),
  (3,'Marco','Lopez','mlopez','$2b$10$O.Zklw4nZCFWrv7drvsn.uFiMqzm8.xFSwQYyNPFh9d3PR/ma9ure','marco.lopez@example.test','staff');
INSERT INTO property_owners (owner_id,first_name,middle_name,last_name,contact_number,email) VALUES
  (1,'Maria','Lopez','Santos','09171234567','maria.santos@example.test'),(2,'Jose','Rivera','Dela Cruz','09181234567','jose.delacruz@example.test'),(3,'Ana','Perez','Reyes','09191234567','ana.owner@example.test');
INSERT INTO addresses (address_id,house_number,street,barangay,municipality,province,postal_code) VALUES
  (1,'18','National Highway','Poblacion','Lagonglong','Misamis Oriental','9006'),(2,'42','Purok 2','Manaol','Lagonglong','Misamis Oriental','9006'),(3,'7','Barangay Road','Umagos','Lagonglong','Misamis Oriental','9006');
INSERT INTO owner_addresses (owner_address_id,owner_id,address_id) VALUES (1,1,1),(2,2,2),(3,3,3);
INSERT INTO properties (property_id,owner_id,address_id,property_type_id,classification_id,property_status) VALUES
  (1,1,1,1,1,'active'),(2,2,2,2,2,'active'),(3,3,3,3,3,'pending');
INSERT INTO property_lots (lot_id,property_id,lot_number,title_number,location,lot_area,latitude,longitude,lot_status) VALUES
  (1,1,'LOT-LGL-2024-001','TCT-LGL-10001','Poblacion, Lagonglong, Misamis Oriental',450.00,8.8072000,124.7903000,'active'),
  (2,2,'LOT-LGL-2024-002','TCT-LGL-10002','Purok 2, Manaol, Lagonglong, Misamis Oriental',1250.50,8.8018000,124.7976000,'active'),
  (3,3,'LOT-LGL-2024-003','TCT-LGL-10003','Barangay Umagos, Lagonglong, Misamis Oriental',320.15,8.8144000,124.7849000,'pending');
INSERT INTO property_buildings (building_id,property_id,building_name,building_type,floor_area,floor_count,construction_type,year_constructed,market_value,assessed_value,building_status) VALUES
  (1,1,'Poblacion Family Residence','Residential',180,2,'Concrete',2010,6225000,1245000,'active'),(2,2,'Manaol Trading Center','Commercial',750,3,'Concrete',2016,7700000,3850000,'active'),(3,3,'Umagos Farm House','Agricultural',95,1,'Wood',1998,1062500,425000,'pending');
INSERT INTO lot_history (lot_id,owner_id,ownership_type,transfer_reason,transfer_date,is_current_owner,registered_by_user_id,remarks) VALUES (1,1,'Individual','Initial registration','2024-01-10',1,3,'Current owner'),(2,2,'Individual','Sale','2024-02-12',1,3,'Current owner'),(3,3,'Individual','Inheritance','2024-03-15',1,3,'Current owner');
INSERT INTO lot_assessment_history (lot_id,assessor_user_id,assessment_level_id,market_value,assessed_value,assessment_date,assessment_reason,remarks) VALUES (1,2,1,6225000,1245000,'2024-01-15','Initial assessment','Verified'),(2,2,2,7700000,3850000,'2024-02-20','Initial assessment','Verified'),(3,2,3,1062500,425000,'2024-03-20','Initial assessment','Pending review');
INSERT INTO building_history (building_id,owner_id,ownership_type,transfer_reason,transfer_date,is_current_owner,registered_by_user_id,remarks) VALUES (1,1,'Individual','Initial registration','2024-01-10',1,3,'Current owner'),(2,2,'Individual','Sale','2024-02-12',1,3,'Current owner'),(3,3,'Individual','Inheritance','2024-03-15',1,3,'Current owner');
INSERT INTO building_assessment_history (building_id,assessor_user_id,assessment_level_id,market_value,assessed_value,assessment_date,assessment_reason,remarks) VALUES (1,2,1,6225000,1245000,'2024-01-15','Initial assessment','Verified'),(2,2,2,7700000,3850000,'2024-02-20','Initial assessment','Verified'),(3,2,3,1062500,425000,'2024-03-20','Initial assessment','Pending review');
INSERT INTO property_assessments (assessment_id,property_id,assessor_user_id,assessment_level_id,market_value,assessed_value,assessment_date,remarks) VALUES (1,1,2,1,6225000,1245000,'2024-01-15','Initial assessment'),(2,2,2,2,7700000,3850000,'2024-02-20','Initial assessment'),(3,3,2,3,1062500,425000,'2024-03-20','Initial assessment');
INSERT INTO tax_declarations (tax_declaration_id,property_id,assessment_id,declaration_number,tax_year,issue_date) VALUES (1,1,1,'TD-2024-01842',2024,'2024-01-20'),(2,2,2,'TD-2024-01841',2024,'2024-02-25'),(3,3,3,'TD-2024-01840',2024,'2024-03-25');
INSERT INTO ai_predictions (property_id,predicted_market_value,predicted_assessed_value,confidence_score,prediction_reason,approved_by_user_id,prediction_status) VALUES (1,6300000,1260000,94.5,'Comparable residential lots',1,'approved'),(2,7800000,3900000,91.2,'Commercial location trend',1,'approved'),(3,1100000,440000,88.0,'Agricultural land comparables',NULL,'pending');
INSERT INTO gis_locations (property_id,latitude,longitude,gps_accuracy) VALUES (1,14.8295000,120.9950000,4.5),(2,14.8305000,120.9960000,5.2),(3,14.8285000,120.9940000,6.1);
INSERT INTO activity_logs (user_id,module_name,activity,ip_address) VALUES (1,'Properties','Registered Poblacion property record','127.0.0.1'),(2,'Assessments','Assessed Manaol property record','127.0.0.1'),(3,'Lots','Updated Umagos lot record','127.0.0.1');
INSERT INTO ownership_transfers (property_id,previous_owner_id,new_owner_id,transfer_reason,transfer_date,reference_number,remarks,processed_by_user_id) VALUES (1,1,2,'sale','2023-01-10','TR-001','Historical transfer',1),(2,2,3,'donation','2023-02-10','TR-002','Historical transfer',1),(3,3,1,'inheritance','2023-03-10','TR-003','Historical transfer',1);
INSERT INTO property_inspections (inspection_id,property_id,inspector_user_id,scheduled_at,completed_at,inspection_status,property_condition,remarks) VALUES (1,1,2,'2024-04-01 09:00:00','2024-04-01 10:00:00','completed','Good','No issues'),(2,2,2,'2024-04-02 09:00:00',NULL,'scheduled','Good','Upcoming'),(3,3,2,'2024-04-03 09:00:00',NULL,'for_report','Fair','Report required');
INSERT INTO inspection_photos (inspection_id,file_path,caption) VALUES (1,'/uploads/inspection-1.jpg','Front view'),(2,'/uploads/inspection-2.jpg','Storefront'),(3,'/uploads/inspection-3.jpg','Lot view');
INSERT INTO assessment_appeals (property_id,assessment_id,appellant_owner_id,appeal_reason,assigned_assessor_id,appeal_status,resolution,resolved_at) VALUES (1,1,1,'Request market-value review',2,'under_review',NULL,NULL),(2,2,2,'Classification clarification',2,'resolved','Assessment confirmed','2024-05-10'),(3,3,3,'Area correction request',2,'submitted',NULL,NULL);
INSERT INTO certified_copy_issuances (property_id,certification_number,document_type,requestor_name,issued_by_user_id,purpose) VALUES (1,'CERT-001','tax_declaration','Maria Santos',3,'Bank loan'),(2,'CERT-002','property_record','Jose Dela Cruz',3,'Business permit'),(3,'CERT-003','assessment_record','Ana Reyes',3,'Personal record');
INSERT INTO database_backups (file_name,file_path,file_size_bytes,checksum,backup_status,created_by_user_id) VALUES ('backup-001.sql','/backups/backup-001.sql',102400,'sha256-001','verified',1),('backup-002.sql','/backups/backup-002.sql',102500,'sha256-002','verified',1),('backup-003.sql','/backups/backup-003.sql',102600,'sha256-003','created',1);
SET FOREIGN_KEY_CHECKS = 1;
