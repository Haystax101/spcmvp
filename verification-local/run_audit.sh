#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
DOCKER_DIR="${ROOT_DIR}/docker"
AUDIT_DIR="${ROOT_DIR}/audit"
ENV_FILE="${ROOT_DIR}/.env"

if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  set -a && source "${ENV_FILE}" && set +a
else
  echo "Warning: ${ENV_FILE} not found. Copy .env.example to .env and set values." >&2
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker is not installed." >&2
  exit 1
fi

if ! command -v ollama >/dev/null 2>&1; then
  echo "Error: ollama is not installed." >&2
  exit 1
fi

echo "Starting local infra (SearXNG + Redis + Open WebUI)..."
(cd "${DOCKER_DIR}" && docker compose up -d)

echo "Checking Ollama..."
"${ROOT_DIR}/ollama/healthcheck.sh"

echo "Installing audit dependencies..."
(cd "${AUDIT_DIR}" && npm install)

echo "Running audit..."
(cd "${AUDIT_DIR}" && npm run audit -- "$@")
