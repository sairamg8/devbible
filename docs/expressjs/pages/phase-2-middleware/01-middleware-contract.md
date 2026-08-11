---
title: "The middleware contract"
sidebar_label: "01 · Middleware contract"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**Middleware is a function `(req, res, next) => void`. It must either send a
response or call `next` (or `next(err)`). Anything else hangs the client.**

## The shape

```js
function middleware(req, res, next) {
  // read req, optionally write res headers/body
  // then exactly one of:
  //   res.status(...).json(...)  // terminal
  //   next()                     // continue
  //   next(err)                  // error stack
}
```

Route handlers are middleware that matched a method and path. Same contract.

## Three legal endings

| Ending | Means |
|---|---|
| **Respond** | `res.json`, `res.send`, `res.end`, … — request finished |
| **`next()`** | Pass to the next layer in this stack |
| **`next(err)`** | Skip to error-handling middleware |

Returning from the function without one of those is not an ending Express
understands — the socket waits.

## See a clean chain

```js
// contract.mjs
import express from 'express';

const app = express();

app.use((req, res, next) => {
  req.seen = ['A'];
  next();
});

app.use((req, res, next) => {
  req.seen.push('B');
  next();
});

app.get('/t', (req, res) => {
  res.json({seen: req.seen});
});

const server = app.listen(0, async () => {
  const {port} = server.address();
  console.log(await (await fetch(`http://127.0.0.1:${port}/t`)).json());
  server.close();
});
```

```console
$ node contract.mjs
{ seen: [ 'A', 'B' ] }
```

## Trade-off

Small middleware units are testable and reusable; too many hops hide the path a
request takes. Prefer a short, named chain over twenty anonymous lambdas.

## Gotchas

**Symptom:** Request never completes  
**Cause:** No `next`, no response  
**Fix:** Audit every branch — including `if` arms and async paths

**Symptom:** Async middleware “sometimes” hangs  
**Cause:** Forgot `await` then `next`, or unhandled rejection on Express 4  
**Fix:** On Express 5, async throws reach error middleware; still `await` work
before responding

**Symptom:** Thinking `return next()` is special  
**Cause:** Confusion with other frameworks  
**Fix:** `return next()` only returns from *your* function; `next` is what
matters. `return` avoids running code after `next` by accident

## Interview questions

**★ What is the Express middleware signature?**  
`(req, res, next) => void` for normal middleware; four args for errors.

**★ What must middleware do before finishing?**  
Send a response or call `next` / `next(err)`.

**Are route handlers middleware?**  
Yes — with a method and path filter in front.

**Why is `return next()` a common style?**  
To stop executing the rest of the function after continuing the chain.

---

← Index: [Phase 2](README.md) · Next → [Execution order](02-execution-order.md)
