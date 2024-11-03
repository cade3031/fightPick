const express = require('express');
const cors = require('cors');
const app = express();
const axios = require('axios');
const { Pool } = require('pg');

const pool = new Pool({
  user: 'your_username',
  host: 'localhost',
  database: 'fightpick_db',
  password: 'your_password',
  port: 5432,
});

// Add middleware
app.use(cors());
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

// Add this constant
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";

// Add this function to call Ollama
const getOllamaAnalysis = async (fighter1, fighter2, stats) => {
  try {
    console.log("Starting Ollama analysis for:", {
      fighter1: fighter1.name,
      fighter2: fighter2.name
    });

    const prompt = `As a UFC fight analyst, analyze this matchup:

    Fighter 1: ${fighter1.name}
    Stats:
    - Record: ${fighter1.wins}-${fighter1.losses}
    - KO Rate: ${(fighter1.koWins/fighter1.wins * 100).toFixed(1)}%
    - Submission Rate: ${(fighter1.subWins/fighter1.wins * 100).toFixed(1)}%
    - Strike Accuracy: ${fighter1.strikeAccuracy}%
    - Takedown Accuracy: ${fighter1.takedownAccuracy}%
    - Takedown Defense: ${fighter1.takedownDefense}%
    - Physical: Height ${fighter1.height}, Reach ${fighter1.reach}

    Fighter 2: ${fighter2.name}
    Stats:
    - Record: ${fighter2.wins}-${fighter2.losses}
    - KO Rate: ${(fighter2.koWins/fighter2.wins * 100).toFixed(1)}%
    - Submission Rate: ${(fighter2.subWins/fighter2.wins * 100).toFixed(1)}%
    - Strike Accuracy: ${fighter2.strikeAccuracy}%
    - Takedown Accuracy: ${fighter2.takedownAccuracy}%
    - Takedown Defense: ${fighter2.takedownDefense}%
    - Physical: Height ${fighter2.height}, Reach ${fighter2.reach}

    Additional Analysis:
    ${stats}

    Provide a detailed analysis including:
    1. Who has the striking advantage and why
    2. Who has the grappling advantage and why
    3. Physical advantages and how they might be used
    4. Most likely path to victory for each fighter
    5. Prediction on fight outcome with confidence level
    6. Betting recommendation based on the analysis

    Format your response in clear sections.`;

    console.log("Sending prompt to Ollama");
    const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model: "llama2",
      prompt: prompt,
      stream: false,
      temperature: 0.7
    });

    console.log("Received Ollama response:", response.data.response);
    return response.data.response;
  } catch (error) {
    console.error('Ollama error:', error);
    console.error('Error details:', {
      message: error.message,
      response: error.response?.data
    });
    return 'AI analysis unavailable - Error: ' + error.message;
  }
};

// Add this function to save fight analysis
const saveFightAnalysis = async (fightData) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
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
      fightData.fighter1.name,
      fightData.fighter2.name,
      JSON.stringify(fightData.fighter1),
      JSON.stringify(fightData.fighter2),
      JSON.stringify(fightData.prediction),
      JSON.stringify(fightData.bettingAdvice)
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

