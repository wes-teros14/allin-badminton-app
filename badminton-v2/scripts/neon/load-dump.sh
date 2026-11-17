#!/usr/bin/env bash
# Load a prod pg_dump (custom format, --schema=public --no-owner --no-acl) into an EMPTY Neon branch whose
# Data API already exists (it creates the anonymous/authenticated roles). Same steps as the 2026-11-16 rehearsal:
#
#   apply.mjs pre → pg_restore pre-data → data → fill shim auth.users from profiles → post-data
#   → apply.mjs transform grants verify
#
# Triggers are post-data, so the data load fires none. Every pg_restore runs in one transaction and stops on
# the first error.
#
# Usage:  scripts/neon/load-dump.sh <dump file> <file holding the branch's direct connection string> <pg bin dir> <dir with node_modules/pg>
# The connection string is read from the file and never printed.
set -euo pipefail

DUMP="$1"; CS_FILE="$2"; PGBIN="$3"; PG_NODE_MODULES="$4"
HERE="$(cd "$(dirname "$0")" && pwd)"
CS="$(tr -d '\r\n' < "$CS_FILE")"
case "$CS" in *supabase.co*) echo "refusing: the target is Supabase" >&2; exit 2;; esac
mask() { sed -E 's#postgres(ql)?://[^ ]+#<conn>#g'; }

existing=$("$PGBIN/psql" -d "$CS" -qAt -c "select count(*) from pg_tables where schemaname='public'" 2>/dev/null | tr -d '\r')
if [ "$existing" != "0" ]; then echo "refusing: target already has $existing public tables (load into an empty branch)" >&2; exit 2; fi

LIST="$(mktemp)"
"$PGBIN/pg_restore" --list "$DUMP" | grep -v -E " SCHEMA - public | COMMENT - SCHEMA public " > "$LIST"

echo "== pre";       NEON_DATABASE_URL="$CS" NODE_PATH="$PG_NODE_MODULES" node "$HERE/apply.mjs" pre 2>&1 | mask
for sec in pre-data data; do
  echo "== $sec"
  "$PGBIN/pg_restore" --section=$sec --no-owner --no-acl --single-transaction --exit-on-error -L "$LIST" -d "$CS" "$DUMP" 2>&1 | mask
done
echo "== shim auth.users"
"$PGBIN/psql" -d "$CS" -v ON_ERROR_STOP=1 -qAt -c "insert into auth.users (id, email) select id, email from public.profiles on conflict (id) do nothing; select 'shim users: ' || count(*) from auth.users;" 2>&1 | mask
echo "== post-data"
"$PGBIN/pg_restore" --section=post-data --no-owner --no-acl --single-transaction --exit-on-error -L "$LIST" -d "$CS" "$DUMP" 2>&1 | mask
echo "== transform grants verify"
NEON_DATABASE_URL="$CS" NODE_PATH="$PG_NODE_MODULES" node "$HERE/apply.mjs" transform grants verify 2>&1 | mask
rm -f "$LIST"
echo "== loaded"
