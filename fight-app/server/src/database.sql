-- First, create the database
CREATE DATABASE fightpick_db;

-- Connect to the database
\c fightpick_db

-- Create fighters table to store fighter information
CREATE TABLE fighters (
    id SERIAL PRIMARY KEY,  -- Auto-incrementing ID
    name VARCHAR(255) NOT NULL,
    age INTEGER,
    height VARCHAR(50),
    reach VARCHAR(50),
    world_ranking INTEGER,
    wins INTEGER,
    losses INTEGER,
    ko_wins INTEGER,
    sub_wins INTEGER,
    decision_wins INTEGER,
    strike_accuracy DECIMAL,
    takedown_accuracy DECIMAL,
    takedown_defense DECIMAL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create fight_analyses table to store fight predictions
CREATE TABLE fight_analyses (
    id SERIAL PRIMARY KEY,
    event_date TIMESTAMP DEFAULT NOW(),
    fighter1_id INTEGER REFERENCES fighters(id),  -- Links to fighters table
    fighter2_id INTEGER REFERENCES fighters(id),  -- Links to fighters table
    fighter1_odds VARCHAR(50),
    fighter2_odds VARCHAR(50),
    prediction JSONB,  -- Stores JSON prediction data
    ai_analysis TEXT,  -- Stores Ollama's analysis
    created_at TIMESTAMP DEFAULT NOW()
); 