// Main prediction endpoint
app.post("/api/predict", async (req, res) => {
  try {
    const { fighter1, fighter2 } = req.body;
    
    // Add detailed logging
    console.log("Processing fight analysis for:");
    console.log("Fighter 1:", {
      name: fighter1.name,
      record: `${fighter1.wins}-${fighter1.losses}`,
      koRate: (parseInt(fighter1.koWins) / parseInt(fighter1.wins) * 100).toFixed(1) + '%',
      subRate: (parseInt(fighter1.subWins) / parseInt(fighter1.wins) * 100).toFixed(1) + '%'
    });
    console.log("Fighter 2:", {
      name: fighter2.name,
      record: `${fighter2.wins}-${fighter2.losses}`,
      koRate: (parseInt(fighter2.koWins) / parseInt(fighter2.wins) * 100).toFixed(1) + '%',
      subRate: (parseInt(fighter2.subWins) / parseInt(fighter2.wins) * 100).toFixed(1) + '%'
    });

    // Add data validation
    if (!fighter1.wins || !fighter2.wins) {
      throw new Error('Missing critical fighter statistics');
    }

    // Calculate all stats once
    const fighter1Style = analyzeFightingStyle(fighter1);
    const fighter2Style = analyzeFightingStyle(fighter2);
    const advantages = calculateAdvantages(fighter1, fighter2);
    const fighter1Stats = calculateWinRate(fighter1);
    const fighter2Stats = calculateWinRate(fighter2);
    const fighter1GrapplingAdvantage = analyzeGrapplingAdvantage(fighter1, fighter2);
    const fighter2GrapplingAdvantage = analyzeGrapplingAdvantage(fighter2, fighter1);

    // Calculate fight outcome
    const outcomeAnalysis = predictFightOutcome(fighter1, fighter2);

    // Create analysis string
    const analysis = `Fight Analysis: ${fighter1.name} vs ${fighter2.name}\n\n` +
      `Style Matchup:\n` +
      `${fighter1.name} (${fighter1Style}):\n` +
      `- Record: ${fighter1.wins}-${fighter1.losses}\n` +
      `- KO Wins: ${fighter1.koWins}\n` +
      `- Submission Wins: ${fighter1.subWins}\n` +
      `- Strike Accuracy: ${fighter1.strikeAccuracy}%\n` +
      `- Takedown Accuracy: ${fighter1.takedownAccuracy}%\n` +
      `- Takedown Defense: ${fighter1.takedownDefense}%\n` +
      `- Win Rate: ${fighter1Stats.winRate.toFixed(1)}%\n` +
      `- Grappling Analysis: ${fighter1GrapplingAdvantage}\n\n` +
      `${fighter2.name} (${fighter2Style}):\n` +
      `- Record: ${fighter2.wins}-${fighter2.losses}\n` +
      `- KO Wins: ${fighter2.koWins}\n` +
      `- Submission Wins: ${fighter2.subWins}\n` +
      `- Strike Accuracy: ${fighter2.strikeAccuracy}%\n` +
      `- Takedown Accuracy: ${fighter2.takedownAccuracy}%\n` +
      `- Takedown Defense: ${fighter2.takedownDefense}%\n` +
      `- Win Rate: ${fighter2Stats.winRate.toFixed(1)}%\n` +
      `- Grappling Analysis: ${fighter2GrapplingAdvantage}\n\n` +
      `Fight Outcome Analysis:\n` +
      `- Safe Bet Recommendation: ${outcomeAnalysis.prediction.recommendedBet}\n` +
      `- Win Probability: ${fighter1.name}: ${fighter1Stats.winRate.toFixed(1)}% | ${fighter2.name}: ${fighter2Stats.winRate.toFixed(1)}%\n` +
      `- Distance Probability: ${outcomeAnalysis.prediction.goesToDistance} (${(100 - outcomeAnalysis.prediction.finishProbability).toFixed(1)}%)\n` +
      `- Finish Probability: ${outcomeAnalysis.prediction.finishProbability.toFixed(1)}%\n` +
      `${outcomeAnalysis.prediction.likelyMethod ? `- Most Likely Method: ${outcomeAnalysis.prediction.likelyMethod} (${outcomeAnalysis.prediction.confidence.toFixed(1)}% confidence)` : ''}`;

    // Get AI analysis from Ollama
    const aiAnalysis = await getOllamaAnalysis(fighter1, fighter2, 
      `Style Matchup: ${fighter1Style} vs ${fighter2Style}\n` +
      `Physical Advantages: ${JSON.stringify(advantages)}\n` +
      `Grappling Analysis: ${fighter1GrapplingAdvantage} vs ${fighter2GrapplingAdvantage}`
    );

    console.log("AI Analysis received:", aiAnalysis);

    // Include AI analysis in response
    res.json({
      message: aiAnalysis,  // This will be the Ollama analysis
      aiAnalysis: true,
      fighter1Probability: fighter1Stats.winRate,
      fighter2Probability: fighter2Stats.winRate,
      simulationConfidence: 80,
      suggestedBet: fighter1Stats.winRate > fighter2Stats.winRate ? fighter1.name : fighter2.name,
      bettingAdvice: {
        fighter1: {
          kellyBet: (fighter1Stats.winRate > fighter2Stats.winRate ? 2.5 : 1.5).toFixed(1),
          expectedValue: (fighter1Stats.winRate/100 - 0.5).toFixed(3)
        },
        fighter2: {
          kellyBet: (fighter2Stats.winRate > fighter1Stats.winRate ? 2.5 : 1.5).toFixed(1),
          expectedValue: (fighter2Stats.winRate/100 - 0.5).toFixed(3)
        }
      },
      fightOutcome: outcomeAnalysis.prediction
    });

  } catch (error) {
    console.error('Error in prediction:', error);
    res.status(500).json({ 
      error: 'Failed to generate prediction',
      details: error.message 
    });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Server URL: http://localhost:${PORT}`);
});
