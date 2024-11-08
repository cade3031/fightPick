// We need some tools to make our server work
const express = require('express'); // This helps us make a web server
const cors = require('cors'); // This helps our server talk to other places on the internet
const axios = require('axios'); // This helps us ask other computers for information
const pool = require('./config/db'); // This helps us talk to our database

// We create a new server
const app = express();
const PORT = process.env.PORT || 8080; // This is the door our server uses to talk to the internet
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434'; // Using your server's IP

// Add this near the top of your server.js, after creating the app
app.use(express.json());  // Add this line to parse JSON requests

// These are helpers that make our server work better

app.use(cors({
  origin: '*', // These are the places that can talk to our server
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'Origin'],
  credentials: true
}));

// This helps us see what our server is doing
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`); // This shows us the time and what we asked the server to do
  console.log('Request body:', req.body); // This shows us the message we sent to the server
  next(); // This means "keep going"
});

// This is a simple test to see if our server is awake
app.get('/', (req, res) => {
  res.json({ message: 'Server is running' }); // This sends back a message saying "I'm awake!"
});

// Another test to see if our server is working
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!' }); // This sends back a message saying "I'm working!"
});

// Add test endpoint
app.post('/api/test-predict', (req, res) => {
  console.log('=== TEST PREDICT ENDPOINT ===');
  console.log('Request headers:', req.headers);
  console.log('Request body:', req.body);
  res.json({ 
    message: 'Test predict endpoint working',
    receivedData: req.body 
  });
});

// This is where we ask our server to predict a fight
app.post("/api/predict", async (req, res) => {
  try {
    console.log("=== START OF PREDICT REQUEST ===");
    console.log("Request headers:", req.headers);
    console.log("Raw body:", req.body);

    if (!req.body || !req.body.fighter1 || !req.body.fighter2) {
      return res.status(400).json({
        error: 'Missing fighter data',
        receivedBody: req.body
      });
    }

    const { fighter1, fighter2 } = req.body;
    console.log("Processing fighters:", { fighter1, fighter2 });

    // Test Ollama connection first
    try {
      const testResponse = await axios.post(`${OLLAMA_URL}/api/generate`, {
        model: "llama2",
        prompt: "test",
        stream: false
      });
      console.log("Ollama test successful");
    } catch (error) {
      console.error("Ollama test failed:", error.message);
      throw new Error(`Ollama connection failed: ${error.message}`);
    }

    const aiAnalysis = await getOllamaAnalysis(fighter1, fighter2);
    console.log("AI analysis completed:", aiAnalysis);

    const outcomeAnalysis = predictFightOutcome(fighter1, fighter2);
    console.log("Outcome prediction completed:", outcomeAnalysis);

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
    console.error('=== ERROR IN PREDICT REQUEST ===');
    console.error('Error details:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({
      error: 'Failed to analyze fight',
      details: error.message,
      stack: error.stack
    });
  }
});

// This is how we guess who might win the fight
const predictFightOutcome = (fighter1, fighter2) => {
  try {
    // We look at how many fights each fighter has won and lost
    const f1Wins = parseInt(fighter1.wins) || 0;
    const f1Losses = parseInt(fighter1.losses) || 0;
    const f2Wins = parseInt(fighter2.wins) || 0;
    const f2Losses = parseInt(fighter2.losses) || 0;

    // We calculate how often each fighter wins
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
    console.error('Error in predictFightOutcome:', error); // If something goes wrong, we say "Oops!"
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

// This is how we ask our AI friend for help
const getOllamaAnalysis = async (fighter1, fighter2) => {
  try {
    console.log("=== START OF OLLAMA ANALYSIS ===");
    console.log("Connecting to Ollama at:", OLLAMA_URL);
    console.log("Fighter data:", { fighter1, fighter2 });

    let retries = 3;
    while (retries > 0) {
      try {
        console.log(`Attempt ${4 - retries}: Sending request to Ollama`);
        const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
          model: "llama2",
          prompt: `As an expert UFC analyst, provide a detailed breakdown of this fight:

${fighter1.name} vs ${fighter2.name}

Fighter Stats:
${fighter1.name}:
- Record: ${fighter1.wins}-${fighter1.losses}
- KO Wins: ${fighter1.koWins}
- Submission Wins: ${fighter1.subWins}
- Decision Wins: ${fighter1.decisionWins}
- Strike Accuracy: ${fighter1.strikeAccuracy}%

${fighter2.name}:
- Record: ${fighter2.wins}-${fighter2.losses}
- KO Wins: ${fighter2.koWins}
- Submission Wins: ${fighter2.subWins}
- Decision Wins: ${fighter2.decisionWins}
- Strike Accuracy: ${fighter2.strikeAccuracy}%

