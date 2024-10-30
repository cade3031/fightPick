import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import UFC from './UFC';
import Navbar from './Navbar';
import './App.css';
import Home from './pages/Home';
import WeightClass from './pages/WeightClass';
import Football from './pages/Football';
import Events from './pages/Events';

function App() {
const [isAuthenticated, setIsAuthenticated] = useState(false);


  return (
    <Router>
      <Routes path="/" element={isAuthenticated ? <Home /> : <Home />} />
      <div>
        <Navbar />
        <Routes>
          <Route path="/UFC/*" element={<UFC />} />
          <Route path="/" element={<Home />} />
          <Route path="/WeightClass" element={<WeightClass />} />
          <Route path="/Football" element={<Football />} />
          <Route path="/Events" element={<Events />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
 