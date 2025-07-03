#!/bin/bash
# Secure API key setup using system keychain

echo "🔐 Secure OpenAI API Key Setup"
echo "================================"

# Check if running on macOS or Linux
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS - use Keychain
    echo "📱 Detected macOS - Using Keychain"
    echo ""
    echo "To store your API key securely:"
    echo "security add-generic-password -a $USER -s 'OPENAI_API_KEY' -w 'your-api-key-here'"
    echo ""
    echo "To retrieve it when starting the server:"
    echo "export OPENAI_API_KEY=\$(security find-generic-password -a $USER -s 'OPENAI_API_KEY' -w)"
else
    # Linux - use secret-tool or pass
    if command -v secret-tool &> /dev/null; then
        echo "🐧 Detected Linux with secret-tool"
        echo ""
        echo "To store your API key securely:"
        echo "secret-tool store --label='OpenAI API Key' service openai username $USER"
        echo ""
        echo "To retrieve it when starting the server:"
        echo "export OPENAI_API_KEY=\$(secret-tool lookup service openai username $USER)"
    elif command -v pass &> /dev/null; then
        echo "🔑 Detected Linux with pass"
        echo ""
        echo "To store your API key securely:"
        echo "pass insert openai/api-key"
        echo ""
        echo "To retrieve it when starting the server:"
        echo "export OPENAI_API_KEY=\$(pass openai/api-key)"
    else
        echo "⚠️  No secure storage tool found"
        echo "Install one of: gnome-keyring (secret-tool) or pass"
    fi
fi