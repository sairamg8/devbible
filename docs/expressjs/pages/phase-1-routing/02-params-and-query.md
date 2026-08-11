---
title: "Params and query"
sidebar_label: "02 · Params and query"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

**Path params are part of the route pattern. Query strings are not — they land
on `req.query` after the path matches. On Express 5, `req.query` defaults to
the simple parser.**

## Path params

```js
// params.mjs
import express from 'express';

const app = express();

app.get('/users/:userId/books/:bookId', (req, res) => {
  res.json({params: req.params, path: req.path});
});

const server = app.listen(0, async () => {
  const {port} = server.address();
  const res = await fetch(
    `http://127.0.0.1:${port}/users/u1/books/b9?verbose=1`,
  );
  console.log(await res.json());
  server.close();
});
```

```console
$ node params.mjs
{ params: { userId: 'u1', bookId: 'b9' }, path: '/users/u1/books/b9' }
```

Params are **strings**. Coerce and validate at the edge (Phase 8) — never trust
`req.params.id` as a number without parsing.

## Query strings

```js
// query.mjs
import express from 'express';

const app = express();
// default query parser on Express 5.2.1 is "simple"
app.get('/search', (req, res) => res.json(req.query));

const server = app.listen(0, async () => {
  const {port} = server.address();
  const u =
    `http://127.0.0.1:${port}/search?a=1&a=2&a[b]=1&q=hello%20world`;
  console.log(await (await fetch(u)).json());
  server.close();
});
```

```console
$ node query.mjs
{ a: [ '1', '2' ], 'a[b]': '1', q: 'hello world' }
```

| Input | `simple` result (default) |
|---|---|
| `a=1&a=2` | `{ a: ['1','2'] }` |
| `a[b]=1` | `{ 'a[b]': '1' }` — **literal key**, not nested |

Express 4’s default `extended` produced nested objects. Upgrades break
`req.query.filter.status` style code. Opt into `app.set('query parser', 'extended')`
only if you need nesting — and still allow-list fields (Phase 6 filters).

## Wildcards / splats (Express 5)

Named splats replace bare `*`:

```js
app.get('/files/*path', (req, res) => {
  res.json({path: req.params.path});
});
```

Bare `app.get('*')` **throws at registration** — see [Path matching on Express 5](05-path-matching-express5.md).

## Trade-off

Rich query languages in the URL are flexible and easy to abuse (injection,
unexpected nested keys). Prefer allow-listed filters and explicit params for
identity (`/users/:id`), not `?id=`.

## Gotchas

**Symptom:** `req.query.a.b` is undefined after Express 5 upgrade  
**Cause:** Simple parser; nested bracket keys stay literal  
**Fix:** Change clients, parse manually, or set `extended` deliberately

**Symptom:** `req.params.id` used in SQL without validation  
**Cause:** Treating route params as trusted typed IDs  
**Fix:** Validate/coerce (Phase 8); parameterized queries (Node Phase 6)

**Symptom:** Optional path segments from Express 4 tutorials fail to boot  
**Cause:** `:id?` style patterns throw on Express 5  
**Fix:** Separate routes or new path syntax (page 05)

## Interview questions

**★ Difference between `req.params` and `req.query`?**  
Params come from the path pattern; query comes from the `?` string after the path.

**★ What is the Express 5 default query parser?**  
`simple` — duplicate keys become arrays; bracket nesting is not objects by default.

**Are param values numbers?**  
No — strings (or string arrays in some edge cases). Coerce explicitly.

**Where should `?page=2&limit=20` be validated?**  
At the HTTP boundary (Phase 8), with caps on `limit` (Phase 6 pagination).

**Why did `a[b]=1` stop nesting after upgrade?**  
Default moved from `extended` (`qs`) to `simple`.

---

← Prev: [HTTP methods](01-http-methods.md) · Next → [Router composition](03-router-composition.md)