Provide analysis covering:
1. Which fighter has the advantage and specifically why (consider striking, grappling, and experience)
2. Predicted fight outcome with confidence level (KO, Submission, or Decision)
3. Probability of fight going to distance based on finishing rates
4. Most likely method of victory and why
5. Betting recommendation with reasoning

Keep analysis focused and under 200 words.`,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9
          }
        }, {
          timeout: 120000
        });

        if (response.data && response.data.response) {
          console.log("Successfully received Ollama response");
          return response.data.response;
        } else {
          console.error("Invalid response format from Ollama:", response.data);
          return "AI analysis unavailable - invalid response format";
        }
      } catch (error) {
        console.error(`Attempt ${4 - retries} failed:`, error.message);
        console.error('Error details:', {
          code: error.code,
          response: error.response?.data,
          config: {
            url: error.config?.url,
            method: error.config?.method
          }
        });
        retries--;
        if (retries === 0) throw error;
        console.log(`Waiting 5 seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  } catch (error) {
    console.error('=== ERROR IN OLLAMA ANALYSIS ===');
    console.error('Error details:', error.message);
    console.error('Stack trace:', error.stack);
    return `AI analysis unavailable - ${error.message}`;
  }
};

// Add this new function to analyze multiple fights for parlays
const generateParlayRecommendation = (analyzedFights, size) => {
  try {
    // Sort fights by confidence level
    const sortedFights = analyzedFights.sort((a, b) => {
      const aConf = parseFloat(a.simulationConfidence) || 0;
      const bConf = parseFloat(b.simulationConfidence) || 0;
      return bConf - aConf;
    });

    // Take the top N fights based on parlay size
    const selectedFights = sortedFights.slice(0, size);

    // Calculate combined probability and expected value
    const parlayAnalysis = {
      fights: selectedFights.map(fight => ({
        fighters: `${fight.fighter1.name} vs ${fight.fighter2.name}`,
        recommendedBet: fight.suggestedBet,
        confidence: fight.simulationConfidence,
        method: fight.fightOutcome?.likelyMethod || 'Decision',
        odds: fight.fighter1.odds // Include odds for calculation
      })),
      totalConfidence: (selectedFights.reduce((acc, fight) => 
        acc * (parseFloat(fight.simulationConfidence) / 100), 1) * 100).toFixed(2),
      expectedValue: calculateParlayValue(selectedFights),
      riskLevel: calculateRiskLevel(selectedFights)
    };

    return parlayAnalysis;
  } catch (error) {
    console.error('Error generating parlay:', error);
    return null;
  }
};

// Helper function to calculate parlay expected value
const calculateParlayValue = (fights) => {
  try {
    let totalOdds = 1;
    fights.forEach(fight => {
      const odds = parseFloat(fight.suggestedBet.includes(fight.fighter1.name) 
        ? fight.fighter1.odds 
        : fight.fighter2.odds);
      totalOdds *= (odds > 0 ? (odds / 100) + 1 : (-100 / odds) + 1);
    });
    return (totalOdds - 1).toFixed(2);
  } catch (error) {
    return 0;
  }
};

// Helper function to calculate risk level
const calculateRiskLevel = (fights) => {
  const avgConfidence = fights.reduce((acc, fight) => 
    acc + parseFloat(fight.simulationConfidence), 0) / fights.length;
  
  if (avgConfidence > 80) return 'Low';
  if (avgConfidence > 65) return 'Medium';
  return 'High';
};

// Add new endpoint for parlay recommendations
app.post('/api/generate-parlay', async (req, res) => {
  try {
    const { size, analyzedFights } = req.body;
    
    if (!analyzedFights || analyzedFights.length < size) {
      return res.status(400).json({
        error: 'Not enough analyzed fights for parlay',
        required: size,
        available: analyzedFights?.length || 0
      });
    }

    const parlayRecommendation = generateParlayRecommendation(analyzedFights, size);
    
    if (!parlayRecommendation) {
      return res.status(500).json({
        error: 'Failed to generate parlay recommendation'
      });
    }

    res.json({
      parlaySize: size,
      recommendation: parlayRecommendation,
      message: `${size}-Fight Parlay Generated`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in parlay generation:', error);
    res.status(500).json({
      error: 'Failed to generate parlay',
      details: error.message
    });
  }
});

// This helps us catch any mistakes and say "Oops!"
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// We start our server so it can talk to the internet
app.listen(PORT, '0.0.0.0', () => {
  console.log('=================================');
  console.log(`Server running on port ${PORT}`);
  console.log(`Server URL: http://100.119.251.66:${PORT}`);
  console.log(`Ollama URL: ${OLLAMA_URL}`);
  console.log('Available endpoints:');
  console.log('- GET  /');
  console.log('- GET  /api/test');
  console.log('- POST /api/predict');
  console.log('- POST /api/test-predict');
  console.log('=================================');
});