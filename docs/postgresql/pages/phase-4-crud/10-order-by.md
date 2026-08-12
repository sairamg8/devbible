---
title: "ORDER BY"
sidebar_label: "10 · ORDER BY"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4**, both `postgres:18-alpine` (musl,
> `127.0.0.1:55432`) and `postgres:18` (Debian/glibc, `127.0.0.1:55433`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex5-filter-sort.mjs`,
> `ex6-collation.mjs`.

**Without `ORDER BY` there is no row order — not "usually insertion order", none.
With `ORDER BY` on a non-unique column there is still no *total* order, which is
the same problem wearing a disguise.** Sorting also depends on collation, which
means the same query can order differently on your laptop and in production.

## There is no default order

A `SELECT` with no `ORDER BY` may return rows in any order, and the order can
change between runs of the *same* query — after a `VACUUM`, once the plan switches
to a parallel or index scan, or when a concurrent `UPDATE` moves a row to the end
of the heap. Code that relies on "they come back in the order I inserted them"
works until the table grows.

If order matters, say so. If it does not, leave `ORDER BY` off — it is not free.

## Ties: sorted is not the same as deterministic

`ORDER BY` on a column with duplicate values leaves the tied rows in an
unspecified order.

```console
$ node ex5-filter-sort.mjs
=== 10. ties + LIMIT/OFFSET without a tiebreaker ===
paging 0→100 by 5 without a tiebreaker: 54 distinct ids, 46 repeats
same, with ", id" as tiebreaker:        100 distinct ids, 0 repeats
```

30 000 rows, three distinct sort values, paged five at a time: **46 of 100 rows
came back twice** and the same number were never returned at all. The rule that
follows is short — **every `ORDER BY` used with `LIMIT` ends with a unique
column**, normally the primary key:

```sql
SELECT id FROM fs_tie ORDER BY grp, id LIMIT 5 OFFSET 50;
```

The full analysis, including why repeating a request will not reveal the bug, is in
[`list` with filtering, sorting and pagination](../phase-9-api-crud/list-endpoint).

## Where NULLs land

NULL is not a value, so it needs a rule. PostgreSQL's default is **`NULLS LAST` for
`ASC` and `NULLS FIRST` for `DESC`** — consistent if you think of NULL as sorting
higher than everything, surprising if you expected "empty things first".

```console
=== 8. where NULLs land ===
price ASC              → fig:5.00  apple:10.00  cherry:20.00  Elderberry:20.00  Banana:30.00  date:NULL
price DESC             → date:NULL  Banana:30.00  cherry:20.00  Elderberry:20.00  apple:10.00  fig:5.00
price ASC NULLS FIRST  → date:NULL  fig:5.00  apple:10.00  cherry:20.00  Elderberry:20.00  Banana:30.00
price DESC NULLS LAST  → Banana:30.00  cherry:20.00  Elderberry:20.00  apple:10.00  fig:5.00  date:NULL
```

The practical consequence: flipping a sort direction in the UI also moves every
NULL row from the bottom to the top. "Sort by price, cheapest first" puts
unpriced items last; clicking to reverse it puts them *first*, ahead of the most
expensive item. That is rarely what anyone wanted.

State it explicitly whenever NULLs are possible:

```sql
ORDER BY price DESC NULLS LAST, id
```

**Indexes carry this too.** A btree index records a null-ordering, and the planner
can only use it to satisfy an `ORDER BY` whose null placement matches. An index
built `(price)` — implicitly `ASC NULLS LAST` — cannot serve
`ORDER BY price DESC NULLS LAST`; you need `CREATE INDEX … ON t (price DESC NULLS LAST)`.
This is a common reason a sort still sorts in memory despite "having an index".

## Collation: the same query, two different orders

Text ordering is decided by the **collation**, and the collation comes from the
operating system's locale library unless you say otherwise. Same PostgreSQL
version, same declared collation, two different container images:

```console
$ node ex6-collation.mjs                      # postgres:18-alpine (musl)
{ datcollate: 'en_US.utf8', datctype: 'en_US.utf8', datlocprovider: 'c' }
default (database collation)       Banana, Date, apple, cherry, elderberry
COLLATE "C"                        Banana, Date, apple, cherry, elderberry
COLLATE "en_US.utf8"               42704 collation "en_US.utf8" for encoding "UTF8" does not exist
COLLATE "und-x-icu"                apple, Banana, cherry, Date, elderberry
lower(name)                        apple, Banana, cherry, Date, elderberry
```

```console
$ podman exec devbible-pg-glibc psql -U devbible -d devbible   # postgres:18 (Debian/glibc)
 datcollate |  datctype  | datlocprovider
------------+------------+----------------
 en_US.utf8 | en_US.utf8 | c

            default_collation
-----------------------------------------
 apple, Banana, cherry, Date, elderberry

               c_collation
-----------------------------------------
 Banana, Date, apple, cherry, elderberry

                  en_us
-----------------------------------------
 apple, Banana, cherry, Date, elderberry
```

Both databases report `datcollate = en_US.utf8` and provider `c`. They sort
differently:

- **glibc** applies real `en_US` rules — case-insensitive-ish dictionary order:
  `apple, Banana, cherry, Date, elderberry`.
- **musl** (Alpine) has near-stub locale support: it accepts the locale *name* and
  then sorts by byte value, so every uppercase letter sorts before every lowercase
  one — `Banana, Date, apple, …`. The collation object `en_US.utf8` does not even
  exist to be named explicitly (`42704`).

So a team developing against `postgres:18-alpine` and deploying to a glibc build
gets a different sort order in production, from identical SQL and an identically
declared database. It changes user-visible ordering, and it changes which rows a
range query (`WHERE name > 'M'`) returns.

Worse, a **libc upgrade can silently corrupt btree indexes on text columns**: the
index was built in the old collation's order, and the new one disagrees, so lookups
miss rows that are present. This is the reason `REINDEX` is required after some OS
upgrades, and the reason PostgreSQL tracks collation versions and warns about it.

### The fix: pin the collation

Do not inherit it from whatever image you happen to run. Two options:

```sql
-- ICU: same ordering everywhere, versioned by PostgreSQL rather than the OS
CREATE DATABASE app LOCALE_PROVIDER icu ICU_LOCALE 'en-US' TEMPLATE template0;

-- or per column, where only some columns need linguistic ordering
CREATE TABLE items (name text COLLATE "en-US-x-icu");
```

ICU collations ship with PostgreSQL (908 of them are present on this server), so
they are identical across base images. PostgreSQL 18 also offers the `builtin`
provider with `C.UTF-8` — fast, stable, byte-order semantics — which is the right
choice when you want determinism and are sorting identifiers rather than prose.

For case-insensitive ordering *and* comparison, a nondeterministic ICU collation
does both:

```console
=== a nondeterministic ICU collation (case-insensitive equality) ===
COLLATE ci                         apple, Banana, cherry, Date, elderberry
equality: { ci_equal: true, default_equal: false }
```

```sql
CREATE COLLATION ci (provider = icu, locale = 'und-u-ks-level2', deterministic = false);
```

`'Apple' = 'apple'` is **true** under it and false under the default. That makes it
a real alternative to `citext` for case-insensitive uniqueness — but
`deterministic = false` disables some optimisations and forbids pattern matching
(`LIKE`) on such columns, so apply it to the column that needs it, not the database.

The cheap portable alternative for ordering only is `ORDER BY lower(name)`, which
sorted correctly on both builds above. Index it as `CREATE INDEX … ON t (lower(name))`
or the sort will not use an index.

## Sorting by an expression, and by position

```sql
ORDER BY lower(name);                      -- expression: needs a matching index
ORDER BY price * quantity DESC;            -- computed
ORDER BY 2;                                -- the 2nd select-list column
ORDER BY CASE status WHEN 'urgent' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END, id;
```

`ORDER BY 2` is positional and brittle — inserting a column into the select list
silently changes the sort. Note it is also the source of a common confusion with
allowlists: a bare integer *literal* means "column N", but a bound parameter `$1`
does **not** — it sorts by a constant and silently does nothing. That trap is in
[Sort and filter allowlists](../phase-9-api-crud/allowlists/).

The `CASE` form is how you get a custom ordering (priority, workflow state) without
adding a sort-order column — readable at four values, unmaintainable at twenty, at
which point the order belongs in a lookup table.

## Trade-off

Sorting in the database is almost always right: it can use an index to avoid
sorting at all, and it must happen there anyway whenever `LIMIT` is involved —
sorting in JavaScript after a `LIMIT` reorders one page, not the result set.

The cost is that sorting is only free when an index provides the order. Otherwise
PostgreSQL sorts, and if the result exceeds `work_mem` it spills to disk — visible
in `EXPLAIN (ANALYZE)` as `Sort Method: external merge Disk: …`. That is the
signal to add a matching index, including matching direction and null placement, or
to reduce the rows before sorting.

## Gotchas

**Symptom:** Rows come back in a different order after a deploy, with no query change
**Cause:** No `ORDER BY`; the plan changed, so the arbitrary order changed.
**Fix:** Add an explicit `ORDER BY`. There is no default order.

**Symptom:** A row appears on two pages of a paginated list
**Cause:** `ORDER BY` on a non-unique column — ties have no defined order.
**Fix:** Append a unique column. Measured: 46 duplicates per 100 rows without it.

**Symptom:** Reversing the sort moves empty values to the top
**Cause:** The default is `NULLS LAST` for `ASC` and `NULLS FIRST` for `DESC`.
**Fix:** State `NULLS LAST`/`NULLS FIRST` explicitly.

**Symptom:** An index exists but `EXPLAIN` still shows a `Sort` node
**Cause:** The index's direction or null placement does not match the `ORDER BY`.
**Fix:** Build the index to match — `(price DESC NULLS LAST)` — or match the query
to the index.

**Symptom:** Sorting differs between local Docker and production
**Cause:** Different libc. musl (Alpine) sorts `en_US.utf8` by byte value; glibc
applies real dictionary rules. Measured on identical PostgreSQL 18.4 images.
**Fix:** Pin an ICU collation, or the `builtin` `C.UTF-8` provider, so ordering
does not depend on the base image.

**Symptom:** Index lookups miss rows that are definitely present, after an OS upgrade
**Cause:** The libc collation changed; the btree is ordered by the old rules.
**Fix:** `REINDEX` the affected text indexes. Use ICU to avoid the exposure.

**Symptom:** `42704 collation "en_US.utf8" for encoding "UTF8" does not exist`
**Cause:** Running on musl, which advertises the locale name without providing the
collation object.
**Fix:** Use an ICU collation name (`en-US-x-icu`) or `C`.

**Symptom:** `Sort Method: external merge Disk: 24000kB` in `EXPLAIN (ANALYZE)`
**Cause:** The sort exceeded `work_mem` and spilled to disk.
**Fix:** An index that provides the order, fewer rows before the sort, or more
`work_mem` for that statement.

## Interview questions

**★ Does a `SELECT` without `ORDER BY` have a defined order?**
No. Not insertion order, not primary-key order, not anything. It can change between
runs of the same query when the plan changes, after a `VACUUM`, or when an `UPDATE`
relocates a row. If order matters it must be stated.

**★ Why does a row show up on two pages of a paginated list?**
The sort is not total: `ORDER BY` on a non-unique column leaves ties unordered, and
the engine may order them differently at different offsets. Measured — 100 rows
paged five at a time returned 54 distinct rows and 46 duplicates; adding the primary
key as a tiebreaker made it 100 and 0.

**★ Where do NULLs sort, by default?**
`NULLS LAST` for `ASC`, `NULLS FIRST` for `DESC` — as though NULL were larger than
every value. The user-visible consequence is that reversing a sort moves all the
empty rows from the bottom to the top, so state the placement explicitly. Indexes
record null ordering too, so a mismatch prevents the index from serving the sort.

**★ Can the same query sort differently on two machines?**
Yes — text ordering comes from the collation, and by default that comes from the
OS locale library. Measured on identical PostgreSQL 18.4: the musl (Alpine) image
sorted `Banana, Date, apple…` by byte value while the glibc image sorted
`apple, Banana, cherry…`, both reporting `datcollate = en_US.utf8`. Pin an ICU
collation to make ordering a property of the database rather than the base image.

**★ Why can a libc upgrade corrupt an index?**
A btree on a text column is physically ordered by the collation in force when it
was built. If the OS collation rules change, the stored order no longer matches
what the engine expects, so searches can fail to find rows that are present. The
remedy is `REINDEX`; the prevention is ICU or `C`/`builtin` collations, which are
versioned by PostgreSQL.

**★ Should you sort in SQL or in JavaScript?**
In SQL. The database can often satisfy the order from an index and skip sorting
entirely, and any query with `LIMIT` *must* sort server-side — sorting the page in
JavaScript reorders the wrong twenty rows. Sort in JavaScript only for data already
fully in memory for other reasons.

**What does `Sort Method: external merge Disk` mean?**
The sort did not fit in `work_mem` and spilled to disk, which is typically an
order-of-magnitude slowdown. Fix it with an index matching the sort (including
direction and null placement), by filtering more rows before the sort, or by
raising `work_mem` for that statement.

---

← [Logical query processing order](09-logical-order.md) · Next → [DELETE](11-delete.md)
