---
title: "First and last"
sidebar_label: "05 · First and last"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

**Some middleware only works in the right slot. Body parsers before handlers that
read `req.body`. Error middleware last. 404 just above errors.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run**.
> Both ends of the skeleton are documented requirements, not style.
> [Error handling](https://expressjs.com/en/guide/error-handling.html): error-handling
> middleware is defined *"last, after other `app.use()` and routes calls"*, and takes
> four arguments — *"you must provide four arguments to identify it as an error-handling
> middleware function"*, even when `next` goes unused.
> [FAQ](https://expressjs.com/en/starter/faq.html): the 404 handler goes *"at the very
> bottom of the stack (below all other functions)"*, because a 404 means Express
> *"executed all middleware functions and routes, and found that none of them
> responded"* — which also means a 404 is **not** an error and never reaches the error
> handler.

## Canonical skeleton

```js
// skeleton — not a full app
import express from 'express';

const app = express();

app.disable('x-powered-by');
// trust proxy when behind Nginx — Phase 9

app.use(express.json({limit: '100kb'})); // early — populates req.body
// app.use(cors(...));
// app.use(requestId);

app.use('/api', apiRouter); // routes

app.use((req, res) => {
  res.status(404).json({error: 'not found'}); // after routes
});

app.use((err, req, res, next) => {
  // last — four arguments
  res.status(err.status || 500).json({error: err.message});
});

export {app};
```

## Why parsers are early

Handlers and validators read `req.body`. If they run before `express.json()`,
`req.body` is empty and you chase ghosts. Size limits also need to apply before
you spend CPU on business logic.

## Why errors are last

Error middleware is skipped in the normal chain. It runs when `next(err)` is
called or when Express 5 forwards a rejection. If you register it *before*
routes, those routes never fall into it.

## Trade-off

A strict skeleton is boring and correct. Ad-hoc `app.use` sprinkled across files
without a mount list becomes undebuggable. Keep one composition root (Phase 10).

## Gotchas

**Symptom:** `req.body` always undefined  
**Cause:** Parser after routes, wrong `Content-Type`, or empty body  
**Fix:** Order + content-type; Phase 3 for parser details

**Symptom:** Custom error handler never runs  
**Cause:** Not last, or not four parameters  
**Fix:** `(err, req, res, next)` at the bottom of the stack

**Symptom:** 404 handler catches errors  
**Cause:** Three-arg function used as error handler  
**Fix:** Separate 404 (3-arg) and errors (4-arg)

## Interview questions

**★ In what order do you mount json parser, routes, and error middleware?**  
Parser first (among body consumers), then routes, then 404, then error middleware.

**Why must error middleware have four parameters?**  
So Express can detect it as error-handling middleware.

**Where does request logging usually sit?**  
Very early — but after anything you need for the log line (sometimes after
request-id middleware).

---

← Prev: [Middleware factories](04-middleware-factories.md) · Next → [Mutating req and res](06-mutating-req-res.md)
