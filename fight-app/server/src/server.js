// We need some tools to make our server work
const express = require('express'); // This helps us make a web server
const cors = require('cors'); // This helps our server talk to other places on the internet
const axios = require('axios'); // This helps us ask other computers for information
const pool = require('./config/db'); // This helps us talk to our database

// We create a new server
const app = express();
const PORT = process.env.PORT || 8080; // This is the door our server uses to talk to the internet
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://ollama:11434'; // This is where we find our AI friend

// These are helpers that make our server work better
app.use(express.json()); // This helps our server understand messages in a special format called JSON
app.use(cors({
  origin: ['http://100.119.251.66:3000', 'http://localhost:3000', '*'], // These are the places that can talk to our server
  methods: ['GET', 'POST'], // These are the ways we can ask our server for things
  allowedHeaders: ['Content-Type'] // This tells our server what kind of messages to expect
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

// This is where we ask our server to predict a fight
app.post("/api/predict", async (req, res) => {
  try {
    console.log("=== START OF PREDICT REQUEST ===");
    console.log("Starting fight analysis process...");
    console.log("Request body:", JSON.stringify(req.body, null, 2));

    const { fighter1, fighter2 } = req.body;
    console.log("Extracted fighters:", { fighter1, fighter2 });

    // Log before Ollama request
    console.log("About to call Ollama at:", OLLAMA_URL);
    console.log("Getting AI analysis...");
    
    const aiAnalysis = await getOllamaAnalysis(fighter1, fighter2);
    console.log("AI analysis completed. Response:", aiAnalysis);

    console.log("Starting outcome prediction...");
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

    console.log("Sending final response:", JSON.stringify(response, null, 2));
    console.log("=== END OF PREDICT REQUEST ===");
    
    res.json(response);

  } catch (error) {
    console.error('=== ERROR IN PREDICT REQUEST ===');
    console.error('Error details:', error);
    console.error('Error stack:', error.stack);
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
    console.log("Preparing Ollama request for fighters:", {
      fighter1: fighter1.name,
      fighter2: fighter2.name
    });

    let retries = 3;
    while (retries > 0) {
      try {
        const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
          model: "llama2:7b-chat-q4_0",
          prompt: `Analyze this UFC fight:
${fighter1.name} vs ${fighter2.name}

Stats:
${fighter1.name}: ${fighter1.wins}-${fighter1.losses}, KO Rate: ${((fighter1.koWins/fighter1.wins) * 100).toFixed(1)}%, Strike Acc: ${fighter1.strikeAccuracy}%
${fighter2.name}: ${fighter2.wins}-${fighter2.losses}, KO Rate: ${((fighter2.koWins/fighter2.wins) * 100).toFixed(1)}%, Strike Acc: ${fighter2.strikeAccuracy}%

Who has the advantage and why? Keep the response concise.`,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9
          }
        });

        console.log("Received response from Ollama:", response.data);
        console.log("=== END OF OLLAMA ANALYSIS ===");

        return response.data.response || "AI analysis unavailable";
      } catch (error) {
        console.error(`Attempt ${4 - retries} failed:`, error.message);
        retries--;
        if (retries === 0) throw error;
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  } catch (error) {
    console.error('=== ERROR IN OLLAMA ANALYSIS ===');
    console.error('Error details:', error);
    console.error('Error stack:', error.stack);
    return `AI analysis unavailable - ${error.message}`;
  }
};

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
  console.log(`Server running on port ${PORT}`); // We tell ourselves the server is running
  console.log(`Server URL: http://100.119.251.66:${PORT}`); // We tell ourselves where to find the server
  console.log(`Ollama URL: ${OLLAMA_URL}`); // We tell ourselves where to find the AI
  console.log('Available endpoints:');
  console.log('- GET  /'); // We can ask the server if it's awake
  console.log('- GET  /api/test'); // We can ask the server if it's working
  console.log('- POST /api/predict'); // We can ask the server to predict a fight
  console.log('=================================');
});