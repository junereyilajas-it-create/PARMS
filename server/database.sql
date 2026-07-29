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

CREATE TABLE properties (
  property_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  owner_id INT UNSIGNED NOT NULL, address_id INT UNSIGNED NOT NULL,
  property_type_id INT UNSIGNED NOT NULL, classification_id INT UNSIGNED NOT NULL,
  lot_number VARCHAR(80) NOT NULL UNIQUE, title_number VARCHAR(80) UNIQUE,
  lot_area DECIMAL(12,2), building_area DECIMAL(12,2),
  latitude DECIMAL(10,7), longitude DECIMAL(10,7),
  property_status ENUM('active','inactive','pending') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_properties_owner FOREIGN KEY (owner_id) REFERENCES property_owners(owner_id),
  CONSTRAINT fk_properties_address FOREIGN KEY (address_id) REFERENCES addresses(address_id),
  CONSTRAINT fk_properties_type FOREIGN KEY (property_type_id) REFERENCES property_types(property_type_id),
  CONSTRAINT fk_properties_classification FOREIGN KEY (classification_id) REFERENCES property_classifications(classification_id)
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

INSERT INTO roles (role_name) VALUES ('Administrator'), ('Assessor'), ('Staff');
INSERT INTO property_types (property_type_name) VALUES ('Residential'), ('Commercial'), ('Agricultural'), ('Industrial');
INSERT INTO property_classifications (classification_name) VALUES ('Residential Lot'), ('Commercial Lot'), ('Agricultural Land'), ('Industrial Lot');
INSERT INTO assessment_levels (classification_id, assessment_percentage) VALUES (1, 20.00), (2, 50.00), (3, 40.00), (4, 50.00);
