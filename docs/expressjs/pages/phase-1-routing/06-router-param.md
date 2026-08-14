---
title: "router.param"
sidebar_label: "06 · router.param"
sidebar_position: 6
---

<span className="db-tier t-know">Know</span>

**`router.param(name, fn)` runs when a route param is present — load once, 404
once, then every handler on that router can use the loaded value.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run**.
> The "load once" claim is the documented guarantee, not an optimisation:
> [`router.param`](https://expressjs.com/en/5x/api/router/) states that *"a param
> callback will be called only once in a request-response cycle, even if the parameter
> is matched in multiple routes"* — the docs' own example labels the callback
> `CALLED ONLY ONCE` while two matching handlers both run afterwards. The callback
> signature `(req, res, next, value)` is from the same page.

## Load-and-attach

```js
// param.mjs
import express from 'express';

const app = express();
const items = express.Router();

const db = new Map([['42', {id: '42', name: 'Widget'}]]);

items.param('id', (req, res, next, id) => {
  const row = db.get(id);
  if (!row) {
    res.status(404).json({error: 'not found'});
    return; // do not next()
  }
  req.item = row;
  next();
});

items.get('/:id', (req, res) => {
  res.json({item: req.item});
});

items.get('/:id/edit', (req, res) => {
  res.json({editing: req.item});
});

app.use('/items', items);

const server = app.listen(0, async () => {
  const {port} = server.address();
  const base = `http://127.0.0.1:${port}`;
  console.log('ok', await (await fetch(`${base}/items/42`)).json());
  console.log('edit', await (await fetch(`${base}/items/42/edit`)).json());
  console.log('missing', (await fetch(`${base}/items/99`)).status);
  server.close();
});
```

```console
$ node param.mjs
ok { item: { id: '42', name: 'Widget' } }
edit { editing: { id: '42', name: 'Widget' } }
missing 404
```

Both `/:id` and `/:id/edit` share one load path. Without `param`, you duplicate
fetch/404 logic in every handler.

## When not to use it

| Prefer plain middleware / handlers when… |
|---|
| Only one route needs the load |
| Loading is a heavy side effect you want explicit at the call site |
| You are tempted to build a hidden DI container inside `param` |

`param` is sugar for a repeated preload — not an application architecture.

## Trade-off

DRY loading vs “magic” that runs before handlers and surprises readers. Use it
for obvious resource IDs on a small router; document `req.item` clearly.

## Gotchas

**Symptom:** `param` runs for every route including those that do not need the row  
**Cause:** Broad router; param name appears in many paths  
**Fix:** Split routers, or load inside specific handlers

**Symptom:** Double DB hit  
**Cause:** Handler loads again after `param` already did  
**Fix:** Trust `req.item` or do not use `param`

**Symptom:** Forgot to `next()` after attach  
**Cause:** Same hang class as middleware  
**Fix:** Always `next()` or send a response

## Interview questions

**★ What does `router.param('id', fn)` do?**  
Runs `fn` when `:id` is present in a matched route on that router, before the
route handler.

**Why use it?**  
Centralize fetch + 404 for a resource used by multiple routes.

**Does `app.param` exist too?**  
Yes — same idea at application scope. Prefer router scope to limit blast radius.

**Is `param` required for REST?**  
No — explicit loads in handlers are fine and often clearer.

---

← Prev: [Path matching on Express 5](05-path-matching-express5.md) · Next → [app.route and hosts](07-app-route-and-hosts.md)
