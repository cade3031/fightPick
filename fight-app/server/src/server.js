const express = require('express');
const cors = require('cors');
const app = express();
const axios = require('axios');
const { Pool } = require('pg');
const pool = require('./config/db');

// Update CORS configuration
app.use(cors({
  origin: ['http://100.119.251.66:3000', 'http://localhost:3000'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));

// Add middleware
app.use(express.json());

// Helper functions
const analyzeFightingStyle = (fighter) => {
  try {
    const wins = parseInt(fighter.wins) || 0;
    const koWins = parseInt(fighter.koWins) || 0;
    const subWins = parseInt(fighter.subWins) || 0;
    const decisionWins = parseInt(fighter.decisionWins) || 0;
    const tdAccuracy = parseFloat(fighter.takedownAccuracy) || 0;
    const strikeAcc = parseFloat(fighter.strikeAccuracy) || 0;

    // Calculate percentages
    const koRate = wins > 0 ? (koWins / wins) * 100 : 0;
    const subRate = wins > 0 ? (subWins / wins) * 100 : 0;
    const decisionRate = wins > 0 ? (decisionWins / wins) * 100 : 0;

    // Determine fighting style
    if (tdAccuracy > 60 && subRate > 30) return "Dominant Grappler";
    if (koRate > 50 && strikeAcc > 50) return "Power Striker";
    if (strikeAcc > 55) return "Technical Striker";
    if (tdAccuracy > 50 && subRate > 20) return "Wrestling-Based";
    if (decisionRate > 50) return "Point Fighter";
    return "Well-rounded";
  } catch (error) {
    console.error('Error in analyzeFightingStyle:', error);
    return "Style Unknown";
  }
};

const calculateAdvantages = (f1, f2) => {
  const reachDiff = parseInt(f1.reach) - parseInt(f2.reach);
  const heightDiff = parseInt(f1.height) - parseInt(f2.height);
  const ageDiff = parseInt(f2.age) - parseInt(f1.age);
  const strikingDiff = parseFloat(f1.strikeAccuracy) - parseFloat(f2.strikeAccuracy);
  const tdDiff = parseFloat(f1.takedownAccuracy) - parseFloat(f2.takedownDefense);
  
  return {
    physical: { reachDiff, heightDiff, ageDiff },
    technical: { strikingDiff, tdDiff }
  };
};

const calculateWinRate = (fighter) => {
  const totalFights = parseInt(fighter.wins) + parseInt(fighter.losses);
  const winRate = totalFights > 0 ? (parseInt(fighter.wins) / totalFights) * 100 : 0;
  const finishRate = parseInt(fighter.wins) > 0 ? 
    ((parseInt(fighter.koWins) + parseInt(fighter.subWins)) / parseInt(fighter.wins)) * 100 : 0;
  return { winRate, finishRate };
};

const analyzeGrapplingAdvantage = (f1, f2) => {
  const f1TDOffense = parseFloat(f1.takedownAccuracy) || 0;
  const f2TDDefense = parseFloat(f2.takedownDefense) || 0;
  const advantage = f1TDOffense - f2TDDefense;
  
  if (advantage > 20) return "Significant takedown advantage";
  if (advantage > 10) return "Slight takedown advantage";
  if (advantage < -10) return "Takedown disadvantage";
  return "Even grappling match";
};

// Add this function after your other analysis functions
const predictFightOutcome = (fighter1, fighter2) => {
  try {
    // Calculate win probabilities based on records and stats
    const f1Wins = parseInt(fighter1.wins) || 0;
    const f1Losses = parseInt(fighter1.losses) || 0;
    const f2Wins = parseInt(fighter2.wins) || 0;
    const f2Losses = parseInt(fighter2.losses) || 0;

    // Calculate win rates
    const f1WinRate = f1Wins / (f1Wins + f1Losses) * 100;
    const f2WinRate = f2Wins / (f2Wins + f2Losses) * 100;

    // Adjust probabilities based on stats
    const f1StrikeBonus = (parseFloat(fighter1.strikeAccuracy) || 0) / 100;
    const f2StrikeBonus = (parseFloat(fighter2.strikeAccuracy) || 0) / 100;
    const f1TakedownBonus = (parseFloat(fighter1.takedownAccuracy) || 0) / 100;
    const f2TakedownBonus = (parseFloat(fighter2.takedownAccuracy) || 0) / 100;

    // Calculate final probabilities
    let f1Probability = (f1WinRate + (f1StrikeBonus + f1TakedownBonus) * 25) / 1.5;
    let f2Probability = (f2WinRate + (f2StrikeBonus + f2TakedownBonus) * 25) / 1.5;

    // Normalize probabilities to sum to 100%
    const total = f1Probability + f2Probability;
    f1Probability = (f1Probability / total * 100).toFixed(1);
    f2Probability = (f2Probability / total * 100).toFixed(1);

    // Rest of your existing code...
    const outcome = {
      goesToDistance: combinedFinishRate < 65 ? "High" : "Low",
      finishProbability: combinedFinishRate,
      likelyMethod: null,
      confidence: null,
      recommendedBet: "",
      winProbability: {
        fighter1: f1Probability,
        fighter2: f2Probability
      }
    };

    return {
      prediction: outcome,
      analysis: `Fight Analysis:\n` +
                `Win Probability:\n` +
                `${fighter1.name}: ${f1Probability}%\n` +
                `${fighter2.name}: ${f2Probability}%`
    };
  } catch (error) {
    console.error('Error in predictFightOutcome:', error);
    return {
      prediction: {
        goesToDistance: "Unknown",
        finishProbability: 0,
        recommendedBet: "Insufficient data for prediction",
        winProbability: {
          fighter1: "50.0",
          fighter2: "50.0"
        }
      },
      analysis: 'Unable to predict fight outcome - insufficient data'
    };
  }
};

// Update this constant
const OLLAMA_URL = process.env.OLLAMA_URL || "http://ollama:11434";

// Add this function to call Ollama
const getOllamaAnalysis = async (fighter1, fighter2, stats) => {
  try {
    console.log("Starting llama2:13b analysis...");

    const prompt = `As an expert UFC analyst, provide a detailed analysis of this fight:

${fighter1.name} vs ${fighter2.name}

Fighter Stats:

${fighter1.name}:
- Record: ${fighter1.wins}-${fighter1.losses}
- KO Rate: ${((fighter1.koWins/fighter1.wins) * 100).toFixed(1)}%
- Strike Accuracy: ${fighter1.strikeAccuracy}%
- Takedown Accuracy: ${fighter1.takedownAccuracy}%
- Takedown Defense: ${fighter1.takedownDefense}%

${fighter2.name}:
- Record: ${fighter2.wins}-${fighter2.losses}
- KO Rate: ${((fighter2.koWins/fighter2.wins) * 100).toFixed(1)}%
- Strike Accuracy: ${fighter2.strikeAccuracy}%
- Takedown Accuracy: ${fighter2.takedownAccuracy}%
- Takedown Defense: ${fighter2.takedownDefense}%

Provide a comprehensive analysis covering:

1. Striking Analysis:
- Compare their striking statistics
- Who has the technical advantage?
- How might their striking styles match up?

2. Grappling Assessment:
- Compare takedown and defense abilities
- Who has the wrestling/grappling edge?
- How will this affect the fight?

3. Path to Victory:
- What is each fighter's best strategy?
- Most likely way to win for each?

4. Final Prediction:
- Who is most likely to win and why?
- What method of victory?
- Confidence level in prediction?

Explain your reasoning thoroughly.`;

    const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model: "llama2:13b",
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.8,
        top_p: 0.95,
        max_tokens: 2000,
        stop: ["Human:", "Assistant:", "User:"]
      }
    }, {
      timeout: 120000
    });

    console.log("Received llama2:13b response:", response.data);
    
    if (!response.data || !response.data.response) {
      throw new Error('Invalid response format from llama2:13b');
    }

    return response.data.response.trim();
  } catch (error) {
    console.error('llama2:13b error:', error);
    return `AI analysis unavailable - ${error.message}`;
  }
};

