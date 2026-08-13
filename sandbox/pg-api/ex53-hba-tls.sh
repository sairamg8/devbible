#!/usr/bin/env bash
# Phase 13 pages 05, 06 — pg_hba.conf rules and TLS, measured on a DEDICATED
# container (devbible-pg-hba on :55435) so the shared devbible-pg is untouched.
#
#   podman run -d --name devbible-pg-hba -e POSTGRES_PASSWORD=devbible \
#     -e POSTGRES_USER=devbible -e POSTGRES_DB=devbible -p 55435:5432 postgres:18-alpine
set -uo pipefail

C=devbible-pg-hba
PORT=55435
HBA=/var/lib/postgresql/18/docker/pg_hba.conf
DATA=/var/lib/postgresql/18/docker
export PGPASSWORD=devbible
# scratch stays INSIDE the project, never the host /tmp
SCRATCH="$(cd "$(dirname "$0")" && pwd)/tmp"; mkdir -p "$SCRATCH"
line() { printf '\n=== %s ===\n' "$1"; }
psqlc() { psql -h 127.0.0.1 -p $PORT -U "${2:-devbible}" -d devbible -tAc "$1" 2>&1 | head -20; }
# pg_reload_conf() returns before the postmaster has re-read the file; a short
# sleep here made every result lag one step behind its own config. 1.5 s is
# what reproduced consistently across runs.
reload() { podman exec $C psql -U devbible -d devbible -tAc "SELECT pg_reload_conf()" >/dev/null; sleep 1.5; }
# replace the host rules (keep local ones) with a single supplied rule set
# printf '%s' writes a literal \n; '%b' is what expands it. Getting this wrong
# put every multi-rule config on one malformed line and silently broke sections 4-6.
sethba() { podman exec $C sh -c "grep -E '^local|^# TYPE' $HBA > /tmp/h && printf '%b\n' \"$1\" >> /tmp/h && cp /tmp/h $HBA"; reload; }
attempt() { printf '  %-46s %s\n' "$1" "$(psqlc 'SELECT 1' "${2:-devbible}" | head -1)"; }

line "0. the container, and how the client appears to the server"
podman exec $C psql -U devbible -d devbible -tAc "SELECT version()" | cut -c1-60
psqlc "SELECT 'client_addr as the server sees it: '||inet_client_addr()"

# Reset to a pristine state so every section reproduces on a re-run: the image's
# own pg_hba.conf (the last line is appended by the postgres entrypoint when
# POSTGRES_HOST_AUTH_METHOD is unset) and ssl off.
podman exec --user root $C sh -c "cat > $HBA <<'PRISTINE'
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             all                                     trust
host    all             all             127.0.0.1/32            trust
host    all             all             ::1/128                 trust
local   replication     all                                     trust
host    replication     all             127.0.0.1/32            trust
host    replication     all             ::1/128                 trust
host all all all scram-sha-256
PRISTINE
chown postgres:postgres $HBA; chmod 600 $HBA
sed -i '/^ssl = on/d' $DATA/postgresql.conf; rm -f $DATA/server.crt $DATA/server.key" 2>/dev/null
podman restart $C >/dev/null; sleep 6

line "1. the default pg_hba.conf that ships with the image"
podman exec $C grep -vE '^\s*#|^\s*$' $HBA

line "2. pg_hba_file_rules — the parsed view, with line numbers"
psqlc "SELECT rule_number||' | '||type||' '||array_to_string(database,',')||' '||array_to_string(user_name,',')||' '||coalesce(address,'-')||' '||auth_method FROM pg_hba_file_rules ORDER BY rule_number" | head -8

line "3. scram-sha-256: right password, wrong password, unknown role"
sethba 'host all all all scram-sha-256'
attempt 'correct password'
PGPASSWORD=wrong attempt 'wrong password'
PGPASSWORD=devbible attempt 'role that does not exist' 'ghost_role'

line "4. reject — and the fact that the FIRST matching rule wins"
sethba 'host all all all reject\nhost all all all scram-sha-256'
attempt 'reject first, scram second'
echo "  ↑ the scram rule below it is never reached"
sethba 'host all all all scram-sha-256\nhost all all all reject'
attempt 'scram first, reject second'
echo "  ↑ same two rules, opposite order, opposite outcome"

line "5. a rule that does not match at all"
sethba 'host all all 10.99.99.0/24 scram-sha-256'
attempt 'no rule matches this client address'
echo "  ↑ 'no pg_hba.conf entry' is a DIFFERENT error from a rejected one:"
echo "    it means no rule matched, not that a rule said no"

line "6. per-database and per-role rules"
podman exec $C psql -U devbible -d devbible -q -c "CREATE ROLE reporter LOGIN PASSWORD 'devbible'" 2>/dev/null
sethba 'host all reporter all reject\nhost all all all scram-sha-256'
attempt 'devbible (not named in the reject rule)'
attempt 'reporter (rejected by role name)' 'reporter'

line "7. trust — what it actually means"
sethba 'host all all all trust'
PGPASSWORD=completely-wrong attempt 'trust: any password at all'
PGPASSWORD=devbible
echo "  ↑ trust does not check the password. It is why an exposed port with a"
echo "    trust rule is a full compromise, with no credential needed."

