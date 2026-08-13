---
title: "Arrays and strings"
sidebar_label: "01 · Arrays and strings"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex36-aggregation.mjs`,
> `sandbox/pg-api/ex36e-shaping.mjs`.

**`array_agg` and `string_agg` both collect a group into one value and disagree about
almost everything else — `NULL` handling, what an empty group returns, and what arrives
in JavaScript. The one thing they share is that neither guarantees an order unless you
put one inside the aggregate.**

## `string_agg`

```sql
SELECT string_agg(name, ', ' ORDER BY name) AS names FROM agg_customers;
```

```console
basic : [{"names":"Ann, Bob, Cid, Dee, Eve"}]
```

Two behaviours to know, and both were measured:

```console
NULLs are skipped : [{"rows":6,"non_null":3,"joined":"WELCOME|WELCOME|SPRING"}]
empty group       : [{"s":null}]
```

**`NULL`s are dropped, and no delimiter is emitted for them.** Six rows, three of them
`NULL`, and the result has two separators rather than five. That is almost always what
you want from a joined string, and it means the output length tells you nothing about
the row count.

**An empty group gives `NULL`, not `''`.** The same rule as `sum` — an aggregate over no
input is `NULL`. So `'Tags: ' || string_agg(tag, ', ')` on a row with no tags is `NULL`,
not `'Tags: '`, and the whole expression vanishes. Wrap it:

```sql
coalesce(string_agg(tag, ', '), '')
```

The delimiter is an ordinary expression, so newlines work with the `E''` escape form:

```console
a non-text delimiter : [{"lines":"10\n11\n12"}]
```

And the aggregate is `text`-only — there is no implicit cast:

```console
string_agg over a non-text column -> 42883 function string_agg(integer, unknown) does not exist
```

`42883` again, an *unknown function* error rather than a type error, because PostgreSQL
resolves the overload by argument type and finds none. Cast explicitly: `string_agg(id::text, ',')`.

## `array_agg`

```sql
SELECT array_agg(coupon ORDER BY id) AS with_nulls,
       array_length(array_agg(coupon), 1) AS len
FROM agg_orders;
```

```console
nulls are KEPT : [{"with_nulls":["WELCOME",null,"WELCOME",null,"SPRING",null],"len":6}]
  contrast with string_agg, which drops them
```

**Six elements, three of them `null`.** This is the opposite of `string_agg` on the same
column, and there is no principled reason you could have derived it — an array can hold
`NULL` and a string cannot, so each aggregate did the only thing available to it. Learn
it as a pair.

Two ways to drop them, both measured equivalent:

```console
array_remove / FILTER : [{"removed":["WELCOME","WELCOME","SPRING"],
                          "filtered":["WELCOME","WELCOME","SPRING"]}]
```

```sql
array_remove(array_agg(coupon), NULL)            -- build then clean
array_agg(coupon) FILTER (WHERE coupon IS NOT NULL)  -- never collect them
```

Prefer the `FILTER` form: it states the intent, and it generalises to a predicate more
interesting than `IS NOT NULL`. But note the difference at the extreme — if *every* value
is `NULL`, `array_remove` gives `{}` and `FILTER` gives `NULL`, because `FILTER` emptied
the group. That distinction is the whole of
[the empty-array trap](03-the-empty-array-trap.md).

### `DISTINCT` inside an aggregate

```sql
SELECT array_agg(DISTINCT status ORDER BY status) AS statuses FROM agg_orders;
```

```console
DISTINCT inside : [{"statuses":["cancelled","open","paid"]}]
```

With one restriction that is easy to trip over:

```console
DISTINCT with a different ORDER BY
  -> 42P10 in an aggregate with DISTINCT, ORDER BY expressions must appear in argument list
