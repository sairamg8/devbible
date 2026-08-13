---
title: "Indexing jsonb"
sidebar_label: "03 · Indexing jsonb"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex44-jsonb-ops.mjs`.

**A GIN index on a jsonb column is not a general-purpose index — it serves one
family of operators and is invisible to the rest.** Choosing between the two GIN
opclasses and a plain expression index is the whole of this topic, and the sizes
involved make it a real decision.

Measured on 200 000 rows with 1000 distinct tags, 200 rows per tag.

## The baseline

```console
$ node ex44-jsonb-ops.mjs
-- no index --
@> containment       43.6 ms
->> equality         34.2 ms
```

## `jsonb_ops` — the default

```sql
CREATE INDEX jb_gin_default ON jb_docs USING gin (doc);
```

```console
-- GIN (default jsonb_ops) --
@> containment        4.5 ms
    ->  Bitmap Heap Scan on jb_docs (actual rows=200.00 loops=1)
    ->  Bitmap Index Scan on jb_gin_default (actual rows=200.00 loops=1)
    Index Cond: (doc @> '{"tag": "t42"}'::jsonb)
->> equality         35.4 ms
    ->  Parallel Seq Scan on jb_docs (actual rows=66.67 loops=3)
    Filter: ((doc ->> 'tag'::text) = 't42'::text)
    Rows Removed by Filter: 66600
? key exists         41.0 ms
```

Containment: **43.6 ms → 4.5 ms**, a proper `Index Cond`.

`->>` equality: **unchanged at 35.4 ms**, a parallel sequential scan. The index
exists and the query cannot use it. This is the single most common surprise with
jsonb — see
[containment and jsonpath](./01-jsonb-operators/02-containment-and-jsonpath.md)
for why.

`? key exists` at 41.0 ms is *supported* by this opclass but was not chosen here:
the key exists on every row, so the index offers no selectivity and a scan is
correctly cheaper. Support and usefulness are different things.

## `jsonb_path_ops` — smaller and faster, and narrower

```sql
CREATE INDEX jb_gin_pathops ON jb_docs USING gin (doc jsonb_path_ops);
```

```console
-- GIN (jsonb_path_ops) --
@> containment        1.1 ms
? key exists     → ->  Parallel Seq Scan on jb_docs
```

**Containment 4.5 ms → 1.1 ms, four times faster**, and the index is smaller. But
`?` now has no index at all — not "not chosen", *not supported*.

The difference is what gets stored. `jsonb_ops` indexes every key and every value
as separate entries, so it can answer "does this key exist". `jsonb_path_ops`
stores one hash per *path-plus-value*, which is fewer, smaller entries and a more
selective lookup for containment — and leaves nothing to match a bare key against.

## An expression index for one hot key

```sql
CREATE INDEX jb_expr_tag ON jb_docs ((doc->>'tag'));
```

```console
-- with an expression index on the one hot key --
->> equality          0.9 ms
    ->  Bitmap Index Scan on jb_expr_tag (actual rows=200.00 loops=1)
    Index Cond: ((doc ->> 'tag'::text) = 't42'::text)
```

**35.4 ms → 0.9 ms**, and now `->>` has an `Index Cond`. The expression index does
not index the document; it indexes one derived value, exactly like an index on a
column.

## The sizes, which decide it

```console
index sizes:
  jb_col_tag         1352 kB
  jb_docs_pkey       4408 kB
  jb_expr_tag        1352 kB
  jb_gin_default     17 MB
  jb_gin_pathops     13 MB
