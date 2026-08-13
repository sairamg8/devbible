#!/usr/bin/env bash
# Phase 13 page 04 — pg_dump / pg_restore, measured on a dedicated database so
# nothing here touches the shared devbible fixtures.
# Client and server are both PostgreSQL 18.4.
set -uo pipefail

export PGHOST=127.0.0.1 PGPORT=55432 PGUSER=devbible PGPASSWORD=devbible
SRC=p13_bk_src
DST=p13_bk_dst
OUT=$(mktemp -d)
line() { printf '\n=== %s ===\n' "$1"; }
sizes() { du -b "$@" 2>/dev/null | awk '{printf "  %-34s %10.1f KB\n", $2, $1/1024}'; }

line "0. versions"
pg_dump --version
psql -d postgres -tAc "select current_setting('server_version')" | sed 's/^/server_version /'

# ---------------------------------------------------------------- fixture
psql -d postgres -q -c "DROP DATABASE IF EXISTS $SRC" -c "DROP DATABASE IF EXISTS $DST"
psql -d postgres -q -c "CREATE DATABASE $SRC"
psql -d "$SRC" -q <<'SQL'
CREATE TABLE orders (
  id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer text NOT NULL,
  status   text NOT NULL,
  total    numeric(10,2) NOT NULL,
  placed_at timestamptz NOT NULL DEFAULT now());
INSERT INTO orders (customer, status, total)
SELECT 'cust-'||(g%5000), (ARRAY['open','shipped','cancelled'])[1+(g%3)], (g%900+10)::numeric
  FROM generate_series(1,2000000) g;
CREATE INDEX orders_customer_idx ON orders (customer);
CREATE TABLE audit_log (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, note text);
INSERT INTO audit_log (note) SELECT 'note-'||g FROM generate_series(1,50000) g;
CREATE VIEW open_orders AS SELECT * FROM orders WHERE status = 'open';
CREATE ROLE p13_reader NOLOGIN;
GRANT SELECT ON orders TO p13_reader;
SQL
psql -d "$SRC" -tAc "SELECT 'rows: orders='||(SELECT count(*) FROM orders)||' audit_log='||(SELECT count(*) FROM audit_log)"
psql -d "$SRC" -tAc "SELECT 'database size: '||pg_size_pretty(pg_database_size('$SRC'))"

line "1. the four formats — size and wall time"
for fmt in p c t; do
  t0=$(date +%s.%N)
  pg_dump -d "$SRC" -F$fmt -f "$OUT/dump.$fmt"
  t1=$(date +%s.%N)
  printf '  -F%s  %6.2f s\n' "$fmt" "$(echo "$t1-$t0" | bc)"
done
t0=$(date +%s.%N); pg_dump -d "$SRC" -Fd -f "$OUT/dump.d"; t1=$(date +%s.%N)
printf '  -Fd  %6.2f s\n' "$(echo "$t1-$t0" | bc)"
sizes "$OUT/dump.p" "$OUT/dump.c" "$OUT/dump.t" "$OUT/dump.d"
echo "  (plain = SQL text, custom = compressed+indexed, tar = uncompressed archive,"
echo "   directory = one compressed file per table)"
ls "$OUT/dump.d" | head -5 | sed 's/^/    dir entry: /'

line "2. plain text piped through gzip, vs -Fc"
pg_dump -d "$SRC" -Fp | gzip > "$OUT/dump.sql.gz"
sizes "$OUT/dump.sql.gz" "$OUT/dump.c"
echo "  ↑ same compression, but only -Fc can be restored selectively or in parallel"

line "3. parallel dump — only the directory format supports it"
t0=$(date +%s.%N); pg_dump -d "$SRC" -Fd -j 4 -f "$OUT/dump.d4"; t1=$(date +%s.%N)
printf '  -Fd -j 4  %6.2f s\n' "$(echo "$t1-$t0" | bc)"
pg_dump -d "$SRC" -Fc -j 4 -f "$OUT/nope.c" 2>&1 | head -2 | sed 's/^/  -Fc -j 4 → /'

line "4. what is inside a custom dump — the table of contents"
pg_restore -l "$OUT/dump.c" | grep -v '^;' | head -12 | sed 's/^/  /'
echo "  ↑ pg_restore -l is the manifest; -L with an edited copy restores a subset"

line "5. roles and grants: what a database dump does NOT contain"
grep -c 'CREATE ROLE' "$OUT/dump.p" | sed 's/^/  CREATE ROLE statements in the dump: /'
grep -c 'GRANT' "$OUT/dump.p" | sed 's/^/  GRANT statements in the dump:      /'
grep 'GRANT SELECT ON TABLE' "$OUT/dump.p" | head -2 | sed 's/^/    /'
echo "  ↑ the GRANT is dumped, the role it references is not — restore into a new"
echo "    cluster fails unless pg_dumpall --roles-only ran too"
pg_dumpall --roles-only -f "$OUT/roles.sql"
grep -c 'CREATE ROLE' "$OUT/roles.sql" | sed 's/^/  CREATE ROLE in pg_dumpall --roles-only: /'

line "6. restore into a fresh database"
psql -d postgres -q -c "CREATE DATABASE $DST"
t0=$(date +%s.%N)
pg_restore -d "$DST" "$OUT/dump.c" 2>&1 | head -3 | sed 's/^/  /'
t1=$(date +%s.%N)
printf '  restore -Fc          %6.2f s\n' "$(echo "$t1-$t0" | bc)"
psql -d "$DST" -tAc "SELECT 'restored rows: orders='||(SELECT count(*) FROM orders)||' audit_log='||(SELECT count(*) FROM audit_log)"

