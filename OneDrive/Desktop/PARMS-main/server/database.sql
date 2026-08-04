CREATE DATABASE IF NOT EXISTS property_management_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE property_management_db;

CREATE TABLE roles (
  role_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE users (
  user_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  username VARCHAR(60) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  role_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(role_id)
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

CREATE TABLE property_lots (
  lot_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  owner_id INT UNSIGNED NOT NULL,
  address_id INT UNSIGNED NOT NULL,
  property_type_id INT UNSIGNED NOT NULL,
  classification_id INT UNSIGNED NOT NULL,
  lot_number VARCHAR(80) NOT NULL UNIQUE,
  title_number VARCHAR(80) UNIQUE,
  location VARCHAR(255) NOT NULL,
  lot_area DECIMAL(12,2),
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  property_status ENUM('active','inactive','pending') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_lots_owner FOREIGN KEY (owner_id) REFERENCES property_owners(owner_id),
  CONSTRAINT fk_lots_address FOREIGN KEY (address_id) REFERENCES addresses(address_id),
  CONSTRAINT fk_lots_type FOREIGN KEY (property_type_id) REFERENCES property_types(property_type_id),
  CONSTRAINT fk_lots_classification FOREIGN KEY (classification_id) REFERENCES property_classifications(classification_id)
) ENGINE=InnoDB;

CREATE TABLE property_buildings (
  building_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lot_id INT UNSIGNED NOT NULL,
  property_name VARCHAR(255),
  building_type VARCHAR(120),
  building_area DECIMAL(12,2),
  number_of_floors TINYINT UNSIGNED,
  construction_type VARCHAR(120),
  year_constructed YEAR,
  market_value DECIMAL(15,2),
  assessed_value DECIMAL(15,2),
  property_status ENUM('active','inactive','pending') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_buildings_lot FOREIGN KEY (lot_id) REFERENCES property_lots(lot_id)
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
  assessment_date DATE NOT NULL,y_lots(lot
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
  CONSTRAINT fk_assessments_property FOREIGN KEY (property_id) REFERENCES property_lots(lot_id),
  CONSTRAINT fk_assessments_user FOREIGN KEY (assessor_user_id) REFERENCES users(user_id),
  CONSTRAINT fk_assessments_level FOREIGN KEY (assessment_level_id) REFERENCES assessment_levels(assessment_level_id)
) ENGINE=InnoDB;

CREATE TABLE tax_declarations (
  tax_declaration_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  property_id INT UNSIGNED NOT NULL, assessment_id INT UNSIGNED NOT NULL,
  declaration_number VARCHAR(80) NOT NULL UNIQUE, tax_year YEAR NOT NULL, issue_date DATE NOT NULL,
  CONSTRAINT fk_declarations_property FOREIGN KEY (property_id) REFERENCES property_lots(lot_id),
  CONSTRAINT fk_declarations_assessment FOREIGN KEY (assessment_id) REFERENCES property_assessments(assessment_id)
) ENGINE=InnoDB;

CREATE TABLE ai_predictions (
  prediction_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  property_id INT UNSIGNED NOT NULL, predicted_market_value DECIMAL(15,2) NOT NULL,
  predicted_assessed_value DECIMAL(15,2) NOT NULL, confidence_score DECIMAL(5,2) NOT NULL,
  prediction_reason TEXT, prediction_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_by_user_id INT UNSIGNED, prediction_status ENUM('pending','approved','edited','rejected') NOT NULL DEFAULT 'pending',
  CONSTRAINT fk_predictions_property FOREIGN KEY (property_id) REFERENCES property_lots(lot_id),
  CONSTRAINT fk_predictions_approver FOREIGN KEY (approved_by_user_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE gis_locations (
  location_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  property_id INT UNSIGNED NOT NULL UNIQUE, latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL, gps_accuracy DECIMAL(8,2),
  last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_gis_property FOREIGN KEY (property_id) REFERENCES property_lots(lot_id)
) ENGINE=InnoDB;

CREATE TABLE activity_logs (
  log_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL, module_name VARCHAR(80) NOT NULL, activity TEXT NOT NULL,
  activity_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, ip_address VARCHAR(45),
  CONSTRAINT fk_logs_user FOREIGN KEY (user_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

INSERT INTO roles (role_name) VALUES ('Administrator'), ('Assessor'), ('Staff');
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
  FOREIGN KEY (property_id) REFERENCES property_lots(lot_id),
  FOREIGN KEY (previous_owner_id) REFERENCES property_owners(owner_id),
  FOREIGN KEY (new_owner_id) REFERENCES property_owners(owner_id),
  FOREIGN KEY (processed_by_user_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE property_inspections (
  inspection_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, property_id INT UNSIGNED NOT NULL,
  inspector_user_id INT UNSIGNED, scheduled_at DATETIME NOT NULL, completed_at DATETIME,
  inspection_status ENUM('scheduled','completed','cancelled','for_report') DEFAULT 'scheduled',
  property_condition VARCHAR(100), remarks TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES property_lots(lot_id), FOREIGN KEY (inspector_user_id) REFERENCES users(user_id)
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
  FOREIGN KEY (property_id) REFERENCES property_lots(lot_id), FOREIGN KEY (assessment_id) REFERENCES property_assessments(assessment_id),
  FOREIGN KEY (appellant_owner_id) REFERENCES property_owners(owner_id), FOREIGN KEY (assigned_assessor_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE certified_copy_issuances (
  issuance_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, property_id INT UNSIGNED NOT NULL,
  certification_number VARCHAR(100) NOT NULL UNIQUE, document_type ENUM('tax_declaration','property_record','assessment_record') NOT NULL,
  requestor_name VARCHAR(200) NOT NULL, issued_by_user_id INT UNSIGNED NOT NULL,
  issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, purpose VARCHAR(255),
  FOREIGN KEY (property_id) REFERENCES property_lots(lot_id), FOREIGN KEY (issued_by_user_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE database_backups (
  backup_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL, file_size_bytes BIGINT UNSIGNED, checksum VARCHAR(128),
  backup_status ENUM('created','verified','failed') DEFAULT 'created', created_by_user_id INT UNSIGNED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (created_by_user_id) REFERENCES users(user_id)
) ENGINE=InnoDB;