```

`array_agg(DISTINCT status ORDER BY id)` is rejected. Once you de-duplicate by `status`,
there is no single `id` left to order by — the request is incoherent, and PostgreSQL says
so rather than picking one. The `ORDER BY` inside a `DISTINCT` aggregate must be over the
same expressions being de-duplicated.

If you want "distinct statuses, ordered by first appearance", that is a different query:
de-duplicate in a subquery where you can keep `min(id)`, then aggregate.

## Ordering: the measurement that changes how you write these

Aggregates have no defined input order. Everyone knows this and most people assume
insertion order in practice. Here is what actually happens:

```console
=== E1. does an unordered array_agg follow insertion order? ===
alone, nothing else in the query : [{"unordered":["paid","open","paid","cancelled","paid","open"]}]
beside an ORDER BY aggregate     : [{"unordered":["open","paid","cancelled","paid","open","paid"],
                                     "ordered"  :["open","paid","cancelled","paid","open","paid"]}]
after an explicit sort           : [{"from_sorted_input":["open","paid","cancelled","paid","open","paid"]}]
```

Read the middle line carefully. **The same `array_agg(status)` returned a different order
in the second query than in the first** — and the order it returned was the one belonging
to its *sibling* aggregate, `array_agg(status ORDER BY id DESC)`.

The mechanism: when a query contains an aggregate with an internal `ORDER BY`, the
executor may sort the input once and feed every aggregate in the select list from that
same sorted stream. Your unordered aggregate silently inherits somebody else's ordering.

The consequence is stronger than "don't rely on insertion order". It is:

> **An `array_agg` with no `ORDER BY` can change its output when an unrelated column is
> added to the select list.** Nothing about your expression changed; the query around it
> did.

There is no incantation that makes the outer query's `ORDER BY` apply either — that
orders the *result rows*, not the aggregate's input. The only reliable form is the
`ORDER BY` inside the parentheses:

```sql
array_agg(sku ORDER BY sku)        -- deterministic
jsonb_agg(item ORDER BY item_id)   -- deterministic
string_agg(name, ', ' ORDER BY name)
```

Sorting the input in a subquery (`FROM (SELECT … ORDER BY id DESC) s`) happened to work
here, and it is not a guarantee either — the planner is free to re-order a subquery's
output unless the aggregate itself demands the order.

**Write the `ORDER BY` inside every collection aggregate whose order a consumer can
see.** It costs a sort the query may already be doing, and it is the difference between a
stable API response and one that reshuffles after an unrelated deploy.

## What the driver hands JavaScript

```console
what pg gives JS :
  ints    Array of number  [10,11]
  texts   Array of string  ["paid","open"]
  stamps  Array of object  ["2026-03-01T09:15:00.000Z","2026-03-03T14:40:00.000Z"]
