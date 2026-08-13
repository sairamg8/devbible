#!/usr/bin/env bash
# Phase 1 pages 09-15 — \copy vs COPY, \timing and \watch, \i and \ir,
# \conninfo/\du/\dp, .psqlrc, \errverbose and SQLSTATE, piping psql.
export PGPASSWORD=devbible
H=127.0.0.1; P=55432; U=devbible; D=devbible
PSQL="psql -h $H -p $P -U $U -d $D"
line() { printf '\n=== %s ===\n' "$1"; }
WORK=/tmp/p1_work; rm -rf $WORK; mkdir -p $WORK/sub

$PSQL -q -v ON_ERROR_STOP=1 <<'SQL'
DROP TABLE IF EXISTS p1_import;
CREATE TABLE p1_import (id int PRIMARY KEY, name text, amount numeric);
SQL

# --- 09 \copy vs COPY ------------------------------------------------------
line "09a. COPY (server-side) tries to read a file on the SERVER"
$PSQL -c "COPY p1_import FROM '/tmp/does-not-exist-on-server.csv' WITH (FORMAT csv)" 2>&1 | head -3

line "09b. \\copy (client-side) reads the file where psql runs"
cat > $WORK/import.csv <<'CSV'
id,name,amount
1,Widget,10.50
2,Gadget,99.99
3,Doohickey,0.75
CSV
$PSQL -c "\\copy p1_import FROM '$WORK/import.csv' WITH (FORMAT csv, HEADER)"
$PSQL -c 'SELECT * FROM p1_import ORDER BY id;'

line "09c. exporting: \\copy TO, and the same thing as csv"
$PSQL -c "\\copy (SELECT * FROM p1_import WHERE amount > 1) TO '$WORK/export.csv' WITH (FORMAT csv, HEADER)"
cat $WORK/export.csv

line "09d. \\copy TO STDOUT streams to the terminal or a pipe"
$PSQL -c "\\copy p1_import TO STDOUT WITH (FORMAT csv)" | head -3

line "09e. a bad row aborts the whole \\copy — it is one transaction"
cat > $WORK/bad.csv <<'CSV'
id,name,amount
4,Fine,1.00
5,Broken,not-a-number
6,AlsoFine,2.00
CSV
$PSQL -c "\\copy p1_import FROM '$WORK/bad.csv' WITH (FORMAT csv, HEADER)" 2>&1 | head -3
$PSQL -tAc "SELECT count(*) FROM p1_import"

line "09f. COPY reports a row count; that is your receipt"
$PSQL -c "\\copy p1_import FROM '$WORK/import.csv' WITH (FORMAT csv, HEADER)" 2>&1 | head -2
$PSQL -c "TRUNCATE p1_import" -c "\\copy p1_import FROM '$WORK/import.csv' WITH (FORMAT csv, HEADER)"

# --- 10 \timing and \watch -------------------------------------------------
line "10a. \\timing measures the round trip, not server execution"
$PSQL <<'SQL'
\timing on
SELECT count(*) FROM generate_series(1, 2000000);
SELECT pg_sleep(0.25);
\timing off
SQL

line "10b. compare \\timing against the server's own view"
$PSQL <<'SQL'
\timing on
EXPLAIN (ANALYZE, TIMING OFF, SUMMARY ON) SELECT count(*) FROM generate_series(1,2000000);
\timing off
SQL

line "10c. \\watch re-runs the buffer on an interval"
timeout 4 $PSQL <<'SQL'
SELECT now()::time AS t, count(*) AS conns FROM pg_stat_activity WHERE datname = 'devbible'
\watch 1
SQL
echo "(stopped after ~4s; interactively you press Ctrl-C)"

line "10d. \\watch with a count limit (PostgreSQL 16+)"
$PSQL <<'SQL'
SELECT 'tick' AS beat, now()::time
\watch i=0.5 c=3
SQL

