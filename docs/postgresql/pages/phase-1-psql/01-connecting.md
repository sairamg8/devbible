---
title: "Connecting with psql"
sidebar_label: "01 · Connecting"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **psql 18.4** on the host, **Node 24.19.0**. Script:
> `sandbox/pg-api/ex31-psql-basics.sh`.

**Three ways to describe the same connection — flags, a URI, or environment variables —
and four distinct failures that look similar until you read them. Getting this reflexive
is what makes `psql` a debugging tool rather than an obstacle.**

## The three forms

```console
$ ./ex31-psql-basics.sh
=== 01b. the three ways to say the same connection ===
URI form: devbible
flag form: devbible
env form: devbible
```

```bash
# flags — clearest when typing by hand
psql -h 127.0.0.1 -p 55432 -U devbible -d devbible

# URI — one string, the same one your app config already holds
psql "postgresql://devbible:devbible@127.0.0.1:55432/devbible"

# environment — nothing to type at all
PGHOST=127.0.0.1 PGPORT=55432 PGUSER=devbible PGDATABASE=devbible psql
```

The URI form is the one worth defaulting to: it is exactly the `DATABASE_URL` your Node
application uses, so connecting with it proves the string itself is right — a
distinction that matters when the app cannot connect and you are trying to work out
whether the problem is the string or the code.

The flags map to environment variables one-for-one: `-h`/`PGHOST`, `-p`/`PGPORT`,
`-U`/`PGUSER`, `-d`/`PGDATABASE`, plus `PGPASSWORD`. Anything omitted falls back to the
environment, then to defaults — the current OS username for the user and database, which
is why a bare `psql` so often reports a database you have never heard of.

## Passwords

```bash
export PGPASSWORD=devbible          # convenient, but visible in the environment
psql -h 127.0.0.1 -p 55432 -U devbible -d devbible
```

`PGPASSWORD` is fine in a sandbox and wrong on a shared machine — it leaks into the
process environment and shell history. The durable answer is `~/.pgpass`:

```bash
# ~/.pgpass — hostname:port:database:username:password
127.0.0.1:55432:devbible:devbible:devbible
```

```bash
chmod 0600 ~/.pgpass     # psql silently ignores the file if it is more permissive
```

That silent ignore is worth remembering: wrong permissions produce a password prompt with
no explanation. `-w` refuses to prompt at all (right for scripts, which should fail
rather than hang), and `-W` forces a prompt.

## Reading the four failures

```console
=== 01c. what each connection failure looks like ===
psql: error: connection to server at "127.0.0.1", port 55499 failed: Connection refused
	Is the server running on that host and accepting TCP/IP connections?
psql: error: connection to server at "127.0.0.1", port 55432 failed: FATAL:  database "nosuchdb" does not exist
psql: error: connection to server at "127.0.0.1", port 55432 failed: FATAL:  password authentication failed for user "nosuchuser"
psql: error: connection to server at "127.0.0.1", port 55432 failed: FATAL:  password authentication failed for user "devbible"
```

| Message | What it actually means |
|---|---|
| `Connection refused` | Nothing is listening there. Wrong port, container stopped, or not published |
| `FATAL: database "x" does not exist` | **The network and password were fine.** You reached the server |
| `password authentication failed for user "nosuchuser"` | Could be a wrong user *or* a wrong password |
| `password authentication failed for user "devbible"` | Same message, real user, wrong password |

The important pair is the last two: **a nonexistent user and a wrong password produce the
identical message.** That is deliberate — telling an attacker which usernames exist would
be a gift — but it means "authentication failed" never distinguishes the two, and you
should check the username exists (`\du`) before assuming the password is wrong.

The second is the most useful one to recognise: reaching `database does not exist` proves
host, port, user and password are all correct, so the remaining problem is small.

## Into a container

```console
=== 01d. straight into the container, no host client needed ===
inside the container as devbible, over the unix socket
```

```bash
# no host psql required — use the one inside the image
podman exec -it devbible-pg psql -U devbible -d devbible
```

Inside the container there is no host, no port and no password to get wrong: it connects
over the unix socket as the local user. That makes it the fastest way to answer "is the
server itself healthy?" when the host client is failing — if this works and the host
client does not, the problem is the published port or the network, not PostgreSQL.

