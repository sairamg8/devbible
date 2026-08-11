---
title: "Query parser"
sidebar_label: "04 · Query parser"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

**Express 5 defaults `query parser` to `simple`. Nested bracket queries are not
objects unless you opt into `extended`. Upgrades break filter APIs that assumed
Express 4.**

## Default: simple

```js
// query-simple.mjs
import express from 'express';

const app = express();
console.log('default', app.get('query parser'));
app.get('/q', (req, res) => res.json(req.query));

const server = app.listen(0, async () => {
  const {port} = server.address();
  const u = `http://127.0.0.1:${port}/q?a=1&a=2&a[b]=1`;
  console.log(await (await fetch(u)).json());
  server.close();
});
```

```console
$ node query-simple.mjs
default simple
{ a: [ '1', '2' ], 'a[b]': '1' }
```

## Extended (opt-in)

```js
app.set('query parser', 'extended');
// a[b]=1 → { a: { b: '1' } } via qs
```

Nested objects are convenient and historically used in prototype-pollution
payloads (`?__proto__[x]=y`). If you enable `extended`, still **allow-list**
filter keys in application code (Phase 6).

## Trade-off

`simple` is safer default and breaks old nested-query clients. `extended` restores
old behaviour with more parse power and more attack surface. Prefer flat query
params for public APIs.

## Gotchas

**Symptom:** `req.query.filter.status` undefined after upgrade  
**Cause:** Nested key became literal `'filter[status]'` or similar  
**Fix:** Change clients or set `extended` and re-validate

**Symptom:** Enabling extended “for convenience” on an open API  
**Cause:** No filter allow-list  
**Fix:** Never pass raw `req.query` into Mongo/SQL builders

## Interview questions

**★ Express 5 default query parser?**  
`simple`.

**What happened to nested `a[b]` queries?**  
Literal keys under `simple`; objects under `extended`.

**Security angle?**  
Nested query parsing + object merge bugs → pollution; keep parsers boring.

---

← Prev: [Size limits](03-size-limits.md) · Next → [Malformed bodies](05-malformed-bodies.md)
