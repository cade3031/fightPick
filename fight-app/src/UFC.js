import React, { useEffect, useState } from 'react';
import './UFC.css';

// Replace YOUR_TAILSCALE_IP with your actual Tailscale IP address
const API_URL = 'http://100.119.251.66:8080';  // Make sure this matches your server IP

const defaultFightOutcome = {
  goesToDistance: "Unknown",
  finishProbability: 0,
  recommendedBet: "No recommendation",
  winProbability: {
    fighter1: "0.0",
    fighter2: "0.0"
  }
};

function UFC() {
  const [fightCardData, setFightCardData] = useState(null); // state for fight card data
  const [selectedFight, setSelectedFight] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [showPopup, setShowPopup] = useState(false);
  const [ollamaResponse, setOllamaResponse] = useState('');
  const [analyzedFights, setAnalyzedFights] = useState(new Set());
  const [isInputMode, setIsInputMode] = useState(true);
  const [analyzedFightsData, setAnalyzedFightsData] = useState([]);
  const [showParlayDropdown, setShowParlayDropdown] = useState(false);
  const [parlayRecommendation, setParlayRecommendation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedParlay, setSelectedParlay] = useState(null);
  const [seedData, setSeedData] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const handleInputChange = (e, fighter, field) => {
    const { value } = e.target;
    setSelectedFight(prev => ({
      ...prev,
      [fighter]: {
        ...prev[fighter],
        [field]: value
      }
    }));
  };

  const handleSubmitFighterData = async (e) => {
    e.preventDefault();
    console.log("Form submitted with data:", selectedFight);

    const fighterData = {
      fighter1: {
        ...selectedFight.fighter1,
        wins: parseInt(selectedFight.fighter1.wins) || 0,
        losses: parseInt(selectedFight.fighter1.losses) || 0,
        koWins: parseInt(selectedFight.fighter1.koWins) || 0,
        subWins: parseInt(selectedFight.fighter1.subWins) || 0,
        decisionWins: parseInt(selectedFight.fighter1.decisionWins) || 0,
        strikeAccuracy: parseFloat(selectedFight.fighter1.strikeAccuracy) || 0,
      },
      fighter2: {
        ...selectedFight.fighter2,
        wins: parseInt(selectedFight.fighter2.wins) || 0,
        losses: parseInt(selectedFight.fighter2.losses) || 0,
        koWins: parseInt(selectedFight.fighter2.koWins) || 0,
        subWins: parseInt(selectedFight.fighter2.subWins) || 0,
        decisionWins: parseInt(selectedFight.fighter2.decisionWins) || 0,
        strikeAccuracy: parseFloat(selectedFight.fighter2.strikeAccuracy) || 0,
      }
    };
    
    console.log("Sending request to:", `${API_URL}/api/predict`);
    console.log("Request data:", fighterData);
    
    try {
      const response = await fetch(`${API_URL}/api/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fighterData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Received analysis:", data);
      
      setPrediction(data);
      setOllamaResponse(data.message || 'No AI analysis available');
      setIsInputMode(false);
    } catch (error) {
      console.error('Error submitting fighter data:', error);
      alert('Error analyzing fight data: ' + error.message);
    }
  };

  useEffect(() => {
    const fetchFightCard = async () => {
      try {
        const response = await fetch(
          'https://www.bovada.lv/services/sports/event/coupon/events/A/description/ufc-mma?marketFilterId=def&preMatchOnly=true&eventsLimit=50&lang=en'
        );
        const fightCardData = await response.json();
        console.log(fightCardData, "fight card data");
        setFightCardData(fightCardData);
      } catch (err) {
        console.error(err);
        setError('An error occurred while fetching data. Please try again later.');
      }
    };

    const fetchSeedData = async () => {
      try {
        const response = await fetch(`${API_URL}/api/seed-data`);
        const data = await response.json();
        setSeedData(data);
      } catch (err) {
        console.error('Failed to fetch seed data:', err);
        setError('Failed to fetch seed data');
      }
    };

    fetchFightCard();
    fetchSeedData();
  }, []);

  const handleFightClick = (event, competitors) => {
    console.log("handleFightClick called with:", { event, competitors });

    if (!handleAnalyzeFight(event, competitors)) {
      console.log("handleAnalyzeFight returned false");
      return;
    }

    // Add safety checks for markets data
    const markets = event.displayGroups?.[0]?.markets;
    if (!markets || !markets[0]?.outcomes) {
      console.error('Missing markets data:', { markets });
      return;
    }

    const fighter1 = {
      name: competitors[0].name,
      odds: markets[0].outcomes[0]?.price?.american || 'N/A',
      age: '',
      height: '',
      reach: '',
      worldRanking: '',
      wins: '',
      losses: '',
      koWins: '',
      subWins: '',
      strikeAccuracy: '',
      takedownAccuracy: '',
      takedownDefense: ''
    };
    
    const fighter2 = {
      name: competitors[1].name,
      odds: markets[0].outcomes[1]?.price?.american || 'N/A',
      age: '',
      height: '',
      reach: '',
      worldRanking: '',
      wins: '',
      losses: '',
      koWins: '',
      subWins: '',
      strikeAccuracy: '',
      takedownAccuracy: '',
      takedownDefense: ''
    };
    
    console.log('Setting fighter data:', { fighter1, fighter2 });
    
    setSelectedFight({ fighter1, fighter2 });
    setShowPopup(true);
    setIsInputMode(true);
  };

  const handleAnalyzeFight = (event) => {
    const fighter1 = event.competitors[0].name;
    const fighter2 = event.competitors[1].name;
    const fightId = `${fighter1}-${fighter2}`;
    if (analyzedFights.has(fightId)) {
      return false;
    } 
    setAnalyzedFights(prev => new Set([...prev, fightId]));
    return true;
  };

  const handleParlaySelect = (size) => {
    setSelectedParlay(size);
    generateParlay(size);
  };

  const calculateParlayOdds = (fights) => {
    return fights.reduce((total, fight) => {
      if (!fight || !fight.prediction || !fight.prediction.bettingAdvice) {
        console.log('Missing betting advice for fight:', fight);
        return total;
      }

      const odds = parseFloat(fight.prediction.bettingAdvice.fighter1?.expectedValue || 0);
      return total * (1 + odds);
    }, 1);
  };

  const calculateParlayConfidence = (fights) => {
    try {
      if (!fights || fights.length === 0) {
        console.log('No fights provided for confidence calculation');
        return 0;
      }

      const avgConfidence = fights.reduce((sum, fight) => {
        if (!fight || !fight.prediction || typeof fight.prediction.simulationConfidence === 'undefined') {
          console.log('Missing simulation confidence for fight:', fight);
          return sum;
        }
        return sum + parseFloat(fight.prediction.simulationConfidence || 0);
      }, 0) / fights.length;

      return avgConfidence.toFixed(1);
    } catch (error) {
      console.error('Error calculating parlay confidence:', error);
      return 0;
    }
  };

  const generateParlay = (size) => {
    if (!analyzedFightsData || analyzedFightsData.length === 0) {
      alert('Please analyze some fights first before generating a parlay');
      return;
    }

    const sortedFights = [...analyzedFightsData].sort((a, b) => {
      const aConfidence = a?.prediction?.simulationConfidence || 0;
      const bConfidence = b?.prediction?.simulationConfidence || 0;
      return bConfidence - aConfidence;
    });

    const selectedFights = sortedFights.slice(0, size);
    
    const parlayAnalysis = {
      fights: selectedFights,
      confidence: calculateParlayConfidence(selectedFights),
      suggestedBets: selectedFights.map(fight => ({
        fighter: fight?.prediction?.suggestedBet || 'Unknown',
        confidence: fight?.prediction?.simulationConfidence || 0,
        odds: fight?.prediction?.bettingAdvice?.fighter1?.expectedValue || 0
      }))
    };

    setParlayRecommendation(parlayAnalysis);
  };

  // Load analyzed fights from database on component mount
  useEffect(() => {
    const loadAnalyzedFights = async () => {
      try {
        const response = await fetch(`${API_URL}/api/analyzed-fights`);
        if (!response.ok) throw new Error('Failed to fetch analyzed fights');
        const data = await response.json();
        setAnalyzedFightsData(data);
      } catch (error) {
        console.error('Error loading analyzed fights:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAnalyzedFights();
  }, []);

  return (
    <div id="fight-card-data">
      <div className="fight-card-header">
        UFC Fight Card
      </div>
      {fightCardData ? (
        fightCardData[0]?.events?.map((event, index) => (
         
          <div 
            className={`fight-card ${analyzedFights.has(`${event.competitors[0].name}-${event.competitors[1].name}`)? 'analyzed' : ''}`}
            key={index}
            onClick={() => handleFightClick(event, event.competitors)} 
          >
                
            {event.competitors.map((competitor, i) => (
              <div className="fighter-container" key={i}>
                <div className="fighter-info">
                  <div className="fighter-name">{competitor.name}</div>
                  <div className="opponent">
                    vs. {event.competitors[1 - i].name}
                  </div>
                  <div className="odds">
                    {event.displayGroups?.[0]?.markets?.[0]?.outcomes?.[i]?.price?.american || 'N/A'}
                  </div>
                </div>
                <div className="fight-details">
                  <div className="time">
                    {new Date(event.startTime).toLocaleString()}
                  </div>
                  <div className="rounds">
                    {event.displayGroups[0].markets[1]?.outcomes.map((outcome, j) => (
                      <span 
                        key={j} 
                        className={outcome.type === 'O' ? 'over' : 'under'}
                      >
                        {outcome.description} {outcome.price.american}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            {selectedFight && 
             selectedFight.fighter1.name === event.competitors[0].name && 
             prediction && (
              <div className="prediction-container">
                <button onClick={() => setPrediction(null)}
                className="close-prediction"
              > 
                x
              </button>
                <h3>Fight Analysis</h3>
                {prediction.aiAnalysis ? (
                  <>
                    <div className="ai-analysis"> 
                      <h4>AI Analysis</h4>
                      <p>{prediction.message}</p>
                    </div>
                    

                    <div className="simulation-results">
                      <h4>Monte Carlo Simulation Results</h4>
                      <div className="prediction-details">
                        <div className="fighter-prediction">
                          <strong>{selectedFight.fighter1.name}</strong>
                          <p>Win Probability: {prediction.fighter1Probability}%</p>
                          <div className="betting-metrics">
                            <p>Kelly Criterion: {prediction.bettingAdvice.fighter1.kellyBet}%</p>
                            <p>Expected Value: {prediction.bettingAdvice.fighter1.expectedValue}</p>
                          </div>
                        </div>
                        <div className="fighter-prediction">
                          <strong>{selectedFight.fighter2.name}</strong>
                          <p>Win Probability: {prediction.fighter2Probability}%</p>
                          <div className="betting-metrics">
                            <p>Kelly Criterion: {prediction.bettingAdvice.fighter2.kellyBet}%</p>
                            <p>Expected Value: {prediction.bettingAdvice.fighter2.expectedValue}</p>
                          </div>
                        </div>
                      </div>
                      <div className="safe-bet-analysis"> 
                        <h4>Fight Outcome Analysis</h4>
                        <p>Safe Bet: {prediction.fightOutcome?.recommendedBet}</p>
                         
                        <p>Distance Probability: {prediction.fightOutcome?.goesToDistance} ({(100 - prediction.fightOutcome?.finishProbability).toFixed(1)}%)</p>  
                        {/* distance probability pulling from server */}
                        <p>Finish Probability: {prediction.fightOutcome?.finishProbability.toFixed(1)}%</p> 
                        {prediction.fightOutcome?.likelyMethod && (
                       <p>Most Likely Method: {prediction.fightOutcome.likelyMethod} ({prediction.fightOutcome.confidence}% confidence)</p> 
                        )}
                      </div>
                      <div className="simulation-confidence">
                        <p>Simulation Confidence: {prediction.simulationConfidence}%</p>
                      </div>
                    </div>
                    <div className="betting-advice">
                      <h4>Betting Recommendation</h4>
                      <div className="suggested-bet">
                        <p>Suggested Bet: {prediction.suggestedBet}</p>
                        <p className="bet-size">
                          Recommended Size: {
                            prediction.bettingAdvice[prediction.suggestedBet.toLowerCase().includes(selectedFight.fighter1.name.toLowerCase()) 
                              ? 'fighter1' 
                              : 'fighter2'
                            ].kellyBet
                          }% of bankroll
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <p>Using basic odds-based prediction (AI analysis unavailable)</p>
                )}
                {isSimulating && (
                  <div className="simulation-progress">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${simulationProgress}%` }}
                      ></div>
                    </div>
                    <p>Running simulations: {simulationProgress}%</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))
      ) : (
        <p>Loading fight card data...</p>
      )}
      {showPopup && (
        <div className="popup-overlay">
          <div className="popup-content">
            <button 
              className="popup-close-button"
              onClick={() => setShowPopup(false)}
            >
              ×
            </button>
            {isInputMode ? ( 
              <>
                <h3>Enter Fighter Data</h3>
                <form onSubmit={handleSubmitFighterData}>
                  <div className="fighters-comparison">
                    <div className="fighter-form">
                      <h4>{selectedFight.fighter1.name}</h4>
                      <div className="form-group">
                        <label>Age:</label>
                        <input 
                          type="text" 
                          value={selectedFight.fighter1.age}
                          onChange={(e) => handleInputChange(e, 'fighter1', 'age')}
                        />
                      </div>
                      <div className="form-group">
                        <label>Height:</label>
                        <input 
                          type="text" 
                          value={selectedFight.fighter1.height}
                          onChange={(e) => handleInputChange(e, 'fighter1', 'height')}
                        />
                      </div>
                      <div className="form-group">
                        <label>Weight:</label>
                        <input 
                          type="number" 
                          value={selectedFight.fighter1.weight}
                          onChange={(e) => handleInputChange(e, 'fighter1', 'weight')}
                        />
                      </div>
                      <div className="form-group">
                        <label>Reach:</label>
                        <input 
                          type="text" 
                          value={selectedFight.fighter1.reach}
                          onChange={(e) => handleInputChange(e, 'fighter1', 'reach')}
                        />
                      </div>
                      <div className="form-group">
                        <label>World Ranking:</label>
                        <input 
                          type="number" 
                          value={selectedFight.fighter1.worldRanking}
                          onChange={(e) => handleInputChange(e, 'fighter1', 'worldRanking')}
                        />
                      </div>
                      <div className="form-group">
                        <label>Wins:</label>
                        <input 
                          type="number" 
                          value={selectedFight.fighter1.wins}
                          onChange={(e) => handleInputChange(e, 'fighter1', 'wins')}
                        />
                      </div>
                      <div className="form-group">
                        <label>Losses:</label>
                        <input 
                          type="number" 
                          value={selectedFight.fighter1.losses}
                          onChange={(e) => handleInputChange(e, 'fighter1', 'losses')}
                        />
                      </div>
                      <div className="form-group">
                        <label>KO Wins:</label>
                        <input 
                          type="number" 
                          value={selectedFight.fighter1.koWins}
                          onChange={(e) => handleInputChange(e, 'fighter1', 'koWins')}
                        />
                      </div>
                      <div className="form-group">
                        <label>Sub Wins:</label>
                        <input 
                          type="number" 
                          value={selectedFight.fighter1.subWins}
                          onChange={(e) => handleInputChange(e, 'fighter1', 'subWins')}
                        />
                      </div>
                      <div className="form-group">
                        <label>Decision Wins:</label>
                        <input 
                          type="number" 
                          value={selectedFight.fighter1.decisionWins}
                          onChange={(e) => handleInputChange(e, 'fighter1', 'decisionWins')}
                        />
                      </div>
                      <div className="form-group">
                        <label>Strike Accuracy:</label>
                        <input 
                          type="text" 
                          value={selectedFight.fighter1.strikeAccuracy}
                          onChange={(e) => handleInputChange(e, 'fighter1', 'strikeAccuracy')}
                        />
                      </div>
                      <div className="form-group">
                        <label>Takedown Accuracy:</label>
                        <input 
                          type="text" 
                          value={selectedFight.fighter1.takedownAccuracy}
                          onChange={(e) => handleInputChange(e, 'fighter1', 'takedownAccuracy')}
                        />
                      </div>
                      <div className="form-group">
                        <label>Takedown Defense:</label>
                        <input 
                          type="text" 
                          value={selectedFight.fighter1.takedownDefense}
                          onChange={(e) => handleInputChange(e, 'fighter1', 'takedownDefense')}
                        />
                      </div>
                    </div>

                    <div className="fighter-form">
                      <h4>{selectedFight.fighter2.name}</h4>
                      <div className="form-group">
                        <label>Age:</label>
                        <input 
                          type="text" 
                          value={selectedFight.fighter2.age}
                          onChange={(e) => handleInputChange(e, 'fighter2', 'age')}
                        />
                      </div>
                      <div className="form-group">
                        <label>Height:</label>
                        <input 
                          type="text" 
                          value={selectedFight.fighter2.height}
                          onChange={(e) => handleInputChange(e, 'fighter2', 'height')}
                        />
                      </div>
                      <div className="form-group">
                        <label>Weight:</label>
                        <input 
                          type="number" 
                          value={selectedFight.fighter2.weight}
                          onChange={(e) => handleInputChange(e, 'fighter2', 'weight')}
                        />
                      </div>
                      <div className="form-group">
                        <label>Reach:</label>
                        <input 
                          type="text" 
                          value={selectedFight.fighter2.reach}
                          onChange={(e) => handleInputChange(e, 'fighter2', 'reach')}
                        />
                      </div>
                      <div className="form-group">
                        <label>World Ranking:</label>
                        <input 
                          type="number" 
                          value={selectedFight.fighter2.worldRanking}
                          onChange={(e) => handleInputChange(e, 'fighter2', 'worldRanking')}
                        />
                      </div>
                      <div className="form-group">
                        <label>Wins:</label>
                        <input 
                          type="number" 
                          value={selectedFight.fighter2.wins}
                          onChange={(e) => handleInputChange(e, 'fighter2', 'wins')}
                        />
                      </div>
                      <div className="form-group">
                        <label>Losses:</label>
                        <input 
                          type="number" 
                          value={selectedFight.fighter2.losses}
                          onChange={(e) => handleInputChange(e, 'fighter2', 'losses')}
                        />
                      </div>
                      <div className="form-group">
                        <label>KO Wins:</label>
                        <input 
                          type="number" 
                          value={selectedFight.fighter2.koWins}
                          onChange={(e) => handleInputChange(e, 'fighter2', 'koWins')}
                        />
                      </div>
                      <div className="form-group">
                        <label>Sub Wins:</label>
                        <input 
                          type="number" 
                          value={selectedFight.fighter2.subWins}
                          onChange={(e) => handleInputChange(e, 'fighter2', 'subWins')}
                        />
                      </div>
                      <div className="form-group">
                        <label>Decision Wins:</label>
                        <input 
                          type="number" 
                          value={selectedFight.fighter2.decisionWins}
                          onChange={(e) => handleInputChange(e, 'fighter2', 'decisionWins')}
                        />
                      </div>
                      <div className="form-group">
                        <label>Strike Accuracy:</label>
                        <input 
                          type="text" 
                          value={selectedFight.fighter2.strikeAccuracy}
                          onChange={(e) => handleInputChange(e, 'fighter2', 'strikeAccuracy')}
                        />
                      </div>
                      <div className="form-group">
                        <label>Takedown Accuracy:</label>
                        <input  
                          type="text" 
                          value={selectedFight.fighter2.takedownAccuracy}
                          onChange={(e) => handleInputChange(e, 'fighter2', 'takedownAccuracy')}
                        />
                      </div>
                      <div className="form-group">
                        <label>Takedown Defense:</label>
                        <input  
                          type="text" 
                          value={selectedFight.fighter2.takedownDefense}
                          onChange={(e) => handleInputChange(e, 'fighter2', 'takedownDefense')}
                        />  
                      </div>
                    </div>
                  </div>
                  <button type="submit" className="submit-fighter-data">
                    Analyze Fight
                  </button>
                </form>
              </>
            ) : (
                <>
                    <h3>Ollama Analysis</h3>
                   <div className="ollama-response">
                    {ollamaResponse}
                </div>
                <button className="close-popup" onClick={() => setShowPopup(false)}>
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}
      <div className="parlay-container">
        <button 
          className="parlay-button"
          onClick={() => setShowParlayDropdown(!showParlayDropdown)}
        >
          Generate Parlay
        </button>
        {showParlayDropdown && (
          <div className="parlay-dropdown">
            <button onClick={() => handleParlaySelect(2)}>2-Fight Parlay</button>
            <button onClick={() => handleParlaySelect(3)}>3-Fight Parlay</button>
            <button onClick={() => handleParlaySelect(4)}>4-Fight Parlay</button>
          </div>
        )}
      </div>
      {parlayRecommendation && (
        <div className="parlay-recommendation">
          <h3>Parlay Recommendation</h3>
          <div className="parlay-bets">
            {parlayRecommendation.bets.map((bet, index) => (
              <div key={index} className="parlay-bet">
                {bet.type === 'Winner' ? (
                  <>
                    <p className="bet-fighter">Fight {index + 1}: {bet.fighter}</p>
                    <p className="bet-type">Bet Type: Straight Win</p>
                  </>
                ) : (
                  <>
                    <p className="bet-method">Fight {index + 1}: {bet.description}</p>
                    <p className="bet-type">Bet Type: Fight Outcome</p>
                  </>
                )}
                <p className="bet-confidence">Confidence: {bet.confidence.toFixed(1)}%</p>
                <p className="bet-odds">Expected Value: {parseFloat(bet.odds).toFixed(2)}</p>
              </div>
            ))}
          </div>
          <div className="parlay-stats">
            <p>Total Parlay Odds: {parlayRecommendation.totalOdds.toFixed(2)}</p>
            <p>Overall Confidence: {parlayRecommendation.confidence}%</p>
            <p>Parlay Expected Value: {parlayRecommendation.expectedValue}</p>
            <p className="parlay-advice">
              Recommended Bet Size: {Math.min(parlayRecommendation.confidence/100 * 2, 5).toFixed(1)}% of bankroll
            </p>
          </div>
        </div>
      )}
      <div className="analyzed-fights-section">
        <h3>Analyzed Fights ({analyzedFightsData.length})</h3>
        <div className="parlay-controls">
          <button onClick={() => generateParlay(2)}>Generate 2-Fight Parlay</button>
          <button onClick={() => generateParlay(3)}>Generate 3-Fight Parlay</button>
          <button onClick={() => generateParlay(4)}>Generate 4-Fight Parlay</button>
        </div>
        
        {parlayRecommendation && (
          <div className="parlay-recommendation">
            <h4>Recommended Parlay</h4>
            <p>Overall Confidence: {(parlayRecommendation.confidence || 0).toFixed(2)}%</p>
            <div className="parlay-fights">
              {parlayRecommendation.suggestedBets.map((bet, index) => (
                <div key={index} className="parlay-fight">
                  <p>Fight {index + 1}: {bet?.fighter || 'Unknown'}</p>
                  <p>Confidence: {bet?.confidence || 0}%</p>
                  <p>Expected Value: {bet?.odds || 0}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {!isInputMode && (
        <div className="analysis-container">
          <h3>Mistral Fight Analysis</h3>
          <div className="mistral-analysis">
            {ollamaResponse.split('\n').map((line, index) => (
              <p key={index}>{line}</p>
            ))}
          </div>
          
          <div className="statistical-analysis">
            <h4>Statistical Breakdown</h4>
            {prediction && (
              <>
                <div className="prediction-details">
                  <div className="fighter-prediction">
                    <strong>{selectedFight.fighter1.name}</strong>
                    <p>Win Probability: {prediction.fighter1Probability}%</p>
                    <div className="betting-metrics">
                      <p>Kelly Criterion: {prediction.bettingAdvice.fighter1.kellyBet}%</p>
                      <p>Expected Value: {prediction.bettingAdvice.fighter1.expectedValue}</p>
                    </div>
                  </div>
                  
                  <div className="fighter-prediction">
                    <strong>{selectedFight.fighter2.name}</strong>
                    <p>Win Probability: {prediction.fighter2Probability}%</p>
                    <div className="betting-metrics">
                      <p>Kelly Criterion: {prediction.bettingAdvice.fighter2.kellyBet}%</p>
                      <p>Expected Value: {prediction.bettingAdvice.fighter2.expectedValue}</p>
                    </div>
                  </div>
                </div>

                <div className="fight-outcome-analysis">
                  <h4>Fight Outcome Analysis</h4>
                  <p>Safe Bet: {prediction.fightOutcome?.recommendedBet}</p>
                  <p>Distance Probability: {prediction.fightOutcome?.goesToDistance} 
                     ({(100 - prediction.fightOutcome?.finishProbability).toFixed(1)}%)</p>
                  <p>Finish Probability: {prediction.fightOutcome?.finishProbability.toFixed(1)}%</p>
                  {prediction.fightOutcome?.likelyMethod && (
                    <p>Most Likely Method: {prediction.fightOutcome.likelyMethod} 
                       ({prediction.fightOutcome.confidence}% confidence)</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  ); 
}

export default UFC;





// It parses the XML data and extracts information from both the selections and bets sections.
// For selections, it extracts the id, outcomeId, marketId, priceId, system, price, and points.
// For bets, it extracts the id, betType, price, description, and the American odds from the totalPriceFormattedMap.
// 4. The parsed data is stored in a structured object with selections and bets arrays.
// The render method now displays this structured data in a more readable format, showing separate sections for Selections and Bets.

