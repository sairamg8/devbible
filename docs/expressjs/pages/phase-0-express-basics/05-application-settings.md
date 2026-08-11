---
title: "Application settings"
sidebar_label: "05 · Application settings"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

**`app.set` / `app.get` hold app-wide defaults. A few of them change security and
query parsing. Know which ones you inherit.**

## Defaults on Express 5.2.1

Measured on Node 24.19.0:

```js
// settings.mjs
import express from 'express';

const app = express();

for (const key of [
  'env',
  'x-powered-by',
  'etag',
  'query parser',
  'trust proxy',
  'strict routing',
  'case sensitive routing',
]) {
  console.log(key, '=', JSON.stringify(app.get(key)));
}
```

```console
$ node settings.mjs
env = "development"
x-powered-by = true
etag = "weak"
query parser = "simple"
trust proxy = false
strict routing = false
case sensitive routing = false
```

## Settings that earn a deliberate choice

| Setting | Default | Why you care |
|---|---|---|
| **`x-powered-by`** | `true` | Advertises Express in `X-Powered-By`. Turn off in production APIs: `app.disable('x-powered-by')` |
| **`query parser`** | **`simple`** (Express 5) | Nested `a[b]=1` is **not** an object by default (was `extended` in Express 4). See Phase 3 |
| **`trust proxy`** | `false` | Without it, `req.ip` is the proxy, not the client. Phase 9 |
| **`etag`** | `"weak"` | Affects automatic ETag generation for some responses |
| **`env`** | `process.env.NODE_ENV` or `"development"` | Error verbosity and template caches in older stacks |

```js
// harden-basics.mjs
import express from 'express';

const app = express();
app.disable('x-powered-by');
// app.set('trust proxy', 1);  // when behind one reverse proxy — Phase 9
// app.set('query parser', 'extended'); // only if you need nested query objects

console.log('x-powered-by', app.get('x-powered-by'));
```

```console
$ node harden-basics.mjs
x-powered-by false
```

## `app.set` vs `app.use`

| API | Purpose |
|---|---|
| `app.set(name, value)` | Configuration flags |
| `app.use(fn)` / `app.get(path, fn)` | Middleware and routes |

Do not confuse `app.get('etag')` (setting) with `app.get('/etag', handler)`
(route). Same method name, different arity and intent.

## Trade-off

Leaving defaults is fine for demos. Production APIs should at least disable
`x-powered-by` and set `trust proxy` correctly behind Nginx — wrong proxy trust
breaks rate limits and secure cookies later.

## Gotchas

**Symptom:** `req.query.filter.status` is `undefined` after upgrading to Express 5  
**Cause:** Default query parser is now `simple`  
**Fix:** Flatten clients, or opt into `extended` deliberately (Phase 3)

**Symptom:** Rate limiter bans your load balancer  
**Cause:** `trust proxy` still `false`  
**Fix:** Set trust to the hop count you control (Phase 9) — never `true` blindly
on an open internet edge without understanding spoofed `X-Forwarded-For`

**Symptom:** Thought you disabled powered-by but header remains  
**Cause:** Another layer (proxy, gateway) adds its own brand header  
**Fix:** Check the full response chain, not only Express

## Interview questions

**★ Name three Express settings you would review before production.**  
`x-powered-by`, `trust proxy`, and `query parser` (plus `env` / `NODE_ENV`).

**★ What is the Express 5 default for `query parser`?**  
`simple`. Nested object queries are opt-in.

**How do you read a setting?**  
`app.get('name')` for settings; do not confuse with route registration.

**Why disable `x-powered-by`?**  
Minor fingerprinting reduction; stops advertising the stack for free. Not a
security boundary by itself.

**Does `trust proxy` affect only `req.ip`?**  
It affects IP and protocol derived from `X-Forwarded-*` — cookies’ `secure`
behaviour and rate-limit keys often depend on it too.

---

← Prev: [Creating an app](04-creating-an-app.md) · Next → [Express 5 vs 4](06-express-5-vs-4.md)
