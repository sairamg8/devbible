---
title: "Route ordering"
sidebar_label: "04 · Route ordering"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

**First match wins. A param route registered before a static sibling steals the
static path. Express will not warn you.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run**.
> Order-dependence is the documented model, not an accident:
> [using middleware](https://expressjs.com/en/guide/using-middleware.html) states that
> middleware runs *"in the order they are defined"*, and the router reference says
> *"the order of `router.use()` definitions is critical — they execute sequentially,
> defining middleware precedence."* The
> [FAQ](https://expressjs.com/en/starter/faq.html) supplies the other half of rule 4:
> a 404 happens only once *"Express has executed all middleware functions and routes,
> and found that none of them responded"*, which is why the 404 handler goes last.

## The classic bug

```js
// order.mjs
import express from 'express';

function withOrder(label, register) {
  const app = express();
  register(app);
  return new Promise((resolve) => {
    const server = app.listen(0, async () => {
      const {port} = server.address();
      const text = await (
        await fetch(`http://127.0.0.1:${port}/users/export`)
      ).text();
      console.log(label, '→', text);
      server.close();
      resolve();
    });
  });
}

await withOrder('static first', (app) => {
  app.get('/users/export', (req, res) => res.send('export'));
  app.get('/users/:id', (req, res) => res.send('id=' + req.params.id));
});

await withOrder('param first', (app) => {
  app.get('/users/:id', (req, res) => res.send('id=' + req.params.id));
  app.get('/users/export', (req, res) => res.send('export'));
});
```

```console
$ node order.mjs
static first → export
param first → id=export
```

`export` is a perfectly legal `:id`. The second app never reaches the static
route.

## Rules of thumb

1. **Static segments before param segments** on the same prefix.
2. **More specific paths before more general ones.**
3. **No universal catch-all** until every real route is registered (SPA fallback
   last — Phase 4).
4. Register **404** after all routes (Phase 5).

## Routers do not save you from order

Order is per stack. Inside a router, the same first-match rule applies. Mount
order between routers matters too: an earlier `app.use('/users', …)` can claim
paths before a later mount sees them.

## Trade-off

Convention (`/users/:id` everywhere) is tidy until you need `/users/export`.
Either reserve static names, put actions under `POST /users/actions/export`, or
always register static routes first — pick a house rule and stick to it.

## Gotchas

**Symptom:** “Wrong handler ran” with a plausible param value  
**Cause:** Param route above static route  
**Fix:** Reorder; add a test that hits the static path

**Symptom:** Works in one file, breaks after split into routers  
**Cause:** Mount order between files changed  
**Fix:** Centralize mount list; review order when adding routes

**Symptom:** Catch-all serves API JSON as `index.html`  
**Cause:** SPA fallback registered before API routers  
**Fix:** API mounts first, static + fallback last

## Interview questions

**★ Why does `/users/export` hit `:id` with id `export`?**  
Param routes match any segment; first registered match wins.

**How do you prevent that class of bug?**  
Register static paths first; or avoid clashing names; test both paths.

**Does Express rank routes by specificity automatically?**  
No — registration order only.

**Where should a SPA `/*splat` fallback sit?**  
After API and static asset routes.

**How do tests catch ordering bugs?**  
Integration tests for every static sibling of a param route.

---

← Prev: [Router composition](03-router-composition.md) · Next → [Path matching on Express 5](05-path-matching-express5.md)
