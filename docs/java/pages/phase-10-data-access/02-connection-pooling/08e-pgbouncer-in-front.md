---
title: "Putting PgBouncer in front dissolves the connection budget and changes what a connection is — transaction mode is a different contract, not a faster one"
sidebar_label: "8e · PgBouncer in front"
sidebar_position: 26
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the PgBouncer configuration reference
> (`pool_mode`, `max_client_conn`, `default_pool_size`, `server_reset_query`,
> `server_reset_query_always`, `max_prepared_statements`)
> ([pgbouncer.org/config.html](https://www.pgbouncer.org/config.html)), the
> PostgreSQL 18 documentation
> ([postgresql.org/docs/18/](https://www.postgresql.org/docs/18/)), the pgjdbc
> connection-parameter reference
> ([jdbc.postgresql.org/documentation/use/](https://jdbc.postgresql.org/documentation/use/))
> and the HikariCP 7.0.2 README
> ([github.com/brettwooldridge/HikariCP](https://github.com/brettwooldridge/HikariCP)).
> JDK 25, HikariCP 7.0.2, pgjdbc 42.7.13, PostgreSQL 18.

**A server-side pooler multiplexes many client connections onto a few database
backends. That dissolves [chunk 3d's](03d-the-fleet-budget.md) fleet arithmetic —
a hundred instances can hold a pool each without the database seeing a hundred
pools. The price is that in its most useful mode, **a connection stops being a
session**, and everything [chunk 7b](07b-what-sql-leaves-behind.md) listed as
*dangerous* becomes *broken*. That is the trade, and it is a design decision
rather than an optimisation. [Chunk 8f](08f-operating-two-layers.md) covers what
it does to the settings you have already chosen.**

## The three pool modes

| `pool_mode` | PgBouncer's own words |
|---|---|
| `session` | *"Server is released back to pool after client disconnects. Default."* |
| `transaction` | *"Server is released back to pool after transaction finishes."* |
| `statement` | *"Server is released back to pool after query finishes. Transactions spanning multiple statements are disallowed in this mode."* |

**Session mode is the default and changes nothing about semantics.** A client
connection owns a server connection for its whole life, so a pooled HikariCP
connection maps one-to-one onto a backend — the same model as no pooler at all,
with a cap on the total. It bounds the fleet; it does not multiplex.

🔴 **Transaction mode is the one people install PgBouncer for**, and it is the one
that changes the contract. Between your transactions, your server connection goes
back to PgBouncer's pool and may be handed to somebody else. Your next
transaction may land on a completely different backend.

**Statement mode forbids multi-statement transactions outright**, which rules out
essentially all application code.

## The arithmetic it dissolves

| Setting | Default | What it bounds |
|---|---|---|
| `max_client_conn` | 100 | connections from *clients* (your pools) |
| `default_pool_size` | 20 | server connections per user/database pair |
| `min_pool_size` | 0 | server connections kept warm |
| `reserve_pool_size` | 0 | extra server connections under pressure |
| `max_db_connections` | 0 (unlimited) | server connections per database |

So `max_client_conn` replaces `max_connections` as the number your fleet must fit
inside, and `default_pool_size` becomes the number
[chunk 2's](02-why-a-small-pool-is-faster.md) throughput argument applies to.
Raise `max_client_conn` to a few thousand and `instances x maximumPoolSize` stops
being a constraint — which is exactly what a large fleet, or a serverless
deployment where instance count is unknowable, needs.

⚠️ **Note that the sizing argument did not go away, it moved.** The database still
performs best with a few dozen concurrent backends, so `default_pool_size`
inherits every consideration from chunks 2 and 3, including the deadlock floor if
any code path holds two connections at once.

## What transaction mode breaks

PgBouncer states the rule itself:

> *When transaction pooling is used, the `server_reset_query` is not used, because
> in that mode, clients must not use any session-based features, since each
> transaction ends up in a different connection and thus gets a different session
> state.*

🔴 **That is [chunk 7b's](07b-what-sql-leaves-behind.md) catalogue with a shorter
fuse.** Everything session-scoped now leaks — or vanishes — between
*transactions* rather than between requests:

| Feature | In transaction mode |
|---|---|
| `SET` of any parameter | ⛔ applies to whichever backend you happened to get |
| session-level advisory locks | ⛔ held on a backend you no longer own |
| `LISTEN` / `NOTIFY` | ⛔ the subscription is on a backend that moved on |
| temporary tables | ⛔ created on one backend, invisible from the next transaction |
| `WITH HOLD` cursors | ⛔ they survive commit, and the connection does not |
| session-level `PREPARE` | ⛔ prepared on one backend, missing on the next |
| `SET SESSION AUTHORIZATION` / `SET ROLE` | ⛔ and this one is a security problem |

⚠️ **`server_reset_query` defaults to `DISCARD ALL`, but only runs in session
mode.** `server_reset_query_always` forces it in every mode, and PgBouncer
describes that setting as a fix for *"broken setups that run applications that use
session features over a transaction-pooled PgBouncer"* — which is an accurate and
unflattering description of what it is for.

## The part that changed: prepared statements

🔴 **The advice you will find online is out of date.** Server-side prepared
statements used to be the headline casualty of transaction mode, and the standard
workaround was to disable them in the driver. Current PgBouncer handles them:

> *When this is set to a non-zero value PgBouncer tracks protocol-level named
> prepared statements related commands sent by the client in transaction and
> statement pooling mode.*

That is `max_prepared_statements`, and its **default is 200** — non-zero, so the
support is on by default. PgBouncer rewrites the statement names internally and
maps them onto whichever server connection a transaction lands on.

⚠️ **The old workaround was pgjdbc's `prepareThreshold`.** Its documented values
are the default `5` and the special value `-1` (force binary); the parameter
reference does not document what `0` does, though it is widely used to mean
"never use server-side prepared statements". If you are on a PgBouncer old enough
to need it, verify the behaviour rather than trusting the folklore — and note
that disabling server-side prepared statements gives up the plan reuse that
[topic 01 chunk 9](../01-jdbc/09-server-side-prepared-statements.md) exists to
explain.

## The discipline that makes it possible

Here is the payoff of chunks 7c and 7d. **An application that already scopes its
state correctly is already transaction-mode safe**, and one that does not cannot
be made safe by configuration:

| Chunk 7c/7d says | Transaction mode requires |
|---|---|
| `SET LOCAL`, not `SET` | ✅ exactly this |
| `pg_advisory_xact_lock`, not `pg_advisory_lock` | ✅ exactly this |
| `CREATE TEMP TABLE ... ON COMMIT DROP` | ✅ exactly this |
| `ALTER ROLE ... SET` for defaults | ✅ exactly this — it applies at login on the *server* side |
| a dedicated connection for `LISTEN` | ✅ and it must bypass the pooler entirely |
| `INSERT ... RETURNING`, not `currval()` | ✅ exactly this |

🔴 **That is not a coincidence.** Both are the same rule — *do not put state in
the session* — with the recycling happening at a different granularity. Writing an
application that survives connection pooling correctly is most of the work of
making it survive a transaction-mode pooler.

## The trade-off

Transaction mode buys the ability to have far more clients than backends, and
pays for it by removing the session as a unit your application can rely on. In
exchange for that constraint you also get a genuinely useful property: the
connection budget becomes centrally enforced, so no single service can exhaust
the server. Session mode keeps every semantic and buys much less — a cap
on total server connections, and reuse across application restarts, but no
multiplexing. There is no mode that gives you both, which is why this is a design
decision about the application rather than a knob on the infrastructure.

## Gotchas

**⚠️ Transaction mode with session `SET` in the application**
**Symptom:** settings that apply to random requests; occasionally a `SET ROLE`
landing on somebody else's transaction.
**Cause:** each transaction may run on a different backend.
**Fix:** `SET LOCAL` ([chunk 7c](07c-scoping-state-correctly.md)) or role-level
defaults ([chunk 7d](07d-connection-level-defaults.md)).

**⚠️ Session-level advisory locks behind transaction mode**
**Symptom:** locks that are never released, on backends nobody owns.
**Cause:** the server connection returns to PgBouncer's pool with the lock held.
**Fix:** `pg_advisory_xact_lock`, always.

**⚠️ `LISTEN` through a transaction-mode pooler**
**Symptom:** notifications silently never arrive.
**Cause:** the subscription is on a backend that has moved on to other clients.
**Fix:** a dedicated connection that bypasses the pooler entirely.

**⚠️ Choosing statement mode for maximum multiplexing**
**Symptom:** every multi-statement transaction in the application fails.
**Cause:** PgBouncer's own words — *"Transactions spanning multiple statements are
disallowed in this mode."*
**Fix:** transaction mode is the useful one. Statement mode is for a very narrow
class of workload that runs single autocommit statements only.

**⚠️ Assuming `DISCARD ALL` makes transaction mode safe**
**Symptom:** session features still misbehave.
**Cause:** `server_reset_query` runs only in session mode by default, and even
when forced it cleans *between* transactions — it cannot give you back a session
that spans them.
**Fix:** a reset is not a session. Scope the state properly instead.

**⚠️ Enabling `server_reset_query_always` to make session features work**
**Symptom:** it papers over some of it and not all of it, unpredictably.
**Cause:** it is documented as a fix for *"broken setups"* — a reset between
transactions does not give you back a session that spans them.
**Fix:** fix the application's scoping. The setting is a mitigation, not a
solution.

**⚠️ Disabling server-side prepared statements out of habit**
**Symptom:** worse plan reuse for no reason on current PgBouncer.
**Cause:** advice written before `max_prepared_statements` existed; its default is
now 200.
**Fix:** check your PgBouncer version before applying a workaround from a blog
post.

## Interview questions

**★ What does PgBouncer's transaction mode actually change?**
When a server connection is released. In session mode it is held for the whole
life of the client connection, so semantics are unchanged. In transaction mode it
is released the moment a transaction finishes, which means your next transaction
may run on a different backend — so the *session* stops being something your
application can rely on. PgBouncer says so directly: clients must not use any
session-based features, because each transaction ends up in a different
connection and gets a different session state. That is the whole trade: many more
clients than backends, in exchange for the session no longer being yours.

**★ What breaks in transaction mode?**
Everything session-scoped: any `SET`, session-level advisory locks,
`LISTEN`/`NOTIFY`, temporary tables, `WITH HOLD` cursors, session-level
`PREPARE`, and `SET ROLE` or `SET SESSION AUTHORIZATION` — which is the one that
is a security problem rather than merely a bug. It is exactly the catalogue of
things a client-side pool already fails to reset, with the recycling happening
between transactions instead of between requests. Server-side prepared
statements used to be on that list and largely are not any more, because current
PgBouncer tracks protocol-level prepared statements with `max_prepared_statements`,
whose default is 200.

**★ How does an application become transaction-mode safe?**
By doing what it should already be doing on a pooled connection: `SET LOCAL`
instead of `SET`, `pg_advisory_xact_lock` instead of `pg_advisory_lock`, temp
tables with `ON COMMIT DROP`, defaults set with `ALTER ROLE ... SET` on the
server, `INSERT ... RETURNING` instead of `currval()`, and a dedicated
non-pooled connection for `LISTEN`. That is not a coincidence — both disciplines
are the same rule, "do not put state in the session", applied at different
granularities. An application that already survives connection pooling correctly
needs almost nothing to survive a transaction-mode pooler; one that does not
cannot be fixed with configuration.

**★ What is session mode actually good for, if it does not multiplex?**
Two real things. It caps the total number of server connections regardless of how
many clients connect, so one misconfigured service cannot exhaust the database —
the same protection a per-role `CONNECTION LIMIT` gives, enforced in one place
for the whole estate. And it decouples client connection churn from backend
churn, so a fleet of instances restarting does not produce a storm of backend
forks. What it does not give you is more clients than backends, which is the
thing people usually install a pooler for. It is the safe choice when the
application uses session features and you cannot change that.

**★ Why is `SET ROLE` under transaction mode a security problem rather than a bug?**
Because the failure mode is privilege *escalation* for somebody else rather than
a visible error. A `SET ROLE` applies to whichever backend the current
transaction happens to be running on, and that backend goes back to PgBouncer's
pool afterwards, still carrying the role. A completely unrelated client's next
transaction can land on it and execute with privileges it was never granted —
silently, with no error, producing correct-looking results. Everything else on
the broken list produces a malfunction; this one produces an authorisation
bypass, which is why `SET ROLE`-based tenant or privilege scoping and
transaction pooling must never be combined.

---

← Prev: [8d · The database side](08d-the-database-side.md) · Index: [Connection pooling with HikariCP](README.md) · Next → [8f · Operating two layers](08f-operating-two-layers.md)
