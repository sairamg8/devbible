---
title: "Middleware factories"
sidebar_label: "04 · Factories"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

**A factory returns middleware. Configure once, reuse with different options —
no module-level mutable globals.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run**.
> The factory shape is Express's own convention rather than a community invention:
> [using middleware](https://expressjs.com/en/guide/using-middleware.html) shows
> "configurable middleware" as a module that *"exports a function which accepts an
> options object and returns the middleware implementation"*, and every built-in follows
> it — `express.json({limit})`, `express.static(root, options)`, `express.urlencoded({extended})`
> are all called for their return value, never passed directly.

## Pattern

```js
// factory.mjs
import express from 'express';

function requireHeader(name) {
  return function requireHeaderMiddleware(req, res, next) {
    if (!req.get(name)) {
      res.status(400).send('missing ' + name);
      return;
    }
    next();
  };
}

const app = express();
app.get('/x', requireHeader('x-api-key'), (req, res) => res.send('ok'));

const server = app.listen(0, async () => {
  const {port} = server.address();
  const base = `http://127.0.0.1:${port}`;
  console.log('no key', (await fetch(`${base}/x`)).status);
  console.log(
    'key',
    await (
      await fetch(`${base}/x`, {headers: {'x-api-key': '1'}})
    ).text(),
  );
  server.close();
});
```

```console
$ node factory.mjs
no key 400
key ok
```

Same pattern powers validation middleware (Phase 8): `validate(schema)` returns
`(req, res, next) => …`.

## Why not a single global middleware object

| Approach | Problem |
|---|---|
| Module-level `let options` | Tests and concurrent apps clobber each other |
| Closure over `options` in factory | Each instance is independent |
| New class per request | Usually overkill |

## Trade-off

Factories add a nesting level. For one-off middleware, a plain function is
clearer. Reach for factories when the same behaviour appears with different
config.

## Gotchas

**Symptom:** Factory used as middleware: `app.use(requireHeader)`  
**Cause:** Passed the factory, not the instance  
**Fix:** `app.use(requireHeader('x-api-key'))`

**Symptom:** Options mutated later change all instances  
**Cause:** Shared object in outer scope  
**Fix:** Copy options inside the factory or freeze them

## Interview questions

**★ What is a middleware factory?**  
A function that returns a middleware function, capturing configuration.

**Why prefer factories for validation?**  
One implementation, many schemas — `validate(bodySchema)` etc.

**Show a bug with forgetting to call the factory.**  
`app.use(requireHeader)` passes a function with the wrong arity/behaviour.

---

← Prev: [next semantics](03-next-semantics/README.md) · Next → [First and last](05-first-and-last.md)
