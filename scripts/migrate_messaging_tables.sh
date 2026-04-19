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

column_exists() {
  local table_id="$1"
  local key="$2"
  appwrite tables-db get-column --database-id "$DB_ID" --table-id "$table_id" --key "$key" >/dev/null 2>&1
}

index_exists() {
  local table_id="$1"
  local index_key="$2"
  appwrite tables-db get-index --database-id "$DB_ID" --table-id "$table_id" --key "$index_key" >/dev/null 2>&1
}

create_table_if_missing() {
  local table_id="$1"
  local table_name="$2"

  if table_exists "$table_id"; then
    echo "Table already exists, skipping create: $table_id"
    return
  fi

  echo "Creating table: $table_id"
  appwrite tables-db create-table \
    --database-id "$DB_ID" \
    --table-id "$table_id" \
    --name "$table_name" \
    --row-security false \
    --enabled true >/dev/null
}

create_varchar_column_if_missing() {
  local table_id="$1"
  local key="$2"
  local size="$3"
  local required="$4"

  if column_exists "$table_id" "$key"; then
    echo "Column already exists, skipping: $table_id.$key"
    return
  fi

  echo "Creating varchar column: $table_id.$key"
  appwrite tables-db create-varchar-column \
    --database-id "$DB_ID" \
    --table-id "$table_id" \
    --key "$key" \
    --size "$size" \
    --required "$required" >/dev/null
}

create_text_column_if_missing() {
  local table_id="$1"
  local key="$2"
  local required="$3"

  if column_exists "$table_id" "$key"; then
    echo "Column already exists, skipping: $table_id.$key"
    return
  fi

  echo "Creating text column: $table_id.$key"
  appwrite tables-db create-text-column \
    --database-id "$DB_ID" \
    --table-id "$table_id" \
    --key "$key" \
    --required "$required" >/dev/null
}

create_boolean_column_if_missing() {
  local table_id="$1"
  local key="$2"
  local required="$3"
  local default_value="$4"

  if column_exists "$table_id" "$key"; then
    echo "Column already exists, skipping: $table_id.$key"
    return
  fi

  echo "Creating boolean column: $table_id.$key"
  appwrite tables-db create-boolean-column \
    --database-id "$DB_ID" \
    --table-id "$table_id" \
    --key "$key" \
    --required "$required" \
    --xdefault "$default_value" >/dev/null
}

create_datetime_column_if_missing() {
  local table_id="$1"
  local key="$2"
  local required="$3"

  if column_exists "$table_id" "$key"; then
    echo "Column already exists, skipping: $table_id.$key"
    return
  fi

  echo "Creating datetime column: $table_id.$key"
  appwrite tables-db create-datetime-column \
    --database-id "$DB_ID" \
    --table-id "$table_id" \
    --key "$key" \
    --required "$required" >/dev/null
}

create_enum_column_if_missing() {
  local table_id="$1"
  local key="$2"
  local required="$3"
  local default_value="$4"
  shift 4
  local elements=("$@")

  if column_exists "$table_id" "$key"; then
    echo "Column already exists, skipping: $table_id.$key"
    return
  fi

  echo "Creating enum column: $table_id.$key"
  appwrite tables-db create-enum-column \
    --database-id "$DB_ID" \
    --table-id "$table_id" \
    --key "$key" \
    --elements "${elements[@]}" \
    --required "$required" \
    --xdefault "$default_value" >/dev/null
}

create_relationship_column_if_missing() {
  local table_id="$1"
  local key="$2"
  local related_table_id="$3"
  local relation_type="$4"
  local on_delete="$5"

  if column_exists "$table_id" "$key"; then
    echo "Relationship already exists, skipping: $table_id.$key"
    return
  fi

  echo "Creating relationship column: $table_id.$key -> $related_table_id ($relation_type)"
  appwrite tables-db create-relationship-column \
    --database-id "$DB_ID" \
    --table-id "$table_id" \
    --related-table-id "$related_table_id" \
    --type "$relation_type" \
    --two-way false \
    --key "$key" \
    --on-delete "$on_delete" >/dev/null
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

ensure_tables() {
  create_table_if_missing "conversations" "Conversations"
  create_table_if_missing "conversation_members" "Conversation Members"
  create_table_if_missing "messages" "Messages"
}

ensure_conversations_schema() {
  create_enum_column_if_missing "conversations" "conversation_type" false "direct" "direct" "group"
  create_varchar_column_if_missing "conversations" "title" 200 false
  create_boolean_column_if_missing "conversations" "is_archived" false false
  create_datetime_column_if_missing "conversations" "last_message_at" false
  create_relationship_column_if_missing "conversations" "creator" "profiles" "manyToOne" "setNull"

  create_index_if_missing "conversations" "idx_conv_type" "key" --columns conversation_type
  create_index_if_missing "conversations" "idx_conv_last_msg" "key" --columns last_message_at
}

ensure_conversation_members_schema() {
  create_relationship_column_if_missing "conversation_members" "conversation" "conversations" "manyToOne" "cascade"
  create_relationship_column_if_missing "conversation_members" "profile" "profiles" "manyToOne" "cascade"
  create_enum_column_if_missing "conversation_members" "role" false "member" "member" "admin"
  create_boolean_column_if_missing "conversation_members" "muted" false false
  create_datetime_column_if_missing "conversation_members" "last_read_at" false

  create_index_if_missing "conversation_members" "idx_cm_role" "key" --columns role
  create_index_if_missing "conversation_members" "idx_cm_last_read" "key" --columns last_read_at
}

ensure_messages_schema() {
  create_relationship_column_if_missing "messages" "conversation" "conversations" "manyToOne" "cascade"
  create_relationship_column_if_missing "messages" "sender" "profiles" "manyToOne" "setNull"

  create_varchar_column_if_missing "messages" "reply_to_message_id" 36 false
  create_text_column_if_missing "messages" "body" true
  create_enum_column_if_missing "messages" "message_type" false "text" "text" "system"
  create_enum_column_if_missing "messages" "delivery_status" false "sent" "sent" "delivered" "read"
  create_boolean_column_if_missing "messages" "is_edited" false false
  create_boolean_column_if_missing "messages" "is_deleted" false false
  create_datetime_column_if_missing "messages" "sent_at" false

  create_index_if_missing "messages" "idx_msg_sent_at" "key" --columns sent_at
  create_index_if_missing "messages" "idx_msg_reply_to" "key" --columns reply_to_message_id
  create_index_if_missing "messages" "idx_msg_type" "key" --columns message_type
  create_index_if_missing "messages" "idx_msg_status" "key" --columns delivery_status
  create_index_if_missing "messages" "idx_msg_body_ft" "fulltext" --columns body
}

main() {
  require_cli

  echo "Database: $DB_ID"
  echo "This migration is non-destructive."
  echo "It will create missing messaging tables, columns, relationships, and indexes."

  if [[ "$ASSUME_YES" != "--yes" ]]; then
    read -r -p "Continue? Type 'yes' to proceed: " confirm
    if [[ "$confirm" != "yes" ]]; then
      echo "Aborted."
      exit 1
    fi
  fi

  ensure_tables
  ensure_conversations_schema
  ensure_conversation_members_schema
  ensure_messages_schema

  echo "Messaging migration complete."
  echo "Next: run 'appwrite pull tables' to sync local appwrite.json."
}

main
