---
title: "JSON shapes"
sidebar_label: "02 · JSON shapes"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex36e-shaping.mjs`.

**Four constructors cover everything: `jsonb_build_object` names fields explicitly,
`to_jsonb` converts a whole row, `jsonb_agg` collects rows into an array, and
`jsonb_object_agg` turns rows into a keyed map. Combining them is how a query returns a
response instead of a result set.**

## `jsonb_build_object` — the one you will use most

```sql
SELECT jsonb_build_object('id', id, 'status', status) AS o
FROM agg_orders ORDER BY id LIMIT 2;
```

```console
jsonb_build_object : [{"o":{"id":10,"status":"paid"}},{"o":{"id":11,"status":"open"}}]
```

Alternating key, value, key, value. Keys are literals, values are any expression. It is
verbose, and the verbosity is the feature: **the API contract is written out in the
query**, so adding a column to the table cannot change the response shape.

## `to_jsonb` — the whole row, including what you did not want

```sql
SELECT to_jsonb(o) AS o FROM agg_orders o ORDER BY id LIMIT 1;
```

```console
to_jsonb of a row : [{"o":{"id":10,"total":100,"coupon":"WELCOME","status":"paid",
                           "placed_at":"2026-03-01T09:15:00+00:00","customer_id":1}}]
```

Every column, named by its column name. Convenient, and a standing hazard: the day
someone adds `internal_notes` or `password_reset_token` to that table, it appears in the
API response. **Never point `to_jsonb` at a table whose columns you do not control.**

The safe form names the columns in a subquery, which also lets you rename them:

```sql
SELECT to_jsonb(x) AS o FROM (SELECT id, status FROM agg_orders ORDER BY id LIMIT 1) x;
```

```console
to_jsonb of a subset : [{"o":{"id":10,"status":"paid"}}]
```

At that point it is equivalent to `jsonb_build_object` with less typing and no
alternating-argument mistakes — a reasonable trade when the field names match the column
names. Note also what happened to the timestamp: inside JSON it is the **string**
`"2026-03-01T09:15:00+00:00"`, not a `Date`. Types collapse to JSON's four scalars on the
way in, so a `numeric` becomes a JSON number and precision beyond a double is at risk.
Cast money to text before embedding it.

## `jsonb_object_agg` — rows into a map

```sql
SELECT jsonb_object_agg(status, n) AS by_status
FROM (SELECT status, count(*)::int AS n FROM agg_orders GROUP BY status) s;
```

```console
jsonb_object_agg : [{"by_status":{"open":2,"paid":3,"cancelled":1}}]
```

One object, one key per group — often exactly the shape a chart component wants, and it
saves the client building a `Map` from an array. Two failure modes, both measured:

```console
jsonb_object_agg with a NULL key       -> 22023 field name must not be null
jsonb_object_agg with duplicate keys   ok  {"open":15,"paid":14,"cancelled":13}
  ^ duplicates: last one wins, silently
```

**A `NULL` key is a runtime error**, `22023 invalid_parameter_value`. It fires only when
such a row exists, so a query that works for months breaks the first time the grouping
column is `NULL`. Guard it: `jsonb_object_agg(coalesce(k, '(none)'), v)`, or filter the
row out deliberately.

**Duplicate keys are silent.** Feeding it un-grouped rows keeps the last value and
discards the rest, with no error and no warning — which is why the example above
aggregates a subquery that has already grouped. If the input is not guaranteed unique per
key, `jsonb_object_agg` will quietly lose data.

## `json` versus `jsonb`

The difference is invisible from Node unless you go looking, which is why it is worth
seeing once. Cast both to `text` so the server's own storage is what comes back:

```console
as TEXT from the server (what PG actually stores):
  json ::text  : "{\"a\":1,\"a\":2}"
  jsonb ::text : "{\"a\": 2}"
  json ws      : "{\"b\":1,   \"a\":2}"
  jsonb ws     : "{\"a\": 2, \"b\": 1}"
```

`json` stores **the text you gave it, verbatim** — duplicate keys preserved, whitespace
preserved, key order preserved. `jsonb` stores a parsed binary form — duplicates
collapsed to the last, whitespace gone, keys reordered (by length then bytewise, not
alphabetically, though it looks alphabetical in small examples).

And what the driver does with each:

```console
parsed by the pg driver into JS:
   { j: { a: 2 }, jb: { a: 2 } }   <- the duplicate is gone in BOTH
```

**Both arrive identical**, because `pg` runs `JSON.parse` on the `json` value and
JavaScript object literals cannot hold a duplicate key either. So the one thing `json`
preserves and `jsonb` does not is the thing you cannot observe from Node — an argument
for `jsonb` being the default that has nothing to do with performance.

The real reasons to choose:

| | `json` | `jsonb` |
|---|---|---|
| Storage | the original text | parsed binary |
| Size (`{"a":1,"b":2,"c":3}`) | **23 bytes** | **60 bytes** |
| Insert cost | cheap — no parse | parse on write |
| Read/key access | re-parse every time | direct |
| Indexable (GIN) | no | **yes** |
| Operators (`@>`, `?`, `->`) | limited | full set |

**`jsonb` is 2.6× larger here**, which is worth knowing and rarely decisive at that
absolute size. Use `jsonb` unless you specifically need byte-for-byte fidelity of an
incoming document — an audit log of exactly what a partner sent, for example, where
whitespace and key order are evidence.

For *output* — the case this topic is about — the choice barely matters, since the value
is built and immediately serialised. `jsonb_agg` is the conventional spelling and this
corpus uses it throughout. Full treatment of the type, its operators and its indexes:
[jsonb](../../phase-2-types/08-jsonb.md).

### `jsonb_agg` and what reaches JavaScript

```console
  what pg hands JS:
    jb   object  array [10,11,12,13,14,15]
    js   object  array [10,11,12,13,14,15]
    str  string   "10,11,12,13,14,15"
    arr  object  array [10,11,12,13,14,15]
