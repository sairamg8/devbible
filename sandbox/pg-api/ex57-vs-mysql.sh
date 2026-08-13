#!/usr/bin/env bash
# Phase 0 page 11 — PostgreSQL vs MySQL, measured side by side.
# Both engines get the same statement and both answers are printed, errors included.
#   PostgreSQL 18.4  devbible-pg     127.0.0.1:55432
#   MySQL 8.4.11     devbible-mysql  127.0.0.1:55440
# Start MySQL with:
#   podman run -d --name devbible-mysql -e MYSQL_ROOT_PASSWORD=devbible \
#     -e MYSQL_DATABASE=devbible -e MYSQL_USER=devbible -e MYSQL_PASSWORD=devbible \
#     -p 55440:3306 docker.io/library/mysql:8
set -uo pipefail
export PGPASSWORD=devbible
PG="psql -h 127.0.0.1 -p 55432 -U devbible -d devbible -qAt"
MY() { podman exec -i devbible-mysql mysql -udevbible -pdevbible devbible -N -B "$@" 2>&1 \
       | grep -v '^mysql: \[Warning\]'; }

hdr() { printf '\n=== %s ===\n' "$1"; }
pg()  { printf '  postgres   %s\n' "$($PG -c "$1" 2>&1 | tr '\n' ' ' | sed 's/  */ /g')"; }
my()  { printf '  mysql      %s\n' "$(MY -e "$1" | tr '\n' ' ' | sed 's/  */ /g')"; }

hdr "versions"
pg "select version()"
my "select version()"

hdr "1. can you roll back a CREATE TABLE?"
$PG -c "drop table if exists t_ddl" >/dev/null 2>&1
MY -e "drop table if exists t_ddl" >/dev/null 2>&1
pg "begin; create table t_ddl (id int); rollback; select to_regclass('t_ddl') is null as rolled_back"
my "start transaction; create table t_ddl (id int); rollback;
    select count(*) = 0 as rolled_back from information_schema.tables
     where table_schema='devbible' and table_name='t_ddl'"

hdr "2. does an out-of-range value raise or get silently changed?"
$PG -c "drop table if exists t_num; create table t_num (v smallint)" >/dev/null 2>&1
MY -e "drop table if exists t_num; create table t_num (v smallint)" >/dev/null 2>&1
pg "insert into t_num values (99999)"
my "insert into t_num values (99999)"

hdr "3. varchar(3) overflow"
$PG -c "drop table if exists t_len; create table t_len (c varchar(3))" >/dev/null 2>&1
MY -e "drop table if exists t_len; create table t_len (c varchar(3))" >/dev/null 2>&1
pg "insert into t_len values ('abcdefgh')"
my "insert into t_len values ('abcdefgh')"

hdr "4. default transaction isolation level"
pg "show transaction_isolation"
my "select @@transaction_isolation"

hdr "5. unquoted mixed-case column identifiers"
$PG -c "drop table if exists t_case; create table t_case (MixedCol int)" >/dev/null 2>&1
MY -e "drop table if exists t_case; create table t_case (MixedCol int)" >/dev/null 2>&1
pg "select column_name from information_schema.columns
     where table_name='t_case' and table_schema='public'"
my "select column_name from information_schema.columns
     where table_name='t_case' and table_schema='devbible'"

hdr "6. GROUP BY with a non-aggregated column"
$PG -c "drop table if exists t_g; create table t_g (k int, v int);
        insert into t_g values (1,10),(1,20),(2,30)" >/dev/null 2>&1
MY -e "drop table if exists t_g; create table t_g (k int, v int);
       insert into t_g values (1,10),(1,20),(2,30)" >/dev/null 2>&1
pg "select k, v from t_g group by k"
my "select k, v from t_g group by k"

hdr "7. UPDATE ... ORDER BY ... LIMIT"
pg "update t_g set v = v + 1 order by k limit 1"
my "update t_g set v = v + 1 order by k limit 1"

hdr "8. RETURNING on an INSERT"
pg "insert into t_g (k,v) values (9,99) returning k, v"
my "insert into t_g (k,v) values (9,99) returning k, v"

hdr "9. what is a BOOLEAN really?"
pg "select pg_typeof(true)::text"
$PG -c "drop table if exists t_b; create table t_b (flag boolean)" >/dev/null 2>&1
MY -e "drop table if exists t_b; create table t_b (flag boolean)" >/dev/null 2>&1
my "select column_type from information_schema.columns
     where table_name='t_b' and table_schema='devbible'"

hdr "10. CHECK constraint enforcement"
$PG -c "drop table if exists t_chk; create table t_chk (age int check (age >= 0))" >/dev/null 2>&1
MY -e "drop table if exists t_chk; create table t_chk (age int check (age >= 0))" >/dev/null 2>&1
pg "insert into t_chk values (-5)"
my "insert into t_chk values (-5)"

hdr "11. one sequence/AUTO_INCREMENT after a rolled-back insert"
# NOTE: several statements in ONE `psql -c` run inside a single implicit transaction,
# so an embedded ROLLBACK discards the earlier inserts too and the comparison is
# confounded. Each statement therefore gets its own -c invocation.
$PG -c "drop table if exists t_seq" >/dev/null 2>&1
$PG -c "create table t_seq (id serial primary key, v int)" >/dev/null 2>&1
MY -e "drop table if exists t_seq" >/dev/null 2>&1
MY -e "create table t_seq (id int auto_increment primary key, v int)" >/dev/null 2>&1
$PG -c "insert into t_seq (v) values (1)" >/dev/null 2>&1
$PG -c "begin; insert into t_seq (v) values (2); rollback;" >/dev/null 2>&1
$PG -c "insert into t_seq (v) values (3)" >/dev/null 2>&1
pg "select string_agg(id::text, ',' order by id) as ids_kept from t_seq"
MY -e "insert into t_seq (v) values (1)" >/dev/null 2>&1
MY -e "start transaction; insert into t_seq (v) values (2); rollback;" >/dev/null 2>&1
MY -e "insert into t_seq (v) values (3)" >/dev/null 2>&1
my "select group_concat(id order by id) as ids_kept from t_seq"

hdr "cleanup"
$PG -c "drop table if exists t_ddl, t_num, t_len, t_case, t_g, t_b, t_chk, t_seq" >/dev/null 2>&1
MY -e "drop table if exists t_ddl, t_num, t_len, t_case, t_g, t_b, t_chk, t_seq" >/dev/null 2>&1
echo "  done"
