const express = require("express"); //express framework used to create the server and handle http requests
const cors = require("cors"); //cors is used to allow cross-origin requests
const axios = require("axios"); //axios is used to make http requests to the ollama api
const path = require("path");
const os = require("os");

const app = express();
const port = process.env.PORT || 8080; // Make sure this matches docker-compose

// Log all network interfaces
const networkInterfaces = os.networkInterfaces();
console.log("\nAvailable Network Interfaces:");
Object.keys(networkInterfaces).forEach((interfaceName) => {
  networkInterfaces[interfaceName].forEach((interface) => {
    if (!interface.internal && interface.family === "IPv4") {
      console.log(`Interface: ${interfaceName}, IP: ${interface.address}`);
    }
  });
});

// Allow all origins during development
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Accept"],
  })
);

app.use(express.json());

// Add request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Define Ollama URL with environment variable support
const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
console.log("Ollama URL:", OLLAMA_URL);

// Improve Ollama connection test with better error handling and debugging
const testOllamaConnection = async () => {
  console.log("Testing Ollama connection...");
  try {
    console.log("Attempting to connect to:", OLLAMA_URL);
    const response = await axios.get(`${OLLAMA_URL}/api/version`, {
      timeout: 5000, // 5 second timeout
      headers: {
        Accept: "application/json",
      },
    });
    console.log("Raw response:", response.data);
    console.log(
      "Successfully connected to Ollama, version:",
      response.data.version
    );
    return true;
  } catch (error) {
    console.error("Failed to connect to Ollama:", {
      url: OLLAMA_URL,
      error: error.message,
      code: error.code,
      response: error.response?.data,
      stack: error.stack,
    });

    // Test network connectivity
    try {
      const netTest = await axios.get("https://api.github.com/zen", {
        timeout: 5000,
      });
      console.log("Network connectivity test successful");
    } catch (netError) {
      console.error("Network connectivity test failed:", netError.message);
    }

    return false;
  }
};

// Call test connection immediately and periodically
testOllamaConnection();
setInterval(testOllamaConnection, 30000); // Test every 30 seconds

const SIMULATION_COUNT = 10000; // Number of Monte Carlo simulations

// Add route to serve seed data
app.get("/api/seed-data", (req, res) => {
  const seedData = require("./data/seedData.json");
  res.json(seedData);
});

// Add SSE endpoint
app.get("/api/simulation-progress", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendProgress = (percent) => {
    res.write(`data: ${JSON.stringify({ percent })}\n\n`);
  };

  req.on("close", () => {
    // Clean up when client disconnects
  });

  global.sendProgress = sendProgress;
});

