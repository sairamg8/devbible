---
title: "The clever ways to avoid concatenating are safe, and most of them are slow"
sidebar_label: "7b · Dynamic SQL without concatenation"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the PostgreSQL 18 manual *Queries → Sorting Rows*
> (postgresql.org/docs/18/queries-order.html) and *SELECT*
> (postgresql.org/docs/18/sql-select.html), and the JDK 25 API for
> `java.sql.PreparedStatement`
> (docs.oracle.com/en/java/javase/25/docs/api/java.sql/). JDK 25, JDBC 4.3,
> PostgreSQL 18, pgjdbc 42.7.13.

**[The previous chunk](07-what-a-parameter-can-be.md) established that an
identifier cannot be a bound value, and that the answer is an allow-list. This one
is about the forms people reach for instead — a `CASE` expression that makes the
sort column a real parameter, a `(? IS NULL OR col = ?)` predicate for every
optional filter, a select list assembled at runtime. All three are genuinely safe:
no user string ever becomes SQL text. All three are also, in the usual case, a
performance trade you did not intend to make, because each one hands the planner a
statement that has to work for every case instead of the one you actually sent.
Rejecting them for the right reason matters, because "it is an injection risk" is
the wrong reason and gets the argument lost.**

## The parameterized sort that does work, and what it costs

There is a form that puts the sort choice in a bound value, and it is worth
knowing precisely so you can reject it for the right reason rather than the wrong
one:

```sql
SELECT id, display_name, email, created_at
FROM   customers
WHERE  tenant_id = ?
ORDER BY
  CASE WHEN ? = 'name'    THEN display_name END ASC,
  CASE WHEN ? = 'created' THEN created_at    END DESC
LIMIT ? OFFSET ?
```

It is safe — the sort key really is a bound value — and it is usually the wrong
answer, for a reason that has nothing to do with security. The ordering the query
now asks for is an ordering over a `CASE` *expression*, not over a column. An
ordinary b-tree index on `display_name` supplies an ordering for `ORDER BY
display_name`; it supplies nothing for `ORDER BY CASE WHEN … END`, so unless you
have built a matching expression index the server must materialise and sort the
rows itself. On a paged query with `LIMIT 20` over a large table, that is the
difference between reading twenty index entries and sorting the whole result set.
Check what your own plan does before adopting it.

There is a second cost that compounds it: one SQL text now serves every sort
order, so it crosses the prepare threshold quickly and gets **one generic plan
for all of them** ([chunk 10](10-the-generic-plan-cliff.md)) — and the plans for
"sort by name" and "sort by created" are genuinely different.

🔴 **The allow-list produces one SQL text per sort option, and that is a feature.**
Four sortable columns and two directions is eight statements, each of which the
planner can plan properly and the statement cache can hold.

## The optional filter, and why it is the same problem wearing different clothes

The other place people reach for cleverness is a search form where every field is
optional:

```sql
WHERE (? IS NULL OR status  = ?)
  AND (? IS NULL OR country = ?)
  AND (? IS NULL OR created_at >= ?)
```

Again: safe, parameterized, and quietly expensive. Every predicate is in the
statement whether or not it is used, so the planner must produce one plan that
copes with all combinations, and it cannot know at plan time which branches
collapse. The index it would have chosen for a country search is not obviously
useful for a plan that must also handle country being null.

The alternative is to build the `WHERE` clause from a **fixed set of predicate
fragments** — text you wrote, selected by which filters are present — and bind
only their values:

```java
var where = new ArrayList<String>();
var args  = new ArrayList<Object>();
where.add("tenant_id = ?");            args.add(tenantId);
if (status  != null) { where.add("status = ?");        args.add(status); }
if (country != null) { where.add("country = ?");       args.add(country); }
if (since   != null) { where.add("created_at >= ?");   args.add(since); }
String sql = "SELECT id, display_name FROM customers WHERE "
           + String.join(" AND ", where) + " ORDER BY created_at DESC LIMIT ?";
```