Both `podman` and `docker` take the same form; the sandbox for this bible uses
`podman start devbible-pg`.

## Confirming what you connected to

```console
=== 01a. version and who am I ===
                                         version
-----------------------------------------------------------------------------------------
 PostgreSQL 18.4 on x86_64-pc-linux-musl, compiled by gcc (Alpine 15.2.0) 15.2.0, 64-bit

      Connection Information
      Parameter       |   Value
----------------------+-----------
 Database             | devbible
 Client User          | devbible
 Host                 | 127.0.0.1
 Server Port          | 55432
 Protocol Version     | 3.0
 Password Used        | true
 Backend PID          | 1356
 SSL Connection       | false
 Superuser            | on
```

`\conninfo` is the first thing to run when something is confusing. Two fields earn their
place: **`Backend PID`**, which is what you match against `pg_stat_activity` when hunting
a blocking query, and **`Superuser`**, because a permission that "works in psql but not in
the app" is almost always you being superuser here and not there.

`version()` also tells you the platform — `x86_64-pc-linux-musl` above, an Alpine image.
That matters more than it looks: musl and glibc sort text differently, so a query that
orders differently in production than locally can come down to this line.

## Trade-off

**A connection string in your shell history is a credential in your shell history.**
`PGPASSWORD` and URIs with embedded passwords are the fastest way to work and the easiest
way to leak; `~/.pgpass` with `0600` costs one setup step and keeps secrets out of history
and process lists. On a personal sandbox the convenience wins. On anything shared or
production-adjacent it does not — and `-w` should be set in scripts so a missing
credential fails immediately instead of hanging on a prompt.

## Gotchas

**Symptom:** `psql: error: connection to server ... Connection refused`
**Cause:** Nothing listening on that host/port — container stopped, or the port is not published
**Fix:** Check the container is running and the port mapping; `podman ps` shows both

**Symptom:** `database "yourname" does not exist` from a bare `psql`
**Cause:** With no `-d`, psql defaults to your OS username
**Fix:** Pass `-d`, or set `PGDATABASE`

**Symptom:** psql keeps prompting for a password despite `~/.pgpass`
**Cause:** The file is more permissive than `0600`, so it is silently ignored
**Fix:** `chmod 0600 ~/.pgpass`

**Symptom:** `password authentication failed` and the password is definitely right
**Cause:** The *username* may not exist — the message is identical for both cases
**Fix:** Confirm the role exists with `\du` from a working connection

**Symptom:** Works in psql, fails from Node with the same credentials
**Cause:** Different host resolution, or the app is not superuser while your psql session is
**Fix:** Compare `\conninfo` with the app's connection config; check `Superuser`

**Symptom:** A script hangs in CI with no output
**Cause:** psql is waiting on an interactive password prompt
**Fix:** `-w` to never prompt, and supply credentials via `~/.pgpass` or the environment

## Interview questions

**★ What are the ways to specify a connection to psql?**
Flags (`-h -p -U -d`), a `postgresql://` URI, or `PG*` environment variables. They can be
mixed; anything unspecified falls back to the environment and then to defaults derived
from the OS username.

**★ Which connection error tells you the most?**
`FATAL: database "x" does not exist` — it proves host, port, user and password all
worked. `Connection refused` means you never reached a server at all.

**★ Why do a wrong username and a wrong password give the same error?**
Deliberately, so the server does not reveal which usernames exist. Measured: both
produced `password authentication failed for user "…"`.

**★ How do you avoid putting passwords in shell history?**
`~/.pgpass` with `0600` permissions. psql silently ignores the file if the permissions
are looser, which presents as an unexplained password prompt.

**★ How do you connect when the host has no psql installed?**
Use the one inside the container: `podman exec -it devbible-pg psql -U devbible -d
devbible`. It connects over the unix socket, bypassing host, port and password entirely.

**What does `\conninfo` tell you that a connection string does not?**
The backend PID (for matching against `pg_stat_activity`) and whether you are connected
as a superuser — the usual explanation for "it works in psql but not in the app".

**Why does `version()` matter for debugging?**
It names the platform. A musl build sorts text differently from glibc, which explains
ordering differences between a local container and production.

---

← [Phase index](README.md) · Next → [Daily meta-commands](02-daily-meta-commands.md)
