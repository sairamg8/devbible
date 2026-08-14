---
title: "Error response contract"
sidebar_label: "03 · Error contract"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

**One public JSON shape for errors. Include a stable `code`. Never send
`err.stack` when `NODE_ENV === 'production'`.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run**.
> The envelope itself is **this bible's design, not an Express feature** — Express has no
> opinion on error body shape. What *is* documented
> ([error handling](https://expressjs.com/en/guide/error-handling.html)) is the behaviour
> this page exists to replace: the built-in handler *"sets `res.statusCode` from
> `err.status` (or `err.statusCode`)"*, defaults to 500 outside the 4xx–5xx range, and
> **writes `err.stack` in development while sending an HTML page in production** — which
> is why the `NODE_ENV` check below matters and why an API needs its own handler at all.
> The `if (res.headersSent) return next(err)` guard is the documented pattern, verbatim.

```js
function errorMiddleware(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = err.statusCode || err.status || 500;
  const body = {
    error: {
      code: err.code || (status >= 500 ? 'INTERNAL' : 'REQUEST_ERROR'),
      message:
        status >= 500 && process.env.NODE_ENV === 'production'
          ? 'Internal Server Error'
          : err.expose === false
            ? 'Internal Server Error'
            : err.message,
    },
  };
  if (process.env.NODE_ENV !== 'production' && status >= 500) {
    body.error.stack = err.stack;
  }
  res.status(status).json(body);
}
```

Log full `err` + `requestId` server-side — see
[Error logging at the edge](07-error-logging.md).

## The three fields, and why each earns its place

| Field | Audience | Why |
|---|---|---|
| `code` | **Machines** | A stable string the client branches on. `INVALID_EMAIL` survives copy edits; a message does not |
| `message` | **Humans** debugging | Free to change. Never the thing a client parses |
| `details` | **Forms** | Per-field errors for validation. Optional, and absent rather than `null` when unused |

The split matters because the two audiences want opposite things. A client needs
a value that never changes; a developer needs a message that can be improved. Put
the contract in `code` and you can rewrite every message without breaking anyone.

**Add a request id to the body as well as the log.** A user reporting "it failed"
with an id turns a search through thousands of lines into one lookup — and unlike
the error itself, an id is safe to expose.

## Deciding what is safe to expose

The `expose` convention (`statusCode < 500`) is a good default, and it encodes a
real distinction: **4xx errors describe the caller's request, 5xx errors describe
your internals.** The caller already knows what they sent, so echoing it back
leaks nothing. What went wrong inside your process is not theirs to know.

Where the default is wrong:

- A **5xx you raised deliberately** — "payment provider unavailable" — is safe and
  useful. Set `expose: true` explicitly.
- A **4xx carrying internal detail** — a validation message quoting a database
  constraint name — is a leak with a 400 status. `expose` is not a substitute for
  writing the message carefully.

Treat `expose` as a default that individual errors override, never as a rule that
excuses the message text.

## Trade-off

A single envelope for every failure means clients write one parser, and you can
add fields without breaking them. The cost is uniformity where it is sometimes
unhelpful: a validation failure and a database outage arrive in the same shape,
so clients must inspect `code` to tell a retry from a fix-your-input. That is the
right trade — the alternative, per-endpoint error shapes, pushes the same problem
onto every client and multiplies it.

The real cost is discipline. One handler that forgets the envelope, or one route
that responds with `res.status(400).send('bad')`, and the contract is a suggestion.

## Gotchas

**Symptom:** Production returns an HTML error page instead of JSON  
**Cause:** No custom error handler, so Express's default responded  
**Fix:** Register the four-arg handler. The default is HTML by design

**Symptom:** Stack traces appear in production responses  
**Cause:** `NODE_ENV` is unset — it is not `'production'`, so the development branch ran  
**Fix:** Set `NODE_ENV=production` in the deployment environment, and assert it at
startup rather than trusting it. Defaulting the *check* to the safe side —
`process.env.NODE_ENV !== 'development'` — fails closed instead of open

**Symptom:** A client's error handling breaks after a copy edit  
**Cause:** They were matching on `message` because `code` was missing or inconsistent  
**Fix:** Always send `code`, document it, and treat it as a public API — changing one is
a breaking change

**Symptom:** `details` is `null` in some responses and absent in others  
**Cause:** `JSON.stringify` **omits `undefined` properties but serialises `null`**  
([MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify))  
**Fix:** Pick one and be consistent. Leaving the field `undefined` when unused keeps it
out of the payload entirely, which is usually what you want

**Symptom:** An unexpected 500 leaks a database constraint name to the client  
**Cause:** A driver error passed through with `expose` unset but a 4xx status assigned
elsewhere  
**Fix:** Never forward a driver error's message. Map it to your own `code` and message
at the boundary where you catch it

## Interview questions

**★ What must never appear in production error JSON?**  
Stack traces and internal exception messages for unexpected 500s.

**★ Why send a `code` when the message already says what happened?**  
Because the message is for humans and will be rewritten; the code is the contract.
Clients that branch on message text break the first time someone improves the copy.

**★ How do you decide whether an error's message is safe to send?**  
Default on status: 4xx describes the caller's own request and is safe; 5xx describes
your internals and is not. Override deliberately with `expose` for 5xx you raised
on purpose — and never let a driver or ORM message through unmapped.

**What does Express do by default with an unhandled error, and why is that wrong for an API?**  
It responds with an HTML page (or `err.stack` in development), status from
`err.status`/`err.statusCode`. Wrong for an API on two counts: the content type is
not JSON, and the leak is decided by `NODE_ENV` rather than by you.

**Why include a request id in the error body?**  
It is the only field that links a user's report to your logs, and it is safe to
expose. Without it, "I got an error at about 2pm" is not a searchable fact.

---

← Prev: [Async errors on Express 5](02-async-errors/README.md) · Next → [Mapping to HTTP](04-mapping-to-http.md)