# --- 11 \i and \ir ---------------------------------------------------------
line "11. \\i uses a path relative to the CWD; \\ir relative to the script"
cat > $WORK/sub/inner.sql <<'SQL'
SELECT 'inner.sql ran' AS msg;
SQL
cat > $WORK/outer_i.sql <<'SQL'
\echo 'outer using \i:'
\i sub/inner.sql
SQL
cat > $WORK/outer_ir.sql <<'SQL'
\echo 'outer using \ir:'
\ir sub/inner.sql
SQL
echo "--- run from $WORK (both work) ---"
(cd $WORK && $PSQL -q -f outer_i.sql && $PSQL -q -f outer_ir.sql)
echo "--- run from / (only \\ir works) ---"
(cd / && $PSQL -q -f $WORK/outer_i.sql 2>&1 | head -2; $PSQL -q -f $WORK/outer_ir.sql)

# --- 12 who am I, what can I touch -----------------------------------------
line "12a. \\conninfo and the identity functions"
$PSQL -c '\conninfo'
$PSQL -c "SELECT current_user, session_user, current_database(), current_schema, inet_server_port();"

line "12b. \\du — roles and their attributes"
$PSQL -c '\du'

line "12c. make a limited role and see the difference"
$PSQL -q -c "DROP OWNED BY p1_reader" 2>/dev/null
$PSQL -q -c "DROP ROLE IF EXISTS p1_reader" 2>/dev/null
$PSQL -q -v ON_ERROR_STOP=1 <<'SQL'
CREATE ROLE p1_reader LOGIN PASSWORD 'readonly';
GRANT CONNECT ON DATABASE devbible TO p1_reader;
GRANT USAGE ON SCHEMA public TO p1_reader;
GRANT SELECT ON p1_import TO p1_reader;
SQL
$PSQL -c '\du p1_reader'

line "12d. \\dp / \\z — who has what on which table"
$PSQL -c '\dp p1_import'

line "12e. what the limited role can and cannot do"
PGPASSWORD=readonly psql -h $H -p $P -U p1_reader -d $D -tAc 'SELECT count(*) FROM p1_import' 2>&1 | head -2
PGPASSWORD=readonly psql -h $H -p $P -U p1_reader -d $D -c 'DELETE FROM p1_import' 2>&1 | head -2
PGPASSWORD=readonly psql -h $H -p $P -U p1_reader -d $D -c 'SELECT * FROM p1_orders' 2>&1 | head -2

# --- 13 .psqlrc ------------------------------------------------------------
line "13a. a .psqlrc, and proof that -X ignores it"
cat > $WORK/psqlrc <<'RC'
\set QUIET 1
\timing on
\pset null '(null)'
\set ON_ERROR_ROLLBACK interactive
\set COMP_KEYWORD_CASE upper
\set HISTSIZE 5000
\set PROMPT1 '%[%033[1;32m%]%n@%/%[%033[0m%]%R%# '
\set QUIET 0
\echo '.psqlrc loaded'
RC
echo "--- with PSQLRC pointing at it ---"
PSQLRC=$WORK/psqlrc $PSQL -c "SELECT NULL AS n;" 2>&1 | head -6
echo "--- same command with -X (no startup file) ---"
PSQLRC=$WORK/psqlrc $PSQL -X -c "SELECT NULL AS n;" 2>&1 | head -4

line "13b. handy \\set shortcuts to keep in .psqlrc"
$PSQL <<'SQL'
\set activity 'SELECT pid, state, left(query,30) AS q FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid();'
:activity
SQL

line "13c. where the history lives"
$PSQL <<'SQL'
\echo 'HISTFILE as a variable :' :HISTFILE
\echo '(unexpanded above means it is unset - psql then uses the default path)'
SQL
ls -l ~/.psql_history 2>/dev/null | sed 's/.* \//\//' || echo '~/.psql_history does not exist yet'
PSQLRC=$WORK/psqlrc $PSQL -X -c "\\echo HISTSIZE is :HISTSIZE" 

# --- 14 \errverbose and SQLSTATE -------------------------------------------
line "14a. the default error, then the same error verbosely"
$PSQL <<'SQL'
INSERT INTO p1_import (id, name, amount) VALUES (1,'dup',1), (1,'dup',1);
\errverbose
SQL

