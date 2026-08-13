---
title: "Containment and jsonpath"
sidebar_label: "02 · Containment and jsonpath"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex44-jsonb-ops.mjs`.

**`@>` asks "does this document contain that structure" and a GIN index can
answer it. `->> = ` asks the same question in a way no GIN index can serve.**
That is the single most consequential fact about querying jsonb.

## The predicates

```console
$ node ex44-jsonb-ops.mjs
=== 1. the operator set ===
@> '{"qty":3}' (contains)              → true
<@ (is contained by)                   → true
? 'sku'        (key exists)            → true
? 'discount'   (key exists, value null) → true
?| array['x','sku'] (any key)          → true
?& array['sku','qty'] (all keys)       → true
@? '$.dims.w ? (@ > 5)' (path exists)  → true
@@ '$.qty == 3' (path predicate)       → true
```

| Operator | Asks | Indexable by GIN |
|---|---|---|
| `@>` | does the left contain the right? | **yes** (both opclasses) |
| `<@` | is the left contained by the right? | no — the right side varies |
| `?` | does this key exist? | **yes** (`jsonb_ops` only) |
| `?\|` | does any of these keys exist? | **yes** (`jsonb_ops` only) |
| `?&` | do all of these keys exist? | **yes** (`jsonb_ops` only) |
| `@?` | does this jsonpath match anything? | **yes** (both opclasses) |
| `@@` | does this jsonpath predicate hold? | **yes** (both opclasses) |

The measured consequences of that column are in
[Indexing jsonb](../03-index-jsonb.md); the summary is that `jsonb_path_ops` is
smaller and faster for `@>` but **cannot serve `?` at all**.

## Containment is structural, not equality

`@>` tests whether the right-hand document appears *inside* the left, at any
depth from the top:

```sql
'{"a":1,"b":2}'::jsonb @> '{"a":1}'              -- true, subset of keys
'{"tags":["new","sale"]}'::jsonb @> '{"tags":["sale"]}'  -- true, array containment
'{"d":{"w":10,"h":20}}'::jsonb @> '{"d":{"w":10}}'       -- true, nested subset
'{"a":1}'::jsonb @> '{"a":1,"b":2}'              -- false, right is bigger
```

Two properties that surprise people:

- **Array containment ignores order and duplicates.** `["a","b"]` contains
  `["b"]` and contains `["b","a"]`.
- **Containment is not the same as key existence.** `@> '{"a":null}'` matched a
  document with an explicit null — measured, `contains_null: true` — while a
  document missing `a` entirely does not match.

The one real trap: **`@>` does not descend into arrays of objects the way people
expect for scalars.** `'{"t":[1,2]}' @> '{"t":1}'` is true (a special case for
scalar-in-array), but for objects you must supply the array wrapper:
`'{"t":[{"x":1}]}' @> '{"t":[{"x":1}]}'`.

## Why `@>` and not `->>`

These two look equivalent:

```sql
WHERE doc @> '{"tag":"t42"}'      -- containment
WHERE doc ->> 'tag' = 't42'       -- accessor plus comparison
```

They return the same rows. With a GIN index on `doc`, they do not perform
remotely the same:

```console
-- GIN (default jsonb_ops) --
@> containment        4.5 ms
    ->  Bitmap Index Scan on jb_gin_default (actual rows=200.00 loops=1)
    Index Cond: (doc @> '{"tag": "t42"}'::jsonb)
->> equality         35.4 ms
    ->  Parallel Seq Scan on jb_docs (actual rows=66.67 loops=3)
    Filter: ((doc ->> 'tag'::text) = 't42'::text)
    Rows Removed by Filter: 66600
```

**`Index Cond` against `Filter` again.** A GIN index on a jsonb column indexes the
document's structure — its keys and values — so it can answer "which rows contain
this fragment". It knows nothing about the *expression* `doc->>'tag'`, so that
query gets a sequential scan and a filter, discarding 66 600 rows per worker.

The rule: **write filters as containment when you want the GIN index to serve
them.** If you need `->>` — because you are comparing ranges, or casting — then a
GIN index is the wrong tool and you want an expression index instead.

## jsonpath, for what containment cannot express

`@>` can only test for a fixed fragment. Anything with a comparison needs
jsonpath:

```sql
doc @? '$.dims.w ? (@ > 5)'       -- does any match exist?
doc @@ '$.qty == 3'               -- does the predicate hold?
jsonb_path_query_array(doc, '$.tags[*]')
```

```console
jsonb_path_query_array $.tags[*]       → ["new", "sale"]
```

The distinction between `@?` and `@@`: `@?` asks whether the path *matches
anything*, `@@` evaluates a path expression that is itself a predicate and returns
its boolean. In practice `@?` with a `? (@ ...)` filter is the form that reads
best and the one that GIN can serve.

jsonpath also handles the array-of-objects case that containment cannot:

```sql
doc @? '$.items[*] ? (@.price > 100)'   -- any item over 100
```

There is no `@>` fragment that expresses "greater than". This is the point at
which people conclude the data should have been a table — see
[When a column beats JSON](../02-column-vs-json.md).

## Mutation

```console
|| (shallow merge)   → {"qty": 9, "sku": "a1", "dims": {"h": 20, "w": 10}, ...}
- 'tags'  (remove key) → {"qty": 3, "sku": "a1", "dims": {...}, "discount": null}
#- '{dims,w}' (remove path) → {"qty": 3, "sku": "a1", "dims": {"h": 20}, ...}
```

| Operator | Does |
|---|---|
| `\|\|` | **shallow** merge — right wins on conflicts |
| `-` (text) | remove a key |
| `-` (int) | remove an array element by index |
| `#-` | remove by path |
| `jsonb_set(doc, path, value)` | replace at a path |
| `jsonb_insert(doc, path, value)` | insert without replacing |

