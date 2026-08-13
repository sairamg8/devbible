---
title: "pg_hba.conf — who may connect"
sidebar_label: "05 · pg_hba.conf"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`), on a dedicated
> container `devbible-pg-hba` at `127.0.0.1:55435` so the shared sandbox is
> untouched. Script: `sandbox/pg-api/ex53-hba-tls.sh`.

**`pg_hba.conf` runs before privileges exist.** It answers one question — may
this client, from this address, as this role, to this database, attempt to
authenticate, and how — and it answers with the **first matching rule only**.
Everything in [Roles, GRANT and REVOKE](roles-grant/) happens afterwards.

## The file, and the parsed view

```console
$ ./ex53-hba-tls.sh
=== 1. the default pg_hba.conf that ships with the image ===
local   all             all                                     trust
host    all             all             127.0.0.1/32            trust
host    all             all             ::1/128                 trust
local   replication     all                                     trust
host    replication     all             127.0.0.1/32            trust
host    replication     all             ::1/128                 trust
host all all all scram-sha-256
```

Five columns: **type, database, user, address, method**. `local` means the Unix
socket and takes no address; `host` means TCP.

The last line is appended by the `postgres` image's entrypoint when
`POSTGRES_HOST_AUTH_METHOD` is unset — which is why the official image is safe by
default from outside and `trust` from localhost. Setting that variable to `trust`
in a compose file, as many tutorials do, replaces it with a rule that lets
**anyone** in.

Rather than reading the file, read the parsed view — it resolves includes and
numbers the rules in evaluation order:

```console
=== 2. pg_hba_file_rules — the parsed view, with line numbers ===
1 | local all all - trust
2 | host all all 127.0.0.1 trust
3 | host all all ::1 trust
4 | local replication all - trust
5 | host replication all 127.0.0.1 trust
6 | host replication all ::1 trust
7 | host all all all scram-sha-256
```

```sql
SELECT rule_number, type, database, user_name, address, auth_method, error
  FROM pg_hba_file_rules ORDER BY rule_number;
```

## The first matching rule wins — and nothing else is consulted

This is the rule that surprises people, so it is worth seeing both ways round.
Same two rules, opposite order:

```console
=== 4. reject — and the fact that the FIRST matching rule wins ===
  reject first, scram second   FATAL: pg_hba.conf rejects connection for host "192.168.1.5", user "devbible", database "devbible", no encryption
  ↑ the scram rule below it is never reached
  scram first, reject second   1
  ↑ same two rules, opposite order, opposite outcome
```

Matching stops at the first rule whose type, database, user and address all
match. If that rule's method fails, **the connection fails** — PostgreSQL does
not fall through to a later rule that might have succeeded.

The practical consequence: a broad rule near the top makes every rule below it
dead. Order specific rules before general ones, and check with
`pg_hba_file_rules` rather than by reading the file top to bottom.

## The three failure messages mean different things

```console
=== 5. a rule that does not match at all ===
  FATAL: no pg_hba.conf entry for host "192.168.1.5", user "devbible", database "devbible", no encryption

=== 4 (above) ===
  FATAL: pg_hba.conf rejects connection for host "192.168.1.5", ...

=== 3. scram-sha-256: right password, wrong password, unknown role ===
  correct password            1
  wrong password              FATAL: password authentication failed for user "devbible"
  role that does not exist    FATAL: password authentication failed for user "ghost_role"
```

| Message | Meaning | Where to look |
|---|---|---|
| `no pg_hba.conf entry for host …` | **No rule matched.** The client's address, database or role is not covered. | The address column — usually a new network or a container IP |
| `pg_hba.conf rejects connection` | A rule matched and its method is `reject`. | Rule order; something above the rule you expected |
| `password authentication failed` | A rule matched, authentication ran, credentials were wrong | The password — or the role's `VALID UNTIL` |

Note the last line of the measurement: **a role that does not exist reports
exactly the same message as a wrong password.** That is deliberate — it prevents
using the login endpoint to enumerate role names — and it means "is the role
spelled right?" is a question the error will never answer for you.

## Per-role and per-database rules

```console
=== 6. per-database and per-role rules ===
  devbible (not named in the reject rule)        1
  reporter (rejected by role name)               FATAL: pg_hba.conf rejects connection for host "192.168.1.5", user "reporter", ...
```

```
host all reporter all reject
host all all      all scram-sha-256
```

The user and database columns take a name, a comma-separated list, a `+group`
(any member of that role), `all`, or `@file` to read a list from disk. This is
how you keep a reporting role off the primary, or confine an application role to
its own database — a control that is enforced before authentication and cannot be
undone by a `GRANT`.

## The methods worth knowing

```console
=== 7. trust — what it actually means ===
  trust: any password at all                     1

=== 8. md5 — still accepted, and what happens to a scram-stored password ===
  md5 rule, password stored as SCRAM             1
  scram-sha-256
