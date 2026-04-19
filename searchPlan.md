Local Pre-Release People Auditing Plan

This plan is for pre-release auditing only. It is not a runtime production dependency.

Goal
- Find reliable LinkedIn evidence for imported people.
- Keep and enrich findable people with strong summaries.
- Remove consistently non-findable people from people and join tables.

Architecture
1. Single workspace directory: /Users/gdwha/SPCMVP/verification-local
2. Local infra in Docker: SearXNG + Redis + Open WebUI
3. Local model runtime on macOS: Ollama (native)
4. Audit job: Node script using Appwrite TablesDB APIs

Feasibility of one directory
- Yes: all project assets/scripts/config can live inside verification-local.
- Exception: Docker Desktop memory/CPU caps are global host settings, not per-directory.

Directory layout
- verification-local/docker
- verification-local/ollama
- verification-local/audit
- verification-local/logs
- verification-local/state

Model profile for 16GB M1
- Primary: qwen3.5:4b-q4_K_M
- Escalation for uncertain rows: gemma4:e2b-it-q4_K_M
- Avoid 35B-class models as defaults on 16GB when Docker is active.

Memory policy
- Docker Desktop memory cap around 2GB.
- Keep Ollama native and run one active model at a time.
- Audit concurrency low (1-2 workers max).
- Disable thinking for extraction/summarization tasks.

Audit decision contract
Per person, the model returns:
- found_linkedin
- linkedin_url
- summary
- confidence
- signals
- decision (keep or delete_candidate)

Keep workflow
- Update people.linkedin_url
- Update people.description
- Set people.is_enriched = true
- Set people.last_enriched_at

Delete workflow
- Two-pass policy (no immediate delete on first failure)
- Pass 1: mark delete candidate in local state
- Pass 2: if still non-findable, delete in safe order:
  1) people_societies rows by person_id
  2) people_sports rows by person_id
  3) people row
- Write append-only JSON report to verification-local/logs

Execution flow
1. Copy .env.example to .env and fill Appwrite credentials.
2. Pull local models with ollama/bootstrap.sh.
3. Start stack and run dry-run sample:
   ./run_audit.sh --dry-run --limit 25
4. Run full audit:
   ./run_audit.sh
5. Stop stack when done:
   ./stop_stack.sh

Validation checklist
- Containers healthy (SearXNG/Open WebUI/Redis)
- Ollama responds and model is loaded
- Dry-run output quality looks correct
- Two-pass deletion behavior is respected
- No memory thrashing during full run
