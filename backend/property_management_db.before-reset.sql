-- MySQL dump 10.13  Distrib 8.4.3, for Win64 (x86_64)
--
-- Host: localhost    Database: property_management_db
-- ------------------------------------------------------
-- Server version	8.4.3

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `property_management_db`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `property_management_db` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `property_management_db`;

--
-- Table structure for table `activity_logs`
--

DROP TABLE IF EXISTS `activity_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `activity_logs` (
  `log_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `module_name` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `activity` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `activity_date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`log_id`),
  KEY `fk_logs_user` (`user_id`),
  CONSTRAINT `fk_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `activity_logs`
--

LOCK TABLES `activity_logs` WRITE;
/*!40000 ALTER TABLE `activity_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `activity_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `addresses`
--

DROP TABLE IF EXISTS `addresses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `addresses` (
  `address_id` int unsigned NOT NULL AUTO_INCREMENT,
  `house_number` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `street` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `barangay` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `municipality` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `province` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `postal_code` varchar(15) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`address_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `addresses`
--

LOCK TABLES `addresses` WRITE;
/*!40000 ALTER TABLE `addresses` DISABLE KEYS */;
/*!40000 ALTER TABLE `addresses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ai_predictions`
--

DROP TABLE IF EXISTS `ai_predictions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ai_predictions` (
  `prediction_id` int unsigned NOT NULL AUTO_INCREMENT,
  `property_id` int unsigned NOT NULL,
  `predicted_market_value` decimal(15,2) NOT NULL,
  `predicted_assessed_value` decimal(15,2) NOT NULL,
  `confidence_score` decimal(5,2) NOT NULL,
  `prediction_reason` text COLLATE utf8mb4_unicode_ci,
  `prediction_date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `approved_by_user_id` int unsigned DEFAULT NULL,
  `prediction_status` enum('pending','approved','edited','rejected') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  PRIMARY KEY (`prediction_id`),
  KEY `fk_predictions_property` (`property_id`),
  KEY `fk_predictions_approver` (`approved_by_user_id`),
  CONSTRAINT `fk_predictions_approver` FOREIGN KEY (`approved_by_user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_predictions_property` FOREIGN KEY (`property_id`) REFERENCES `properties` (`property_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ai_predictions`
--

LOCK TABLES `ai_predictions` WRITE;
/*!40000 ALTER TABLE `ai_predictions` DISABLE KEYS */;
/*!40000 ALTER TABLE `ai_predictions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `assessment_levels`
--

DROP TABLE IF EXISTS `assessment_levels`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `assessment_levels` (
  `assessment_level_id` int unsigned NOT NULL AUTO_INCREMENT,
  `classification_id` int unsigned NOT NULL,
  `assessment_percentage` decimal(5,2) NOT NULL,
  PRIMARY KEY (`assessment_level_id`),
  UNIQUE KEY `uq_assessment_classification` (`classification_id`),
  CONSTRAINT `fk_levels_classification` FOREIGN KEY (`classification_id`) REFERENCES `property_classifications` (`classification_id`),
  CONSTRAINT `chk_assessment_percentage` CHECK ((`assessment_percentage` between 0 and 100))
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `assessment_levels`
--

LOCK TABLES `assessment_levels` WRITE;
/*!40000 ALTER TABLE `assessment_levels` DISABLE KEYS */;
INSERT INTO `assessment_levels` VALUES (1,1,20.00),(2,2,50.00),(3,3,40.00),(4,4,50.00);
/*!40000 ALTER TABLE `assessment_levels` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `gis_locations`
--

DROP TABLE IF EXISTS `gis_locations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `gis_locations` (
  `location_id` int unsigned NOT NULL AUTO_INCREMENT,
  `property_id` int unsigned NOT NULL,
  `latitude` decimal(10,7) NOT NULL,
  `longitude` decimal(10,7) NOT NULL,
  `gps_accuracy` decimal(8,2) DEFAULT NULL,
  `last_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`location_id`),
  UNIQUE KEY `property_id` (`property_id`),
  CONSTRAINT `fk_gis_property` FOREIGN KEY (`property_id`) REFERENCES `properties` (`property_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `gis_locations`
--

LOCK TABLES `gis_locations` WRITE;
/*!40000 ALTER TABLE `gis_locations` DISABLE KEYS */;
/*!40000 ALTER TABLE `gis_locations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `owner_addresses`
--

DROP TABLE IF EXISTS `owner_addresses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `owner_addresses` (
  `owner_address_id` int unsigned NOT NULL AUTO_INCREMENT,
  `owner_id` int unsigned NOT NULL,
  `address_id` int unsigned NOT NULL,
  PRIMARY KEY (`owner_address_id`),
  UNIQUE KEY `uq_owner_address` (`owner_id`,`address_id`),
  KEY `fk_owner_addresses_address` (`address_id`),
  CONSTRAINT `fk_owner_addresses_address` FOREIGN KEY (`address_id`) REFERENCES `addresses` (`address_id`),
  CONSTRAINT `fk_owner_addresses_owner` FOREIGN KEY (`owner_id`) REFERENCES `property_owners` (`owner_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `owner_addresses`
--

LOCK TABLES `owner_addresses` WRITE;
/*!40000 ALTER TABLE `owner_addresses` DISABLE KEYS */;
/*!40000 ALTER TABLE `owner_addresses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `properties`
--

DROP TABLE IF EXISTS `properties`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `properties` (
  `property_id` int unsigned NOT NULL AUTO_INCREMENT,
  `owner_id` int unsigned NOT NULL,
  `address_id` int unsigned NOT NULL,
  `property_type_id` int unsigned NOT NULL,
  `classification_id` int unsigned NOT NULL,
  `lot_number` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title_number` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lot_area` decimal(12,2) DEFAULT NULL,
  `building_area` decimal(12,2) DEFAULT NULL,
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `property_status` enum('active','inactive','pending') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`property_id`),
  UNIQUE KEY `lot_number` (`lot_number`),
  UNIQUE KEY `title_number` (`title_number`),
  KEY `fk_properties_owner` (`owner_id`),
  KEY `fk_properties_address` (`address_id`),
  KEY `fk_properties_type` (`property_type_id`),
  KEY `fk_properties_classification` (`classification_id`),
  CONSTRAINT `fk_properties_address` FOREIGN KEY (`address_id`) REFERENCES `addresses` (`address_id`),
  CONSTRAINT `fk_properties_classification` FOREIGN KEY (`classification_id`) REFERENCES `property_classifications` (`classification_id`),
  CONSTRAINT `fk_properties_owner` FOREIGN KEY (`owner_id`) REFERENCES `property_owners` (`owner_id`),
  CONSTRAINT `fk_properties_type` FOREIGN KEY (`property_type_id`) REFERENCES `property_types` (`property_type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `properties`
--

LOCK TABLES `properties` WRITE;
/*!40000 ALTER TABLE `properties` DISABLE KEYS */;
/*!40000 ALTER TABLE `properties` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `property_assessments`
--

DROP TABLE IF EXISTS `property_assessments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `property_assessments` (
  `assessment_id` int unsigned NOT NULL AUTO_INCREMENT,
  `property_id` int unsigned NOT NULL,
  `assessor_user_id` int unsigned NOT NULL,
  `assessment_level_id` int unsigned NOT NULL,
  `market_value` decimal(15,2) NOT NULL,
  `assessed_value` decimal(15,2) NOT NULL,
  `assessment_date` date NOT NULL,
  `remarks` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`assessment_id`),
  KEY `fk_assessments_property` (`property_id`),
  KEY `fk_assessments_user` (`assessor_user_id`),
  KEY `fk_assessments_level` (`assessment_level_id`),
  CONSTRAINT `fk_assessments_level` FOREIGN KEY (`assessment_level_id`) REFERENCES `assessment_levels` (`assessment_level_id`),
  CONSTRAINT `fk_assessments_property` FOREIGN KEY (`property_id`) REFERENCES `properties` (`property_id`),
  CONSTRAINT `fk_assessments_user` FOREIGN KEY (`assessor_user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `property_assessments`
--

LOCK TABLES `property_assessments` WRITE;
/*!40000 ALTER TABLE `property_assessments` DISABLE KEYS */;
/*!40000 ALTER TABLE `property_assessments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `property_classifications`
--

DROP TABLE IF EXISTS `property_classifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `property_classifications` (
  `classification_id` int unsigned NOT NULL AUTO_INCREMENT,
  `classification_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`classification_id`),
  UNIQUE KEY `classification_name` (`classification_name`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `property_classifications`
--

LOCK TABLES `property_classifications` WRITE;
/*!40000 ALTER TABLE `property_classifications` DISABLE KEYS */;
INSERT INTO `property_classifications` VALUES (3,'Agricultural Land'),(2,'Commercial Lot'),(4,'Industrial Lot'),(1,'Residential Lot');
/*!40000 ALTER TABLE `property_classifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `property_owners`
--

DROP TABLE IF EXISTS `property_owners`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `property_owners` (
  `owner_id` int unsigned NOT NULL AUTO_INCREMENT,
  `first_name` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `middle_name` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_name` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_number` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`owner_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `property_owners`
--

LOCK TABLES `property_owners` WRITE;
/*!40000 ALTER TABLE `property_owners` DISABLE KEYS */;
/*!40000 ALTER TABLE `property_owners` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `property_types`
--

DROP TABLE IF EXISTS `property_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `property_types` (
  `property_type_id` int unsigned NOT NULL AUTO_INCREMENT,
  `property_type_name` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`property_type_id`),
  UNIQUE KEY `property_type_name` (`property_type_name`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `property_types`
--

LOCK TABLES `property_types` WRITE;
/*!40000 ALTER TABLE `property_types` DISABLE KEYS */;
INSERT INTO `property_types` VALUES (3,'Agricultural'),(2,'Commercial'),(4,'Industrial'),(1,'Residential');
/*!40000 ALTER TABLE `property_types` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `role_id` int unsigned NOT NULL AUTO_INCREMENT,
  `role_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`role_id`),
  UNIQUE KEY `role_name` (`role_name`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,'Administrator'),(2,'Assessor'),(3,'Staff');
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tax_declarations`
--

DROP TABLE IF EXISTS `tax_declarations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tax_declarations` (
  `tax_declaration_id` int unsigned NOT NULL AUTO_INCREMENT,
  `property_id` int unsigned NOT NULL,
  `assessment_id` int unsigned NOT NULL,
  `declaration_number` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tax_year` year NOT NULL,
  `issue_date` date NOT NULL,
  PRIMARY KEY (`tax_declaration_id`),
  UNIQUE KEY `declaration_number` (`declaration_number`),
  KEY `fk_declarations_property` (`property_id`),
  KEY `fk_declarations_assessment` (`assessment_id`),
  CONSTRAINT `fk_declarations_assessment` FOREIGN KEY (`assessment_id`) REFERENCES `property_assessments` (`assessment_id`),
  CONSTRAINT `fk_declarations_property` FOREIGN KEY (`property_id`) REFERENCES `properties` (`property_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tax_declarations`
--

LOCK TABLES `tax_declarations` WRITE;
/*!40000 ALTER TABLE `tax_declarations` DISABLE KEYS */;
/*!40000 ALTER TABLE `tax_declarations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `user_id` int unsigned NOT NULL AUTO_INCREMENT,
  `first_name` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_name` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `username` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role_id` int unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`),
  KEY `fk_users_role` (`role_id`),
  CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-08-11 23:59:23
