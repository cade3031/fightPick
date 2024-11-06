const express = require('express');
const cors = require('cors');
const axios = require('axios');
const pool = require('./config/db');

const app = express();
const PORT = process.env.PORT || 8080;
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://ollama:11434';

// Middleware
app.use(express.json());
app.use(cors({
  origin: ['http://100.119.251.66:3000', 'http://localhost:3000', '*'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Request body:', req.body);
  next();
});

// Basic test route
app.get('/', (req, res) => {
  res.json({ message: 'Server is running' });
});

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!' });
});

// Your existing predict endpoint and other code...

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('=================================');
  console.log(`Server running on port ${PORT}`);
  console.log(`Server URL: http://100.119.251.66:${PORT}`);
  console.log(`Ollama URL: ${OLLAMA_URL}`);
  console.log('Available endpoints:');
  console.log('- GET  /');
  console.log('- GET  /api/test');
  console.log('- POST /api/predict');
  console.log('=================================');
});
