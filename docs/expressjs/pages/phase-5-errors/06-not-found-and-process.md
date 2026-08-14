---
title: "404 and process-level errors"
sidebar_label: "06 · 404 · process"
sidebar_position: 6
---

<span className="db-tier t-know">Know</span>

**404 is normal middleware (3 args) after routes. Process crashes are not Express
topics — cross-link Node.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run**.
> [FAQ — "How do I handle 404 responses?"](https://expressjs.com/en/starter/faq.html)
> settles both halves of this page: *"in Express, 404 responses are not the result of an
> error, so the error-handler middleware will not capture them"*, because a 404
> *"simply indicates the absence of additional work to do; in other words, Express has
> executed all middleware functions and routes, and found that none of them responded."*
> The documented placement is *"at the very bottom of the stack (below all other
> functions)"*. That is why the handler takes **three** arguments — a four-arg function
> would never be reached, since nothing errored.

```js
app.use((req, res) => {
  res.status(404).json({error: {code: 'NOT_FOUND', message: 'Not found'}});
});
// error middleware after this
```

| Concern | Where |
|---|---|
| Request 404 / 500 envelope | **Express** (this phase) |
| `unhandledRejection` / `uncaughtException` | **Node** Phase 5 |
| Structured logging of errors | **Node** Phase 10 + request-id middleware |

## Order is the whole design

Three things sit at the bottom of the stack, and swapping any two breaks something:

```js
app.use('/api', apiRouter);          // 1. routes

app.use((req, res) => {              // 2. 404 — 3 args, nothing matched
  res.status(404).json({error: {code: 'NOT_FOUND', message: 'Not found'}});
});

app.use((err, req, res, next) => {   // 3. errors — 4 args, something threw
  /* … */
});
```

- **404 above the error handler.** It is ordinary middleware; put it below and it
  is unreachable, because the error handler only runs for errors and the 404
  handler only runs when nothing responded.
- **404 below every route.** Above them, it answers everything and your API returns
  404 for routes that exist.
- **The error handler last**, always — it can only catch what is registered above it.

A 404 handler is one of the few pieces of middleware where "it never runs" and "it
runs for everything" are both one line apart.

## Where the process-level line falls

Express error middleware is **request-scoped**. It has a `req` and a `res`, and its
job ends when one response is written. An `uncaughtException` has neither — by the
time it fires, there may be no request in scope at all.

| Concern | Owner |
|---|---|
| A route threw | Express error middleware |
| A callback threw on a later stack | **Node** — `uncaughtException` |
| A floating promise rejected | **Node** — `unhandledRejection` |
| The process should stop serving | **Node** + your supervisor |

The rule of thumb: **if there is a `res` to write to, it is an Express problem.**
If there is not, no amount of Express middleware will help, and the correct
response is to log and exit rather than to continue in unknown state. Node's
syllabus covers why continuing is the wrong instinct.

## Trade-off

A custom 404 handler buys a consistent envelope — the same shape as every other
error, so clients parse one thing. It costs a line of middleware and the discipline
to keep it in the right slot forever.

The alternative is Express's default, which answers with HTML. For a browser app
that is fine and arguably better. For an API it means a client that handles your
error shape everywhere still has to special-case "the response wasn't JSON" —
which is exactly the branch nobody writes, and exactly why a mistyped URL surfaces
as a parse error in the client instead of a clean 404.

## Gotchas

**Symptom:** Every request returns 404, including ones that should work  
**Cause:** The 404 middleware is mounted above the routes  
**Fix:** It goes below every route and above the error handler

**Symptom:** The 404 handler never runs; mistyped URLs return HTML  
**Cause:** It is mounted below the error handler, where nothing reaches it  
**Fix:** Move it above. Errors and not-founds travel different paths

**Symptom:** A `next(err)` inside the 404 handler produces a 500, not a 404  
**Cause:** Treating "nothing matched" as an error condition  
**Fix:** Respond directly. A 404 is not an error in Express's model — the FAQ says so

**Symptom:** `unhandledRejection` fires with no request context  
**Cause:** A floating promise in a handler ([page 02](02-async-errors/02-the-shapes-that-escape.md))  
**Fix:** Await it or attach a deliberate `.catch`. Express cannot associate it with a
request after the fact

**Symptom:** The process survives an `uncaughtException` and then behaves strangely  
**Cause:** A handler that logs and continues  
**Fix:** Log and exit; let the supervisor restart. State after an unexpected throw is
unknown by definition

## Interview questions

**★ Is 404 an error middleware?**  
No — three-argument middleware that always sends 404 when reached.

**★ Why does Express not treat a 404 as an error?**  
Because nothing failed. The docs put it plainly: a 404 "indicates the absence of
additional work to do" — every middleware and route ran and none responded. There is
no error object to hand anywhere.

**★ Where exactly do the 404 and error handlers go, relative to each other?**  
Routes, then the 404 handler, then the error handler. The 404 is ordinary middleware
so it must be reachable in the normal flow; the error handler is last because it can
only catch what is registered above it.

**Can Express error middleware catch an `uncaughtException`?**  
No. It is request-scoped and needs a `res` to write to. Exceptions on a later stack
have no request associated with them and belong to Node's process-level handlers.

**What should an `uncaughtException` handler do?**  
Log with the full stack and exit. Continuing means serving requests from a process
whose state is unknown — the supervisor restarting you is the safer outcome.

---

← Prev: [Operational vs programmer](05-operational-vs-programmer.md) · Index: [Phase 5](README.md)