```

**PostgreSQL arrays arrive as real JavaScript arrays**, with elements parsed by the same
type parsers as ordinary columns — `int4` becomes `number`, `text` becomes `string`,
`timestamptz` becomes a `Date` object (printed above as its ISO form). No `JSON.parse`,
no manual splitting of `{a,b,c}` text.

This is a genuine convenience and one asymmetry is worth flagging: `int8`/`bigint`
elements arrive as **strings**, exactly as scalar `bigint` does, so `array_agg(id)` over a
`bigserial` column gives `['1','2']` rather than `[1,2]`. Same fix as everywhere else —
cast in SQL or register a type parser.

Multidimensional arrays nest properly too:

```console
multidimensional : [{"pairs":[[10,100],[11,50],[12,200]]}]
```

`array_agg(ARRAY[id, total])` builds a 2-D array. It works, and it is a poor way to
return pairs to an API — the consumer has to remember that index 0 is the id. Use
`jsonb_agg(jsonb_build_object(...))` when the shape has names, which is
[the next chunk](02-json-shapes.md). PostgreSQL will also reject a 2-D `array_agg` if the
inner arrays have different lengths, which makes it fragile for anything variable.

## Trade-off

Collecting into an array keeps the query shape flat — one row per parent, children in a
column — and avoids both fan-out and a second round trip. The costs are that the whole
collection is materialised in memory for each group, so a parent with 100 000 children
builds a 100 000-element array before anything is returned; and that arrays lose their
names, so any consumer has to know the element order. For small, bounded child sets
`array_agg` is ideal; past that, paginate the children separately.

## Gotchas

**Symptom:** a joined string is `null` for rows with no items, so a whole concatenated
label disappears
**Cause:** `string_agg` over an empty group is `NULL`, and `NULL` propagates through `||`
**Fix:** `coalesce(string_agg(x, ', '), '')` — in SQL, before the concatenation

**Symptom:** `array_agg` output contains `null` elements but `string_agg` on the same
column does not
**Cause:** they genuinely differ — `array_agg` keeps `NULL`s, `string_agg` drops them
**Fix:** `array_agg(x) FILTER (WHERE x IS NOT NULL)` or `array_remove(array_agg(x), NULL)`.
They differ when *all* values are `NULL`: `NULL` versus `{}`

**Symptom:** the order of elements in an array changed after an unrelated column was
added to the select list
**Cause:** a sibling aggregate with an internal `ORDER BY` caused the executor to sort the
shared input, and the unordered aggregate inherited it. Measured
**Fix:** put `ORDER BY` inside every collection aggregate. The outer `ORDER BY` does not
reach the aggregate's input

**Symptom:** `42P10 in an aggregate with DISTINCT, ORDER BY expressions must appear in
argument list`
**Cause:** `array_agg(DISTINCT a ORDER BY b)` — after de-duplicating by `a` there is no
single `b`
**Fix:** order by the same expression, or de-duplicate in a subquery where you can keep
`min(b)`

**Symptom:** `42883 function string_agg(integer, unknown) does not exist`
**Cause:** `string_agg` takes `text`; there is no implicit cast from `integer`
**Fix:** `string_agg(id::text, ',')`

**Symptom:** `array_agg(id)` over a `bigserial` gives an array of strings
**Cause:** `bigint` elements use the same type parser as scalar `bigint`, which returns
text to avoid precision loss
**Fix:** cast in SQL, or register a parser for OID 20 at startup

## Interview questions

**★ Does `array_agg` keep `NULL`s? Does `string_agg`?**
`array_agg` keeps them as elements; `string_agg` drops them and emits no delimiter for
them. Measured on the same column: a 6-element array with three `null`s, versus
`"WELCOME|WELCOME|SPRING"`. An array can hold `NULL` and a string cannot, so each did the
only thing available.

**★ How do you guarantee the order of elements inside an aggregate?**
`ORDER BY` **inside** the parentheses — `array_agg(sku ORDER BY sku)`. The query's outer
`ORDER BY` orders result rows, not aggregate input. Measured: an unordered `array_agg`
returned a different order once a sibling aggregate with its own `ORDER BY` was added to
the select list, because the executor sorted the shared input.

**★ What does `string_agg` return for a group with no rows?**
`NULL`, not the empty string — the same rule as `sum`. It matters because `'Tags: ' ||
string_agg(…)` then becomes `NULL` entirely. Use `coalesce(string_agg(…), '')`.

**★ Why does `array_agg(DISTINCT a ORDER BY b)` fail?**
`42P10`. Once rows are de-duplicated by `a`, there is no single `b` to order by, so the
request is incoherent. The `ORDER BY` must use the same expressions as the `DISTINCT`.

**How do PostgreSQL arrays arrive in Node?**
As real JavaScript arrays, with elements parsed by the ordinary type parsers — `int4` to
`number`, `timestamptz` to `Date`. The exception is `bigint`, whose elements arrive as
strings for the same precision reason as scalars.

**When would you not use `array_agg` for a parent's children?**
When the child set is unbounded. The whole collection is materialised per group before
anything is returned, so a parent with 100 000 children builds a 100 000-element value.
Paginate the children in a separate query instead.

---

← [Topic index](README.md) · Next → [JSON shapes](02-json-shapes.md)
