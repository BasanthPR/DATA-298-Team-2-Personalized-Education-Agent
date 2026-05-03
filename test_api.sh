#!/bin/bash
# Professor in a Box — API Test Suite
# Usage: bash test_api.sh <EC2-PUBLIC-IP>
# Example: bash test_api.sh 54.123.45.67
#
# Run this from your laptop AFTER Nischitha has deployed the server on EC2.
# All 5 tests from the deployment plan are covered.

EC2_IP="${1:-localhost}"
BASE_URL="http://${EC2_IP}:8000"

echo "============================================"
echo " Professor in a Box — Deployment Test Suite"
echo " Target: ${BASE_URL}"
echo "============================================"
echo ""

PASS=0
FAIL=0

run_test() {
    local test_id="$1"
    local description="$2"
    local expected="$3"
    local result="$4"

    if echo "$result" | grep -q "$expected"; then
        echo "  [PASS] ${test_id}: ${description}"
        PASS=$((PASS + 1))
    else
        echo "  [FAIL] ${test_id}: ${description}"
        echo "         Expected to find: ${expected}"
        echo "         Got: ${result}"
        FAIL=$((FAIL + 1))
    fi
}

# ── T1: Health check ──────────────────────────────────────────────────────────
echo "T1 — Health Check"
T1=$(curl -s --max-time 10 "${BASE_URL}/health")
run_test "T1" "Server alive and responding" '"status":"ok"' "$T1"
echo "     Response: $T1"
echo ""

# ── T2: Mistral — general concept question ────────────────────────────────────
echo "T2 — Mistral (general pathway)"
echo "     Sending: 'Explain binary search trees with an example'"
echo "     Please wait — first load takes 20-60 seconds ..."
T2=$(curl -s --max-time 180 -X POST "${BASE_URL}/ask" \
    -H "Content-Type: application/json" \
    -d '{"question": "Explain binary search trees with a simple example", "model": "mistral"}')
run_test "T2" "Mistral returns answer" '"model_used":"mistral"' "$T2"
echo "     Latency: $(echo $T2 | python3 -c "import sys,json; d=json.load(sys.stdin); print(str(d.get('latency_ms','?'))+'ms')" 2>/dev/null)"
echo ""

# ── T3: DeepSeek — advanced reasoning question ───────────────────────────────
echo "T3 — DeepSeek (reasoning pathway)"
echo "     Sending: 'What is the time complexity of merge sort and why?'"
echo "     Please wait — first load takes 20-60 seconds ..."
T3=$(curl -s --max-time 180 -X POST "${BASE_URL}/ask" \
    -H "Content-Type: application/json" \
    -d '{"question": "What is the time complexity of merge sort and why? Show the derivation.", "model": "deepseek"}')
run_test "T3" "DeepSeek returns answer" '"model_used":"deepseek"' "$T3"
echo "     Latency: $(echo $T3 | python3 -c "import sys,json; d=json.load(sys.stdin); print(str(d.get('latency_ms','?'))+'ms')" 2>/dev/null)"
echo ""

# ── T4: Invalid model name — should return 400 ───────────────────────────────
echo "T4 — Invalid model name (error handling)"
T4=$(curl -s --max-time 10 -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/ask" \
    -H "Content-Type: application/json" \
    -d '{"question": "test", "model": "gpt4"}')
run_test "T4" "Returns 400 for unknown model" "400" "$T4"
echo ""

# ── T5: Health check shows both models loaded ─────────────────────────────────
echo "T5 — Both models cached in memory"
T5=$(curl -s --max-time 10 "${BASE_URL}/health")
run_test "T5a" "Mistral is loaded" '"mistral"' "$T5"
run_test "T5b" "DeepSeek is loaded" '"deepseek"' "$T5"
echo "     Response: $T5"
echo ""

# ── Summary ───────────────────────────────────────────────────────────────────
echo "============================================"
echo " Results: ${PASS} passed, ${FAIL} failed"
if [ "$FAIL" -eq 0 ]; then
    echo " ALL TESTS PASSED — deployment is ready!"
    echo " Share this IP with the routing colleague: ${EC2_IP}"
else
    echo " Some tests failed — check server.log on EC2"
    echo " SSH in and run: tail -50 server.log"
fi
echo "============================================"