line "8. md5 — still accepted, and what happens to a scram-stored password"
sethba 'host all all all md5'
attempt 'md5 rule, password stored as SCRAM'
podman exec $C psql -U devbible -d devbible -tAc "SHOW password_encryption"
echo "  ↑ an md5 RULE works against a SCRAM-stored password (the server negotiates"
echo "    SCRAM anyway); the reverse — a scram rule against an md5-stored password —"
echo "    is what fails. Storage format and rule method are two different settings."

line "9. reload vs restart"
sethba 'host all all all scram-sha-256'
podman exec $C psql -U devbible -d devbible -tAc "SELECT name, context FROM pg_settings WHERE name IN ('hba_file','ssl','port','shared_buffers','log_statement')"
echo "  ↑ context tells you what a change needs: 'postmaster' = restart,"
echo "    'sighup' = reload, 'user'/'superuser' = SET in a session"

line "10. a syntax error in pg_hba.conf"
podman exec $C sh -c "cp $HBA /tmp/hba.bak && echo 'host all all all not-a-method' >> $HBA"
reload
psqlc "SELECT count(*)||' rule(s) with an error' FROM pg_hba_file_rules WHERE error IS NOT NULL"
psqlc "SELECT 'line '||line_number||': '||error FROM pg_hba_file_rules WHERE error IS NOT NULL"
attempt 'connections during a broken hba file'
echo "  ↑ a bad rule does NOT take the server down: the reload is refused, the old"
echo "    rules stay in force, and pg_hba_file_rules.error names the line."
podman exec $C sh -c "cp /tmp/hba.bak $HBA"; reload

line "11. TLS — off by default in this image"
psqlc "SHOW ssl"
psqlc "SELECT 'ssl in use on this connection: '||coalesce(ssl::text,'?') FROM pg_stat_ssl WHERE pid = pg_backend_pid()"

line "12. generate a self-signed certificate and turn ssl on"
# NOTE: postgres:18-alpine has no openssl binary, so the certificate is generated
# on the host and copied in. CN is deliberately NOT 127.0.0.1 — section 15 needs
# a hostname mismatch to show what verify-full checks that verify-ca does not.
openssl req -new -x509 -days 365 -nodes -text -out "$SCRATCH/p13-server.crt" \
  -keyout "$SCRATCH/p13-server.key" -subj '/CN=devbible-pg-hba' 2>/dev/null
podman cp "$SCRATCH/p13-server.crt" $C:$DATA/server.crt
podman cp "$SCRATCH/p13-server.key" $C:$DATA/server.key
podman exec --user root $C sh -c "chown postgres:postgres $DATA/server.key $DATA/server.crt && \
  chmod 600 $DATA/server.key && grep -q '^ssl = on' $DATA/postgresql.conf || echo 'ssl = on' >> $DATA/postgresql.conf"
podman restart $C >/dev/null; sleep 6
psqlc "SHOW ssl"
psqlc "SELECT 'this connection: ssl='||ssl||' version='||coalesce(version,'-')||' cipher='||coalesce(cipher,'-') FROM pg_stat_ssl WHERE pid = pg_backend_pid()"
echo "  ↑ libpq defaults to sslmode=prefer, so the connection went TLS with no"
echo "    client change at all once the server had a certificate"

line "13. hostssl / hostnossl"
sethba 'hostnossl all all all reject\nhostssl all all all scram-sha-256'
PGSSLMODE=disable attempt 'sslmode=disable against a hostnossl reject'
PGSSLMODE=require attempt 'sslmode=require'
unset PGSSLMODE
echo "  ↑ this is how you make TLS mandatory: reject the plaintext path in pg_hba,"
echo "    rather than trusting every client to ask for it"

line "14. what each sslmode actually verifies"
sethba 'host all all all scram-sha-256'
for m in disable allow prefer require verify-ca verify-full; do
  out=$(PGSSLMODE=$m psql -h 127.0.0.1 -p $PORT -U devbible -d devbible -tAc \
        "SELECT 'ssl='||ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()" 2>&1 | head -1)
  printf '  sslmode=%-12s %s\n' "$m" "$out"
done
echo "  ↑ require encrypts but authenticates nothing; verify-ca and verify-full"
echo "    need a root certificate the client trusts"

line "15. verify-ca vs verify-full — the hostname check"
for m in verify-ca verify-full; do
  out=$(PGSSLMODE=$m PGSSLROOTCERT="$SCRATCH/p13-server.crt" psql -h 127.0.0.1 -p $PORT -U devbible \
        -d devbible -tAc "SELECT 'ssl='||ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()" 2>&1 | head -2 | tr '\n' ' ')
  printf '  sslmode=%-12s + root cert   %s\n' "$m" "$out"
done
out=$(PGSSLMODE=verify-ca psql -h 127.0.0.1 -p $PORT -U devbible -d devbible -tAc "SELECT 1" 2>&1 | head -1)
printf '  sslmode=verify-ca, NO root cert   %s\n' "$out"
echo "  ↑ the certificate says CN=devbible-pg-hba and we connected to 127.0.0.1:"
echo "    verify-ca accepts it (chain only), verify-full rejects it (hostname too)."

line "16. cleanup note"
echo "  the container is left running for re-runs: podman rm -f $C to remove it"
