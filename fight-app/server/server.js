const express = require('express');
const cors = require('cors');
const app = express();

// Debug logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} request to ${req.url}`);
  next();
});

// Add middleware
app.use(cors());
app.use(express.json());

app.post('/api/predict', async (req, res) => {
  console.log('Received prediction request');
  try {
    const { fighter1, fighter2, odds1, odds2 } = req.body;
    console.log('Fighter data received:', { fighter1, fighter2 });

    // Create analysis for both fighters
    const analysis = `Fight Analysis:\n\n` +
                    `${fighter1.name} vs ${fighter2.name}\n\n` +
                    `Fighter 1: ${fighter1.name}\n` +
                    `Record: ${fighter1.wins}-${fighter1.losses}\n` +
                    `KO Wins: ${fighter1.koWins}\n` +
                    `Submission Wins: ${fighter1.subWins}\n` +
                    `Height: ${fighter1.height}\n` +
                    `Reach: ${fighter1.reach}\n\n` +
                    `Fighter 2: ${fighter2.name}\n` +
                    `Record: ${fighter2.wins}-${fighter2.losses}\n` +
                    `KO Wins: ${fighter2.koWins}\n` +
                    `Submission Wins: ${fighter2.subWins}\n` +
                    `Height: ${fighter2.height}\n` +
                    `Reach: ${fighter2.reach}\n\n` +
                    `Analysis:\n` +
                    `Based on the fighters' records and statistics...`;

    // Mock prediction data
    const predictionData = {
      message: analysis,
      aiAnalysis: true,
      fighter1Probability: 55,
      fighter2Probability: 45,
      simulationConfidence: 80,
      suggestedBet: `${fighter1.name} by Decision`,
      bettingAdvice: {
        fighter1: {
          kellyBet: 2.5,
          expectedValue: 0.15
        },
        fighter2: {
          kellyBet: 1.5,
          expectedValue: -0.05
        }
      }
    };

    res.json(predictionData);
  } catch (error) {
    console.error('Error in prediction:', error);
    res.status(500).json({ error: 'Failed to generate prediction' });
  }
});

const PORT = process.env.PORT || 8080;

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

// Start server with error handling
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}).on('error', (err) => {
  console.error('Failed to start server:', err);
}); 