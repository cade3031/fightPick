-- First, create the database
CREATE DATABASE fightpick_db;

-- Connect to the database
\c fightpick_db

-- Create fighters table to store all fighter information
CREATE TABLE fighters (
    id SERIAL PRIMARY KEY,                              -- Auto-incrementing unique ID
    name VARCHAR(100) NOT NULL,                         -- Fighter's name (required)
    age INTEGER,                                        -- Fighter's age
    height INTEGER,                                     -- Height in cm
    reach INTEGER,                                      -- Reach in cm
    world_ranking INTEGER,                              -- Current world ranking
    wins INTEGER DEFAULT 0,                             -- Total wins
    losses INTEGER DEFAULT 0,                           -- Total losses
    ko_wins INTEGER DEFAULT 0,                          -- Knockout wins
    sub_wins INTEGER DEFAULT 0,                         -- Submission wins
    decision_wins INTEGER DEFAULT 0,                    -- Decision wins
    strike_accuracy DECIMAL(5,2),                       -- Strike accuracy percentage
    takedown_accuracy DECIMAL(5,2),                     -- Takedown success rate
    takedown_defense DECIMAL(5,2),                      -- Takedown defense rate
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,     -- When record was created
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP    -- Last update timestamp
);

-- Create fight_analyses table to store AI and statistical analysis of fights
CREATE TABLE fight_analyses (
    id SERIAL PRIMARY KEY,                              -- Auto-incrementing unique ID
    event_date TIMESTAMP,                               -- When the fight is scheduled
    fighter1_id INTEGER REFERENCES fighters(id),        -- Links to fighter 1 in fighters table
    fighter2_id INTEGER REFERENCES fighters(id),        -- Links to fighter 2 in fighters table
    fighter1_odds DECIMAL(10,2),                        -- Betting odds for fighter 1
    fighter2_odds DECIMAL(10,2),                        -- Betting odds for fighter 2
    distance_probability DECIMAL(5,2),                  -- Probability fight goes to decision
    finish_probability DECIMAL(5,2),                    -- Probability of a finish
    likely_method VARCHAR(50),                          -- Predicted method of victory
    confidence_level DECIMAL(5,2),                      -- AI confidence in prediction
    recommended_bet TEXT,                               -- Betting recommendation
    ai_analysis TEXT,                                   -- Full AI analysis text
    striking_advantage TEXT,                            -- Who has striking advantage
    grappling_advantage TEXT,                           -- Who has grappling advantage
    physical_advantages TEXT,                           -- Height/reach advantages
    win_probability_fighter1 DECIMAL(5,2),              -- Win probability for fighter 1
    win_probability_fighter2 DECIMAL(5,2),              -- Win probability for fighter 2
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,     -- When analysis was created
    status VARCHAR(20) DEFAULT 'pending'                -- Fight status (pending/completed)
);

-- Create parlays table to store parlay bet information
CREATE TABLE parlays (
    id SERIAL PRIMARY KEY,                              -- Auto-incrementing unique ID
    user_id INTEGER,                                    -- User who created the parlay
    parlay_name VARCHAR(100),                           -- Name of the parlay
    status VARCHAR(20) DEFAULT 'active',                -- Parlay status (active/settled)
    total_odds DECIMAL(10,2),                           -- Combined odds of all fights
    potential_payout DECIMAL(10,2),                     -- Potential winnings
    stake DECIMAL(10,2),                                -- Amount bet
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP      -- When parlay was created
);

-- Create parlay_fights table to link fights to parlays
CREATE TABLE parlay_fights (
    id SERIAL PRIMARY KEY,                              -- Auto-incrementing unique ID
    parlay_id INTEGER REFERENCES parlays(id),           -- Links to parlay table
    fight_analysis_id INTEGER REFERENCES fight_analyses(id), -- Links to fight analysis
    selected_fighter_id INTEGER REFERENCES fighters(id), -- Fighter picked to win
    odds DECIMAL(10,2),                                 -- Odds for this fight
    status VARCHAR(20) DEFAULT 'pending',               -- Fight status in parlay
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,     -- When fight was added
    CONSTRAINT fk_parlay FOREIGN KEY (parlay_id) REFERENCES parlays(id) ON DELETE CASCADE  -- Delete fight when parlay is deleted
);

-- Create indexes for faster querying
CREATE INDEX idx_fighters_name ON fighters(name);                    -- Fast lookup by fighter name
CREATE INDEX idx_fight_analyses_date ON fight_analyses(event_date);  -- Fast lookup by fight date
CREATE INDEX idx_parlay_fights_parlay_id ON parlay_fights(parlay_id); -- Fast lookup of fights in parlay