#!/bin/bash

# Start Ollama with llama2 model in the background
echo "Starting Ollama and pulling llama2 model..."
ollama pull llama2 &

# Wait for Ollama to be ready
sleep 10

# Start Docker containers
echo "Starting Docker containers..."
docker-compose up -d

# Wait for containers to be ready
sleep 5

# Start frontend development server
echo "Starting frontend development server..."
cd frontend
npm run dev &

# Start backend server
echo "Starting backend server..."
cd ../backend
npm run dev &

echo "All services started!"
echo "Frontend: http://localhost:3000"
echo "Backend: http://localhost:8080"
echo "Ollama: http://localhost:11434"

# Keep script running
wait 