// Add this function to save detailed fight analysis
const saveFightAnalysis = async (analysisData) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const insertQuery = `
      INSERT INTO fight_analyses (
        event_date,
        fighter1_id,
        fighter2_id,
        fighter1_odds,
        fighter2_odds,
        distance_probability,
        finish_probability,
        likely_method,
        confidence_level,
        recommended_bet,
        ai_analysis,
        striking_advantage,
        grappling_advantage,
        physical_advantages,
        win_probability_fighter1,
        win_probability_fighter2
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING id
    `;
    
    const values = [
      analysisData.eventDate,
      analysisData.fighter1Id,
      analysisData.fighter2Id,
      analysisData.fighter1Odds,
      analysisData.fighter2Odds,
      analysisData.distanceProbability,
      analysisData.finishProbability,
      analysisData.likelyMethod,
      analysisData.confidenceLevel,
      analysisData.recommendedBet,
      analysisData.aiAnalysis,
      analysisData.strikingAdvantage,
      analysisData.grapplingAdvantage,
      analysisData.physicalAdvantages,
      analysisData.winProbabilityFighter1,
      analysisData.winProbabilityFighter2
    ];

    const result = await client.query(insertQuery, values);
    await client.query('COMMIT');
    return result.rows[0].id;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Add this function to save/update fighter data
