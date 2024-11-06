const express = require('express');
const cors = require('cors');
const app = express();
const axios = require('axios');
const pool = require('./config/db');

// Define constants
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://ollama:11434';
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

// Middleware
app.use(express.json());
app.use(cors({
  origin: ['http://100.119.251.66:3000', 'http://localhost:3000', '*'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// Request logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  next();
});

// Basic test endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Server is running' });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    database: 'connected',
    ollama: OLLAMA_URL
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API is working!',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Add these functions at the top
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

    // Calculate finish rates
    const f1KoRate = (parseInt(fighter1.koWins) / f1Wins) * 100 || 0;
    const f2KoRate = (parseInt(fighter2.koWins) / f2Wins) * 100 || 0;
    const combinedFinishRate = (f1KoRate + f2KoRate) / 2;

    return {
      prediction: {
        goesToDistance: combinedFinishRate < 65 ? "High" : "Low",
        finishProbability: combinedFinishRate,
        confidence: 80,
        recommendedBet: "",
        winProbability: {
          fighter1: f1WinRate.toFixed(1),
          fighter2: f2WinRate.toFixed(1)
        }
      }
    };
  } catch (error) {
    console.error('Error in predictFightOutcome:', error);
    return {
      prediction: {
        goesToDistance: "Unknown",
        finishProbability: 0,
        recommendedBet: "Insufficient data",
        winProbability: {
          fighter1: "50.0",
          fighter2: "50.0"
        }
      }
    };
  }
};

const getOllamaAnalysis = async (fighter1, fighter2) => {
  try {
    console.log("Starting llama2:7b-chat analysis...");

    const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model: "llama2:7b-chat",
      prompt: `Analyze this UFC fight:
${fighter1.name} vs ${fighter2.name}

Stats:
${fighter1.name}: ${fighter1.wins}-${fighter1.losses}, KO Rate: ${((fighter1.koWins/fighter1.wins) * 100).toFixed(1)}%, Strike Acc: ${fighter1.strikeAccuracy}%
${fighter2.name}: ${fighter2.wins}-${fighter2.losses}, KO Rate: ${((fighter2.koWins/fighter2.wins) * 100).toFixed(1)}%, Strike Acc: ${fighter2.strikeAccuracy}%

Who has the advantage and why?`,
      stream: false,
      options: {
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: 500
      }
    });

    return response.data.response || "AI analysis unavailable";
  } catch (error) {
    console.error('Ollama error:', error);
    return `AI analysis unavailable - ${error.message}`;
  }
};

// Add the predict endpoint
app.post("/api/predict", async (req, res) => {
  try {
    console.log("Starting fight analysis process...");
    console.log("Request body:", req.body);

    const { fighter1, fighter2 } = req.body;

    // 1. First save fighter data to database
    const client = await pool.connect();
    try {
      await client.query('BEGIN');  // Start transaction

      // Save both fighters with a different query approach
      const saveFighterQuery = `
        INSERT INTO fighters 
          (name, age, height, reach, wins, losses, ko_wins, sub_wins, strike_accuracy, takedown_accuracy, takedown_defense)
        VALUES 
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id`;

      // Save fighter1
      const fighter1Result = await client.query(saveFighterQuery, [
        fighter1.name,
        parseInt(fighter1.age) || 0,
        parseInt(fighter1.height) || 0,
        parseInt(fighter1.reach) || 0,
        parseInt(fighter1.wins) || 0,
        parseInt(fighter1.losses) || 0,
        parseInt(fighter1.koWins) || 0,
        parseInt(fighter1.subWins) || 0,
        parseFloat(fighter1.strikeAccuracy) || 0,
        parseFloat(fighter1.takedownAccuracy) || 0,
        parseFloat(fighter1.takedownDefense) || 0
      ]);

      // Save fighter2
      const fighter2Result = await client.query(saveFighterQuery, [
        fighter2.name,
        parseInt(fighter2.age) || 0,
        parseInt(fighter2.height) || 0,
        parseInt(fighter2.reach) || 0,
        parseInt(fighter2.wins) || 0,
        parseInt(fighter2.losses) || 0,
        parseInt(fighter2.koWins) || 0,
        parseInt(fighter2.subWins) || 0,
        parseFloat(fighter2.strikeAccuracy) || 0,
        parseFloat(fighter2.takedownAccuracy) || 0,
        parseFloat(fighter2.takedownDefense) || 0
      ]);

      // 2. Get AI analysis
      console.log("Getting AI analysis...");
      const aiAnalysis = await getOllamaAnalysis(fighter1, fighter2);
      console.log("AI analysis received:", aiAnalysis);

      // 3. Calculate fight outcome
      console.log("Calculating fight outcome...");
      const outcomeAnalysis = predictFightOutcome(fighter1, fighter2);
      console.log("Fight outcome calculated:", outcomeAnalysis);

      // 4. Save analysis to database
      const analysisQuery = `
        INSERT INTO fight_analyses (
          fighter1_id, fighter2_id, 
          distance_probability, finish_probability,
          confidence_level, recommended_bet, ai_analysis,
          win_probability_fighter1, win_probability_fighter2
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id`;

      const analysisResult = await client.query(analysisQuery, [
        fighter1Result.rows[0].id,
        fighter2Result.rows[0].id,
        outcomeAnalysis.prediction.goesToDistance === "High" ? 75 : 25,
        outcomeAnalysis.prediction.finishProbability,
        outcomeAnalysis.prediction.confidence,
        outcomeAnalysis.prediction.recommendedBet,
        aiAnalysis,
        parseFloat(outcomeAnalysis.prediction.winProbability.fighter1),
        parseFloat(outcomeAnalysis.prediction.winProbability.fighter2)
      ]);

      await client.query('COMMIT');

      // 5. Send response
      const response = {
        message: aiAnalysis,
        aiAnalysis: true,
        fighter1Probability: outcomeAnalysis.prediction.winProbability.fighter1,
        fighter2Probability: outcomeAnalysis.prediction.winProbability.fighter2,
        simulationConfidence: outcomeAnalysis.prediction.confidence,
        suggestedBet: outcomeAnalysis.prediction.recommendedBet,
        fightOutcome: outcomeAnalysis.prediction,
        analysisId: analysisResult.rows[0].id
      };

      console.log("Sending response:", response);
      res.json(response);

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Database error:', error);
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error in fight analysis:', error);
    res.status(500).json({
      error: 'Failed to analyze fight',
      details: error.message
    });
  }
});

// Start server
app.listen(PORT, HOST, () => {
  console.log('=================================');
  console.log(`Server running on port ${PORT}`);
  console.log(`Server URL: http://100.119.251.66:${PORT}`);
  console.log(`Ollama URL: ${OLLAMA_URL}`);
  console.log('Available endpoints:');
  console.log('- GET  /');
  console.log('- GET  /health');
  console.log('- GET  /api/test');
  console.log('- POST /api/predict');
  console.log('=================================');
});

// Rest of your code...
