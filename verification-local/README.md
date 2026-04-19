# Local Pre-Release People Audit Stack

This directory contains a fully local stack for pre-release people auditing.

## Purpose

Use local web search + local model inference to audit imported `people` rows:
- Keep people that are findable with reliable LinkedIn evidence and write strong summaries.
- Remove people that repeatedly fail findability checks.

This is **not** production runtime infrastructure.

## One-directory feasibility

Yes, the project assets can live in one directory (`verification-local`).

The only external requirement is Docker Desktop resource limits, which are global host settings. Set Docker memory to about 2GB before running this stack on a 16GB Mac.

## Directory layout

- `docker/` Docker compose and SearXNG config
- `ollama/` local model bootstrap and health scripts
- `audit/` Node audit job (Appwrite read/write)
- `logs/` audit reports
- `state/` non-findable retry state

## Prerequisites

1. Docker Desktop installed and running
2. Ollama installed and running (`ollama serve`)
3. Appwrite API key with read/write access to `supercharged` tables
4. Node 20+ and npm

## Setup

1. Copy env file:

```bash
cd /Users/gdwha/SPCMVP/verification-local
cp .env.example .env
```

2. Fill `.env` values, especially:
- `APPWRITE_API_KEY`
- `APPWRITE_ENDPOINT`
- `APPWRITE_PROJECT_ID`

3. Pull local models:

```bash
./ollama/bootstrap.sh
```

4. Make scripts executable once:

```bash
chmod +x run_audit.sh stop_stack.sh ollama/bootstrap.sh ollama/healthcheck.sh
```

## Run modes

Dry run sample (no DB writes/deletes):

```bash
./run_audit.sh --dry-run --limit 25
```

Full run:

```bash
./run_audit.sh
```

Single person test:

```bash
./run_audit.sh --person-id <person_row_id>
```

Stop local stack:

```bash
./stop_stack.sh
```

## Deletion safety policy

The audit uses two-pass deletion confirmation:
1. first non-findable pass marks candidate in state
2. second failed pass deletes in safe order:
   - `people_societies` rows by `person_id`
   - `people_sports` rows by `person_id`
   - `people` row

All runs write an append-only JSON report in `logs/`.

## Recommended model defaults for 16GB M1

- Primary: `qwen3.5:4b-q4_K_M`
- Escalation (manual/second pass if needed): `gemma4:e2b-it-q4_K_M`

Avoid 35B-class defaults on 16GB when Docker services are running.
