---
title: "When a column beats JSON"
sidebar_label: "02 · Column vs JSON"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex44-jsonb-ops.mjs`.

**This decision is made in an afternoon and lived with for years.** jsonb is not a
way to avoid designing a schema — it is a way to store the part of the data whose
shape you genuinely do not control. Everything you put in it, you give up
constraints, types and cheap indexing for.

The measurements below store the same two facts twice in one table: once as
`tag`/`qty` columns, once inside a `doc` jsonb column.

## Storage

```console
$ node ex44-jsonb-ops.mjs
storage for the same two facts: { doc_bytes: '22 MB', col_bytes: '1736 kB' }
```

**22 MB against 1736 kB — about 13×** for 200 000 rows. jsonb stores the key
names with every single row. `tag` costs the value; `"tag"` costs the value plus
the string `tag` plus the binary structure around it, 200 000 times.

That multiplier is on the table itself, so it lands on every sequential scan, on
the buffer cache, and on every backup.

## Query cost

```console
=== 4. jsonb key vs a plain column, same data ===
doc->>'tag' (expression index)      1.13 ms
tag         (column index)          0.71 ms
(doc->>'qty')::int > 45             40.3 ms
qty > 45                            20.5 ms
```

Two different stories in those four lines.

**Equality with an expression index is close** — 1.13 ms against 0.71 ms. If you
index the exact expression, jsonb equality is competitive. That is the good case.

**The range query is 2× slower and, more importantly, not indexed at all:**

```console
  plan for the jsonb range:
    ->  Parallel Seq Scan on jb_docs (actual rows=5333.33 loops=3)
    Filter: (((doc ->> 'qty'::text))::integer > 45)
    Rows Removed by Filter: 61333
```

A sequential scan discarding 61 333 rows per worker. The GIN index on `doc` cannot
serve a cast-and-compare expression, and the expression index built for
`doc->>'tag'` is on a different expression. To index this you would need a third
index on `((doc->>'qty')::int)` — and then a fourth for the next field, and a
fifth for the one after that.

**That is the real cost.** A column gets one index and serves equality, ranges,
sorting and index-only scans. A jsonb key needs a purpose-built expression index
per access pattern, or a GIN index that only serves containment.

## Constraints

```console
=== 5. constraints and types ===
NOT NULL on a jsonb key            → OK
a typed CHECK on a jsonb key       → OK
a FOREIGN KEY from a jsonb key     → 42601 syntax error at or near "("
```

Better than folklore suggests, and worse where it counts:

- **`CHECK (doc ? 'tag')` works** — you can require a key to exist.
- **`CHECK (((doc->>'qty')::int) BETWEEN 0 AND 49)` works** — you can enforce a
  typed range.
- **A foreign key cannot reference a jsonb key.** `42601` — it is not supported
  syntax. Referential integrity is the thing you cannot have.

So the honest statement is not "you lose constraints", it is: **you can enforce
shape and range with CHECK constraints, and you cannot enforce relationships at
all.** Any id stored inside a document is an id nothing verifies, which is how
documents accumulate references to rows that were deleted years ago.

There is a second cost to the CHECK approach: every constraint is written against
an expression, so the constraint is only as good as the expression's assumptions.
`((doc->>'qty')::int)` raises `22P02` rather than failing the check if a row
arrives with `"qty": "abc"` — a different error, at insert time, from a different
part of the system.

## Types

```console
1 vs "1" inside jsonb: { num: 'number', str: 'string', same_as_text: true }
```

A column has one type and the database enforces it. Inside a document,
`{"qty": 1}` and `{"qty": "1"}` both insert happily and render identically through
`->>`. The application is now responsible for a guarantee the database used to
make, and it will be responsible for it on rows written by last year's version of
the application.

## The decision

Put it in a **column** when any of these is true:

- you filter, sort or join on it;
- it must be non-null, unique, or reference another table;
- it has a fixed type you want enforced;
- it exists on essentially every row;
- it is large and updated often — every jsonb mutation rewrites the whole
  document, as [containment and mutation](./01-jsonb-operators/02-containment-and-jsonpath.md)
  covers.

Put it in **jsonb** when:

- the shape genuinely varies per row — per-tenant custom fields, a webhook
  payload, a third-party API response you store verbatim;
- you read it as a whole rather than querying inside it;
- it is genuinely optional and sparse, so a column would be mostly null;
- you need to keep the original document for audit or replay.

**The hybrid is usually right and is not a compromise.** Promote the two or three
keys you actually query to columns, keep the rest of the document as jsonb:

```sql
CREATE TABLE events (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type       text NOT NULL,                    -- always queried
  user_id    bigint NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  payload    jsonb NOT NULL                    -- the part that varies
);
```

A **generated column** gets you both without a write path change:

```sql
ALTER TABLE events ADD COLUMN type text
  GENERATED ALWAYS AS (payload->>'type') STORED;
