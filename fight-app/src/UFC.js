import React, { useEffect, useState } from 'react';
import './UFC.css';

// Replace YOUR_TAILSCALE_IP with your actual Tailscale IP address
const API_URL = 'http://localhost:8080';  // Make sure port matches your server

function UFC() {
  const [betslipData, setBetslipData] = useState(null); // state for betslip data
  const [fightCardData, setFightCardData] = useState(null); // state for fight card data
  const [seedData, setSeedData] = useState(null); // Add state for seedData
  const [error, setError] = useState(null);
  const [selectedFight, setSelectedFight] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [ollamaResponse, setOllamaResponse] = useState('');
  const [analyzedFights, setAnalyzedFights] = useState(new Set());
  const [isInputMode, setIsInputMode] = useState(true);
  const [selectedParlay, setSelectedParlay] = useState(null);
  const [analyzedFightsData, setAnalyzedFightsData] = useState([]);
  const [showParlayDropdown, setShowParlayDropdown] = useState(false);
  const [parlayRecommendation, setParlayRecommendation] = useState(null);

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
    try {
      const response = await fetch(`${API_URL}/api/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fighter1: selectedFight.fighter1,
          fighter2: selectedFight.fighter2
        })
      });

      const data = await response.json();
      setPrediction(data);
      setOllamaResponse(data.message);
      
      // Save to database
      const saveResponse = await fetch(`${API_URL}/api/save-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fighters: selectedFight,
          prediction: data,
          fightOutcome: data.fightOutcome,
          bettingAdvice: data.bettingAdvice
        })
      });

      if (!saveResponse.ok) {
        console.error('Failed to save fight analysis');
      }
      
      // Update local state
      setAnalyzedFightsData(prev => [...prev, {
        fighters: selectedFight,
        prediction: data,
        fightOutcome: data.fightOutcome,
        bettingAdvice: data.bettingAdvice
      }]);
      
      setIsInputMode(false);
    } catch (error) {
      console.error('Error analyzing fight:', error);
      alert('Error analyzing fight data: ' + error.message);
    }
  };

  useEffect(() => {
    const fetchBetslipData = async () => {
      try {
        const response = await fetch(
          'https://services.bovada.lv/services/sports/bet/betslip?outcomeId=A:1738983871:1&outcomeId=A:1750044571:2&outcomeId=A:1750044572:3&outcomeId=A:1730728345:4&outcomeId=A:1738913866:5'
        );
        const data = await response.json(); // Parse the response as JSON
        console.log('Raw JSON data fetched:', data);

        // Extract selections and bets from the JSON response
        const selections = data.selections.selection.map(selection => ({
          id: selection.id || '',
          outcomeId: selection.outcomeId || '',
          marketID: selection.marketId || '',
          priceID: selection.priceId || '',
          system: selection.system || '',
          price: selection.price || '',
          points: selection.points || ''
        }));

        const bets = data.bets.bet.map(bet => ({
          id: bet.id || '',
          betType: bet.betType || '',
          price: bet.price || '',
          description: bet.description || '',
          americanOdds: bet.totalPriceFormattedMap?.AMERICAN || ''
        }));

        setBetslipData({ selections, bets });
      } catch (err) {
        console.error(err);
        setError('An error occurred while fetching data. Please try again later.');
      }
    };

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

    fetchBetslipData();
    fetchFightCard();
    fetchSeedData();
  }, []);

  const getPrediction = async (fighter1, fighter2) => {
    setIsLoading(true);
    setIsSimulating(true);
    setSimulationProgress(0);
    
    try {
      console.log('Sending request to:', `${API_URL}/api/predict`);
      const response = await fetch(`${API_URL}/api/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          fighter1,
          fighter2,
          odds1: fighter1.odds,
          odds2: fighter2.odds
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Received response:', data);
      setPrediction(data);
      setOllamaResponse(data.message);
      setShowPopup(true);
    } catch (err) {
      console.error('Detailed prediction error:', err);
      console.error('Network status:', navigator.onLine);
      setError('Failed to get prediction: ' + err.message);
    } finally {
      setIsLoading(false);
      setIsSimulating(false);
    }
  };

  const handleFightClick = (event, competitors) => {
    if (!handleAnalyzeFight(event, competitors)) {
      return;
    }

    // Add safety checks for markets data
    const markets = event.displayGroups?.[0]?.markets;
    if (!markets || !markets[0]?.outcomes) {
      console.error('Missing markets data');
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
    
    console.log('Fighter data:', { fighter1, fighter2 });
    
    setSelectedFight({ fighter1, fighter2 });
    setShowPopup(true);
    setIsInputMode(true);
  };

  const handleAnalyzeFight = (event, name) => {
    const fighter1 = event.competitors[0].name; //creates a variable for the first fighter
    const fighter2 = event.competitors[1].name; //creates a variable for the second fighter
    const fightId = `${fighter1}-${fighter2}`; //creates a variable for the fight id
    if (analyzedFights.has(fightId)) { //checks if the fight id has been clicked
      return false;
    } 
      setAnalyzedFights(prev => new Set([...prev, fightId])); //adds the fight id to the set
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

  const calculateParlayEV = (fights) => {
    try {
      if (!fights || fights.length === 0) return 0;
      
      const totalOdds = calculateParlayOdds(fights);
      const confidence = calculateParlayConfidence(fights);
      return ((confidence/100 * totalOdds) - 1).toFixed(3);
    } catch (error) {
      console.error('Error calculating parlay EV:', error);
      return 0;
    }
  };

  const generateParlay = (size) => {
    console.log('Current analyzedFightsData:', analyzedFightsData);
    if (!analyzedFightsData || analyzedFightsData.length === 0) {
      console.log('No analyzed fights available for parlay');
      alert('Please analyze some fights first before generating a parlay');
      return;
    }

    console.log('Generating parlay with data:', analyzedFightsData);

    const allBets = analyzedFightsData
      .filter(fight => fight && fight.prediction)
      .map(fight => {
        const bets = [];

        if (fight.prediction?.suggestedBet) {
          const winnerBet = {
            type: 'Winner',
            fighter: fight.prediction.suggestedBet,
            odds: fight.prediction.bettingAdvice?.[
              fight.prediction.suggestedBet.toLowerCase().includes(fight.fighters.fighter1.name.toLowerCase()) 
                ? 'fighter1' 
                : 'fighter2'
            ]?.expectedValue || 0,
            confidence: fight.prediction.simulationConfidence || 0,
            description: `${fight.prediction.suggestedBet} to win`
          };
          bets.push(winnerBet);
        }

        if (fight.fightOutcome?.confidence > 70) {
          bets.push({
            type: 'Method',
            description: fight.fightOutcome.recommendedBet || 'Method unknown',
            odds: (fight.fightOutcome.finishProbability || 0) / 100,
            confidence: fight.fightOutcome.confidence || 0,
            methodType: fight.fightOutcome.likelyMethod
          });
        }

        return bets;
      }).flat();

    const sortedBets = allBets.sort((a, b) => {
      const aValue = a.confidence * parseFloat(a.odds);
      const bValue = b.confidence * parseFloat(b.odds);
      return bValue - aValue;
    });

    const selectedBets = sortedBets.slice(0, size);

    const parlayAnalysis = {
      bets: selectedBets,
      totalOdds: calculateParlayOdds(selectedBets),
      confidence: calculateParlayConfidence(selectedBets),
      expectedValue: calculateParlayEV(selectedBets)
    };

    setParlayRecommendation(parlayAnalysis);
  };

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
    </div>
  ); 
}

export default UFC;





// It parses the XML data and extracts information from both the selections and bets sections.
// For selections, it extracts the id, outcomeId, marketId, priceId, system, price, and points.
// For bets, it extracts the id, betType, price, description, and the American odds from the totalPriceFormattedMap.
// 4. The parsed data is stored in a structured object with selections and bets arrays.
// The render method now displays this structured data in a more readable format, showing separate sections for Selections and Bets.