Every fragment is a literal in the source; only values are bound. The cost is
more distinct SQL texts — bounded by the number of filter *combinations*, which
is why you want few optional filters, and which interacts with the statement
cache limits in [chunk 9](09-server-side-prepared-statements.md).

## Dynamic projection

`SELECT ?` does not select a column; it returns the literal you bound, once per
row. Choosing *which columns come back* at runtime is the same allow-list problem
as sorting, with one extra wrinkle: the result-set shape changes, so the code
reading it has to be driven by
[`ResultSetMetaData`](12-resultset-the-cursor-model.md) rather than by fixed
column names. In practice, a fixed projection plus a mapper that omits fields is
almost always simpler than a dynamic one, and a GraphQL-style "only the fields I
asked for" requirement is better served by a small number of hand-written
projections than by assembling a select list from request input.

## The trade-off

Everything here trades **plan quality for text count**. The allow-list and the
fragment builder produce more distinct SQL texts — one per sort option, one per
filter combination — and each of those is a statement the planner plans properly
and the driver's statement cache has to hold. The clever forms produce exactly
one text, which is easy to cache and impossible to plan well.

That is a real trade and it has a threshold: with four sort options and three
optional filters, the fragment approach is obviously right. With a query builder
exposing forty optional predicates, the text count explodes past the driver's
cache ([chunk 9](09-server-side-prepared-statements.md)) and you are into
territory where a purpose-built search index, not SQL, is the answer.

## Gotchas

**⚠️ The `CASE`-expression sort adopted as the general solution**
**Symptom:** paged queries that were fast become slow as the table grows, with no
code change.
**Cause:** the ordering is over an expression, so an index on the column no longer
supplies it and the server sorts the whole result before applying `LIMIT`.
**Fix:** one SQL text per sort option, from the allow-list; keep the `CASE` form
for the rare case where the sort set is genuinely open-ended and the result set is
small.

**⚠️ `(? IS NULL OR col = ?)` for every optional filter**
**Symptom:** one plan that is mediocre for every search, and an index that never
seems to be used.
**Cause:** all predicates are present at plan time; the planner cannot specialise
for the combination actually supplied.
**Fix:** assemble the `WHERE` clause from fixed fragments and bind only values.

**⚠️ The same parameter bound three times to make an optional filter work**
**Symptom:** `setString(4, x)` calls that repeat the same value, and an
off-by-one when a filter is added.
**Cause:** `?` is positional, so `(? IS NULL OR col = ?)` genuinely needs the
value twice ([chunk 6](06-the-preparedstatement-api.md)).
**Fix:** named parameters via `NamedParameterJdbcTemplate` or `JdbcClient` if you
keep the idiom — or drop the idiom, which removes the duplication entirely.

**⚠️ Fragments and arguments drifting out of step**
**Symptom:** `ERROR: operator does not exist: text = integer`, or a filter that
silently matches the wrong column.
**Cause:** the `WHERE` fragments and the argument list are two parallel
collections held in step by convention alone; adding a fragment without adding
its argument shifts every position after it.
**Fix:** append to both in the same statement, as in the loop above — or use
named parameters (`JdbcClient`, `NamedParameterJdbcTemplate`), where the pairing
is structural rather than positional.

**⚠️ An empty fragment list**
**Symptom:** `syntax error at or near "ORDER"` when no filter is supplied.
**Cause:** `String.join(" AND ", where)` on an empty list produces an empty
string after `WHERE`.
**Fix:** seed the list with a predicate that is always present — the tenant or
owner check, which you want mandatory anyway — or emit `WHERE true` and let the
planner discard it.

**⚠️ Joining fragments with `OR`**
**Symptom:** a search that returns the whole table as soon as one filter is set.
**Cause:** a copy-paste from a different builder, or a "match any" feature that
was never scoped.
**Fix:** `AND` between distinct fields, `OR` only inside a single parenthesised
fragment you wrote as a unit.

**⚠️ An unbounded set of generated texts**
**Symptom:** server-side preparation that never engages and a statement cache
that thrashes ([chunk 9](09-server-side-prepared-statements.md)).
**Cause:** the builder can emit more distinct SQL strings than the driver caches
— easy once optional filters, sort options and page sizes multiply.
**Fix:** count the combinations your API can actually produce; if that number is
large, the shape is wrong for SQL text caching and belongs behind a search
service.

