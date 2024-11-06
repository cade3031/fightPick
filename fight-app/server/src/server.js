const express = require('express');
const cors = require('cors');
const app = express();
const axios = require('axios');
const pool = require('./config/db');

// Add middleware
app.use(express.json());
app.use(cors({
  origin: ['http://100.119.251.66:3000', 'http://localhost:3000', '*'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// Add request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Add basic test endpoint
app.get('/api/test', (req, res) => {
  console.log('Test endpoint hit');
  res.json({ message: 'API is working!' });
});

// Add health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Rest of your existing code...

// Update the listening configuration
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log('=================================');
  console.log(`Server running on port ${PORT}`);
  console.log(`Server URL: http://100.119.251.66:${PORT}`);
  console.log('Server is ready to accept connections');
  console.log('Available endpoints:');
  console.log('- GET  /api/test');
  console.log('- GET  /health');
  console.log('- POST /api/predict');
  console.log('=================================');
});
