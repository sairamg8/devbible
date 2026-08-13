---
title: "Partial updates — COALESCE vs a built SET list"
sidebar_label: "08 · Partial updates"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex43-keyset-patch.mjs`,
> `sandbox/pg-api/ex17-update.mjs`.

**`PATCH` has to distinguish "the client did not mention this field" from "the
client asked me to clear it", and JavaScript gives you the same value for both.**
That one ambiguity decides which of the two implementations you can use.

## The `COALESCE` form

One fixed statement, every column named, `null` meaning "leave it alone":

```sql
UPDATE k_profiles
   SET name     = COALESCE($2, name),
       bio      = COALESCE($3, bio),
       city     = COALESCE($4, city),
       nickname = COALESCE($5, nickname)
 WHERE id = $1
RETURNING name, bio, city, nickname
```

It is a static string with a fixed parameter list — no string building, nothing to
get wrong. And it works, right up to the point where a client wants to clear a
field:

```console
$ node ex43-keyset-patch.mjs
=== 1. COALESCE cannot express "clear this field" ===
start          : { name: 'Ada', bio: 'Mathematician', city: 'London', nickname: 'Countess' }
PATCH {city}   : { name: 'Ada', bio: 'Mathematician', city: 'Paris',  nickname: 'Countess' }
PATCH {nickname: null} — the client is asking to clear it:
               : { name: 'Ada', bio: 'Mathematician', city: 'Paris',  nickname: 'Countess' }
↑ unchanged. "absent" and "explicitly null" are the same value in JS,
  and COALESCE reads both as "keep what is there"
```

`{"nickname": null}` is an explicit instruction and it did nothing. There is no way
to fix this within the `COALESCE` form, because by the time the value reaches the
parameter it is `null` either way — the information about whether the key was
present has already been lost.

The workaround is a sentinel per column (`$3 IS NULL AND $3_provided`), which
doubles the parameters and is worse than the alternative.

## The built `SET` list

Build the assignments from the keys the client actually sent:

```js
const COLUMNS = new Set(['name', 'bio', 'city', 'nickname']);   // the allowlist

const patch = async (db, id, fields) => {
  const sets = [], params = [id];
  for (const [k, v] of Object.entries(fields)) {
    if (!COLUMNS.has(k)) throw new Error(`not updatable: ${k}`);
    params.push(v);
    sets.push(`${k} = $${params.length}`);
  }
  if (!sets.length) return null;                     // nothing to do
  const {rows} = await db.query(
    `UPDATE k_profiles SET ${sets.join(', ')}, updated_at = now()
      WHERE id = $1 RETURNING name, bio, city, nickname`, params);
  return rows[0];
};
```

```console
=== 2. a built SET list distinguishes absent from null ===
PATCH {nickname: null}: { name: 'Ada', bio: 'Mathematician', city: 'Paris', nickname: null }
PATCH {}              : null
PATCH with a crafted key → not updatable: id = 1; DROP TABLE k_profiles; --
↑ the key is checked against the allowlist; only the VALUE is a parameter
```

`nickname` is now `null` because the *key was present*. `Object.entries` sees the
difference that `COALESCE` cannot.

### The safety rule, restated

Column names cannot be parameters. The key goes through an **allowlist**, the
value goes through a **parameter**, and the crafted key above was rejected by
membership, not by escaping or validation. This is exactly the mechanism from
[Sort and filter allowlists](./allowlists/) — the same rule applied to the `SET`
list instead of `ORDER BY`.

The `$n` numbering must be derived from the array, never from a loop counter:
`params.push(v)` then `$${params.length}` cannot drift, because `params[0]` is
already the id. Writing `$${i + 2}` works until someone adds a parameter before the
loop.

## `PATCH {}` — the empty update

`UPDATE t SET WHERE id = $1` is a syntax error, so an empty patch must be handled
before building the statement. Returning `null` for "nothing to do" is one option;
`204 No Content` is usually the better API answer. What you must not do is fall
through into a statement with an empty `SET`.

## Naming a column does not by itself cost anything

A common worry about the `COALESCE` form is that it writes every column, so it
must be more expensive — more index maintenance, fewer HOT updates. Measured
against a table with an index on `b` and `fillfactor = 70`:

```console
=== 3. what each form actually writes — HOT updates ===
index on b; fillfactor 70. 2500 rows per statement:
  COALESCE form, b keeps its own value            updated 2500, HOT 1090
  built SET list, only the unindexed column a     updated 2500, HOT 1096
  the indexed column b actually changes           updated 2500, HOT    0
