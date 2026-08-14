---
title: "Query parser"
sidebar_label: "04 · Query parser"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

**Express 5 defaults `query parser` to `simple`. Nested bracket queries are not
objects unless you opt into `extended`. Upgrades break filter APIs that assumed
Express 4.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run**.
> The [application settings table](https://expressjs.com/en/5x/api/application/) gives
> `query parser` a default of **`"simple"`**, which is Node's `querystring` module —
> so repeated keys become arrays and bracket syntax is never interpreted
> ([`querystring.parse`](https://nodejs.org/api/querystring.html)).
>
> ⚠️ **Express's own docs contradict each other here**, as flagged on
> [Phase 1 page 02](../phase-1-routing/02-params-and-query.md): the
> [`req.query` reference](https://expressjs.com/en/5x/api/request/) still says the parser
> *"by default uses the `qs` module"* — stale Express 4 text. The settings table and the
> [migration guide](https://expressjs.com/en/guide/migrating-5.html) agree on `simple`,
> and this page follows them. Read back `app.get('query parser')` if you need certainty
> on your own version.

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