CREATE INDEX ON events (type);
```

Stored, indexable, constrained, and derived from the document so it cannot drift.
This is the migration path when a jsonb key turns out to be queried after all —
you do not have to rewrite the write path first.

## Trade-off

The argument for jsonb is real: it absorbs change without a migration, and a
migration on a large table is a scheduling problem
([Phase 3 · ALTER TABLE](../phase-3-ddl/05-alter-table.md)). Teams reach for it
when requirements are moving, and that is a legitimate reason.

The cost is deferred rather than avoided. The schema still exists; it has just
moved into application code, where nothing enforces it and every version of the
app that ever ran has left rows shaped its own way. The bill arrives when you need
to query a key you did not plan to query — which requires a new index per pattern
— or when you need to clean up ten variants of the same field.

**The rule of thumb that survives contact with production:** if you can name the
field in a requirement, it is a column. If it belongs to a set you cannot
enumerate, it is jsonb.

## Gotchas

**Symptom:** The table is far larger than the data justifies
**Cause:** jsonb repeats every key name on every row. Measured: 22 MB against
1736 kB for the same two facts, ~13×.
**Fix:** Promote frequently-present keys to columns.

**Symptom:** A range filter on a jsonb key sequentially scans
**Cause:** Neither a GIN index nor an expression index on a different expression
can serve it. Measured: 40.3 ms, 61 333 rows removed by filter per worker.
**Fix:** An expression index on exactly `((doc->>'k')::int)`, a generated column,
or a real column.

**Symptom:** A document references a row that no longer exists
**Cause:** Foreign keys cannot reference a jsonb key — measured, `42601`.
**Fix:** The referencing id must be a column.

**Symptom:** `22P02 invalid input syntax for type integer` on insert
**Cause:** A CHECK constraint casting a jsonb key met a row where the key is a
string.
**Fix:** Validate at the edge, and constrain `jsonb_typeof` as well as the value.

**Symptom:** Comparisons behave inconsistently across rows
**Cause:** The same key holds a number in some rows and a string in others; `->>`
renders both identically.
**Fix:** A generated column with a type, or normalise the data.

**Symptom:** Updating a small field rewrites a large row
**Cause:** jsonb values are immutable; any mutation rewrites the whole document.
**Fix:** Split hot, small, frequently-updated fields into columns.

## Interview questions

**★ When should data go in a jsonb column rather than a real column?**
When the shape genuinely varies per row and you cannot enumerate the fields —
per-tenant custom attributes, third-party payloads stored verbatim. If you can
name the field in a requirement, and especially if you filter, sort or join on it,
it should be a column.

**★ What does jsonb cost in storage?**
Every key name is repeated on every row. Measured for the same two facts across
200 000 rows: 22 MB as jsonb against 1736 kB as columns, roughly 13×. That lands
on scans, the buffer cache and backups.

**★ Can you put constraints on jsonb?**
Partly. `CHECK (doc ? 'key')` and a typed `CHECK` on a cast expression both work —
measured, both were accepted. A **foreign key cannot reference a jsonb key** at
all (`42601`), so referential integrity is the guarantee you actually give up.

**★ Why is a range query on a jsonb key slow even with a GIN index?**
GIN indexes the document's structure and answers containment; it knows nothing
about the expression `(doc->>'qty')::int`. Measured: a parallel sequential scan
discarding 61 333 rows per worker. Each access pattern needs its own expression
index, whereas one column index serves equality, ranges and sorting.

**★ What is the hybrid design, and how do you migrate into it?**
Promote the two or three keys you query to columns and keep the rest as jsonb. To
migrate without touching the write path, add a `GENERATED ALWAYS AS
(payload->>'type') STORED` column and index that — it is derived from the document
so it cannot drift out of sync.

**Is jsonb equality always slower than a column?**
No — with an expression index on exactly that key it is close: measured 1.13 ms
against 0.71 ms. The gap is not in equality, it is in everything else — ranges,
sorting, joins, constraints and storage.

---

← [jsonb operators](./jsonb-operators/) · Next → [Indexing jsonb](03-index-jsonb.md)
