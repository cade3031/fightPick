#!/bin/bash

# Wait for Ollama service to be ready
echo "Waiting for Ollama service..."
until curl -s http://localhost:11434/api/tags > /dev/null; do
    sleep 1
done

echo "Ollama service is ready. Installing models..."

# Pull the Mistral model
echo "Pulling Mistral model..."
ollama pull mistral

echo "Model installation complete!"

# Keep the container running
tail -f /dev/null