line "7. parallel restore"
psql -d postgres -q -c "DROP DATABASE $DST" -c "CREATE DATABASE $DST"
t0=$(date +%s.%N); pg_restore -d "$DST" -j 4 "$OUT/dump.c"; t1=$(date +%s.%N)
printf '  restore -Fc -j 4     %6.2f s\n' "$(echo "$t1-$t0" | bc)"

line "8. restoring over an existing database"
pg_restore -d "$DST" "$OUT/dump.c" 2>&1 | head -4 | sed 's/^/  /'
psql -d "$DST" -tAc "SELECT 'rows after a second restore: '||count(*) FROM orders"
echo "  ↑ errors are reported but the process continues; --exit-on-error changes that"
pg_restore -d "$DST" --clean --if-exists "$OUT/dump.c" 2>&1 | head -3 | sed 's/^/  --clean --if-exists → /'
psql -d "$DST" -tAc "SELECT 'rows after --clean restore: '||count(*) FROM orders"

line "9. selective restore of one table"
psql -d postgres -q -c "DROP DATABASE $DST" -c "CREATE DATABASE $DST"
pg_restore -d "$DST" -t audit_log "$OUT/dump.c"
psql -d "$DST" -tAc "SELECT 'tables present: '||string_agg(tablename,',') FROM pg_tables WHERE schemaname='public'"
echo "  ↑ -t restores the table's data but NOT its indexes/constraints by default"
psql -d "$DST" -tAc "SELECT 'indexes on audit_log: '||count(*) FROM pg_indexes WHERE tablename='audit_log'"

line "10. is a dump a consistent snapshot?"
psql -d postgres -q -c "DROP DATABASE IF EXISTS $DST" >/dev/null
( pg_dump -d "$SRC" -Fc -f "$OUT/snap.c" ) &
DUMPPID=$!
sleep 0.35
psql -d "$SRC" -q -c "INSERT INTO orders (customer,status,total) SELECT 'DURING-DUMP',    'open', 1 FROM generate_series(1,1000)"
wait $DUMPPID
psql -d "$SRC" -tAc "SELECT 'source now has: '||count(*)||' rows' FROM orders"
psql -d postgres -q -c "CREATE DATABASE $DST"
pg_restore -d "$DST" "$OUT/snap.c"
psql -d "$DST" -tAc "SELECT 'the dump captured: '||count(*)||' rows' FROM orders"
psql -d "$DST" -tAc "SELECT 'rows inserted during the dump that made it in: '||count(*) FROM orders WHERE customer='DURING-DUMP'"

line "11. what pg_dump locks, and what blocks it"
# baseline first: the same DDL with no dump running
t0=$(date +%s.%N)
psql -d "$SRC" -q -c "ALTER TABLE orders ADD COLUMN probe int"
t1=$(date +%s.%N)
printf '  ALTER TABLE, no dump running   %6.2f s  (baseline)\n' "$(echo "$t1-$t0" | bc)"
psql -d "$SRC" -q -c "ALTER TABLE orders DROP COLUMN probe"

( pg_dump -d "$SRC" -Fc -f "$OUT/lock.c" ) &
DUMPPID=$!
sleep 0.5
psql -d "$SRC" -tAc "SELECT '  the dump holds: '||mode||' on '||relname
                       FROM pg_locks l JOIN pg_class c ON c.oid=l.relation
                       JOIN pg_stat_activity a ON a.pid=l.pid
                      WHERE a.application_name='pg_dump' AND c.relname='orders' LIMIT 1"
t0=$(date +%s.%N)
timeout 120 psql -d "$SRC" -q -c "ALTER TABLE orders ADD COLUMN probe int"
t1=$(date +%s.%N)
ALTER_WAIT=$(echo "$t1-$t0" | bc)
wait $DUMPPID
t2=$(date +%s.%N)
printf '  ALTER TABLE during the dump    %6.2f s  ← waited for the dump to finish\n' "$ALTER_WAIT"
printf '  the dump itself took           %6.2f s\n' "$(echo "$t2-$t0+$ALTER_WAIT-$ALTER_WAIT" | bc)"
psql -d "$SRC" -q -c "ALTER TABLE orders DROP COLUMN IF EXISTS probe"
echo "  ↑ ACCESS SHARE does not block reads or writes, but it does block ACCESS"
echo "    EXCLUSIVE — so DDL queues behind a running dump, and every query needing"
echo "    that table then queues behind the DDL."

line "12. --no-owner and --no-acl, for restoring as a different role"
grep -m2 'OWNER TO' "$OUT/dump.p" | sed 's/^/  with owner:    /'
pg_dump -d "$SRC" -Fp --no-owner --no-acl -f "$OUT/dump-noowner.p"
grep -c 'OWNER TO' "$OUT/dump-noowner.p" | sed 's/^/  --no-owner --no-acl → OWNER TO lines: /'
grep -c 'GRANT'    "$OUT/dump-noowner.p" | sed 's/^/  --no-owner --no-acl → GRANT lines:    /'

line "13. cleanup"
psql -d postgres -q -c "DROP DATABASE IF EXISTS $SRC" -c "DROP DATABASE IF EXISTS $DST" -c "DROP ROLE IF EXISTS p13_reader"
rm -rf "$OUT"
echo "  done"
