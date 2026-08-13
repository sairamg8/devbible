---
title: "Accessors and paths"
sidebar_label: "01 · Accessors and paths"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex44-jsonb-ops.mjs`.

**`->` returns jsonb, `->>` returns text, and that single character decides
whether the result can be chained, compared or cast.** Everything else about
reading a document follows from it.

## The accessors

Against this document:

```json
{"sku":"a1","qty":3,"tags":["new","sale"],
 "dims":{"w":10,"h":20},"discount":null}
```

```console
$ node ex44-jsonb-ops.mjs
=== 1. the operator set ===
-> 'dims'      (object, returns jsonb) → {"h": 20, "w": 10}
->> 'sku'      (text)                  → a1
-> 'tags' -> 0 (array element)         → "new"
->> 'tags'     (whole array as text)   → ["new", "sale"]
#> '{dims,w}'  (path, jsonb)           → 10
#>> '{dims,w}' (path, text)            → 10
```

| Operator | Right operand | Returns |
|---|---|---|
| `->` | key (text) or array index (int) | **jsonb** |
| `->>` | key (text) or array index (int) | **text** |
| `#>` | path as `text[]` | **jsonb** |
| `#>>` | path as `text[]` | **text** |

Read the fourth line carefully. `-> 'tags' -> 0` gives `"new"` — the first
*element*. `->> 'tags'` gives `["new", "sale"]` — the whole array rendered as
text, which is almost never what you wanted. The difference is one character.

## Why the return type decides everything

**`->` chains, `->>` terminates.** `->` gives you jsonb, so another operator can
be applied to it; `->>` gives text, and text has no jsonb operators.

```sql
doc -> 'dims' ->> 'w'        -- ✅ dig in with ->, extract with ->>
doc ->> 'dims' -> 'w'        -- ❌ operator does not exist: text -> unknown
```

The rule that follows: **use `->` for every step except the last, and `->>` for
the last one.** Or skip the chain entirely with a path:

```sql
doc #>> '{dims,w}'           -- same result, one operator
```

`#>>` is worth preferring when the path is fixed and more than two levels deep:
it is one operator instead of three, and the path can be built as an array in
application code.

### Comparisons need text, and then a cast

```sql
WHERE doc ->> 'qty' = '3'          -- text comparison, works
WHERE doc -> 'qty' = '3'           -- ❌ jsonb vs text
WHERE doc -> 'qty' = '3'::jsonb    -- ✅ jsonb comparison, also works
WHERE (doc ->> 'qty')::int > 2     -- numeric comparison, needs the cast
```

That last line is the one that appears in real queries, and it is the one that
costs you an index — see [Indexing jsonb](../03-index-jsonb.md). A cast on the
left-hand side means a plain index on the expression `doc->>'qty'` cannot serve
it; the index has to be on `((doc->>'qty')::int)`.

## The null trap

This is the part that produces wrong results rather than errors:

```console
=== 2. missing key vs JSON null vs SQL NULL ===
{
  json_null_is_sqlnull: true,
  json_null_arrow: 'null',
  key_exists_when_null: true,
  missing_is_sqlnull: true,
  key_exists_when_missing: false,
  contains_null: true
}
↑ ->> gives SQL NULL for BOTH a missing key and a JSON null.
  Only ? (or -> returning the text "null") tells them apart.
```

Three distinct states collapse into one:

| Document | `doc ->> 'a'` | `doc -> 'a'` | `doc ? 'a'` |
|---|---|---|---|
| `{"a": null}` | SQL `NULL` | jsonb `null` | `true` |
| `{}` | SQL `NULL` | SQL `NULL` | `false` |

**`->>` cannot distinguish "the key is absent" from "the key is present and
null".** For a `PATCH` endpoint that is exactly the distinction that matters —
the same ambiguity as [partial updates](../../phase-9-api-crud/08-update-partial.md),
now inside the document.

Two ways to tell them apart, and they answer different questions:

```sql
doc ? 'a'                          -- is the key present at all?
jsonb_typeof(doc -> 'a') = 'null'  -- is it present and JSON null?
```

`jsonb_typeof` is also how you recover the type information that `->>` throws
away:

```console
1 vs "1" inside jsonb: { num: 'number', str: 'string', same_as_text: true }
↑ ->> flattens both to the text "1" — the distinction survives only via jsonb_typeof
```