line "14b. VERBOSITY verbose shows SQLSTATE inline on every error"
$PSQL <<'SQL'
\set VERBOSITY verbose
INSERT INTO p1_import (id, name, amount) VALUES (999, 'x', 'not-a-number');
SQL

line "14c. every code below was produced by actually causing the error"
$PSQL -q -c "DROP TABLE IF EXISTS p1_err CASCADE" \
      -c "CREATE TABLE p1_err (id int PRIMARY KEY, n int NOT NULL CHECK (n > 0),
                               ref int REFERENCES p1_import(id))" \
      -c "INSERT INTO p1_err VALUES (1, 5, 1)"
run_err() {
  printf '%-56s -> ' "$1"
  $PSQL -v VERBOSITY=verbose -t -c "$2" 2>&1 \
    | grep -oE '^(ERROR|FATAL):  [0-9A-Z]{5}' | head -1 | sed 's/.*:  //'
}
run_err "INSERT a duplicate primary key"        "INSERT INTO p1_err VALUES (1,1,1)"
run_err "INSERT violating the CHECK"            "INSERT INTO p1_err VALUES (2,-1,1)"
run_err "INSERT a NULL into a NOT NULL column"  "INSERT INTO p1_err VALUES (3,NULL,1)"
run_err "INSERT referencing a missing parent"   "INSERT INTO p1_err VALUES (4,1,999)"
run_err "text where a number belongs"           "INSERT INTO p1_err VALUES (5,'abc',1)"
run_err "SELECT from a table that is not there" "SELECT * FROM no_such_table"
run_err "SELECT a column that is not there"     "SELECT no_such_col FROM p1_err"
run_err "divide by zero"                        "SELECT 1/0"
run_err "a statement psql cannot parse"         "SELCT 1" 

line "14d. the same violation as psql shows it vs as node/pg reports it"
$PSQL -c "INSERT INTO p1_import (id,name,amount) VALUES (1,'dup',1)" 2>&1 | head -3
node -e "
const pg=require('pg');
const c=new pg.Client('postgres://devbible:devbible@127.0.0.1:55432/devbible');
c.connect().then(()=>c.query(\"INSERT INTO p1_import (id,name,amount) VALUES (1,'dup',1)\"))
 .catch(e=>console.log(JSON.stringify({code:e.code,constraint:e.constraint,detail:e.detail,table:e.table})))
 .finally(()=>c.end());
"

# --- 15 piping -------------------------------------------------------------
line "15a. -At is the pipe-friendly mode: no headers, no padding"
$PSQL -Atc "SELECT id || ':' || name FROM p1_import ORDER BY id" | head -3

line "15b. feeding a shell loop"
$PSQL -Atc "SELECT name FROM p1_import ORDER BY id" | while read -r n; do echo "processing $n"; done

line "15c. csv straight to a file, and counting it"
$PSQL --csv -c "SELECT * FROM p1_import ORDER BY id" > $WORK/report.csv
wc -l < $WORK/report.csv; head -2 $WORK/report.csv

line "15d. exit codes survive the pipe only if you ask"
$PSQL -Atc "SELECT * FROM no_such_table" 2>/dev/null | cat; echo "naive exit=$?"
set -o pipefail
$PSQL -Atc "SELECT * FROM no_such_table" 2>/dev/null | cat; echo "with pipefail exit=$?"
set +o pipefail

line "15e. generating SQL and executing it with \\gexec"
$PSQL <<'SQL'
SELECT format('COMMENT ON TABLE %I IS %L', tablename, 'auto-commented')
FROM pg_tables WHERE tablename LIKE 'p1_%'
\gexec
SQL
$PSQL -c "\\dt+ p1_import" | head -5

line "15f. one-liner health check suitable for cron"
$PSQL -Atc "SELECT count(*) FROM pg_stat_activity WHERE state = 'active'" \
  && echo "healthcheck exit=0"

# --- cleanup ---------------------------------------------------------------
$PSQL -q -c "DROP OWNED BY p1_reader" -c "DROP ROLE IF EXISTS p1_reader" 2>/dev/null
echo
echo "=== done ==="
