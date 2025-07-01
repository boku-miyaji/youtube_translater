#!/bin/bash
# Start server with API key prompt (never saved to disk)

echo "🔐 Secure YouTube Translator Startup"
echo "===================================="

# Check if already in environment
if [ -z "$OPENAI_API_KEY" ]; then
    echo -n "Enter your OpenAI API key: "
    read -s OPENAI_API_KEY
    echo
    export OPENAI_API_KEY
fi

echo "✅ Starting server (API key in memory only)..."
npm start