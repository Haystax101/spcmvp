#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
DOCKER_DIR="${ROOT_DIR}/docker"

echo "Stopping local verification stack..."
(cd "${DOCKER_DIR}" && docker compose down)

echo "Stopped."
