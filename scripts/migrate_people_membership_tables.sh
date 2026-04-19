#!/usr/bin/env bash
set -euo pipefail

DB_ID="${APPWRITE_DB_ID:-supercharged}"
ASSUME_YES="${1:-}"

require_cli() {
  if ! command -v appwrite >/dev/null 2>&1; then
    echo "Error: appwrite CLI is not installed or not in PATH." >&2
    exit 1
  fi
}

table_exists() {
  local table_id="$1"
  appwrite tables-db get-table --database-id "$DB_ID" --table-id "$table_id" >/dev/null 2>&1
}

index_exists() {
  local table_id="$1"
  local index_key="$2"
  appwrite tables-db get-index --database-id "$DB_ID" --table-id "$table_id" --key "$index_key" >/dev/null 2>&1
}

delete_table_if_exists() {
  local table_id="$1"
  if table_exists "$table_id"; then
    echo "Deleting table: $table_id"
    appwrite tables-db delete-table --database-id "$DB_ID" --table-id "$table_id"
  else
    echo "Skipping delete (not found): $table_id"
  fi
}

create_table_if_missing() {
  local table_id="$1"
  local table_name="$2"

  if table_exists "$table_id"; then
    echo "Table already exists, skipping create: $table_id"
    return 1
  fi

  echo "Creating table: $table_id"
  appwrite tables-db create-table \
    --database-id "$DB_ID" \
    --table-id "$table_id" \
    --name "$table_name" \
    --row-security false \
    --enabled true >/dev/null

  return 0
}

create_index_if_missing() {
  local table_id="$1"
  local index_key="$2"
  local index_type="$3"
  shift 3

  if index_exists "$table_id" "$index_key"; then
    echo "Index already exists, skipping: $table_id.$index_key"
    return
  fi

  echo "Creating index: $table_id.$index_key"
  appwrite tables-db create-index \
    --database-id "$DB_ID" \
    --table-id "$table_id" \
    --key "$index_key" \
    --type "$index_type" \
    "$@" >/dev/null
}

create_people_table() {
  if ! create_table_if_missing "people" "People"; then
    return
  fi

  appwrite tables-db create-varchar-column --database-id "$DB_ID" --table-id "people" --key "full_name" --size 200 --required true >/dev/null
  appwrite tables-db create-varchar-column --database-id "$DB_ID" --table-id "people" --key "normalized_name" --size 200 --required true >/dev/null
  appwrite tables-db create-varchar-column --database-id "$DB_ID" --table-id "people" --key "username" --size 128 --required false >/dev/null
  appwrite tables-db create-varchar-column --database-id "$DB_ID" --table-id "people" --key "normalized_username" --size 128 --required false >/dev/null
  appwrite tables-db create-varchar-column --database-id "$DB_ID" --table-id "people" --key "profile_url" --size 1024 --required false >/dev/null
  appwrite tables-db create-varchar-column --database-id "$DB_ID" --table-id "people" --key "linkedin_url" --size 1024 --required false >/dev/null
  appwrite tables-db create-text-column --database-id "$DB_ID" --table-id "people" --key "description" --required false >/dev/null
  appwrite tables-db create-varchar-column --database-id "$DB_ID" --table-id "people" --key "source" --size 64 --required false >/dev/null
  appwrite tables-db create-boolean-column --database-id "$DB_ID" --table-id "people" --key "is_enriched" --required false --xdefault false >/dev/null
  appwrite tables-db create-datetime-column --database-id "$DB_ID" --table-id "people" --key "last_enriched_at" --required false >/dev/null

  create_index_if_missing "people" "idx_people_name" "key" --columns normalized_name
  create_index_if_missing "people" "idx_people_username" "key" --columns normalized_username
  create_index_if_missing "people" "idx_people_enrich_queue" "key" --columns is_enriched last_enriched_at
  create_index_if_missing "people" "idx_people_description" "fulltext" --columns description
}

create_people_societies_table() {
  if ! create_table_if_missing "people_societies" "People Societies"; then
    return
  fi

  appwrite tables-db create-varchar-column --database-id "$DB_ID" --table-id "people_societies" --key "person_id" --size 36 --required true >/dev/null
  appwrite tables-db create-varchar-column --database-id "$DB_ID" --table-id "people_societies" --key "society_id" --size 36 --required true >/dev/null
  appwrite tables-db create-varchar-column --database-id "$DB_ID" --table-id "people_societies" --key "source_csv" --size 255 --required false >/dev/null
  appwrite tables-db create-varchar-column --database-id "$DB_ID" --table-id "people_societies" --key "role" --size 128 --required false >/dev/null
  appwrite tables-db create-datetime-column --database-id "$DB_ID" --table-id "people_societies" --key "first_seen_at" --required false >/dev/null
  appwrite tables-db create-datetime-column --database-id "$DB_ID" --table-id "people_societies" --key "last_seen_at" --required false >/dev/null

  create_index_if_missing "people_societies" "idx_people_societies_pair" "unique" --columns person_id society_id
  create_index_if_missing "people_societies" "idx_people_societies_society" "key" --columns society_id person_id
  create_index_if_missing "people_societies" "idx_people_societies_person" "key" --columns person_id
}

create_people_sports_table() {
  if ! create_table_if_missing "people_sports" "People Sports"; then
    return
  fi

  appwrite tables-db create-varchar-column --database-id "$DB_ID" --table-id "people_sports" --key "person_id" --size 36 --required true >/dev/null
  appwrite tables-db create-varchar-column --database-id "$DB_ID" --table-id "people_sports" --key "sport_id" --size 36 --required true >/dev/null
  appwrite tables-db create-varchar-column --database-id "$DB_ID" --table-id "people_sports" --key "source_csv" --size 255 --required false >/dev/null
  appwrite tables-db create-varchar-column --database-id "$DB_ID" --table-id "people_sports" --key "role" --size 128 --required false >/dev/null
  appwrite tables-db create-datetime-column --database-id "$DB_ID" --table-id "people_sports" --key "first_seen_at" --required false >/dev/null
  appwrite tables-db create-datetime-column --database-id "$DB_ID" --table-id "people_sports" --key "last_seen_at" --required false >/dev/null

  create_index_if_missing "people_sports" "idx_people_sports_pair" "unique" --columns person_id sport_id
  create_index_if_missing "people_sports" "idx_people_sports_sport" "key" --columns sport_id person_id
  create_index_if_missing "people_sports" "idx_people_sports_person" "key" --columns person_id
}

main() {
  require_cli

  echo "Database: $DB_ID"
  echo "This migration will delete old tables if they exist: society_members, sports_members"
  echo "Then it will create: people, people_societies, people_sports"

  if [[ "$ASSUME_YES" != "--yes" ]]; then
    read -r -p "Continue? Type 'yes' to proceed: " confirm
    if [[ "$confirm" != "yes" ]]; then
      echo "Aborted."
      exit 1
    fi
  fi

  delete_table_if_exists "society_members"
  delete_table_if_exists "sports_members"

  create_people_table
  create_people_societies_table
  create_people_sports_table

  echo "Migration complete."
  echo "Next: ingest your CSVs into people + join tables, then deploy code changes."
}

main
