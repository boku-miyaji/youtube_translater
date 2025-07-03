#!/bin/bash
# Secure startup script for YouTube Translator

# Check if API key is set
if [ -z "$OPENAI_API_KEY" ]; then
    # Try to load from .env.local
    if [ -f .env.local ]; then
        export $(grep -E '^OPENAI_API_KEY=' .env.local | xargs)
    else
        echo "⚠️  OPENAI_API_KEY not found!"
        echo "Please create .env.local file with:"
        echo "OPENAI_API_KEY=your-api-key-here"
        echo ""
        echo "Or set environment variable:"
        echo "export OPENAI_API_KEY='your-api-key-here'"
        exit 1
    fi
fi

echo "✅ Starting server with API key configured..."
npm start