```

`jsonb_agg`, `json_agg` and `array_agg` all arrive as real JavaScript arrays; only
`string_agg` gives a string. There is **no `JSON.parse` to write** — `pg` has already done
it, and calling `JSON.parse` on the result throws, because it is an object rather than a
string. That is a common first mistake when moving a query from `psql` to Node.

## Ordering inside JSON aggregates

Everything from [arrays and strings](01-arrays-and-strings.md) applies unchanged:

```sql
jsonb_agg(jsonb_build_object('sku', i.sku, 'qty', i.qty) ORDER BY i.sku)
```

**Put the `ORDER BY` inside.** A JSON array's element order is meaningful to every
consumer, and without it the order can change when an unrelated aggregate is added to the
select list — measured on the previous chunk.

## Trade-off

Building the response in SQL removes a round trip and a stitching loop, and moves your
API's shape into a string that no TypeScript type checks. A renamed key is a runtime
break that the compiler cannot see, and the query is now the schema. Two mitigations
worth the effort: validate the shape at the boundary with the same parser you would use
for an external input, and keep the `jsonb_build_object` calls in one place per resource
rather than spread across handlers.

## Gotchas

**Symptom:** an internal column appears in an API response after an unrelated migration
**Cause:** `to_jsonb(t)` emits every column of `t`, including ones added later
**Fix:** `to_jsonb` over a subquery that names the columns, or `jsonb_build_object`. Never
point it at a whole table you do not control

**Symptom:** `22023 field name must not be null`
**Cause:** `jsonb_object_agg` received a `NULL` key — it fires only when such a row exists
**Fix:** `coalesce(key, '(none)')`, or exclude those rows with `FILTER`

**Symptom:** a keyed JSON object is missing entries that are definitely in the table
**Cause:** duplicate keys in `jsonb_object_agg` — last one wins, silently
**Fix:** aggregate over an already-grouped subquery, so keys are unique by construction

**Symptom:** `JSON.parse(rows[0].payload)` throws "unexpected token o"
**Cause:** `pg` already parsed it; the value is an object, and `JSON.parse` stringified it
to `[object Object]` first
**Fix:** use it directly. `json` and `jsonb` both arrive as JS values

**Symptom:** a money value loses precision after passing through `jsonb`
**Cause:** JSON has one numeric type; a `numeric` is emitted as a JSON number and parsed
into a double by `JSON.parse`
**Fix:** cast to `text` before embedding: `'amount', total::text`

**Symptom:** duplicate keys survive in one column and not another
**Cause:** `json` keeps the source text verbatim; `jsonb` collapses to the last value
**Fix:** use `jsonb` unless you need byte-fidelity of the original document. Note the
difference is invisible from Node, since `JSON.parse` collapses duplicates too

## Interview questions

**★ `json` or `jsonb` — how do you choose?**
`jsonb` by default: it is indexable with GIN, supports the containment and key operators,
and does not re-parse on every read. `json` only when byte-for-byte fidelity of the
original document matters — an audit record of exactly what arrived. `jsonb` costs more
storage (measured 60 bytes against 23 for the same small object) and a parse on write.

**★ What does `jsonb` do that `json` does not, to the value itself?**
Collapses duplicate keys to the last, discards whitespace, and reorders keys. Measured:
`'{"a":1,"a":2}'` stored as `{"a":1,"a":2}` in `json` and `{"a": 2}` in `jsonb`. Notably,
that difference is **invisible from Node** — `JSON.parse` collapses duplicates too.

**★ Why is `to_jsonb(row)` risky in an API?**
It emits every column, including ones added by a later migration — so an internal or
sensitive field can appear in a response without anyone editing the endpoint. Use
`jsonb_build_object`, or `to_jsonb` over a subquery that names the columns.

**★ What happens when `jsonb_object_agg` sees a duplicate key? A `NULL` key?**
A duplicate key silently keeps the last value — no error, data quietly lost. A `NULL` key
raises `22023 field name must not be null` at runtime, the first time such a row exists.
Aggregate over pre-grouped input and `coalesce` the key.

**Do you need to `JSON.parse` a `jsonb` column in Node?**
No — `pg` parses it for you, for both `json` and `jsonb`. Calling `JSON.parse` on the
result throws. Only `string_agg` returns an actual string.

**How do you keep the element order of a `jsonb_agg` stable?**
`ORDER BY` inside the aggregate. The outer query's `ORDER BY` does not reach the
aggregate's input, and an unordered aggregate can inherit a sibling aggregate's sort —
so its output can change when an unrelated column joins the select list.

---

← [Arrays and strings](01-arrays-and-strings.md) · Next → [The empty-array trap](03-the-empty-array-trap.md)
