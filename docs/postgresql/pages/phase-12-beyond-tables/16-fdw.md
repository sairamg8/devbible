---
title: "Foreign data wrappers — postgres_fdw and dblink"
sidebar_label: "16 · Foreign data wrappers"
sidebar_position: 16
---

<span className="db-tier t-when">Learn When Needed</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script:
> `sandbox/pg-api/ex48-extensions-partitioning.mjs`.

**A foreign table looks like a table and is a query against another server.** The
entire question is how much of your query gets sent there rather than pulling rows
across and filtering locally.

## Setting one up

Four objects, in this order:

```sql
CREATE EXTENSION postgres_fdw;

CREATE SERVER remote_srv FOREIGN DATA WRAPPER postgres_fdw
  OPTIONS (host '127.0.0.1', port '5432', dbname 'fdw_remote');

CREATE USER MAPPING FOR CURRENT_USER SERVER remote_srv
  OPTIONS (user 'devbible', password 'devbible');

CREATE SCHEMA remote;
IMPORT FOREIGN SCHEMA public LIMIT TO (r_customers)
  FROM SERVER remote_srv INTO remote;
```

```console
$ node ex48-extensions-partitioning.mjs
=== 8. postgres_fdw — a table on another server ===
imported: [ { foreign_table_name: 'r_customers' } ]
rows visible through the foreign table: 50000
```

`IMPORT FOREIGN SCHEMA` reads the remote table definitions and creates matching
foreign tables — far better than hand-writing `CREATE FOREIGN TABLE` and getting a
column type subtly wrong. `LIMIT TO` keeps it to the tables you want.

Put foreign tables in **their own schema**. It makes the boundary visible in every
query, and `remote.r_customers` reads as what it is: a network call.

**The user mapping holds a password in the catalog.** It is visible to superusers,
so treat the remote credential accordingly.

## Pushdown is the whole story

```console
=== 9. what gets pushed to the remote server ===
filter on an indexed column        2.9 ms
    Foreign Scan
      Remote SQL: SELECT count(*) FROM public.r_customers WHERE ((region = 'region-3'))

with a VOLATILE local function     41.9 ms
      ->  Foreign Scan on remote.r_customers
            Filter: (random() < '2'::double precision)
            Remote SQL: SELECT NULL FROM public.r_customers WHERE ((lower(region) = 'region-3'::text))
↑ compare the Remote SQL lines: the second pulls rows over and filters locally
```

**2.9 ms against 41.9 ms — 14×**, and the `Remote SQL` lines say exactly why.

In the fast case the **entire aggregate** went to the remote server:
`SELECT count(*) ... WHERE region = 'region-3'`. One number came back.

In the slow case the `random() < 2` predicate is `VOLATILE`, so PostgreSQL cannot
send it. The remote query became `SELECT NULL FROM ...` — every matching row
shipped across the connection — and the filter and the count happened locally.

**`EXPLAIN (VERBOSE)` and its `Remote SQL` line is the only tool that matters
here.** If the remote query is missing your `WHERE`, your `JOIN`, or your
aggregate, you are transferring rows you do not need.

What pushes down: `WHERE` on immutable expressions, joins between two tables on the
*same* foreign server, aggregates, `ORDER BY`, `LIMIT`. What does not: anything
volatile, anything using a local function or local table, and joins across
different servers.

`use_remote_estimate 'true'` on the server makes the planner ask the remote for
cost estimates rather than guessing — worth enabling when plans look wrong, at the
cost of an extra round trip during planning.

## Transactions do not span servers

```console
a transaction spanning local and foreign tables → OK
  ↑ works, but it is NOT two-phase commit — the remote commits separately
```

A local transaction touching a foreign table works, and the atomicity is a
comfortable illusion: PostgreSQL opens a remote transaction and commits it as part
of the local commit, but **there is no two-phase commit**. The local commit can
succeed while the remote one fails, leaving the two sides inconsistent.

That is the fact that should keep FDW out of your write path. It is a read tool.

## `dblink`, and when it differs

`dblink` is the older mechanism: explicit connections and queries as strings.

```sql
SELECT * FROM dblink('dbname=fdw_remote', 'SELECT id, name FROM r_customers')
  AS t(id int, name text);
```

No foreign tables, no pushdown, no planner integration — you send a string and
declare the result shape. It is worth knowing for one thing `postgres_fdw` cannot
do: **running a query on another database in a way that is not part of your
transaction**, which is occasionally how people implement autonomous logging.

