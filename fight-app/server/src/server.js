const express = require('express');
const cors = require('cors');
const axios = require('axios');
const pool = require('./config/db');

const app = express();
const PORT = process.env.PORT || 8080;
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://ollama:11434';

// Middleware
app.use(express.json());
app.use(cors({
  origin: ['http://100.119.251.66:3000', 'http://localhost:3000', '*'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Request body:', req.body);
  next();
});

// Basic test route
app.get('/', (req, res) => {
  res.json({ message: 'Server is running' });
});

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!' });
});

// Add the predict endpoint
app.post("/api/predict", async (req, res) => {
  try {
    console.log("Starting fight analysis process...");
    console.log("Request body:", req.body);

    const { fighter1, fighter2 } = req.body;

    // Get AI analysis
    console.log("Getting AI analysis...");
    const aiAnalysis = await getOllamaAnalysis(fighter1, fighter2);
    console.log("AI analysis received:", aiAnalysis);

    // Calculate fight outcome
    console.log("Calculating fight outcome...");
    const outcomeAnalysis = predictFightOutcome(fighter1, fighter2);
    console.log("Fight outcome calculated:", outcomeAnalysis);

    // Send response
    const response = {
      message: aiAnalysis,
      aiAnalysis: true,
      fighter1Probability: outcomeAnalysis.prediction.winProbability.fighter1,
      fighter2Probability: outcomeAnalysis.prediction.winProbability.fighter2,
      simulationConfidence: outcomeAnalysis.prediction.confidence,
      suggestedBet: outcomeAnalysis.prediction.recommendedBet,
      fightOutcome: outcomeAnalysis.prediction
    };

    console.log("Sending response:", response);
    res.json(response);

  } catch (error) {
    console.error('Error in fight analysis:', error);
    res.status(500).json({
      error: 'Failed to analyze fight',
      details: error.message
    });
  }
});

// Add helper functions
const predictFightOutcome = (fighter1, fighter2) => {
  try {
    // Calculate win probabilities based on records
    const f1Wins = parseInt(fighter1.wins) || 0;
    const f1Losses = parseInt(fighter1.losses) || 0;
    const f2Wins = parseInt(fighter2.wins) || 0;
    const f2Losses = parseInt(fighter2.losses) || 0;

    // Calculate win rates
    const f1WinRate = f1Wins / (f1Wins + f1Losses) * 100;
    const f2WinRate = f2Wins / (f2Wins + f2Losses) * 100;

    return {
      prediction: {
        goesToDistance: "Unknown",
        finishProbability: 0,
        confidence: 80,
        recommendedBet: "No recommendation",
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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('=================================');
  console.log(`Server running on port ${PORT}`);
  console.log(`Server URL: http://100.119.251.66:${PORT}`);
  console.log(`Ollama URL: ${OLLAMA_URL}`);
  console.log('Available endpoints:');
  console.log('- GET  /');
  console.log('- GET  /api/test');
  console.log('- POST /api/predict');
  console.log('=================================');
});
