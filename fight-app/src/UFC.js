import React, { useEffect, useState } from 'react';
import './UFC.css';
import WeightClass from './pages/WeightClass';

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

    const fighter1 = {
      name: competitors[0].name,
      odds: event.displayGroups[0].markets[0].outcomes[0].price.american,
      age: competitors[0].age || 'N/A',
      height: competitors[0].height || 'N/A',
      reach: competitors[0].reach || 'N/A',
      wins: competitors[0].wins || 0,
      losses: competitors[0].losses || 0,
      koWins: competitors[0].koWins || 0,
      subWins: competitors[0].subWins || 0,
      strikeAccuracy: competitors[0].strikeAccuracy || 'N/A'
    };
    
    const fighter2 = {
      name: competitors[1].name,
      odds: event.displayGroups[0].markets[0].outcomes[1].price.american,
      age: competitors[1].age || 'N/A',
      height: competitors[1].height || 'N/A',
      reach: competitors[1].reach || 'N/A',
      wins: competitors[1].wins || 0,
      losses: competitors[1].losses || 0,
      koWins: competitors[1].koWins || 0,
      subWins: competitors[1].subWins || 0,
      strikeAccuracy: competitors[1].strikeAccuracy || 'N/A'
    };
    
    console.log('Fighter data:', { fighter1, fighter2 });
    
    setSelectedFight({ fighter1, fighter2 });
    getPrediction(fighter1, fighter2);
    handleAnalyzeFight(event, fighter1.name); // calls the handleAnalyze fight function into the useEffect 

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
                    {event.displayGroups[0].markets[0].outcomes[i].price.american}
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
            <h3>Ollama Analysis</h3>
            <div className="ollama-response">
              {ollamaResponse}
            </div>
            <button 
              className="close-popup" 
              onClick={() => setShowPopup(false)}
            >
              Close
            </button>
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

