---
title: "findById — and the not-found decision"
sidebar_label: "07 · findById"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex38-repository.mjs`.

**The database has no opinion about a missing row — it is a successful query that
returned nothing.** Every "not found" behaviour in your API is something you
added, and the only real decision is where you added it.

## What the driver gives you

```console
$ node ex38-repository.mjs
=== 2. findById on a missing id — what the driver actually returns ===
rowCount      : 0
rows          : []
rows[0]       : undefined
typeof rows[0]: undefined
rows[0] ?? null: null
did it throw? : no — zero rows is a success
```

No error, no exception, no special result — an empty array. If you want a 404,
you write it.

## `null` or throw

```js
// A — return null
export const findById = async (db, id) => {
  const {rows} = await db.query(
    `SELECT id, email, full_name FROM r_users WHERE id = $1`, [id]);
  return rows[0] ? toDomain(rows[0]) : null;
};

// B — throw a domain error
export const getById = async (db, id) => {
  const {rows} = await db.query(
    `SELECT id, email, full_name FROM r_users WHERE id = $1`, [id]);
  if (!rows[0]) throw new NotFoundError('user', id);
  return toDomain(rows[0]);
};
```

The distinction that actually decides it is **whether the caller has a reasonable
response to absence**.

| Situation | Absence is | Use |
|---|---|---|
| `GET /users/:id` | the answer — a 404 | either; the handler turns it into 404 |
| Checking whether an email is taken | expected, and normal | `null` |
| Loading the user for an authenticated request | impossible — the token referenced them | throw |
| Loading a row you are about to update | a 404, and you must not continue | throw |

A `null` that nobody checks becomes `Cannot read properties of null` three frames
later, with a stack trace pointing at the property access rather than the missing
row. A throw that nobody expected becomes a 500. Neither is safe by default —
what makes one safe is matching it to how the caller behaves.

**The convention that scales** is to provide both, named differently, as above:
`findX` returns `null`, `getX` throws. The name at the call site then says which
one the caller signed up for, and no one has to remember a rule. This is the same
convention `Map.get` vs a checked accessor uses, and it is worth adopting purely
because the names are self-documenting in review.

## Do not return `undefined`

```js
return rows[0];              // undefined when missing
```

`JSON.stringify({user: undefined})` produces `{}` — the key disappears entirely,
rather than appearing as `null`. A client written against the shape
`{user: {...} | null}` gets a third shape it was not expecting. Normalise at the
repository boundary:

```js
return rows[0] ?? null;
```

## The id has to survive being a string

`GET /users/abc` reaches the repository as the string `'abc'`:

```console
id = "abc" (invalid text representation)   → 22P02
                                             message : invalid input syntax for type bigint: "abc"
```

`22P02` is a **400**, not a 404 and not a 500 — the request was malformed, not
pointing at something absent. Two ways to handle it, and they are not equivalent:

```js
// validate at the edge — preferred
const id = z.coerce.bigint().parse(req.params.id);

// or map the SQLSTATE
if (err.code === '22P02') return res.status(400).json({error: 'invalid_id'});
```

Validating at the edge is better because it keeps a malformed id from reaching the
database at all, and because `22P02` can arise from other things in a more complex
query, at which point the mapping is ambiguous. But keep the SQLSTATE mapping as a
backstop — see
[Errors to HTTP status codes](./01-repository/03-errors-to-http.md).

Remember that ids arrive from the database as **strings** for `bigint` columns, so
there is no round-trip conversion to get wrong as long as you never do arithmetic
on them — [Rows to domain objects](./01-repository/02-rows-to-domain.md).

## `findById` and soft deletes

If the table has a `deleted_at`, `findById` must decide whether a soft-deleted row
is found. Almost always it is not:

```sql
SELECT id, email, full_name FROM r_users
 WHERE id = $1 AND deleted_at IS NULL
```

Leaving the predicate off is the most common soft-delete bug: the row comes back,
the API serves a deleted resource, and no test catches it because the test data has
no deleted rows. The full treatment, including the partial unique index that lets
an email be reused after deletion, is in
[delete — hard vs soft](09-delete-soft-hard.md).

## Trade-off

Returning `null` puts the decision at every call site, which means it is right
where the caller knows the context and forgotten where they do not. Throwing
centralises it — one `NotFoundError` mapped to 404 in middleware — at the cost of
using exceptions for a condition that is not exceptional, and of making the
non-error path invisible in the function's signature.

The cost that is easy to miss: a thrown `NotFoundError` from a repository three
layers down produces a 404 for a request whose *actual* subject exists. `GET
/orders/5` that loads a missing `user` row returns "not found" without saying which
thing was not found. If you throw, put the resource and id in the error — as
`NotFoundError('user', id)` above — so the middleware can say.

## Gotchas

**Symptom:** `TypeError: Cannot read properties of null` far from the query
**Cause:** A `null` from `findById` passed along unchecked.
**Fix:** Check at the call site, or use the throwing variant when absence is not a
valid state.

**Symptom:** A key vanishes from the JSON response
**Cause:** Returning `rows[0]`, which is `undefined` for a missing row.
**Fix:** `rows[0] ?? null`.

**Symptom:** `GET /users/abc` returns 500
**Cause:** `22P02 invalid input syntax for type bigint` propagating unmapped.
**Fix:** Validate the id at the edge; map `22P02` to 400 as a backstop.

**Symptom:** A deleted resource is still served by `GET /:id`
**Cause:** `findById` does not filter on `deleted_at`.
**Fix:** `AND deleted_at IS NULL` in every read path, not just the list endpoint.

**Symptom:** A 404 that does not say what was missing
**Cause:** A bare `NotFoundError` thrown deep in the call chain.
**Fix:** Carry the resource type and id in the error.

**Symptom:** `findById` returns a row for another tenant
**Cause:** The id is globally unique so the query looks complete, but tenancy is
not in the predicate.
**Fix:** `WHERE id = $1 AND tenant_id = $2`. Scope every read, not just lists.

## Interview questions

**★ What does PostgreSQL return when you select a row that does not exist?**
A successful result with `rowCount: 0` and `rows: []`, so `rows[0]` is
`undefined`. It does not throw. Any not-found behaviour is added by the
application.

**★ Should `findById` return `null` or throw?**
It depends on whether absence is a normal outcome for the caller. Checking whether
an email is taken should get `null`; loading the authenticated user, where absence
means the token references a deleted account, should throw. The convention that
avoids arguing about it is to provide both — `findX` returns `null`, `getX`
throws — so the call site names the choice.

**★ Why not return `rows[0]` directly?**
Because it is `undefined` when missing, and `JSON.stringify` drops `undefined`
keys entirely, so the response shape changes rather than the value. `rows[0] ??
null` keeps the shape stable.

**★ What status code is `GET /users/abc` where the id column is bigint?**
400. It raises `22P02 invalid input syntax for type bigint`, which means the
request was malformed — not that the resource is absent. Validate at the edge and
keep the SQLSTATE mapping as a backstop.

**What does `findById` have to do differently on a table with soft deletes?**
Filter them out — `AND deleted_at IS NULL` — in every read path. Missing it serves
deleted resources, and test data usually contains no deleted rows so nothing
fails.

---

← [`create` — INSERT RETURNING](06-create.md) · Next → [Partial updates](08-update-partial.md)
