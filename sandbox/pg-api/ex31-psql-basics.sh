#!/usr/bin/env bash
# Phase 1 pages 01-08 — connecting, meta-commands, \d, output control, help,
# scripting, the query buffer, and psql variables.
# Run from sandbox/pg-api. Everything here executes against the sandbox container.
export PGPASSWORD=devbible
H=127.0.0.1; P=55432; U=devbible; D=devbible
PSQL="psql -h $H -p $P -U $U -d $D"
# scratch stays INSIDE the project, never the host /tmp
SCRATCH="$(cd "$(dirname "$0")" && pwd)/tmp"; mkdir -p "$SCRATCH"
line() { printf '\n=== %s ===\n' "$1"; }

# --- fixture ---------------------------------------------------------------
$PSQL -q -v ON_ERROR_STOP=1 <<'SQL'
DROP TABLE IF EXISTS p1_orders, p1_customers CASCADE;
DROP VIEW IF EXISTS p1_open_orders;
CREATE TABLE p1_customers (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email      text NOT NULL UNIQUE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE p1_orders (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id bigint NOT NULL REFERENCES p1_customers(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open','paid','shipped')),
  total_cents integer NOT NULL CHECK (total_cents >= 0),
  note        text
);
CREATE INDEX p1_orders_customer_idx ON p1_orders (customer_id);
CREATE INDEX p1_orders_open_idx ON p1_orders (customer_id) WHERE status = 'open';
COMMENT ON TABLE p1_orders IS 'One row per customer order';
CREATE VIEW p1_open_orders AS SELECT * FROM p1_orders WHERE status = 'open';
INSERT INTO p1_customers (email, name)
  SELECT 'user'||g||'@example.com', 'User '||g FROM generate_series(1,5) g;
INSERT INTO p1_orders (customer_id, status, total_cents, note)
  SELECT 1 + (g % 5), (ARRAY['open','paid','shipped'])[1 + (g % 3)], g * 100,
         CASE WHEN g % 4 = 0 THEN NULL ELSE 'note '||g END
  FROM generate_series(1,12) g;
SQL

# --- 01 connecting ---------------------------------------------------------
line "01a. version and who am I"
$PSQL -c 'SELECT version();' -c '\conninfo'

line "01b. the three ways to say the same connection"
psql "postgresql://$U:$PGPASSWORD@$H:$P/$D" -tAc "select 'URI form: ' || current_database()"
psql -h $H -p $P -U $U -d $D -tAc "select 'flag form: ' || current_database()"
PGHOST=$H PGPORT=$P PGUSER=$U PGDATABASE=$D psql -tAc "select 'env form: ' || current_database()"

line "01c. what each connection failure looks like"
psql -h $H -p 55499 -U $U -d $D -c 'select 1' 2>&1 | head -3
psql -h $H -p $P -U $U -d nosuchdb -c 'select 1' 2>&1 | head -2
psql -h $H -p $P -U nosuchuser -d $D -c 'select 1' 2>&1 | head -2
PGPASSWORD=wrong psql -h $H -p $P -U $U -d $D -c 'select 1' 2>&1 | head -2

line "01d. straight into the container, no host client needed"
podman exec -e PGPASSWORD=$PGPASSWORD devbible-pg psql -U $U -d $D \
  -tAc "select 'inside the container as ' || current_user || ', over ' ||
        coalesce(host(inet_server_addr()), 'the unix socket')"

# --- 02 daily meta-commands ------------------------------------------------
line "02a. \\dt — tables in the current schema"
$PSQL -c '\dt p1_*'

line "02b. \\dt+ adds size and description"
$PSQL -c '\dt+ p1_orders'

line "02c. \\l databases, \\dn schemas"
$PSQL -c '\l' | head -8
$PSQL -c '\dn'

line "02d. the rest of the d-family"
$PSQL -c '\di p1_*'
$PSQL -c '\dv p1_*'
$PSQL -c '\ds'
$PSQL -c '\df pg_size_pretty'

line "02e. patterns: schema-qualified, wildcards, and S for system objects"
$PSQL -c '\dt public.p1_c*'
$PSQL -c '\dtS pg_catalog.pg_am'

# --- 03 \d in full ---------------------------------------------------------
line "03a. \\d — the everyday view"
$PSQL -c '\d p1_orders'

line "03b. \\d+ — adds storage, description, and the index definitions"
$PSQL -c '\d+ p1_orders'

line "03c. \\d on an index, a view and a sequence"
$PSQL -c '\d p1_orders_open_idx'
$PSQL -c '\d p1_open_orders'
$PSQL -c '\d p1_customers_id_seq'

line "03d. \\d with no argument lists everything visible"
$PSQL -c '\d' | head -12

# --- 04 output control -----------------------------------------------------
line "04a. default aligned output"
$PSQL -c 'SELECT id, status, total_cents, note FROM p1_orders ORDER BY id LIMIT 3;'

line "04b. \\x expanded — one column per line"
$PSQL -c '\x' -c 'SELECT * FROM p1_orders ORDER BY id LIMIT 2;'

line "04c. \\x auto — expanded only when the row is too wide"
$PSQL -c '\x auto' -c 'SELECT id, status FROM p1_orders LIMIT 2;'

line "04d. -A unaligned, -t tuples-only, -F field separator"
$PSQL -A -t -F ',' -c 'SELECT id, status, total_cents FROM p1_orders ORDER BY id LIMIT 3;'

line "04e. --csv is the one to pipe into other tools"
$PSQL --csv -c 'SELECT id, status, note FROM p1_orders ORDER BY id LIMIT 3;'

line "04f. NULL is invisible by default — make it visible"
$PSQL -c 'SELECT id, note FROM p1_orders WHERE note IS NULL LIMIT 2;'
$PSQL -c "\\pset null '(null)'" -c 'SELECT id, note FROM p1_orders WHERE note IS NULL LIMIT 2;'

line "04g. other \\pset knobs worth knowing"
$PSQL -c '\pset border 2' -c 'SELECT id, status FROM p1_orders LIMIT 2;'
$PSQL -c '\pset format wrapped' -c '\pset columns 40' -c 'SELECT id, note FROM p1_orders LIMIT 2;'

# --- 05 help ---------------------------------------------------------------
line "05a. \\? lists every meta-command (first lines)"
$PSQL -c '\?' 2>&1 | head -12

line "05b. \\h SQL-COMMAND gives the grammar"
$PSQL -c '\h CREATE INDEX' 2>&1 | head -14

line "05c. \\h with no argument lists what it knows"
$PSQL -c '\h' 2>&1 | head -6

line "05d. \\? variables — the built-in psql variables"
$PSQL -c '\? variables' 2>&1 | head -10

# --- 06 scripting ----------------------------------------------------------
line "06a. -c runs one command and exits; exit code says what happened"
$PSQL -c 'SELECT 1 AS ok;' ; echo "exit=$?"
$PSQL -c 'SELECT * FROM no_such_table;' 2>&1 | head -2 ; echo "exit=${PIPESTATUS[0]}"

line "06b. WITHOUT ON_ERROR_STOP a script keeps going after an error"
cat > $SCRATCH/p1_script.sql <<'SQL'
CREATE TEMP TABLE s1 (id int);
INSERT INTO s1 VALUES (1);
SELECT * FROM no_such_table;
INSERT INTO s1 VALUES (2);
SELECT count(*) AS rows_inserted FROM s1;
SQL
$PSQL -f $SCRATCH/p1_script.sql 2>&1 ; echo "exit=${PIPESTATUS[0]}"

line "06c. WITH ON_ERROR_STOP=1 it stops at the first error"
$PSQL -v ON_ERROR_STOP=1 -f $SCRATCH/p1_script.sql 2>&1 | tail -4 ; echo "exit=${PIPESTATUS[0]}"

line "06d. --single-transaction makes the whole file atomic"
cat > $SCRATCH/p1_atomic.sql <<'SQL'
INSERT INTO p1_customers (email, name) VALUES ('atomic@example.com','Atomic');
SELECT * FROM no_such_table;
SQL
$PSQL -v ON_ERROR_STOP=1 --single-transaction -f $SCRATCH/p1_atomic.sql 2>&1 | tail -3
$PSQL -tAc "SELECT count(*) AS atomic_rows_left FROM p1_customers WHERE email='atomic@example.com'"

line "06e. -e echoes the SQL, -a echoes everything (for logs)"
$PSQL -e -c 'SELECT 42 AS answer;' 2>&1 | head -4

line "06f. several -c flags run as separate statements"
$PSQL -c 'SELECT 1 AS first;' -c 'SELECT 2 AS second;'

# --- 07 query buffer -------------------------------------------------------
line "07a. \\g re-runs the buffer; \\gx runs it expanded"
$PSQL <<'SQL'
SELECT id, status FROM p1_orders ORDER BY id LIMIT 2
\g
\gx
SQL

line "07b. \\gset captures a single row into variables"
$PSQL <<'SQL'
SELECT count(*) AS n_orders, max(total_cents) AS biggest FROM p1_orders
\gset
\echo 'orders =' :n_orders 'biggest =' :biggest
SQL

line "07c. \\p prints the buffer, \\r resets it"
$PSQL <<'SQL'
SELECT 1,
       2
\p
\r
\p
SQL

line "07d. a missing semicolon is why 'nothing happened'"
$PSQL <<'SQL'
SELECT 'no semicolon so this just sits in the buffer' AS msg
\echo 'nothing ran - psql is still collecting input'
\p
SQL

# --- 08 variables ----------------------------------------------------------
line "08a. \\set and the three interpolation forms"
$PSQL <<'SQL'
\set tbl p1_orders
\set wanted 'paid'
\set num 300
SELECT count(*) AS paid_over FROM :tbl WHERE status = :'wanted' AND total_cents > :num;
SQL

line "08b. :'x' quotes as a literal, :\"x\" quotes as an identifier, :x is raw text"
$PSQL <<'SQL'
\set col status
SELECT :'col' AS as_literal, :"col" AS as_identifier FROM p1_orders LIMIT 1;
SQL

line "08c. the trap — a bare :var is textual substitution, not a parameter"
$PSQL <<'SQL'
\set danger '1; DROP TABLE p1_orders_would_be_gone; --'
\echo 'the value is:' :danger
SELECT 'a bare :danger would be pasted straight into the SQL text' AS warning;
SQL

line "08d. -v sets variables from the shell — but -c does NOT interpolate them"
echo '--- with -c (fails) ---'
$PSQL -v status=shipped -tAc "SELECT count(*) FROM p1_orders WHERE status = :'status'" 2>&1 | head -3
echo '--- same variable, same query, fed on stdin (works) ---'
$PSQL -v status=shipped -tA <<'SQL'
SELECT count(*) FROM p1_orders WHERE status = :'status';
SQL
echo '--- and via -f (works) ---'
echo "SELECT count(*) FROM p1_orders WHERE status = :'status';" > $SCRATCH/p1_var.sql
$PSQL -v status=shipped -tA -f $SCRATCH/p1_var.sql

line "08e. built-in variables and \\unset"
$PSQL <<'SQL'
\echo 'server' :SERVER_VERSION_NAME 'db' :DBNAME 'user' :USER 'port' :PORT
\set myvar hello
\echo :myvar
\unset myvar
\echo :myvar
SQL

line "08f. what an UNSET variable does (on stdin, where interpolation is live)"
$PSQL 2>&1 <<'SQL' | head -6
\echo 'bare   :' :nosuchvar
SELECT 'quoted: ' || :'nosuchvar' AS quoted_form;
SQL

echo
echo "=== done ==="
