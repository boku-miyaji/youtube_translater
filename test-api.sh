#!/bin/bash

# YouTube Translator API テストスクリプト
# 使用方法: ./test-api.sh

BASE_URL="http://localhost:8080"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🧪 YouTube Translator API テスト開始"
echo "======================================"

# サーバー稼働確認
echo -e "\n${YELLOW}1. ヘルスチェック${NC}"
response=$(curl -s -w "%{http_code}" -o /tmp/health_response "$BASE_URL/health")
http_code=${response: -3}

if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✅ サーバー稼働中${NC}"
    cat /tmp/health_response | jq .
else
    echo -e "${RED}❌ サーバー応答エラー (HTTP $http_code)${NC}"
    exit 1
fi

# プロンプト設定テスト
echo -e "\n${YELLOW}2. プロンプト設定取得${NC}"
response=$(curl -s -w "%{http_code}" -o /tmp/prompts_response "$BASE_URL/prompts")
http_code=${response: -3}

if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✅ プロンプト設定取得成功${NC}"
    cat /tmp/prompts_response | jq .
else
    echo -e "${RED}❌ プロンプト設定取得失敗 (HTTP $http_code)${NC}"
fi

# セッションコスト取得テスト
echo -e "\n${YELLOW}3. セッションコスト取得${NC}"
response=$(curl -s -w "%{http_code}" -o /tmp/session_costs_response "$BASE_URL/session-costs")
http_code=${response: -3}

if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✅ セッションコスト取得成功${NC}"
    cat /tmp/session_costs_response | jq .
else
    echo -e "${RED}❌ セッションコスト取得失敗 (HTTP $http_code)${NC}"
fi

# 履歴取得テスト
echo -e "\n${YELLOW}4. 履歴取得${NC}"
response=$(curl -s -w "%{http_code}" -o /tmp/history_response "$BASE_URL/history")
http_code=${response: -3}

if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✅ 履歴取得成功${NC}"
    echo "履歴件数: $(cat /tmp/history_response | jq '. | length')"
else
    echo -e "${RED}❌ 履歴取得失敗 (HTTP $http_code)${NC}"
fi

# YouTube URL処理テスト（無効URL）
echo -e "\n${YELLOW}5. YouTube URL処理テスト（無効URL）${NC}"
response=$(curl -s -w "%{http_code}" -o /tmp/upload_invalid_response -X POST "$BASE_URL/upload-youtube" \
    -H "Content-Type: application/json" \
    -d '{"url":"https://invalid-url","language":"ja","gptModel":"gpt-4o-mini"}')
http_code=${response: -3}

if [ "$http_code" = "200" ]; then
    success=$(cat /tmp/upload_invalid_response | jq -r '.success')
    if [ "$success" = "false" ]; then
        echo -e "${GREEN}✅ 無効URL適切にエラー処理${NC}"
        cat /tmp/upload_invalid_response | jq .
    else
        echo -e "${RED}❌ 無効URLエラー処理が不適切${NC}"
    fi
else
    echo -e "${RED}❌ APIリクエスト失敗 (HTTP $http_code)${NC}"
fi

# チャット機能テスト（コンテンツなし）
echo -e "\n${YELLOW}6. チャット機能テスト（コンテンツなし）${NC}"
response=$(curl -s -w "%{http_code}" -o /tmp/chat_response -X POST "$BASE_URL/chat" \
    -H "Content-Type: application/json" \
    -d '{"message":"テストメッセージ","gptModel":"gpt-4o-mini"}')
http_code=${response: -3}

if [ "$http_code" = "200" ]; then
    success=$(cat /tmp/chat_response | jq -r '.success')
    if [ "$success" = "false" ]; then
        echo -e "${GREEN}✅ コンテンツなし適切にエラー処理${NC}"
        cat /tmp/chat_response | jq .
    else
        echo -e "${RED}❌ コンテンツなしエラー処理が不適切${NC}"
    fi
else
    echo -e "${RED}❌ チャットAPIリクエスト失敗 (HTTP $http_code)${NC}"
fi

# デバッグ状態確認
echo -e "\n${YELLOW}7. デバッグ状態確認${NC}"
response=$(curl -s -w "%{http_code}" -o /tmp/debug_response "$BASE_URL/debug/state")
http_code=${response: -3}

if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✅ デバッグ状態取得成功${NC}"
    cat /tmp/debug_response | jq .
else
    echo -e "${RED}❌ デバッグ状態取得失敗 (HTTP $http_code)${NC}"
fi

echo -e "\n${YELLOW}======================================"
echo -e "🏁 テスト完了${NC}"
echo ""
echo -e "${GREEN}✅ 実行可能なテスト項目:${NC}"
echo "  - ヘルスチェック"
echo "  - プロンプト設定取得"  
echo "  - セッションコスト取得"
echo "  - 履歴取得"
echo "  - 無効URL処理"
echo "  - チャット機能（コンテンツなし）"
echo "  - デバッグ状態確認"
echo ""
echo -e "${YELLOW}📝 注意事項:${NC}"
echo "  - 実際のYouTube動画処理テストは時間がかかるため手動で実行してください"
echo "  - OpenAI APIキーが設定されていない場合、一部機能でエラーが発生します"

# 一時ファイル削除
rm -f /tmp/health_response /tmp/prompts_response /tmp/session_costs_response
rm -f /tmp/history_response /tmp/upload_invalid_response /tmp/chat_response /tmp/debug_response