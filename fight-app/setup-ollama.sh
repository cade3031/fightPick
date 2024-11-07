#!/bin/bash

# Wait for Ollama to be ready
echo "Waiting for Ollama service..."
sleep 5

# Pull and load the model
echo "Loading LLaMA model..."
ollama pull llama2:7b-chat-q4_0

# Keep the model loaded
echo "Model loaded successfully"