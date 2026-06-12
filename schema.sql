-- Schema setup for Random Variable Simulation & Data Collector System

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'investigador')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Variables Table
CREATE TABLE IF NOT EXISTS variables (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    type VARCHAR(20) NOT NULL CHECK (type IN ('discreta', 'continua')),
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Data Records Table
CREATE TABLE IF NOT EXISTS data_records (
    id SERIAL PRIMARY KEY,
    variable_id INTEGER REFERENCES variables(id) ON DELETE CASCADE,
    value NUMERIC NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_data_records_variable_id ON data_records(variable_id);