For everything else, `postgres_fdw` is better in every respect.

## When to use it

**Reasonable:** an occasional reporting query joining against another system's
database; a one-off migration reading from an old server; exposing a read-only
slice of another team's data without an ETL pipeline.

**Not reasonable:** anything in a request path, anything writing across servers,
and anything a service call would do better. A foreign table hides a network call
behind SQL syntax — the query looks local, and its failure modes are remote.

**Microservices note:** an FDW joining two services' databases is a well-known
anti-pattern for a reason. It couples them at the schema level, so the remote team
cannot rename a column without breaking you, and it does so invisibly.

## Trade-off

`postgres_fdw` gets data from another server with no pipeline, no sync job and no
staleness — the read is live. That is genuinely valuable for reporting and
migration.

The cost is that a network call is disguised as a table scan. Latency, remote
availability and remote schema changes all become your query's problem, with no
timeout you set locally and no circuit breaker. Add the missing two-phase commit
and the coupling, and it is a tool for the edges of a system rather than its
middle.

Note also there are non-PostgreSQL wrappers — `file_fdw` for CSVs on disk, and
third-party ones for MySQL, MongoDB and S3. Same mechanics, same pushdown question,
usually much weaker pushdown.

## Gotchas

**Symptom:** A foreign-table query is far slower than the same query run remotely
**Cause:** The predicate was not pushed down, so rows crossed the network.
Measured: 2.9 ms with full pushdown against 41.9 ms with a volatile predicate.
**Fix:** `EXPLAIN (VERBOSE)` and read the `Remote SQL` line. Remove volatile
functions and local-table references from the filter.

**Symptom:** A join between a local and a foreign table is slow
**Cause:** Only joins between tables on the *same* foreign server push down.
**Fix:** Materialise the foreign side first, or move the join remote.

**Symptom:** Plans against foreign tables look nonsensical
**Cause:** The planner is guessing at remote statistics.
**Fix:** `ALTER SERVER ... OPTIONS (use_remote_estimate 'true')`, at the cost of a
planning round trip.

**Symptom:** Data is inconsistent between servers after a failure
**Cause:** There is no two-phase commit; the remote transaction commits separately.
**Fix:** Do not write across an FDW. It is a read tool.

**Symptom:** Queries hang when the remote server is down
**Cause:** No local timeout applies to the remote connection by default.
**Fix:** Set `statement_timeout`, and do not put foreign tables in a request path.

**Symptom:** A remote schema change breaks local queries
**Cause:** `IMPORT FOREIGN SCHEMA` took a snapshot of the definitions; it does not
track changes.
**Fix:** Re-import after remote migrations. This coupling is the main argument
against FDW between services.

## Interview questions

**★ What decides whether a foreign-table query is fast?**
Whether the work is pushed to the remote server. Measured: a fully pushed-down
count ran in 2.9 ms with `Remote SQL: SELECT count(*) ... WHERE region = ...`,
while adding a volatile predicate made the remote query `SELECT NULL FROM ...` —
every matching row shipped across and filtered locally — at 41.9 ms. Read the
`Remote SQL` line in `EXPLAIN (VERBOSE)`.

**★ What stops a predicate being pushed down?**
Volatile functions, anything referencing a local table or local function, and joins
across different foreign servers. Immutable `WHERE` expressions, same-server joins,
aggregates, `ORDER BY` and `LIMIT` all push down.

**★ Are transactions across an FDW atomic?**
No. A remote transaction is opened and committed alongside the local one, but there
is **no two-phase commit** — the local side can commit while the remote fails. That
is the main reason to treat FDW as read-only.

**★ How do you create a foreign table without hand-writing the definition?**
`IMPORT FOREIGN SCHEMA public LIMIT TO (t) FROM SERVER s INTO schema` — it reads
the remote definitions. It is a snapshot, so re-import after remote schema changes.

**When is `dblink` still relevant?**
When you need a query on another database that is *not* tied to your transaction —
autonomous logging, for instance. It has no pushdown and no planner integration, so
`postgres_fdw` is better for everything else.

**Why is an FDW between two services' databases an anti-pattern?**
It couples them at the schema level and hides a network call behind SQL syntax. The
remote team cannot rename a column without breaking you, and your query's failure
modes become theirs — with no timeout, retry or circuit breaker that a service call
would give you.

---

← [Procedures](15-procedures.md) · Next → [pgvector](17-pgvector.md)
