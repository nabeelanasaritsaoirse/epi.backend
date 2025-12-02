#!/bin/bash

# Wallet API Test Script using curl
# Usage: bash test-wallet-curl.sh <JWT_TOKEN>

BASE_URL="https://api.epielio.com"
JWT_TOKEN="$1"

if [ -z "$JWT_TOKEN" ]; then
    echo "❌ ERROR: JWT token required"
    echo "Usage: bash test-wallet-curl.sh <JWT_TOKEN>"
    echo ""
    echo "Get your token by:"
    echo "1. Login to the app"
    echo "2. Copy the JWT token from the response"
    exit 1
fi

echo "🚀 Wallet API Tests"
echo "═══════════════════════════════════════════════════"
echo "Base URL: $BASE_URL"
echo "Token: ${JWT_TOKEN:0:20}..."
echo "═══════════════════════════════════════════════════"

# Test 1: Get Wallet Summary
echo ""
echo "📝 Test 1: Get Wallet Summary"
echo "──────────────────────────────────────────────────"
curl -X GET "$BASE_URL/api/wallet/" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -w "\nStatus Code: %{http_code}\n" \
  -s | jq '.' 2>/dev/null || cat

echo ""
echo ""

# Test 2: Add Money
echo "📝 Test 2: Add Money (₹100)"
echo "──────────────────────────────────────────────────"
RESPONSE=$(curl -X POST "$BASE_URL/api/wallet/add-money" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 100}' \
  -w "\n%{http_code}" \
  -s)

# Extract status code (last line)
STATUS_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | head -n -1)

echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo "Status Code: $STATUS_CODE"

# Extract order_id and transaction_id if successful
ORDER_ID=$(echo "$BODY" | jq -r '.order_id' 2>/dev/null)
TRANSACTION_ID=$(echo "$BODY" | jq -r '.transaction_id' 2>/dev/null)

if [ "$STATUS_CODE" = "200" ]; then
    echo "✅ Add Money: SUCCESS"
    echo "Order ID: $ORDER_ID"
    echo "Transaction ID: $TRANSACTION_ID"
else
    echo "❌ Add Money: FAILED"
fi

echo ""
echo ""

# Test 3: Withdrawal Request (UPI)
echo "📝 Test 3: Withdrawal Request (UPI - ₹50)"
echo "──────────────────────────────────────────────────"
curl -X POST "$BASE_URL/api/wallet/withdraw" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50,
    "paymentMethod": "upi",
    "upiId": "test@paytm"
  }' \
  -w "\nStatus Code: %{http_code}\n" \
  -s | jq '.' 2>/dev/null || cat

echo ""
echo ""

# Test 4: Get Transaction History
echo "📝 Test 4: Get Transaction History"
echo "──────────────────────────────────────────────────"
curl -X GET "$BASE_URL/api/wallet/transactions" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -w "\nStatus Code: %{http_code}\n" \
  -s | jq '.' 2>/dev/null || cat

echo ""
echo "═══════════════════════════════════════════════════"
echo "✅ Tests completed"
echo "═══════════════════════════════════════════════════"