**`||` is shallow.** Merging `{"d":{"w":1}}` with `{"d":{"h":2}}` gives
`{"d":{"h":2}}` — the whole `d` object is replaced, not merged. For a nested
update use `jsonb_set(doc, '{d,h}', '2')`. There is no deep-merge operator; it is
a recursive function you write yourself, or a job for the application.

Note also that every one of these produces a **new document**, so an `UPDATE`
rewrites the whole column. On a large document that is a large write for a small
change, which is one of the real costs in
[the column-versus-document decision](../02-column-vs-json.md).

## Trade-off

Containment gives you indexable queries at the cost of expressiveness: you can
ask "does it contain this exact fragment" and nothing else. jsonpath gives you
expressiveness — comparisons, filters, wildcards — and is harder to read, harder
to parameterize safely, and its index support is narrower than it looks in the
docs.

The practical split: **`@>` for the filters your API actually exposes**, because
those are the ones that need to be fast and are usually equality on a known key;
jsonpath for the occasional analytical question; and a real column for anything
that turns out to be neither.

## Gotchas

**Symptom:** A jsonb filter does a sequential scan despite a GIN index
**Cause:** The filter is written as `doc->>'k' = 'v'`, which GIN cannot serve.
Measured: 35.4 ms and 66 600 rows removed by filter, versus 4.5 ms for the
containment form.
**Fix:** Rewrite as `doc @> '{"k":"v"}'`, or add an expression index.

**Symptom:** `?` does not use the GIN index
**Cause:** The index was created with `jsonb_path_ops`, which does not support key
existence. Measured: a parallel sequential scan.
**Fix:** Use the default `jsonb_ops` opclass if you need `?`.

**Symptom:** `@>` misses rows that clearly contain the value
**Cause:** Testing an object inside an array without the array wrapper.
**Fix:** `doc @> '{"items":[{"x":1}]}'`, not `'{"items":{"x":1}}'`.

**Symptom:** A range filter cannot be expressed with `@>`
**Cause:** Containment tests for a fixed fragment; it has no comparison operators.
**Fix:** jsonpath — `doc @? '$.qty ? (@ > 45)'` — or promote the field to a
column.

**Symptom:** A nested merge loses sibling keys
**Cause:** `||` is a shallow merge; the top-level key is replaced wholesale.
**Fix:** `jsonb_set` with a path.

**Symptom:** Updating one key in a document is unexpectedly expensive
**Cause:** Every jsonb mutation produces a new document, so the whole column is
rewritten and, if large, re-TOASTed.
**Fix:** Split hot fields into columns.

## Interview questions

**★ Why prefer `doc @> '{"tag":"t42"}'` over `doc->>'tag' = 't42'`?**
Because a GIN index can serve containment and cannot serve the accessor
expression. Measured on 200 000 rows with a GIN index: 4.5 ms with an
`Index Cond` for `@>`, against 35.4 ms with a parallel sequential scan and 66 600
rows removed by filter for `->>`. They return identical rows.

**★ What does `@>` actually test?**
Whether the right-hand document appears inside the left — a subset of keys at any
depth, with array containment ignoring order and duplicates. It is structural
containment, not equality, and it cannot express comparisons.

**★ When do you need jsonpath rather than containment?**
When the predicate involves a comparison or a wildcard — `doc @? '$.items[*] ?
(@.price > 100)'`. There is no containment fragment meaning "greater than".

**★ What is the difference between `?` and `@>`?**
`?` tests key existence regardless of value; `@>` tests for a key *and* value.
Measured, `? 'discount'` was `true` for a key whose value was JSON `null`, and
`@> '{"a":null}'` also matched an explicit null — but a document missing the key
matches neither.

**Which operators does `jsonb_path_ops` not support?**
The existence family — `?`, `?|`, `?&`. It indexes hashed paths-plus-values, so it
is smaller and faster for `@>` but has no entry for a bare key. Use the default
`jsonb_ops` if you need existence checks.

**Why is updating one key in a large document expensive?**
Because jsonb values are immutable: `jsonb_set` and `||` build a new document and
the `UPDATE` rewrites the entire column, including re-TOASTing it if it is large.
The cost is proportional to the document, not to the change.

---

← [Accessors and paths](01-accessors-and-paths.md) · Next → [When a column beats JSON](../02-column-vs-json.md)
