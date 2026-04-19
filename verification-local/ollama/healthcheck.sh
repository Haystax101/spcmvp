#!/usr/bin/env bash
set -euo pipefail

OLLAMA_URL="${OLLAMA_URL:-http://localhost:11434}"
MODEL="${DEFAULT_AUDIT_MODEL:-qwen3.5:4b-q4_K_M}"

if ! command -v curl >/dev/null 2>&1; then
  echo "Error: curl is required" >&2
  exit 1
fi

curl -fsSL "${OLLAMA_URL}/api/tags" >/dev/null

payload=$(cat <<JSON
{
  "model": "${MODEL}",
  "messages": [
    {"role":"user","content":"Reply with the single word: ready"}
  ],
  "stream": false,
  "options": {"temperature": 0}
}
JSON
)

response=$(curl -fsSL "${OLLAMA_URL}/api/chat" -H "Content-Type: application/json" -d "${payload}")

echo "Ollama OK"
echo "${response}" | head -c 240
printf "\n"