```

**Naming the indexed column in `SET` cost nothing — 1090 HOT updates versus 1096.**
Only *changing its value* defeated HOT, and then completely: 0 of 2500.

PostgreSQL compares the new value with the old one; it does not care that the
column appeared in the `SET` clause. So the argument for the built `SET` list is
about expressiveness and not about write amplification. (The HOT count is below
2500 in both cases because `fillfactor = 70` leaves only so much free space on each
page — the comparison between the rows is the point, not the absolute number.
Background: [Phase 11 · MVCC](../phase-11-mvcc/05-mvcc.md).)

## A no-op update still writes a row version

```console
=== 4. a PATCH that changes nothing still writes a row version ===
SET city = city                     → rowCount 1
... AND city IS DISTINCT FROM $2    → rowCount 0
```

`SET city = city` reported `rowCount: 1` and created a dead tuple for no reason. On
a hot endpoint that clients call repeatedly with unchanged data, that is pure bloat
and pure WAL.

`AND col IS DISTINCT FROM $n` skips it — `IS DISTINCT FROM` rather than `<>`
because `<>` is `NULL` when either side is `NULL`, so a nullable column would never
match. But note what it does to your return value: **`rowCount: 0` now means
either "no change needed" or "row not found"**, and the endpoint has to
distinguish them. `RETURNING` plus a follow-up existence check, or simply accepting
the redundant write, are both reasonable; the choice depends on how often clients
send unchanged data.

## The jsonb alternative

For a genuinely open-ended document, merge instead of assigning:

```console
=== 5. merging into a jsonb column instead ===
merge {city}          : { city: 'Paris', nickname: 'Countess' }
merge {nickname:null} : { city: 'Paris', nickname: null }
↑ null is stored as a JSON null, not "absent" — removing needs the - operator
remove with data - key: { city: 'Paris' }
```

`data || $1::jsonb` is a shallow merge and has the same ambiguity in a new place:
JSON has a real `null`, so `{"nickname": null}` *stores* a null rather than
removing the key. Removal is a different operator, `data - 'nickname'`, so the API
still has to decide what `null` means and translate accordingly.

`||` is also shallow — merging `{"a":{"x":1}}` with `{"a":{"y":2}}` gives
`{"a":{"y":2}}`, not a deep merge. Use `jsonb_set` for a nested path.

## Trade-off

The `COALESCE` form is a static statement: it can be prepared once, it is trivially
auditable, and there is no string concatenation anywhere near it. Its cost is that
it cannot express clearing a field, and that it names every column, so adding a
column means editing the statement.

The built `SET` list expresses everything and adapts to new columns, and it puts
you in the business of assembling SQL from request keys — which is safe only for
as long as the allowlist is actually enforced. It also produces a different
statement text per field combination, so the plan cache holds one entry per shape.

Pick `COALESCE` when the columns are few, stable, and never legitimately null.
Pick the built `SET` list the moment a client needs to clear a field — which, for
any resource with optional fields, is the first week.

## Gotchas

**Symptom:** `{"nickname": null}` does not clear the field
**Cause:** `COALESCE($n, col)` reads `null` as "keep the current value", and an
absent key and an explicit null are both `null` in JavaScript.
**Fix:** Build the `SET` list from the keys that were sent.

**Symptom:** `syntax error at or near "WHERE"`
**Cause:** An empty patch produced `SET` with no assignments.
**Fix:** Return early when there is nothing to update.

**Symptom:** A crafted key modifies an unintended column
**Cause:** Interpolating request keys into the `SET` list without an allowlist.
**Fix:** Check membership in a `Set` of updatable columns. Only values are
parameters.

**Symptom:** Parameter numbering drifts after adding a `WHERE` clause
**Cause:** `$${i + 2}` computed from a loop index rather than the array.
**Fix:** `params.push(v)` then `$${params.length}`.

**Symptom:** Bloat on a table whose rows rarely change
**Cause:** Idempotent clients re-sending identical values; every `UPDATE` writes a
new row version. Measured: `SET city = city` returned `rowCount: 1`.
**Fix:** `AND col IS DISTINCT FROM $n` — accepting that `rowCount: 0` becomes
ambiguous.

**Symptom:** A nullable column never matches the no-op guard
**Cause:** `col <> $n` is `NULL` when either side is `NULL`, which is not true.
**Fix:** `IS DISTINCT FROM`.

**Symptom:** A nested jsonb merge loses sibling keys
**Cause:** `||` is a shallow merge.
**Fix:** `jsonb_set` with a path.

## Interview questions

**★ Why can't `COALESCE($2, col)` implement `PATCH` properly?**
Because it cannot express clearing a field. An absent key and an explicit `null`
are both `null` by the time they are a parameter, and `COALESCE` treats `null` as
"keep the existing value" — measured, `{"nickname": null}` left the value
unchanged.

**★ How do you build a dynamic `SET` list safely?**
Check each key against an allowlist of updatable columns and drop or reject
anything else; push each value onto the parameter array and derive the placeholder
from `params.length`. Column names are never parameters and are never interpolated
from input — only values are.

**★ Does naming every column in `SET` cost more than naming one?**
No. Measured on a table with an index and `fillfactor = 70`, the `COALESCE` form
that named all four columns produced 1090 HOT updates and the single-column form
1096 — effectively identical. Only *changing* the indexed column's value defeated
HOT, and that took it to 0 of 2500. PostgreSQL compares values, not the text of
the clause.

**★ What does an `UPDATE` that sets a column to its current value do?**
It still writes a new row version and reports `rowCount: 1` — a dead tuple and WAL
for no change. `AND col IS DISTINCT FROM $n` avoids it, at the cost of making
`rowCount: 0` mean either "no change" or "not found".

**Why `IS DISTINCT FROM` rather than `<>`?**
Because `<>` evaluates to `NULL` when either operand is `NULL`, so the guard never
matches on a nullable column. `IS DISTINCT FROM` treats `NULL` as a comparable
value.

**What is the equivalent ambiguity when patching a jsonb column?**
JSON has a real `null`, so `data || '{"nickname":null}'` stores a null rather than
removing the key — removal is `data - 'nickname'`. The API still has to decide
what `null` means. `||` is also a shallow merge, so nested objects are replaced
rather than merged.

---

← [findById](07-find-by-id.md) · Next → [`delete` — hard vs soft](09-delete-soft-hard.md)