**⚠️ A dynamic select list read by fixed column index**
**Symptom:** `column index out of range`, or values landing in the wrong fields
when the caller asks for fewer columns.
**Cause:** the projection is runtime and the mapper is compile-time.
**Fix:** drive the mapper from `ResultSetMetaData`
([chunk 12](12-resultset-the-cursor-model.md)), or — far simpler — keep a fixed
projection and omit fields when serialising.

## Interview questions

**★ Is there any way to make the sort column a real bound parameter, and would
you use it?**
Yes — `ORDER BY CASE WHEN ? = 'name' THEN display_name END, CASE WHEN ? =
'created' THEN created_at END`. The sort choice is genuinely a bound value, so it
is safe. I would still normally reject it, and for a performance reason rather
than a security one: the query now orders by an expression, so an ordinary index
on the column cannot supply that ordering and the server has to sort the rows
itself — which on a `LIMIT 20` page over a large table turns twenty index reads
into a full sort. It also collapses every sort option into one SQL text, which
crosses the prepare threshold and then gets a single generic plan covering orders
whose best plans differ. The allow-list produces one statement per option, each
plannable and cacheable, and that is worth the small duplication.

**★ A search screen has six optional filters. How do you build the query?**
By assembling the `WHERE` clause from fixed predicate fragments — string literals
in my source, chosen by which filters are non-null — and binding only the values.
The tempting alternative, `(? IS NULL OR col = ?)` repeated six times, is safe
but produces one plan that has to cope with all sixty-four combinations, and the
planner cannot specialise it for the one you actually sent. The trade-off with
fragments is a larger number of distinct SQL texts, bounded by the number of
combinations used in practice, which matters because the driver's statement cache
is finite and per connection — so this is a reason to keep the number of optional
filters small, or to move a genuinely open-ended search to something built for it.

**★ How do you bound the number of distinct SQL texts a dynamic query
produces?**
By counting what the API can actually emit, not what the builder could. Sort
options times directions times filter combinations is a product, and it is easy
for a builder with eight optional filters to reach hundreds of texts while the
driver caches 256 per connection by default. Two practical controls: make filters
that are almost always present mandatory so they stop being a dimension, and
collapse near-equivalent variants — a page size bound to a small set rather than
free, `LIMIT ?` rather than a concatenated number. If the honest count is still
large, that is information: the workload is a search problem, and a purpose-built
index will serve it better than generated SQL either way.

**★ Would a query builder like jOOQ or JPA Criteria solve this?**
It solves the *safety* half structurally — identifiers come from generated code
or a metamodel, so there is no path from request input to SQL text, which is the
allow-list property enforced by the type system instead of by discipline. It does
not solve the planning half at all: a builder emits exactly the same
one-text-per-combination or one-text-for-everything trade, and it makes it easier
to emit hundreds of variants without noticing. So the value is real but narrow —
worth it where the dynamic surface is genuinely large and worth reasoning about
carefully; overkill where four sort columns and three filters would have been a
map and a list of fragments.

**★ Someone proposes `(? IS NULL OR col = ?)` because it keeps the SQL constant
and the code simple. What is your counter-argument?**
That the constant SQL is precisely the cost. One text means one entry in the
plan cache and one plan, and that plan has to be correct for every combination of
supplied and omitted filters — so the planner cannot choose the index that would
serve a country search, because the same plan must also handle country being
null. The developer-facing simplicity is real and I would weigh it: for a query
that runs rarely, or over a small table, the trade is fine and I would take it.
For anything on a hot path over a large table it is the wrong side of the trade,
and the fragment builder is not much more code once the argument list is built in
the same place as the fragment.

---
← Prev: [7 · What a parameter can be](07-what-a-parameter-can-be.md) · Index: [JDBC](README.md) · Next → [8 · `IN` lists and `LIKE`](08-in-lists-and-like-patterns.md)