```

**17 MB against 1352 kB — the default GIN index is nearly 13× the expression
index**, and `jsonb_path_ops` at 13 MB is not much better. The expression index is
exactly the size of the equivalent column index, because it holds exactly the same
values.

That is the trade in one table:

| Index | Size | `@>` | `->>` = | `?` | Ranges on one key |
|---|---|---|---|---|---|
| GIN `jsonb_ops` | 17 MB | 4.5 ms | ✗ | ✓ | ✗ |
| GIN `jsonb_path_ops` | 13 MB | **1.1 ms** | ✗ | ✗ | ✗ |
| Expression `(doc->>'tag')` | **1352 kB** | ✗ | **0.9 ms** | ✗ | ✓ (that key) |

## Choosing

**One or two known hot keys → expression indexes.** Smallest, fastest, and they
serve ranges and sorting on that key. This is the common case and it is
under-used, because "index jsonb" makes people reach for GIN.

**Unpredictable keys, containment filters → `jsonb_path_ops`.** If users can
filter on arbitrary attributes and the filters are equality-shaped, one GIN index
covers all of them at a size you pay for once.

**You need `?`, `?|` or `?&` → `jsonb_ops`.** It is the only opclass that supports
existence.

**Both is legitimate.** A `jsonb_path_ops` index for the general case plus an
expression index on the two keys that carry your real traffic is a normal
production setup — you are paying 13 MB for flexibility and 1.3 MB for the hot
path.

### Matching the expression exactly

An expression index is only used for the *identical* expression:

```sql
CREATE INDEX ON jb_docs ((doc->>'qty'));         -- text
SELECT ... WHERE (doc->>'qty')::int > 45         -- ✗ different expression
CREATE INDEX ON jb_docs (((doc->>'qty')::int));  -- ✓ matches
```

The cast is part of the expression. This is why the range query in
[column vs JSON](02-column-vs-json.md) sequentially scanned despite an expression
index existing on the table — it was built on a different key *and* a different
type.

The expression must also be `IMMUTABLE`. `(doc->>'ts')::timestamptz` is not — the
result depends on the session time zone — and `CREATE INDEX` refuses it with
`42P17`. Cast to `timestamp` or store the value already normalised. The measured
version of that refusal is in
[Phase 10 · Expression indexes](../phase-10-indexes/10-expression.md).

## Write cost

Every index is maintained on write, and GIN is the most expensive kind: a single
document insert adds one entry per key and value. GIN mitigates this with a
pending list (`fastupdate`, on by default) that batches insertions, which makes
writes cheap and makes the *next read after a burst* pay to merge it — an
occasional slow query with no obvious cause.

For a write-heavy table, that is another argument for the expression index: one
entry per row instead of one per key.

## Trade-off

GIN buys you queries you have not designed yet. That is genuinely valuable when
users filter on arbitrary attributes and you cannot enumerate them in advance —
it is the reason to keep data in jsonb at all.

You pay for it in size (13–17 MB against 1.3 MB here), in write amplification, and
in a narrower operator set than it appears to offer — no ranges, no sorting, and
nothing for `->>`. An expression index is cheaper and faster and only answers the
question you built it for.

The decision is really: **do you know which keys get queried?** If yes, expression
indexes. If genuinely no, `jsonb_path_ops` and accept the size — and revisit,
because after a few months of production you usually do know.

## Gotchas

**Symptom:** A GIN index on jsonb does not speed up a filter
**Cause:** The filter uses `->>` and comparison, which GIN cannot serve. Measured:
35.4 ms with a parallel sequential scan despite the index.
**Fix:** Rewrite as `@>`, or add an expression index on that key.

**Symptom:** `?` stopped using the index after an index change
**Cause:** The index was recreated with `jsonb_path_ops`, which does not support
key existence. Measured: sequential scan.
**Fix:** Keep a `jsonb_ops` index if you need `?`, `?|` or `?&`.

**Symptom:** The jsonb index is larger than the table's other indexes combined
**Cause:** GIN stores an entry per key and value. Measured: 17 MB against 1352 kB
for an expression index on one key.
**Fix:** Use expression indexes on the keys you actually query.

**Symptom:** An expression index exists but is not used
**Cause:** The query's expression differs from the indexed one — usually a cast.
**Fix:** Index exactly `((doc->>'k')::int)` if that is what the query says.

**Symptom:** `42P17 functions in index expression must be marked IMMUTABLE`
**Cause:** The expression depends on session state, e.g. casting to `timestamptz`.
**Fix:** Use an immutable expression, or store the normalised value.

**Symptom:** An occasional slow query on a GIN-indexed table with no pattern
**Cause:** The GIN pending list being merged by whichever read happens to trigger
it.
**Fix:** Expected with `fastupdate`; `VACUUM` more often, or turn `fastupdate`
off to move the cost to writers.

## Interview questions

**★ What can a GIN index on a jsonb column actually serve?**
The containment and existence families — `@>`, `?`, `?|`, `?&`, and the jsonpath
predicates. Not `->>` comparisons, not ranges, not sorting. Measured: containment
went 43.6 ms → 4.5 ms while `->>` equality stayed at 35.4 ms with a parallel
sequential scan.

**★ What is the difference between `jsonb_ops` and `jsonb_path_ops`?**
`jsonb_ops` indexes every key and value separately, so it supports key existence.
`jsonb_path_ops` stores one hash per path-plus-value: smaller and more selective
for containment — measured 1.1 ms against 4.5 ms, and 13 MB against 17 MB — but it
cannot serve `?` at all.

**★ When would you use an expression index instead of GIN?**
When you know which keys are queried. Measured: an expression index on
`(doc->>'tag')` answered `->>` equality in 0.9 ms and occupied 1352 kB, against
17 MB for the GIN index that could not answer that query at all. It also serves
ranges and sorting on that key.

**★ Why did an expression index not get used?**
Because the query's expression differs from the indexed one — most often a cast.
An index on `(doc->>'qty')` does not serve `(doc->>'qty')::int > 45`; the cast is
part of the expression and the index must include it.

**Why must an index expression be `IMMUTABLE`?**
Because the stored value must not depend on anything outside the row — a
session-dependent cast like `timestamptz` would make entries wrong for other
sessions. PostgreSQL refuses with `42P17`.

**Is it reasonable to have both a GIN and an expression index on the same column?**
Yes, and it is a normal production setup: `jsonb_path_ops` for arbitrary
user-driven containment filters, plus expression indexes on the two or three keys
carrying real traffic. You pay the GIN size once for flexibility and very little
for the hot path.

---

← [When a column beats JSON](02-column-vs-json.md) · Next → [Building JSON in SQL](04-build-json-sql.md)
