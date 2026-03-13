-- RoomCraft Designer - Database Schema
-- Compatible with MySQL 8+ and PostgreSQL 14+

CREATE DATABASE IF NOT EXISTS roomcraft;
USE roomcraft;

-- Users table
CREATE TABLE users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER',
    avatar_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Projects (room designs)
CREATE TABLE projects (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    thumbnail_url VARCHAR(255),
    room_config JSON NOT NULL COMMENT 'Stores room shape, dimensions, wall color, floor texture etc.',
    furniture_layout JSON COMMENT 'Stores array of placed furniture items with positions/rotations',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Furniture model library
CREATE TABLE furniture_models (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL COMMENT 'e.g. Sofa, Chair, Table, Bed, Lamp',
    subcategory VARCHAR(50),
    model_url VARCHAR(255) COMMENT 'Path to OBJ/GLTF file',
    thumbnail_url VARCHAR(255),
    width DECIMAL(6,2) COMMENT 'Real-world width in meters',
    height DECIMAL(6,2) COMMENT 'Real-world height in meters',
    depth DECIMAL(6,2) COMMENT 'Real-world depth in meters',
    tags VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    uploaded_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Seed default admin
INSERT INTO users (username, email, password_hash, role) VALUES
('admin', 'admin@roomcraft.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'ADMIN'),
('demo', 'demo@roomcraft.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'USER');
-- Default password: password123

-- Seed furniture library
INSERT INTO furniture_models (name, category, subcategory, width, height, depth, tags) VALUES
('Modern Sofa', 'Seating', 'Sofa', 2.20, 0.85, 0.90, 'sofa,couch,living room'),
('Armchair', 'Seating', 'Chair', 0.85, 0.90, 0.85, 'chair,armchair,living room'),
('Dining Chair', 'Seating', 'Chair', 0.50, 0.95, 0.50, 'chair,dining'),
('Coffee Table', 'Tables', 'Coffee Table', 1.20, 0.45, 0.60, 'table,living room'),
('Dining Table', 'Tables', 'Dining Table', 1.80, 0.75, 0.90, 'table,dining'),
('King Bed', 'Bedroom', 'Bed', 1.93, 0.55, 2.13, 'bed,bedroom,king'),
('Wardrobe', 'Bedroom', 'Storage', 1.80, 2.10, 0.60, 'wardrobe,storage,bedroom'),
('Bookshelf', 'Storage', 'Shelf', 0.80, 1.80, 0.30, 'shelf,storage,books'),
('Desk', 'Office', 'Desk', 1.40, 0.75, 0.70, 'desk,office,work'),
('Office Chair', 'Seating', 'Chair', 0.60, 1.10, 0.60, 'chair,office'),
('Floor Lamp', 'Lighting', 'Lamp', 0.35, 1.60, 0.35, 'lamp,lighting'),
('TV Unit', 'Living Room', 'Media', 1.50, 0.50, 0.40, 'tv,media,living room'),
('Bathroom Sink', 'Bathroom', 'Sink', 0.60, 0.85, 0.45, 'sink,bathroom'),
('Bathtub', 'Bathroom', 'Bath', 1.70, 0.55, 0.75, 'bathtub,bathroom'),
('Kitchen Counter', 'Kitchen', 'Counter', 2.00, 0.90, 0.60, 'counter,kitchen');
