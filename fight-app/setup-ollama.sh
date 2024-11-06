#!/bin/bash
echo "Waiting for Ollama service to start..."
sleep 10
docker exec fight-app-ollama-1 ollama pull llama2 