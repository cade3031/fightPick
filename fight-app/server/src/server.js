const express = require('express');
const cors = require('cors');
const app = express();

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

// Main prediction endpoint
app.post("/api/predict", async (req, res) => {
  try {
    const { fighter1, fighter2 } = req.body;
    console.log("Server received fighter data:", {
      fighter1: {
        name: fighter1.name,
        wins: fighter1.wins,
        losses: fighter1.losses,
        koWins: fighter1.koWins,
        subWins: fighter1.subWins,
        strikeAccuracy: fighter1.strikeAccuracy,
        takedownAccuracy: fighter1.takedownAccuracy,
        takedownDefense: fighter1.takedownDefense,
        weight: fighter1.weight
      },
      fighter2: {
        name: fighter2.name,
        wins: fighter2.wins,
        losses: fighter2.losses,
        koWins: fighter2.koWins,
        subWins: fighter2.subWins,
        strikeAccuracy: fighter2.strikeAccuracy,
        takedownAccuracy: fighter2.takedownAccuracy,
        takedownDefense: fighter2.takedownDefense,
        weight: fighter2.weight
      }
    });

    // Add error checking for required fields
    if (!fighter1.wins || !fighter2.wins) {
      throw new Error('Missing required fighter statistics');
    }

    // Calculate all stats
    const fighter1Style = analyzeFightingStyle(fighter1);
    const fighter2Style = analyzeFightingStyle(fighter2);
    const advantages = calculateAdvantages(fighter1, fighter2);
    const fighter1Stats = calculateWinRate(fighter1);
    const fighter2Stats = calculateWinRate(fighter2);
    const fighter1GrapplingAdvantage = analyzeGrapplingAdvantage(fighter1, fighter2);
    const fighter2GrapplingAdvantage = analyzeGrapplingAdvantage(fighter2, fighter1);

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
      `- Grappling Analysis: ${fighter2GrapplingAdvantage}\n\n`;

    res.json({
      message: analysis,
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
      }
    });

  } catch (error) {
    console.error('Error in prediction:', error);
    res.status(500).json({ error: 'Failed to generate prediction' });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Server URL: http://localhost:${PORT}`);
});