**`{"a":1}` and `{"a":"1"}` are different documents that `->>` renders
identically.** A filter written as `doc->>'a' = '1'` matches both. If the
distinction matters — and for anything that later gets cast, it does — compare as
jsonb (`doc->'a' = '1'::jsonb`) or check `jsonb_typeof`.

## Array elements

```sql
doc -> 'tags' -> 0            -- first element, as jsonb
doc -> 'tags' ->> 0           -- first element, as text
doc #> '{tags,0}'             -- same, by path
doc -> 'tags' -> -1           -- last element (negative indexes count back)
jsonb_array_length(doc -> 'tags')
```

Indexes are **0-based**, unlike SQL arrays, which are 1-based. A document
containing an array and a table column of type `text[]` therefore disagree about
what element 1 is, which is a genuine source of off-by-one bugs when data moves
between the two.

To turn an array into rows, `jsonb_array_elements` (jsonb) or
`jsonb_array_elements_text` (text) — covered in
[Set-returning functions](../10-srf.md).

## Trade-off

The accessor operators are terse, and terseness is the problem: `->` and `->>`
differ by one character and by their entire type, and the wrong one usually
produces a working query with wrong results rather than an error. `#>>` with an
explicit path is more verbose and much harder to misread, and it survives being
built programmatically.

Against that, the arrow form is what every example and every code review is
written in, so it is the one your team reads fluently. The position worth taking:
arrows for one level, `#>>` for anything deeper, and never mix the two families
in one expression.

## Gotchas

**Symptom:** `operator does not exist: text -> unknown`
**Cause:** `->>` used mid-chain; it returns text, which has no jsonb operators.
**Fix:** `->` for every step but the last.

**Symptom:** A filter on a JSON array returns nothing
**Cause:** `doc ->> 'tags'` renders the whole array as the text `["new", "sale"]`
rather than giving elements.
**Fix:** `doc -> 'tags' -> 0` for an element, `@>` to test membership, or
`jsonb_array_elements` to expand.

**Symptom:** A "missing field" check also matches fields explicitly set to null
**Cause:** `->>` returns SQL `NULL` for both. Measured: both cases gave `NULL`.
**Fix:** `doc ? 'key'` for presence; `jsonb_typeof(doc->'key') = 'null'` for an
explicit null.

**Symptom:** `doc->>'a' = '1'` matches documents storing the number and the string
**Cause:** `->>` renders both as the text `1`. Measured: `jsonb_typeof` gave
`number` and `string`, and the text comparison was `true`.
**Fix:** Compare as jsonb, or check `jsonb_typeof`.

**Symptom:** An off-by-one moving between a jsonb array and a `text[]` column
**Cause:** jsonb arrays are 0-based, SQL arrays are 1-based.
**Fix:** Convert deliberately at the boundary.

**Symptom:** `(doc->>'qty')::int > 2` does not use the expression index
**Cause:** The index is on `(doc->>'qty')` (text), the query on
`((doc->>'qty')::int)`.
**Fix:** Index the same expression the query uses, cast included.

## Interview questions

**★ What is the difference between `->` and `->>`?**
`->` returns jsonb, `->>` returns text. That means `->` can be chained into
another jsonb operator and `->>` cannot, and that `->>` is what you need before
comparing to a string or casting. Use `->` for every step of a path except the
last.

**★ How do you tell a missing key from a key set to JSON `null`?**
Not with `->>` — measured, both return SQL `NULL`. Use `doc ? 'key'`, which is
`true` only when the key is present, or `jsonb_typeof(doc -> 'key') = 'null'` for
an explicit null.

**★ What does `doc ->> 'tags'` give you for an array field?**
The entire array rendered as text — `["new", "sale"]` — not an element. To reach
elements use `doc -> 'tags' -> 0`, `@>` for membership, or `jsonb_array_elements`
to expand it into rows.

**★ Are `{"a":1}` and `{"a":"1"}` the same document?**
No, and `jsonb_typeof` reports `number` and `string` — but `->>` renders both as
the text `1`, so a text comparison matches both. Compare as jsonb if the
distinction matters.

**When would you use `#>>` instead of chained arrows?**
When the path is fixed and more than about two levels deep, or when it is built
programmatically: `#>>` takes a `text[]`, so the path can be a parameter, and one
operator is harder to misread than three alternating ones.

---

← [Topic index](README.md) · Next → [Containment and jsonpath](02-containment-and-jsonpath.md)
