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
    // Add default values and validation
    const f1Wins = parseInt(fighter1.wins) || 0;
    const f1KoWins = parseInt(fighter1.koWins) || 0;
    const f1SubWins = parseInt(fighter1.subWins) || 0;
    const f1DecisionWins = parseInt(fighter1.decisionWins) || 0;
    
    const f2Wins = parseInt(fighter2.wins) || 0;
    const f2KoWins = parseInt(fighter2.koWins) || 0;
    const f2SubWins = parseInt(fighter2.subWins) || 0;
    const f2DecisionWins = parseInt(fighter2.decisionWins) || 0;

    // Calculate rates with validation
    const f1KoRate = f1Wins > 0 ? (f1KoWins / f1Wins) * 100 : 0;
    const f1SubRate = f1Wins > 0 ? (f1SubWins / f1Wins) * 100 : 0;
    const f1DecisionRate = f1Wins > 0 ? (f1DecisionWins / f1Wins) * 100 : 0;
    
    const f2KoRate = f2Wins > 0 ? (f2KoWins / f2Wins) * 100 : 0;
    const f2SubRate = f2Wins > 0 ? (f2SubWins / f2Wins) * 100 : 0;
    const f2DecisionRate = f2Wins > 0 ? (f2DecisionWins / f2Wins) * 100 : 0;

    // Calculate combined probabilities with validation
    const combinedKOProb = (f1KoRate + f2KoRate) / 2 || 0;
    const combinedSubProb = (f1SubRate + f2SubRate) / 2 || 0;
    const combinedDecisionProb = (f1DecisionRate + f2DecisionRate) / 2 || 0;
    const combinedFinishRate = Math.min(100, (combinedKOProb + combinedSubProb)) || 0;

    // Calculate win probabilities
    const f1TotalRate = f1Wins > 0 ? 
      ((f1KoWins + f1SubWins + f1DecisionWins) / f1Wins) * 100 : 0;
    const f2TotalRate = f2Wins > 0 ? 
      ((f2KoWins + f2SubWins + f2DecisionWins) / f2Wins) * 100 : 0;

    let outcome = {
      goesToDistance: combinedFinishRate < 65 ? "High" : "Low",
      finishProbability: combinedFinishRate,
      likelyMethod: null,
      confidence: null,
      recommendedBet: "",
      winProbability: {
        fighter1: f1TotalRate.toFixed(1),
        fighter2: f2TotalRate.toFixed(1)
      }
    };

    // Determine most likely finish method
    if (combinedFinishRate > 65) {
      outcome.likelyMethod = combinedKOProb > combinedSubProb ? "KO/TKO" : "Submission";
      outcome.confidence = Math.min(Math.max(combinedFinishRate, 60), 90);
    }

    // Generate betting recommendation
    if (combinedDecisionProb > 65) {
      outcome.recommendedBet = "Fight goes to decision (Confident)";
    } else if (combinedKOProb > 60) {
      outcome.recommendedBet = "Fight doesn't go to decision - Look for KO/TKO (High Confidence)";
    } else if (combinedSubProb > 60) {
      outcome.recommendedBet = "Fight doesn't go to decision - Look for Submission (High Confidence)";
    } else if ((combinedKOProb + combinedSubProb) > 70) {
      outcome.recommendedBet = "Fight doesn't go to decision (Moderate Confidence)";
    } else {
      outcome.recommendedBet = "No strong lean on fight outcome method";
    }

    return {
      prediction: outcome,
      analysis: `Fight Outcome Analysis:\n` +
                `Distance Probability: ${outcome.goesToDistance} (${(combinedDecisionProb).toFixed(1)}%)\n` +
                `Finish Probability: ${combinedFinishRate.toFixed(1)}%\n` +
                `${outcome.likelyMethod ? `Most Likely Method: ${outcome.likelyMethod} (${outcome.confidence.toFixed(1)}% confidence)\n` : ''}\n` +
                `Safe Bet Recommendation: ${outcome.recommendedBet}\n` +
                `Win Probability:\n` +
                `${fighter1.name}: ${outcome.winProbability.fighter1}%\n` +
                `${fighter2.name}: ${outcome.winProbability.fighter2}%`
    };
  } catch (error) {
    console.error('Error in predictFightOutcome:', error);
    return {
      prediction: {
        goesToDistance: "Unknown",
        finishProbability: 0,
        recommendedBet: "Insufficient data for prediction",
        winProbability: {
          fighter1: "0.0",
          fighter2: "0.0"
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
    console.log("Starting Ollama analysis...");

    const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model: "llama2:7b-chat",
      prompt: `Analyze this UFC fight briefly:
      ${fighter1.name} (${fighter1.wins}-${fighter1.losses}) vs ${fighter2.name} (${fighter2.wins}-${fighter2.losses})
      
      Key stats for ${fighter1.name}:
      - Strike Accuracy: ${fighter1.strikeAccuracy}%
      - Takedown Accuracy: ${fighter1.takedownAccuracy}%
      
      Key stats for ${fighter2.name}:
      - Strike Accuracy: ${fighter2.strikeAccuracy}%
      - Takedown Accuracy: ${fighter2.takedownAccuracy}%
      
      Provide a short analysis focusing on who has the advantage.`,
      stream: false,
      options: {
        temperature: 0.7,
        max_tokens: 200  // Limit response length
      }
    }, {
      timeout: 30000  // 30 second timeout
    });

    console.log("Ollama response received:", response.data);
    return response.data.response || "Analysis not available";
  } catch (error) {
    console.error('Ollama error:', error);
    // Return a default analysis if Ollama fails
    return `Technical analysis based on stats: ${fighter1.name} vs ${fighter2.name}`;
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
