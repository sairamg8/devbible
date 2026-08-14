---
title: "Connecting"
sidebar_label: "01 · Connecting"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-15 against the **MongoDB Manual** —
> [Connection Strings](https://www.mongodb.com/docs/manual/reference/connection-string/): the
> standard `mongodb://` form *"requires you to include all cluster members"* while the
> `mongodb+srv://` form *"automatically include[s] all seed list hosts, which supports server
> rotation without client reconfiguration"*, and *"when possible, use SRV connection strings
> over standard connection strings"* — and
> [Connection String Options](https://www.mongodb.com/docs/manual/reference/connection-string-options/):
> **`tls`/`ssl` default to true for the SRV connection format**; `retryWrites` — *"official
> MongoDB drivers default to `true`"*; `authSource` *"defaults to `defaultauthdb` if
> specified, otherwise defaults to `admin`"*; `directConnection` defaults to `false`, where
> *"the client attempts to discover all servers in the replica set"*; `readPreference`
> defaults to `primary`.
> **Documentation-validated; no console blocks.**

Everything about a MongoDB connection lives in one string, and the string is the same for
`mongosh`, for the Node driver and for Compass. Learning to read it is a transferable skill —
most "it works locally and not in staging" reports are a difference of one option.

## The two forms

```
mongodb://user:pass@host1:27017,host2:27017,host3:27017/mydb?replicaSet=rs0&authSource=admin
mongodb+srv://user:pass@cluster0.abcd.mongodb.net/mydb?retryWrites=true&w=majority
```

**Standard (`mongodb://`)** — you list every member yourself. Add or replace a node and every
client's configuration must change.

**SRV (`mongodb+srv://`)** — one hostname, and the client asks DNS for the seed list. The
Manual recommends it: it *"automatically include[s] all seed list hosts, which supports server
rotation without client reconfiguration"*, so the cluster can change shape without touching
clients. It is what Atlas hands you.

🔴 **The SRV form turns TLS on by default.** `tls` (and its old alias `ssl`) default to true
for the SRV connection format. That single difference explains a class of confusion: the same
credentials that work against Atlas over `+srv` fail against a local `mongodb://` server that
has no TLS, and vice versa — a local connection string with `+srv` demands TLS a plain
`mongod` is not serving.

## The anatomy

```
mongodb+srv://  user:pass  @  cluster0.abcd.mongodb.net  /  mydb  ?  opt=val&opt=val
   scheme        credentials        host(s)               defaultauthdb    options
```

⚠️ **The path segment is the *default auth database*, not just "the database you land in".**
It is what `authSource` falls back to. Put a database name there and your credentials are
looked up in that database — which is why an app whose users live in `admin` but whose data
lives in `shop` needs `authSource=admin` explicitly.

⚠️ **A password with `@`, `/`, `:` or `?` must be percent-encoded.** An unencoded `@` splits
the string in the wrong place, and the error you get names the host, not the password —
one of the more time-wasting authentication failures.

## The options worth knowing

| Option | Default | Why you would touch it |
|---|---|---|
| `authSource` | the path database if given, otherwise `admin` | credentials live in a different database from the data |
| `replicaSet` | — | required with the standard form to get replica-set behaviour rather than a single-server connection |
| `retryWrites` | **`true`** in official drivers | leave it on; it retries a write once after a transient network or failover error |
| `w` | — | `w=majority` for durability guarantees on important writes |
| `readPreference` | **`primary`** | `secondaryPreferred` for reporting; be aware you are choosing possibly-stale reads |
| `directConnection` | **`false`** | `true` to talk to one specific node without topology discovery — for diagnosing a single member |
| `tls` | **`true` for `+srv`** | explicitly on or off when the scheme's default is not what the server is doing |
| `appName` | — | 🔴 set it — it labels your connection in server logs and `currentOp`, which is how you find out whose query is the slow one |

**`appName` is the cheapest operational win here.** A production incident where the logs say
"some query from some client" versus "`checkout-api` ran this" is minutes versus an hour.

## Connecting with `mongosh`

```bash
mongosh "mongodb+srv://cluster0.abcd.mongodb.net/shop" --username appuser
mongosh --host localhost --port 27017
mongosh "mongodb://localhost:27017/shop?directConnection=true"
```

**Quote the connection string** in a shell — `?` and `&` are shell metacharacters, and an
unquoted string is silently truncated at the `?`, so you connect with none of your options and
wonder why the replica set is not found.

**Prefer `--username` without a password on the command line** and let `mongosh` prompt.
A password in an argument is visible in the process list and lands in shell history.

Once connected, `mongosh` is a JavaScript REPL with the driver in scope — `db`, `show dbs`,
and any JavaScript you like ([topic 02](./02-navigating.md)).

## Local development: run a replica set

A standalone `mongod` cannot start a transaction — transactions require a replica set. **Run a
single-node replica set locally**, so development matches production and transaction code can
be tested at all. This is also why the Atlas free tier is a replica set rather than a single
server.

## Gotchas

**Symptom:** authentication fails with correct credentials.
**Cause:** the user is defined in a different database from the one in the path, and
`authSource` was not set.
**Fix:** `authSource=admin` (or wherever the user lives). The default is the path database, or
`admin` if the path is empty.

**Symptom:** the same string works in Compass and fails from a shell.
**Cause:** the shell ate everything after the unquoted `?`.
**Fix:** quote the whole connection string.

**Symptom:** a local `+srv` string fails with a TLS error.
**Cause:** the SRV format defaults `tls` to true, and the local server is not serving TLS.
**Fix:** use the standard `mongodb://` form locally, or set `tls=false` deliberately.

**Symptom:** a password containing `@` produces a host-not-found error.
**Cause:** the unencoded `@` splits the string in the wrong place.
**Fix:** percent-encode the password. The error message points at the wrong thing, so check
this early.

**Symptom:** writes fail during a failover instead of retrying.
**Cause:** `retryWrites=false` somewhere in the string.
**Fix:** remove it — the drivers default to true, and the retry covers exactly this.

**Symptom:** reads return stale data.
**Cause:** a `readPreference` of `secondary` or `secondaryPreferred`.
**Fix:** decide deliberately. Secondary reads are a real tool for reporting and a real hazard
for read-after-write.

## Interview questions

**★ What is the difference between `mongodb://` and `mongodb+srv://`?**
The standard form requires you to list every cluster member, so topology changes mean
reconfiguring clients. The SRV form takes one hostname and resolves the seed list from DNS,
which the Manual says supports server rotation without client reconfiguration, and it is the
recommended form. It also changes a default: TLS is on by default for SRV connections.

**★ Authentication fails with the right username and password. What do you check first?**
`authSource`. Credentials are stored in a specific database, and the connection string's path
segment is the *default auth database* — so if the user lives in `admin` but the path names
`shop`, MongoDB looks in the wrong place. After that, check for unencoded special characters in
the password and for an unquoted connection string being truncated at the `?`.

**★ Which connection option would you set on every production application, and why?**
`appName`. It labels the connection in server logs and in `currentOp`, so during an incident
you can tell which service is running the expensive query instead of guessing. It costs
nothing and it is the difference between minutes and an hour.

**Why run a single-node replica set for local development?**
Because a standalone `mongod` cannot start a transaction, so transaction code cannot be tested
against it at all. A single-node replica set matches production's capabilities without needing
three servers.

**What does `directConnection=true` do and when do you want it?**
It stops the client discovering the topology and talks to exactly the node you named. It
defaults to false, where the client finds all members and sends operations to the primary.
Set it when you deliberately want one member — inspecting a specific secondary's lag or state.

**What does `retryWrites` do?**
It lets the driver retry a write once after a transient error such as a failover. Official
drivers default it to true, and it is one of the reasons a rolling restart is usually invisible
to an application.

---

← Index: [Phase 2](./README.md) ·
Next → [Navigating](./02-navigating.md)
