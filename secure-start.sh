#!/bin/bash
# Secure startup with encrypted API key

KEY_FILE=".env.encrypted"
TEMP_ENV=".env.temp"

if [ ! -f "$KEY_FILE" ]; then
    echo "🔐 First time setup - Creating encrypted API key"
    echo -n "Enter your OpenAI API key: "
    read -s API_KEY
    echo
    echo "OPENAI_API_KEY=$API_KEY" | openssl enc -aes-256-cbc -salt -pbkdf2 -out "$KEY_FILE"
    echo "✅ API key encrypted and saved"
fi

echo "🔓 Decrypting API key..."
openssl enc -aes-256-cbc -d -pbkdf2 -in "$KEY_FILE" -out "$TEMP_ENV" 2>/dev/null

if [ $? -eq 0 ]; then
    # Load decrypted env vars
    export $(cat "$TEMP_ENV" | xargs)
    # Remove temp file immediately
    rm -f "$TEMP_ENV"
    
    echo "✅ Starting server..."
    npm start
else
    echo "❌ Failed to decrypt. Wrong password?"
    rm -f "$TEMP_ENV"
    exit 1
fi