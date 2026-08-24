---
title: "PostgreSQL's own manual says COPY beats a prepared, batched, single-transaction INSERT — and the reason to switch is not only speed"
sidebar_label: "19h · COPY instead of batching"
sidebar_position: 28
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the PostgreSQL 18 manual §14.4 *Populating a Database*
> ([postgresql.org/docs/18/populate.html](https://www.postgresql.org/docs/18/populate.html))
> and *COPY*
> ([postgresql.org/docs/18/sql-copy.html](https://www.postgresql.org/docs/18/sql-copy.html)),
> the JDK 25 API for `java.sql.Statement`
> ([docs.oracle.com/en/java/javase/25/docs/api/java.sql/](https://docs.oracle.com/en/java/javase/25/docs/api/java.sql/)),
> and the pgJDBC 42.7.x source and javadoc for `org.postgresql.copy.CopyManager`
> and `PGConnection`
> ([github.com/pgjdbc/pgjdbc](https://github.com/pgjdbc/pgjdbc)). JDK 25,
> JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13. No sandbox: no timings, no console
> output.

**Everything in chunks 19 through 19g is about making a batch behave. This chunk
is about the point at which the right move is to stop. PostgreSQL's loading
documentation does not hedge: "loading a large number of rows using `COPY` is
almost always faster than using `INSERT`, even if `PREPARE` is used and multiple
insertions are batched into a single transaction" — which describes, exactly, the
carefully tuned batch you would otherwise be writing. The speed is the advertised
reason and it is not the most important one. A batch materialises every row in
your heap before a byte is sent; `CopyManager.copyIn` streams from a `Reader` or
an `InputStream`, so a forty-million-row file needs a buffer instead of a chunking
strategy, and the input size stops being a JVM problem at all. What you give up is
real and specific: no per-row counts, no `RETURNING` and therefore no generated
keys, no `ON CONFLICT`, and — quietly — `COPY FROM` fires triggers and check
constraints but not rules. The pattern that keeps both halves is to `COPY` into a
staging table and then do the clever part server-side in one statement.**

## Where batching stops being the answer

PostgreSQL's loading chapter puts the three techniques in order, and the ranking
is explicit rather than implied:

> "Use `COPY` to load all the rows in one command, instead of using a series of
> `INSERT` commands. The `COPY` command is optimized for loading large numbers of
> rows; it is less flexible than `INSERT`, but incurs significantly less overhead
> for large data loads. Since `COPY` is a single command, there is no need to
> disable autocommit if you use this method to populate a table."

> "If you cannot use `COPY`, it might help to use `PREPARE` to create a prepared
> `INSERT` statement, and then use `EXECUTE` as many times as required."

> "Note that loading a large number of rows using `COPY` is almost always faster
> than using `INSERT`, even if `PREPARE` is used and multiple insertions are
> batched into a single transaction."

That last sentence is describing your batch precisely — prepared, multi-row, one
transaction — and saying `COPY` still wins. The same chapter adds the other
half of a bulk load, which has nothing to do with JDBC and is usually the larger
effect: "If you are loading a freshly created table, the fastest method is to
create the table, bulk load the table's data using `COPY`, then create any indexes
needed for the table."

## `CopyManager`

pgJDBC exposes `COPY` through `org.postgresql.copy.CopyManager`, described in its
own javadoc as "API for PostgreSQL COPY bulk data transfer", with `copyIn`
overloads that "use `COPY FROM STDIN` for very fast copying from a `Reader` into a
database table". You reach it through the driver's extension interface:

```java
long bulkLoad(Connection c, Reader csv) throws SQLException, IOException {
    PGConnection pg = c.unwrap(PGConnection.class);   // NOT a cast — see chunk 9
    CopyManager copy = pg.getCopyAPI();
    return copy.copyIn("""
            COPY ledger_entry (account_id, cents, occurred_at)
            FROM STDIN WITH (FORMAT csv)
            """, csv);
}
```

`copyIn` returns the number of rows loaded as a `long`. There are overloads
taking a `Reader`, an `InputStream`, or a `ByteStreamWriter`, and each has a
`bufferSize` variant — "number of characters to buffer and push over network to
server at once" for the `Reader` form, bytes for the `InputStream` form.

🔴 **This is a genuine streaming API, which is the part that matters as much as
the speed.** A batch materialises every row in your heap before anything is sent
([chunk 19e](19e-sizing-a-batch.md)); `copyIn` from a `Reader` pushes bytes as it
reads them, so a forty-million-row file needs a buffer, not a chunking strategy.

## What you give up by using `COPY`

`COPY` is "less flexible than `INSERT`" in ways that are precise and worth knowing
before you commit to it:

| | Batched `INSERT` | `COPY FROM STDIN` |
|---|---|---|
| Per-row update counts | yes (unless [rewritten](19c-insert-rewriting.md)) | no — one total |
| `RETURNING` / [generated keys](19d-generated-keys-from-a-batch.md) | yes | **no** |
| `ON CONFLICT` upsert | yes | **no** — load to a staging table, then `INSERT ... SELECT` |
| Triggers and check constraints | fire | fire — "`COPY FROM` will invoke any triggers and check constraints on the destination table" |
| Rules | apply | **do not** — "However, it will not invoke rules" |
| Per-row error tolerance | one bad row aborts the segment | `ON_ERROR ignore` (PostgreSQL 18), text/csv only |
| Client memory | whole batch resident | streams |

⚠️ **The rules exclusion is a real behavioural difference**, not a footnote. If a
table's writes are governed by a `RULE` — an older pattern, but it exists in
legacy schemas — a `COPY` load bypasses it silently while an `INSERT` does not.

⚠️ **`ON_ERROR` is narrower than it sounds.** PostgreSQL 18's option "specifies
how to behave when encountering an error converting a column's input value into
its data type", with `ignore` meaning "discard the input row and continue with the
next one". It is a *type-conversion* escape hatch, applicable only "for `COPY
FROM` when the `FORMAT` is `text` or `csv`" — it does not make a unique-violation
survivable. The default is `stop`, and by default "`COPY` will fail if it
encounters an error during processing."

## The staging-table pattern

The way to keep `COPY`'s speed and `INSERT`'s flexibility is to use both:

```sql
CREATE TEMP TABLE ledger_entry_stage (LIKE ledger_entry INCLUDING DEFAULTS)
    ON COMMIT DROP;
-- COPY into the staging table from the client, via CopyManager
INSERT INTO ledger_entry (account_id, cents, occurred_at)
SELECT account_id, cents, occurred_at FROM ledger_entry_stage
ON CONFLICT (external_ref) DO NOTHING
RETURNING id;
```

The load runs at `COPY` speed and streams; the conflict handling, the
transformation and the `RETURNING` all happen server-side in one statement, with
no round trip per row at all. This is the shape almost every mature bulk pipeline
converges on, and it is worth reaching for before tuning a batch size for the
third time.

## Gotchas

**⚠️ Casting to `PGConnection` to reach `CopyManager`**
**Symptom:** `ClassCastException` on a line that works against the raw driver.
**Cause:** a pooled connection hands you a proxy, exactly as in
[chunk 9](09-server-side-prepared-statements.md).
**Fix:** `c.unwrap(PGConnection.class).getCopyAPI()`.

**⚠️ Expecting `RETURNING` from a `COPY`**
**Symptom:** no way to learn the ids of the rows just loaded.
**Cause:** `COPY` has no `RETURNING` clause; it reports a row count and nothing
else.
**Fix:** the staging-table pattern — `COPY` into a temp table, then
`INSERT ... SELECT ... RETURNING` — or generate keys client-side.

**⚠️ Assuming `ON_ERROR ignore` makes a load fault-tolerant**
**Symptom:** a constraint violation still aborts the whole `COPY`.
**Cause:** the option covers errors "converting a column's input value into its
data type", in `text` or `csv` format only. It is not a general skip-bad-rows
switch.
**Fix:** load to a staging table with permissive types, then validate and insert
with `ON CONFLICT` server-side.

**⚠️ Forgetting that `COPY` bypasses rules**
**Symptom:** a legacy table's `RULE`-based redirection or auditing stops
happening for bulk-loaded rows only.
**Cause:** "`COPY FROM` will invoke any triggers and check constraints on the
destination table. However, it will not invoke rules."
**Fix:** check for rules before switching a write path to `COPY`; convert the
rule to a trigger if it must apply.

**⚠️ Loading into a table that already has its indexes**
**Symptom:** the `COPY` is much slower than expected and the win over batching is
small.
**Cause:** every index is maintained incrementally per row. The documentation's
advice is to "create the table, bulk load the table's data using `COPY`, then
create any indexes needed for the table."
**Fix:** for a fresh table, build indexes after. For an existing one, this is a
cost you accept — it applies equally to batched inserts.

**⚠️ Leaving `COPY` running with no timeout story**
**Symptom:** a stuck load with no cancellation path.
**Cause:** `copyIn` is not an `executeBatch`, so `setQueryTimeout` on some other
statement has nothing to do with it.
**Fix:** bound it at the connection level — `socketTimeout` and a server-side
`statement_timeout` — and hold a reference so the operation can be cancelled.

## Interview questions

**★ When would you use `COPY` instead of a batch, and what do you lose?**
For a bulk load into a table, essentially always — PostgreSQL's own documentation
says loading a large number of rows with `COPY` "is almost always faster than
using `INSERT`, even if `PREPARE` is used and multiple insertions are batched
into a single transaction", which is exactly the optimised batch you would
otherwise write. The second reason is memory: a batch materialises every row in
your heap before anything is sent, whereas `CopyManager.copyIn` streams from a
`Reader` or `InputStream`, so the input size stops being a JVM problem. What you
lose is flexibility: no per-row update counts, no `RETURNING` and therefore no
generated keys, no `ON CONFLICT`, and — a subtle one — `COPY FROM` fires triggers
and check constraints but not rules. The standard way to get both is the
staging-table pattern: `COPY` into a temp table, then one server-side
`INSERT ... SELECT ... ON CONFLICT ... RETURNING`.

**★ A load fails partway through with one bad row in ten million. How do you make
that survivable?**
Decide first whether the badness is a type-conversion problem or a constraint
problem, because PostgreSQL 18 handles only the first for you: `ON_ERROR ignore`
"means discard the input row and continue with the next one", but it is
explicitly about "converting a column's input value into its data type" and only
for `text` or `csv` format. A unique violation is not covered. The general
answer is to separate loading from validating: `COPY` everything into a staging
table with permissive types and no constraints, which cannot fail on business
rules; then do the real insert as one server-side `INSERT ... SELECT` with
`ON CONFLICT`, which decides per row without a round trip. Bad rows stay visible
in the staging table for inspection instead of being a stack trace. If you are
batching rather than copying, the equivalent is chunk-and-commit with an
idempotent statement, plus quarantining the single entry named by the exception
index.

**★ Why does the documentation recommend building indexes after the load?**
Because an index on an existing table is maintained incrementally, once per row
inserted, whereas building it afterwards is a single bulk operation over data
that is already there — the documentation's wording is that "creating an index on
pre-existing data is quicker than updating it incrementally as each row is
loaded." It matters here because it is usually a larger effect than anything you
can do at the JDBC layer: no amount of batch tuning, insert rewriting or `COPY`
changes the per-row index maintenance cost. The catch is that it only applies
cleanly to a freshly created table — dropping and rebuilding indexes on a live
table trades load speed for a window where queries have no index and unique
constraints are unenforced, which is rarely acceptable outside a maintenance
window.

**★ Is `CopyManager` part of JDBC?**
No, and that is the honest framing: it is a PostgreSQL extension reached through
`c.unwrap(PGConnection.class).getCopyAPI()`, so code using it will not compile
against another driver. Use `unwrap` rather than a cast, because a pooled
connection hands you a proxy and the cast throws — the same trap as
`setPrepareThreshold` in [chunk 9](09-server-side-prepared-statements.md). The
practical consequence is architectural: isolate the `COPY` path behind an
interface so the driver dependency lives in one class, rather than letting
`org.postgresql` imports spread through a data-access layer that is otherwise
portable. That is a reasonable price for the largest single win available at this
layer, but it should be a decision rather than an accident.

---
← Prev: [19g · Locks and long transactions](19g-locks-and-long-transactions.md) · Index: [JDBC](README.md) · Next → [20 · Generated keys](20-generated-keys.md)
