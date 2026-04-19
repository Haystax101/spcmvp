#!/usr/bin/env bash
set -euo pipefail

DEFAULT_MODEL="${DEFAULT_AUDIT_MODEL:-gemma4:e2b-it-q4_K_M}"
CLASSIFIER_MODEL="${CLASSIFIER_MODEL:-qwen2.5:0.5b}"
ESCALATION_MODEL="${ESCALATION_MODEL:-gemma4:e2b-it-q4_K_M}"

if ! command -v ollama >/dev/null 2>&1; then
  echo "Error: ollama is not installed. Install from https://ollama.com/download" >&2
  exit 1
fi

echo "Pulling default model: ${DEFAULT_MODEL}"
ollama pull "${DEFAULT_MODEL}"

echo "Pulling classifier model: ${CLASSIFIER_MODEL}"
ollama pull "${CLASSIFIER_MODEL}"

echo "Pulling escalation model: ${ESCALATION_MODEL}"
ollama pull "${ESCALATION_MODEL}"

echo "Available models:"
ollama list

echo "Bootstrap complete."
