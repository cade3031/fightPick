import React, { useState } from 'react';
import axios from 'axios'; // You'll need to install axios: npm install axios
import './Weightclass.css';

// Simplified seed data
const seedData = {
  "Flyweight": [
    { id: 1, name: "Fighter 1", age: 25, height: "5'5\"", weight: 125, reach: 66, record: "10-2" },
    { id: 2, name: "Fighter 2", age: 27, height: "5'6\"", weight: 125, reach: 67, record: "12-1" },
  ],
  "Bantamweight": [
    { id: 3, name: "Fighter 3", age: 28, height: "5'7\"", weight: 135, reach: 68, record: "15-3" },
    { id: 4, name: "Fighter 4", age: 26, height: "5'8\"", weight: 135, reach: 69, record: "14-2" },
  ],
  // Add more weight classes and fighters as needed
};

function WeightClass() {
    const [selectedFighters, setSelectedFighters] = useState([]);
    const [prediction, setPrediction] = useState(null);

    const weightClasses = Object.keys(seedData);

    const handleFighterClick = (fighter) => {
        if (selectedFighters.length < 2) {
            setSelectedFighters([...selectedFighters, fighter]);
        } else {
            setSelectedFighters([fighter]);
        }
        setPrediction(null);
    };

    const getPrediction = async () => {
        if (selectedFighters.length !== 2) {
            alert("Please select two fighters to compare.");
            return;
        }

        try {
            const response = await axios.post('http://localhost:3001/api/predict', {
                fighter1: selectedFighters[0],
                fighter2: selectedFighters[1]
            });
            setPrediction(response.data.prediction);
        } catch (error) {
            console.error('Error getting prediction:', error);
            alert('An error occurred while getting the prediction.');
        }
    };

    return (
        <div className="weight-class-container">
            <h1>Weight Classes</h1>
            <div className="weight-classes">
                {weightClasses.map((weightClass) => (
                    <div key={weightClass} className="weight-class-item">
                        <h2>{weightClass}</h2>
                        <div className="fighters-list">
                            {seedData[weightClass].map((fighter) => (
                                <button
                                    key={fighter.id}
                                    className={`fighter-button ${selectedFighters.includes(fighter) ? 'selected' : ''}`}
                                    onClick={() => handleFighterClick(fighter)}
                                >
                                    {fighter.name}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            {selectedFighters.length === 2 && (
                <button className="predict-button" onClick={getPrediction}>Get Prediction</button>
            )}
            {prediction && (
                <div className="prediction">
                    <h3>Prediction</h3>
                    <p>{prediction}</p>
                </div>
            )}
            <div className="selected-fighters">
                {selectedFighters.map((fighter) => (
                    <div key={fighter.id} className="fighter-details">
                        <h2>{fighter.name}</h2>
                        <p>Age: {fighter.age}</p>
                        <p>Height: {fighter.height}</p>
                        <p>Weight: {fighter.weight} lbs</p>
                        <p>Reach: {fighter.reach}"</p>
                        <p>Record: {fighter.record}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default WeightClass;