app.post("/api/predict", async (req, res) => {
  try {
    console.log("Received prediction request:", req.body);
    console.log("Ollama URL:", OLLAMA_URL);

    const { fighter1, fighter2, odds1, odds2 } = req.body;

    // Run simulations with progress updates
    const totalSims = 10000;
    let completedSims = 0;
    const results = {
      fighter1Wins: 0,
      fighter2Wins: 0,
    };

    for (let i = 0; i < totalSims; i++) {
      // Run single simulation
      const result = runSingleSimulation(odds1, odds2);
      results[result + "Wins"]++;

      completedSims++;
      if (completedSims % 100 === 0) {
        global.sendProgress?.(Math.floor((completedSims / totalSims) * 100));
      }
    }

    // Calculate final probabilities
    const fighter1Prob = (results.fighter1Wins / totalSims) * 100;
    const fighter2Prob = (results.fighter2Wins / totalSims) * 100;

    // Create prompt for Ollama with simulation results
    const prompt = `
      You are a pair programming assistant helping analyze UFC fights. Instead of giving direct answers, 
      guide the user through the analysis process by:

      1. Asking relevant questions about the matchup
      2. Suggesting what factors to consider
      3. Helping identify patterns in the data
      4. Encouraging critical thinking about betting value

      Here's the fight data to analyze:

      Fighter 1: ${fighter1.name}
      Stats:
      - Age: ${fighter1.age || "N/A"}
      - Height: ${fighter1.height || "N/A"}
      - Reach: ${fighter1.reach || "N/A"}
      - Record: ${fighter1.wins || 0}W - ${fighter1.losses || 0}L
      - KO Wins: ${fighter1.koWins || 0}
      - Submission Wins: ${fighter1.subWins || 0}
      - Strike Accuracy: ${fighter1.strikeAccuracy || "N/A"}%
      Betting Odds: ${odds1}
      
      Fighter 2: ${fighter2.name}
      Stats:
      - Age: ${fighter2.age || "N/A"}
      - Height: ${fighter2.height || "N/A"}
      - Reach: ${fighter2.reach || "N/A"}
      - Record: ${fighter2.wins || 0}W - ${fighter2.losses || 0}L
      - KO Wins: ${fighter2.koWins || 0}
      - Submission Wins: ${fighter2.subWins || 0}
      - Strike Accuracy: ${fighter2.strikeAccuracy || "N/A"}%
      Betting Odds: ${odds2}
      
      Simulation Confidence: ${(Math.abs((results.fighter1Wins - results.fighter2Wins) / totalSims) * 100).toFixed(1)}%
      
      Consider:
      1. Physical advantages (height, reach, age)
      2. Fighting record and experience
      3. Fighting style (KO vs Submission ratio)
      4. Strike accuracy and defensive stats
      5. Betting odds and simulated probabilities
      6. Value betting opportunities
      
      Provide a detailed analysis including:
      1. Who has physical advantages and how they might use them
      2. Experience comparison and style matchup
      3. Who is likely to win and why
      4. Whether the betting odds offer value
      5. Recommended betting strategy
    `;

    console.log("Sending request to Ollama:", OLLAMA_URL);

    const ollamaResponse = await axios
      .post(`${OLLAMA_URL}/api/generate`, {
        model: "llama2",
        prompt: prompt,
        stream: false,
        temperature: 0.7,
        top_p: 0.9,
      })
      .catch((error) => {
        throw new Error(
          `Ollama API error: ${error.message}. URL: ${OLLAMA_URL}`
        );
      });

    // Log the complete response
    console.log("Complete Ollama response:", ollamaResponse.data);

    // Calculate Kelly Criterion for both fighters
    const kelly1 = kellyBet(fighter1Prob / 100, odds1);
    const kelly2 = kellyBet(fighter2Prob / 100, odds2);

    const prediction = {
      //create a prediction object with the ollama response, the probabilities of each fighter winning, the suggested bet, and a boolean indicating that the prediction is from the ai
      message: ollamaResponse.data.response,
      fighter1Probability: fighter1Prob.toFixed(1),
      fighter2Probability: fighter2Prob.toFixed(1),
      simulationConfidence: (
        Math.abs((results.fighter1Wins - results.fighter2Wins) / totalSims) *
        100
      ).toFixed(1),
      bettingAdvice: {
        fighter1: {
          name: fighter1.name,
          kellyBet: kelly1,
          expectedValue: (
            (fighter1Prob / 100) *
            (odds1 > 0 ? odds1 / 100 : -100 / odds1)
          ).toFixed(3),
        },
        fighter2: {
          name: fighter2.name,
          kellyBet: kelly2,
          expectedValue: (
            (fighter2Prob / 100) *
            (odds2 > 0 ? odds2 / 100 : -100 / odds2)
          ).toFixed(3),
        },
      },
      suggestedBet: kelly1 > kelly2 ? fighter1.name : fighter2.name,
      aiAnalysis: true,
    };

    console.log("Sending response:", prediction);
    res.json(prediction);
  } catch (error) {
    console.error("Prediction error:", {
      message: error.message,
      url: OLLAMA_URL,
      code: error.code,
    });
    res.status(500).json({
      error: "Failed to generate prediction",
      details: error.message,
      ollamaUrl: OLLAMA_URL,
    });
  }
});

function oddsToProb(odds) {
  if (odds > 0) {
    return 100 / (odds + 100);
  } else {
    return Math.abs(odds) / (Math.abs(odds) + 100);
  }
}

function runSingleSimulation(odds1, odds2) {
  const prob1 = oddsToProb(odds1);
  const prob2 = oddsToProb(odds2);

  return Math.random() < prob1 / (prob1 + prob2) ? "fighter1" : "fighter2";
}

// Listen on all interfaces
app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
  console.log("Server accessible at:");
  Object.keys(networkInterfaces).forEach((interfaceName) => {
    networkInterfaces[interfaceName].forEach((interface) => {
      if (!interface.internal && interface.family === "IPv4") {
        console.log(`http://${interface.address}:${port}`);
      }
    });
  });
});

// Modify the checkOllamaVersion function to use axios instead of fetch
const checkOllamaVersion = async () => {
  try {
    const response = await axios.get(`${OLLAMA_URL}/api/version`);
    console.log("Ollama version:", response.data.version);
    return response.data.version;
  } catch (error) {
    console.error("Failed to check Ollama version:", {
      url: OLLAMA_URL,
      error: error.message,
      code: error.code,
    });
    return null;
  }
};

// Call this when your server starts
checkOllamaVersion();

function kellyBet(probability, odds) {
  let decimal;
  if (odds > 0) {
    decimal = odds / 100 + 1;
  } else {
    decimal = 100 / Math.abs(odds) + 1;
  }

  const q = 1 - probability;
  const b = decimal - 1;

  const kelly = ((b * probability - q) / b) * 100;
  return kelly > 0 ? kelly.toFixed(1) : 0;
}

// Add this new test endpoint
app.get("/api/test-ollama", async (req, res) => {
  try {
    const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model: "llama2",
      prompt: "Say hello",
      stream: false,
    });
    res.json({ success: true, response: response.data });
  } catch (error) {
    console.error("Test failed:", error);
    res.status(500).json({
      error: "Test failed",
      details: error.response?.data || error.message,
    });
  }
});