const saveFighterData = async (fighterData) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Check if fighter exists
    const checkQuery = `
      SELECT id FROM fighters WHERE name = $1
    `;
    const existingFighter = await client.query(checkQuery, [fighterData.name]);
    
    if (existingFighter.rows.length > 0) {
      // Update existing fighter
      const updateQuery = `
        UPDATE fighters SET
          age = $1,
          height = $2,
          reach = $3,
          world_ranking = $4,
          wins = $5,
          losses = $6,
          ko_wins = $7,
          sub_wins = $8,
          decision_wins = $9,
          strike_accuracy = $10,
          takedown_accuracy = $11,
          takedown_defense = $12,
          last_updated = NOW()
        WHERE name = $13
        RETURNING id
      `;
      
      const values = [
        parseInt(fighterData.age) || 0,
        parseInt(fighterData.height) || 0,
        parseInt(fighterData.reach) || 0,
        parseInt(fighterData.worldRanking) || 0,
        parseInt(fighterData.wins) || 0,
        parseInt(fighterData.losses) || 0,
        parseInt(fighterData.koWins) || 0,
        parseInt(fighterData.subWins) || 0,
        parseInt(fighterData.decisionWins) || 0,
        parseFloat(fighterData.strikeAccuracy) || 0,
        parseFloat(fighterData.takedownAccuracy) || 0,
        parseFloat(fighterData.takedownDefense) || 0,
        fighterData.name
      ];

      const result = await client.query(updateQuery, values);
      await client.query('COMMIT');
      return result.rows[0].id;
    } else {
      // Insert new fighter
      const insertQuery = `
        INSERT INTO fighters (
          name, age, height, reach, world_ranking,
          wins, losses, ko_wins, sub_wins, decision_wins,
          strike_accuracy, takedown_accuracy, takedown_defense
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id
      `;
      
      const values = [
        fighterData.name,
        parseInt(fighterData.age) || 0,
        parseInt(fighterData.height) || 0,
        parseInt(fighterData.reach) || 0,
        parseInt(fighterData.worldRanking) || 0,
        parseInt(fighterData.wins) || 0,
        parseInt(fighterData.losses) || 0,
        parseInt(fighterData.koWins) || 0,
        parseInt(fighterData.subWins) || 0,
        parseInt(fighterData.decisionWins) || 0,
        parseFloat(fighterData.strikeAccuracy) || 0,
        parseFloat(fighterData.takedownAccuracy) || 0,
        parseFloat(fighterData.takedownDefense) || 0
      ];

      const result = await client.query(insertQuery, values);
      await client.query('COMMIT');
      return result.rows[0].id;
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in saveFighterData:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Add this endpoint
app.post("/api/save-analysis", async (req, res) => {
  const client = await pool.connect();
  try {
    const { fighters, prediction, fightOutcome, bettingAdvice } = req.body;
    
    const insertQuery = `
      INSERT INTO fight_analyses (
        fighter1_name, fighter2_name,
        fighter1_stats, fighter2_stats,
        prediction, betting_advice,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING id
    `;
    
    const values = [
      fighters.fighter1.name,
      fighters.fighter2.name,
      JSON.stringify(fighters.fighter1),
      JSON.stringify(fighters.fighter2),
      JSON.stringify(prediction),
      JSON.stringify(bettingAdvice)
    ];

    const result = await client.query(insertQuery, values);
    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Error saving analysis:', error);
    res.status(500).json({ error: 'Failed to save analysis' });
  } finally {
    client.release();
  }
});

// Main prediction endpoint
app.post("/api/predict", async (req, res) => {
  try {
    console.log("Processing fight analysis...");

    // Save fighter data first
    const [fighter1Id, fighter2Id] = await Promise.all([
      saveFighterData(req.body.fighter1),
      saveFighterData(req.body.fighter2)
    ]);

    // Get both analysis results in parallel
    const [outcomeAnalysis, aiAnalysis] = await Promise.all([
      predictFightOutcome(req.body.fighter1, req.body.fighter2),
      getOllamaAnalysis(req.body.fighter1, req.body.fighter2, "")
    ]);

    const response = {
      message: aiAnalysis,
      aiAnalysis: true,
      fighter1Probability: outcomeAnalysis.prediction.winProbability?.fighter1 || "50.0",
      fighter2Probability: outcomeAnalysis.prediction.winProbability?.fighter2 || "50.0",
      simulationConfidence: outcomeAnalysis.prediction.confidence || 80,
      suggestedBet: outcomeAnalysis.prediction.recommendedBet || 'No recommendation',
      fightOutcome: outcomeAnalysis.prediction
    };

    res.json(response);
  } catch (error) {
    console.error('Error in fight analysis:', error);
    res.status(500).json({
      error: 'Failed to analyze fight',
      details: error.message
    });
  }
});

// Save fight analysis
app.post('/api/save-analysis', async (req, res) => {
  try {
    const { fighters, prediction } = req.body;
    
    const result = await pool.query(
      'INSERT INTO analyzed_fights (fighter1_data, fighter2_data, prediction_data) VALUES ($1, $2, $3) RETURNING *',
      [fighters.fighter1, fighters.fighter2, prediction]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all analyzed fights
app.get('/api/analyzed-fights', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM analyzed_fights ORDER BY timestamp DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add these functions after your existing functions

// Create a new parlay
const createParlay = async (userId, parlayName, stake) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const insertQuery = `
      INSERT INTO parlays (user_id, parlay_name, stake)
      VALUES ($1, $2, $3)
      RETURNING id
    `;
    
    const result = await client.query(insertQuery, [userId, parlayName, stake]);
    await client.query('COMMIT');
    return result.rows[0].id;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Add a fight to a parlay
const addFightToParlay = async (parlayId, fighter1Id, fighter2Id, selectedFighterId, odds, fightDate) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const insertQuery = `
      INSERT INTO parlay_fights (
        parlay_id, fighter1_id, fighter2_id, 
        selected_fighter_id, odds, fight_date
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;
    
    const result = await client.query(insertQuery, [
      parlayId, fighter1Id, fighter2Id, 
      selectedFighterId, odds, fightDate
    ]);

    // Update total odds in parlay
    await client.query(`
      UPDATE parlays 
      SET total_odds = (
        SELECT COALESCE(PRODUCT(odds), 1)
        FROM parlay_fights
        WHERE parlay_id = $1
      )
      WHERE id = $1
    `, [parlayId]);

    await client.query('COMMIT');
    return result.rows[0].id;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Add these endpoints

// Create new parlay
app.post("/api/parlays", async (req, res) => {
  try {
    const { userId, parlayName, stake } = req.body;
    const parlayId = await createParlay(userId, parlayName, stake);
    res.json({ success: true, parlayId });
  } catch (error) {
    console.error('Error creating parlay:', error);
    res.status(500).json({ error: 'Failed to create parlay' });
  }
});

// Add fight to parlay
app.post("/api/parlays/:parlayId/fights", async (req, res) => {
  try {
    const { parlayId } = req.params;
    const { fighter1Id, fighter2Id, selectedFighterId, odds, fightDate } = req.body;
    
    const fightId = await addFightToParlay(
      parlayId, 
      fighter1Id, 
      fighter2Id, 
      selectedFighterId, 
      odds, 
      fightDate
    );
    
    res.json({ success: true, fightId });
  } catch (error) {
    console.error('Error adding fight to parlay:', error);
    res.status(500).json({ error: 'Failed to add fight to parlay' });
  }
});

// Get parlay details
app.get("/api/parlays/:parlayId", async (req, res) => {
  const client = await pool.connect();
  try {
    const { parlayId } = req.params;
    
    const parlayResult = await client.query(`
      SELECT p.*, 
        json_agg(json_build_object(
          'fightId', pf.id,
          'fighter1', f1.name,
          'fighter2', f2.name,
          'selectedFighter', f3.name,
          'odds', pf.odds,
          'fightDate', pf.fight_date,
          'status', pf.status
        )) as fights
      FROM parlays p
      LEFT JOIN parlay_fights pf ON p.id = pf.parlay_id
      LEFT JOIN fighters f1 ON pf.fighter1_id = f1.id
      LEFT JOIN fighters f2 ON pf.fighter2_id = f2.id
      LEFT JOIN fighters f3 ON pf.selected_fighter_id = f3.id
      WHERE p.id = $1
      GROUP BY p.id
    `, [parlayId]);

    if (parlayResult.rows.length === 0) {
      return res.status(404).json({ error: 'Parlay not found' });
    }

    res.json(parlayResult.rows[0]);
  } catch (error) {
    console.error('Error fetching parlay:', error);
    res.status(500).json({ error: 'Failed to fetch parlay details' });
  } finally {
    client.release();
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Server URL: http://localhost:${PORT}`);
});

// Add this function
const validateFighterData = (fighter) => {
  if (!fighter.name) return false;
  
  // Convert strings to numbers and provide defaults
  return {
    ...fighter,
    wins: parseInt(fighter.wins) || 0,
    losses: parseInt(fighter.losses) || 0,
    koWins: parseInt(fighter.koWins) || 0,
    subWins: parseInt(fighter.subWins) || 0,
    decisionWins: parseInt(fighter.decisionWins) || 0,
    strikeAccuracy: parseFloat(fighter.strikeAccuracy) || 0,
    takedownAccuracy: parseFloat(fighter.takedownAccuracy) || 0,
    takedownDefense: parseFloat(fighter.takedownDefense) || 0
  };
};
