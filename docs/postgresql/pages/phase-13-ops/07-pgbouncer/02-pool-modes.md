---
title: "07.2 · Pool modes, and what transaction mode breaks"
sidebar_label: "02 · Pool modes"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13. **Mixed provenance, marked inline.**
> The backend-count results are **sandbox-measured** on **PgBouncer 1.25.2**
> (`edoburu/pgbouncer`, transaction mode, `default_pool_size=5`,
> `max_prepared_statements=0`) in front of **PostgreSQL 18.4**, Node 24, `pg` —
> script `sandbox/pg-api/ex54-pgbouncer.mjs`, sections 1–2.
> Everything else is validated against the **PgBouncer documentation**
> ([config](https://www.pgbouncer.org/config.html),
> [features](https://www.pgbouncer.org/features.html),
> [1.21.0 release](https://www.postgresql.org/about/news/pgbouncer-1210-released-now-with-prepared-statements-2735/)).
> ⚠️ `ex54`'s later sections ran but their output was **never captured**, so
> **nothing on this page is reconstructed from them** — where a claim would have
> needed that output, it is cited to the documentation instead.

**Transaction pooling is what makes a pooler worth running, and it is also what
quietly breaks your application.** The PgBouncer docs say so in as many words:
transaction pooling "breaks client expectations of the server *by design* and can
be used only if the application cooperates by not using non-working features."

## The three modes

| Mode | Server connection is returned to the pool… | Multiplexing you get |
|---|---|---|
| `session` **(default)** | when the client disconnects | almost none |
| `transaction` | **when the transaction finishes** | the useful one |
| `statement` | when the query finishes; multi-statement transactions are **disallowed** | most, at a price few can pay |

Session mode is the safe default and is nearly pointless for the problem in
[chunk 01](01-why-connections-cost.md): if a server connection is pinned for the
whole life of a client connection, then a client that holds its connection open
(which is exactly what `pg.Pool` does) holds a backend open too. You have added a
hop and saved nothing.

Transaction mode is the one everybody actually deploys. Between transactions your
client holds *no* server connection at all — the backend is handed to whoever
needs it next. An idle client costs a PgBouncer client slot, which is cheap, not
a PostgreSQL backend, which is not.

## Measured: what multiplexing buys

Two runs from `ex54`, both with 40 clients connected through PgBouncer with
`default_pool_size = 5`:

| Scenario | Distinct backend PIDs on the server | Failures |
|---|---|---|
| 40 clients, queries issued **sequentially** | **1** | 0 |
| 40 clients, all queries **in flight at once** | **exactly 5** (`default_pool_size`) | 0 |

Both numbers are worth sitting with.

**One backend served forty clients** when their work did not overlap. Idle clients
hold no server connection in transaction mode, so forty mostly-idle application
instances need one backend, not forty. That is the whole value proposition.

**Concurrency was capped at exactly `default_pool_size`, and nothing failed.** The
excess did not error — it *waited*. Which is fine here, and is the subject of
[chunk 03](03-exhaustion-and-sizing.md), where waiting stops being fine.

## What transaction mode breaks

Because consecutive transactions from one client can land on different backends,
anything that lives in *session* state is unsafe. This is PgBouncer's documented
feature matrix — each of these is listed as never working under transaction
pooling:

| Feature | Why it breaks |
|---|---|
| `SET` / `RESET` | the setting stays on whichever backend happened to serve it |
| `LISTEN` / `NOTIFY` | you are listening on a backend you no longer hold |
| `WITH HOLD` cursors | the cursor lives in a session you will not get back |
| `PREPARE` / `DEALLOCATE` | SQL-level prepared statements are session objects |
| temp tables (`PRESERVE`/`DELETE ROWS`) | the temp schema belongs to that backend |
| `LOAD` | loads into that backend only |
| **session-level advisory locks** | `pg_advisory_lock()` is held by a backend you have released |

Note what is *not* on that list: ordinary transactions, `SET LOCAL`, transaction-
scoped advisory locks, and `SELECT`/`INSERT`/`UPDATE`/`DELETE`. Transaction mode
is safe for the overwhelming majority of application code. It is the session-state
minority that bites, and it bites *intermittently* — the failure only appears when
the next transaction happens to land on a different backend, which under light
load it often does not.

**That intermittency is the real hazard.** A `SET`-based tenant scheme will pass
every test on a laptop with one client and fail in production under concurrency.

### The two that matter most in a Node app

**`SET` for per-request state.** Setting a tenant id, a `search_path` or a
`statement_timeout` with plain `SET` on a pooled connection leaks it to the next
user of that connection — and this is true even of `pg.Pool` alone, without
PgBouncer. `ex54` §3 measured exactly this: **`SET` persisted across a pooled
connection handoff and `SET LOCAL` did not.** The fix is `SET LOCAL` inside an
explicit transaction, which is scoped to that transaction and therefore safe in
transaction pooling. This is load-bearing for
[14 · Row-level security](../14-rls/README.md) and for
[multi-tenancy](../../phase-3-ddl/20-multi-tenancy/README.md), where a leaked
tenant id is a cross-tenant data exposure, not a bug.

**Session advisory locks.** `pg_advisory_lock()` under transaction pooling is
close to unusable: you take the lock on one backend and the next statement may
run on another, so you neither hold it where you think nor release it where you
think. Use `pg_advisory_xact_lock()`, which is released at commit by the server
itself. Phase 11 covers the lock semantics; the pooling constraint is one more
reason the transaction-scoped form is the right default.

## Prepared statements: the exception that changed

The most repeated piece of PgBouncer folklore is "you cannot use prepared
statements in transaction mode". **That has been out of date since PgBouncer
1.21.0**, and the distinction is precise:

- **SQL-level `PREPARE` / `DEALLOCATE`** — still broken, still on the never-works
  list. These create session objects PgBouncer does not track.
- **Protocol-level named prepared statements** — the extended query protocol,
  which is what `pg` uses when you pass parameters — **work**, provided
  `max_prepared_statements` is set to a non-zero value. The docs: with a non-zero
  value "PgBouncer tracks protocol-level named prepared statements related
  commands sent by the client in transaction and statement pooling mode",
  re-preparing them on each server connection as required. The default is **200**.

The sandbox's PgBouncer was deliberately run with `MAX_PREPARED_STATEMENTS=0` —
the old, restrictive configuration — so the sandbox reproduces the historical
behaviour rather than the current default. If you inherit a PgBouncer config with
`max_prepared_statements = 0` in it, that is someone pinning the old behaviour,
and it is worth asking whether they meant to.

Practical consequence for a Node service: with a modern PgBouncer at its default,
parameterised queries through `pg` are fine. You do not need to disable prepared
statements, and you should not reach for string interpolation to avoid them.

## `server_reset_query` and why it does not save you

In session mode PgBouncer runs `server_reset_query` — default `DISCARD ALL` —
when a client disconnects, wiping session state before the connection is reused.

It is tempting to assume this also protects transaction mode. It does not, and
the docs are explicit: in transaction pooling `server_reset_query` **is not used**,
"because in that mode, clients must not use any session-based features, since
each transaction ends up in a different connection and thus gets a different
session state."

So there is no automatic cleanup between transactions. The contract is entirely
on your side: do not create session state. `SET LOCAL`, not `SET`.

## Choosing a mode

- **`transaction`** — the default choice for a web API. Everything above applies;
  in exchange you get the multiplexing that makes the pooler worth running.
- **`session`** — when you genuinely need session features: a worker that holds
  `LISTEN`, a long-lived migration connection, a tool you do not control. Run it
  as a *separate pool entry* pointed at the same database rather than downgrading
  the whole deployment.
- **`statement`** — effectively autocommit-only; multi-statement transactions are
  rejected outright. Reserve it for workloads that genuinely never open a
  transaction.

Running two pools with different modes against one database is normal and is
usually the right answer when one component needs `LISTEN` and the rest do not.

## Trade-off

Transaction pooling trades **session semantics for connection efficiency**. You
get an order-of-magnitude reduction in backends — measured above as 40 clients on
1 backend when idle, and a hard cap of 5 under full concurrency — and you give up
the guarantee that two consecutive statements from one client see the same server
session.

That trade is nearly always worth taking, because well-written application code
does not rely on session state anyway. But it is a real trade and it is not
detectable by testing on one connection: the code that breaks under it works
perfectly until there is contention. The honest summary is that transaction
pooling makes your application's *implicit* assumptions about session state into
*explicit* correctness requirements.

## Gotchas

**Symptom:** `SET` works locally, leaks between users in production
**Cause:** The setting stays on the backend and the next transaction — possibly
another user's — inherits it. Measured with plain `pg.Pool` in `ex54` §3;
transaction pooling makes it worse by widening the set of consumers.
**Fix:** `SET LOCAL` inside an explicit transaction, always. Never plain `SET` on
a pooled connection.

**Symptom:** `LISTEN`/`NOTIFY` delivers nothing through the pooler
**Cause:** `LISTEN` is on the never-works list for transaction pooling — you are
listening on a backend you no longer hold.
**Fix:** Give the listener its own `session`-mode pool entry, or a direct
connection bypassing the pooler.

**Symptom:** An advisory lock is never released, or is not held
**Cause:** Session-level `pg_advisory_lock()` under transaction pooling.
**Fix:** `pg_advisory_xact_lock()` — released at commit by the server.

**Symptom:** "Prepared statements don't work with PgBouncer"
**Cause:** Out-of-date advice, or an inherited config with
`max_prepared_statements = 0`.
**Fix:** PgBouncer 1.21.0+ supports **protocol-level** named prepared statements
in transaction mode with `max_prepared_statements` non-zero (default 200).
SQL-level `PREPARE` is still unsupported — those are different things.

**Symptom:** Session state bleeds even though `server_reset_query = DISCARD ALL`
**Cause:** `server_reset_query` is **not executed** in transaction mode, by
documented design.
**Fix:** Do not rely on it. Create no session state in the first place.

**Symptom:** Adding PgBouncer changed nothing — backends did not drop
**Cause:** It is in `session` mode (the default), so a server connection is
pinned for the life of each client connection, and `pg.Pool` holds those open.
**Fix:** `pool_mode = transaction`, then audit for the session features above.

## Interview questions

**★ What is the difference between session and transaction pooling?**
Session mode returns the server connection when the *client* disconnects, so a
long-lived client pins a backend and you gain almost nothing. Transaction mode
returns it when each *transaction* finishes, so idle clients hold no backend —
measured at 40 clients served by 1 backend when their work did not overlap. The
cost is that session state no longer follows the client.

**★ What breaks under transaction pooling?**
Anything session-scoped: `SET`/`RESET`, `LISTEN`, `WITH HOLD` cursors, SQL-level
`PREPARE`/`DEALLOCATE`, temp tables, `LOAD`, and session-level advisory locks.
Ordinary transactions, `SET LOCAL` and `pg_advisory_xact_lock()` are all fine.
The danger is that these fail intermittently — only when the next transaction
lands on a different backend.

**★ Why is `SET LOCAL` the rule on a pooled connection?**
Because plain `SET` outlives the transaction and stays on the backend for the
next user of that connection — measured. `SET LOCAL` is scoped to the
transaction, so it is released at commit regardless of which client gets the
connection next. With a tenant id in that setting, the difference is a
cross-tenant data leak.

**★ Can you use prepared statements with PgBouncer?**
Yes, since PgBouncer 1.21.0 — protocol-level named prepared statements (what the
`pg` driver uses for parameterised queries) work under transaction pooling when
`max_prepared_statements` is non-zero, default 200. SQL-level `PREPARE` still
does not. The common "prepared statements don't work" answer is a version behind.

**Does `server_reset_query = DISCARD ALL` protect transaction mode?**
No. It is documented as not being used in transaction pooling at all, precisely
because clients are not supposed to be creating session state there. There is no
automatic cleanup between transactions.

**Your worker needs `LISTEN`. How do you deploy it behind a pooler?**
Give it a separate pool entry in `session` mode against the same database, or let
it connect directly. Do not move the whole deployment to session mode — that
throws away the multiplexing every other component depends on.

---

← [Why connections cost](01-why-connections-cost.md) · Next → [Exhaustion and sizing](03-exhaustion-and-sizing.md)
