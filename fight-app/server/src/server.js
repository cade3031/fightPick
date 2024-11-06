const express = require('express');
const cors = require('cors');
const app = express();
const axios = require('axios');
const pool = require('./config/db');

// Middleware
app.use(express.json());
app.use(cors({
  origin: ['http://100.119.251.66:3000', 'http://localhost:3000', '*'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Test endpoint
app.get('/api/test', (req, res) => {
  console.log('Test endpoint hit');
  res.json({ message: 'API is working!' });
});

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('Health check endpoint hit');
  res.json({ status: 'healthy' });
});

// Predict endpoint
app.post("/api/predict", async (req, res) => {
  try {
    console.log("Received request at /api/predict");
    console.log("Request body:", req.body);

    // Save fighter data
    const fighter1Id = await saveFighterData(req.body.fighter1);
    const fighter2Id = await saveFighterData(req.body.fighter2);

    // Get analysis
    const outcomeAnalysis = await predictFightOutcome(req.body.fighter1, req.body.fighter2);
    const aiAnalysis = await getOllamaAnalysis(req.body.fighter1, req.body.fighter2, "");

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

// Get analyzed fights endpoint
app.get('/api/analyzed-fights', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM fight_analyses ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching analyzed fights:', error);
    res.status(500).json({ error: 'Failed to fetch analyzed fights' });
  }
});

const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log('=================================');
  console.log(`Server running on port ${PORT}`);
  console.log(`Server URL: http://100.119.251.66:${PORT}`);
  console.log('Server is ready to accept connections');
  console.log('Available endpoints:');
  console.log('- GET  /api/test');
  console.log('- GET  /health');
  console.log('- POST /api/predict');
  console.log('- GET  /api/analyzed-fights');
  console.log('=================================');
});