```

**`trust` does not check the password.** The measurement connected with a
deliberately wrong password and got in. It is fine on a Unix socket for local
development, and on an exposed TCP port it is a full compromise requiring no
credential at all. The one-line audit: any `host … trust` rule whose address is
not loopback.

**`md5` still works, including against a SCRAM-stored password** — the server
negotiates SCRAM anyway when it can. The failure runs the other way: a `scram-sha-256`
rule cannot authenticate a password that was *stored* as md5, which is what
breaks logins after switching `password_encryption` without re-setting passwords.
Storage format and rule method are two independent settings.

The rest, briefly:

| Method | Use |
|---|---|
| `scram-sha-256` | The default and correct choice for password auth |
| `md5` | Legacy; still accepted, no reason to choose it |
| `trust` | No authentication. Local development only |
| `reject` | Deny explicitly, before a broader rule can match |
| `peer` | Unix socket only; OS username must equal the role name |
| `cert` | Client certificate, no password — see [TLS](06-tls.md) |
| `ldap` / `gss` / `pam` | Delegate to an external directory |

## Reload, not restart

```console
=== 9. reload vs restart ===
hba_file|postmaster
log_statement|superuser
port|postmaster
shared_buffers|postmaster
ssl|sighup
```

`pg_hba.conf` changes take effect on `SELECT pg_reload_conf()` (or `SIGHUP`, or
`pg_ctl reload`) — no restart, no dropped connections. Note that `hba_file`
itself has context `postmaster`: the *path* needs a restart, the *contents* do
not.

That `context` column is the general answer to "does this need a restart?":

- **`postmaster`** — restart required (`port`, `shared_buffers`, `max_connections`)
- **`sighup`** — reload is enough (`ssl`, `log_min_duration_statement`, autovacuum)
- **`superuser` / `user`** — settable per session with `SET`

One caution measured elsewhere in this script: `pg_reload_conf()` **returns
before the new rules are in force**. A test that reloads and immediately connects
can observe the old configuration — it made every result in an early version of
this script lag one step behind its own config.

## A syntax error does not take the server down

```console
=== 10. a syntax error in pg_hba.conf ===
1 rule(s) with an error
line 5: invalid authentication method "not-a-method"
  connections during a broken hba file           1
```

A bad rule was appended and the configuration reloaded. The server logged the
error, **kept the previous rules in force**, and connections carried on working.
`pg_hba_file_rules.error` names the offending line.

So the dangerous moment is not the reload — it is the **restart**, which is when
a broken file stops the server from starting at all. Validate before restarting:

```sql
SELECT rule_number, line_number, error FROM pg_hba_file_rules WHERE error IS NOT NULL;
```

Run that after every edit and before any restart. It is the whole safety check.

## Trade-off

`pg_hba.conf` is enforced before authentication and cannot be overridden by any
grant, which makes it the strongest control in this phase — and it is a file on
the server, so it lives outside your migrations, outside your dump, and outside
version control unless you deliberately put it there.

That is the cost: a control nobody can see from the application side, changed by
hand on a host, and silently absent from every backup you take with `pg_dump`. If
you rely on it, manage the file with the same configuration tooling as the rest
of the host, and keep a copy in the repo that a restore actually consults.

## Gotchas

**Symptom:** `no pg_hba.conf entry for host …`
**Cause:** No rule matched — the client's address is not covered. Common after a
network change, or from a container whose address differs from the host's.
**Fix:** Read the address in the message and add a rule for that network. Check
`pg_hba_file_rules` for the rules actually loaded.

**Symptom:** A rule you added has no effect
**Cause:** A broader rule above it matched first. Matching stops there, with no
fall-through. Measured: reversing two rules reversed the outcome entirely.
**Fix:** Order specific before general; verify with `pg_hba_file_rules`
`rule_number` order.

**Symptom:** `password authentication failed` for a role you are sure exists
**Cause:** The message is identical for a wrong password, a non-existent role,
and an expired `VALID UNTIL` — deliberately, to prevent role enumeration.
**Fix:** Check `pg_roles` for the name and `rolvaliduntil` before assuming the
password is wrong.

**Symptom:** Logins break after changing `password_encryption` to
`scram-sha-256`
**Cause:** Existing passwords are still stored as md5; a scram rule cannot use
them. (The reverse works — measured, an `md5` rule authenticated a SCRAM-stored
password.)
**Fix:** Re-set every password after the change, then switch the rules.

**Symptom:** The server will not start after a config edit
**Cause:** A syntax error in `pg_hba.conf`. A *reload* survives this — measured,
the old rules stayed in force — but a restart does not.
**Fix:** `SELECT … FROM pg_hba_file_rules WHERE error IS NOT NULL` before every
restart.

**Symptom:** A container database accepts any password
**Cause:** `POSTGRES_HOST_AUTH_METHOD=trust`, which replaces the entrypoint's
`scram-sha-256` line. Measured: `trust` authenticated a deliberately wrong
password.
**Fix:** Remove it and set `POSTGRES_PASSWORD`. Audit for any non-loopback
`trust` rule.

## Interview questions

**★ How does PostgreSQL decide which `pg_hba.conf` rule applies?**
First match on type, database, user and address — and only that one. If its
method fails, the connection fails; there is no fall-through. Measured: swapping
a `reject` and a `scram-sha-256` rule inverted the result.

**★ What is the difference between "no pg_hba.conf entry" and "pg_hba.conf
rejects connection"?**
The first means no rule matched at all — usually an address problem. The second
means a rule matched and its method is `reject`, which is a rule-order problem.
They point at completely different fixes.

**★ Does changing `pg_hba.conf` need a restart?**
No — a reload (`pg_reload_conf()`/SIGHUP). Only the `hba_file` *path* is a
`postmaster` setting. And a syntax error survives a reload with the old rules
still in force; it is a restart that turns it into an outage.

**★ Why is `trust` dangerous, given the role still needs privileges?**
Because it authenticates *anyone* as that role — measured, a wrong password
connected successfully. Privileges then apply to whoever walked in, which for a
superuser role is the whole cluster.

**Can `pg_hba.conf` restrict a role to one database?**
Yes — the database and user columns take names, lists or `+group`, and the check
happens before authentication, so no `GRANT` can undo it. Measured with a
role-specific `reject` rule that denied one role while another connected.

**Why does a non-existent role report "password authentication failed"?**
To prevent enumerating role names through connection attempts. It means the error
never tells you the role is misspelled — check `pg_roles` yourself.

---

← [pg_dump and pg_restore](pg-dump-restore/) · Next → [TLS to the database](06-tls.md)
