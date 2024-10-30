import React, { useEffect, useState } from 'react';
import './Football.css';

function Football() {
  const [footballData, setFootballData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchFootballData = async () => {
      try {
        const response = await fetch(
          'https://www.bovada.lv/services/sports/event/coupon/events/A/description/football/nfl?marketFilterId=def&preMatchOnly=true&eventsLimit=5000&lang=en'
        );
        if (!response.ok) {
          throw new Error('Failed to fetch data');
        }
        const data = await response.json();
        setFootballData(data[0].events || []); // Assuming the events are in the first item of the array
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchFootballData();
  }, []);

  const extractedData = footballData.map(event => ({
    homeTeam: event.competitors.find(team => team.home).name,
    awayTeam: event.competitors.find(team => !team.home).name,
    date: new Date(event.startTime).toLocaleDateString(),
    time: new Date(event.startTime).toLocaleTimeString(),
    odds: {
      spread: event.displayGroups[0].markets.find(market => market.description === "Point Spread").outcomes.map(outcome => ({
        team: outcome.description,
        handicap: outcome.price.handicap,
        odds: outcome.price.american
      })),
      moneyline: event.displayGroups[0].markets.find(market => market.description === "Moneyline").outcomes.map(outcome => ({
        team: outcome.description,
        odds: outcome.price.american
      })),
      total: event.displayGroups[0].markets.find(market => market.description === "Total").outcomes.map(outcome => ({
        type: outcome.description,
        handicap: outcome.price.handicap,
        odds: outcome.price.american
      }))
    }
  }));

  return (
    <div className="football-container">
      <h1 className="football-header">NFL Football Events</h1>
      {loading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}
      {!loading && !error && (
        <div className="football-content">
          {extractedData.map((game, index) => (
            <div key={index} className="football-card">
              <h3>{game.awayTeam} @ {game.homeTeam}</h3>
              <p>Date: {game.date}</p>
              <p>Time: {game.time}</p>
              <h4>Odds:</h4>
              <p>Spread: {game.odds.spread.map(team => `${team.team} ${team.handicap} (${team.odds})`).join(', ')}</p>
              <p>Moneyline: {game.odds.moneyline.map(team => `${team.team} (${team.odds})`).join(', ')}</p>
              <p>Total:</p>
              <div className="total-odds">
                {game.odds.total.map((total, index) => (
                  <div key={index} className={`total-${total.type.toLowerCase()} ${total.type.toLowerCase()}`}>
                    {total.type} {total.handicap} ({total.odds})
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Football;
