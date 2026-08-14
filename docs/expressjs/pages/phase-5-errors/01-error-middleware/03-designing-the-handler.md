---
title: "Designing the handler"
sidebar_label: "03 · Designing the handler"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

**By the time the handler runs, all it has is an error object and a request.
Everything it needs to make a good decision must already be *on* one of those —
which makes the design question "what goes on an error", not "what goes in the
handler".**

> Verified: 2026-08-14. `if (res.headersSent) return next(err)` is the documented
> guard in the
> [error-handling guide](https://expressjs.com/en/guide/error-handling.html); what
> forwarding delegates to is `finalhandler@2.1.1`'s socket destroy, quoted in
> [chunk 02](02-the-default-handler.md). The status-resolution rules the handler
> has to work with are read from the same file in
> `sandbox/express-verify/node_modules/`. **No sandbox run backs this page and it
> carries no console block.** The handler design and the error-class shape are
> **this bible's guidance** — Express has no opinion on either, and says so by
> providing neither.

## The whole handler

```js
export function errorHandler(logger) {
  return function errorHandler(err, req, res, next) {
    // 1 · a response already started — only the socket destroy is safe now
    if (res.headersSent) return next(err);

    // 2 · resolve, once
    const status = statusFor(err);
    const expose = status < 500;

    // 3 · log with the request's identity, at a level that matches the status
    logger[status >= 500 ? 'error' : 'warn']({
      err,
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      status,
    });

    // 4 · answer, saying only what a client may know
    res.status(status).json({
      error: expose ? (err.code ?? 'bad_request') : 'internal_error',
      message: expose ? err.message : 'Something went wrong',
      requestId: req.id,
      ...(err.details ? {details: err.details} : {}),
    });
  };
}
```

Six decisions are encoded there, and each is a mistake somebody has made.

## 1 · The `headersSent` guard comes first

Before logging, before anything. An error raised after the response started
cannot be answered, and trying throws `ERR_HTTP_HEADERS_SENT` **inside your error
handler**, which has nowhere to go. Forwarding hands it to `finalhandler`, which
destroys the socket so the client sees a transport error rather than a
plausible-looking truncated body ([chunk 02](02-the-default-handler.md)).

## 2 · 4xx and 5xx are different kinds of event

| | 4xx | 5xx |
|---|---|---|
| Whose fault | the caller's | yours |
| Log level | `warn`, or `info` for expected ones | `error` |
| Should it page anyone | no | yes |
| Message to the client | **the real one** | a generic one |
| Is it a bug | usually not | always |

🔴 **Logging 4xx at `error` is how alert fatigue starts.** A client sending a bad
body is not an incident; a thousand of them is a client bug, not yours. Split the
level on the status and the error rate becomes a signal again.

## 3 · Expose 4xx messages, never 5xx ones

`expose = status < 500` is the rule that matters most for security. A 4xx message
is *about the caller's request* — "email must be a string" — and telling them is
the point. A 5xx message is about your internals: a connection string, a table
name, a driver error mentioning a column that does not exist. **Send a generic
message and a request id, and put the detail in the log.**

The request id is what makes that acceptable. Without it, "Something went wrong"
gives a user nothing to report and support nothing to search
([Phase 10 · 02](../../phase-10-app-factory/02-request-id.md)).

## 4 · Map with a table, and default

```js
const STATUS_BY_CODE = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED:   401,
  FORBIDDEN:         403,
  NOT_FOUND:         404,
  CONFLICT:          409,
  RATE_LIMITED:      429,
};

function statusFor(err) {
  if (typeof err.status === 'number' && err.status >= 400 && err.status < 600) return err.status;
  return STATUS_BY_CODE[err.code] ?? 500;
}
```

Two things this avoids. **`res.status(err.code)` throws on Express 5** when
`err.code` is a string like `'ECONNREFUSED'` — `TypeError` for a non-integer,
inside the error handler
([Phase 4 · 02 · chunk 01](../../phase-4-responses/02-status-and-headers/01-status-as-contract.md)).
And **defaulting to 500 rather than to a 4xx** means an unrecognised error is
loud. A default of 400 hides real bugs as client errors, and they never get
investigated.

Note the first branch mirrors `finalhandler`'s own rule, so an `http-errors`
object from `body-parser` — a 413, a 415 — passes through with its correct status
([Phase 3 · 02 · chunk 03](../../phase-3-requests/02-json-and-urlencoded/03-errors-and-choices.md)).

## 5 · Put the decision on the error, not in the handler

The handler is far from the context. A `switch` on `err instanceof …` in the
handler means every new failure mode edits one central file, and the handler
gradually learns about every module in the system.

Instead, give errors the fields the handler reads:

```js
export class AppError extends Error {
  constructor(code, message, {status, details, headers} = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;         // a stable string for clients — not the message
    this.status = status;     // optional; the table can supply it
    this.details = details;   // field-level detail for 4xx
    this.headers = headers;   // e.g. { 'Retry-After': '30' }
  }
}

throw new AppError('CONFLICT', 'That email is already registered', {details: {field: 'email'}});
```

**`code` is the client contract, not `message`.** Messages get reworded, typo-
fixed and translated; a client branching on the text breaks. A stable code
survives all of that, and it is the thing to put in your OpenAPI
([Phase 5 · 03](../03-error-contract/README.md)).

## 6 · The handler must not throw

It is the last thing between an error and `finalhandler`, and anything it throws
goes straight there — losing your envelope and, in a non-production `env`,
leaking a stack. So:

- **Never assume a shape.** `err.details.field` throws when `details` is absent.
  Optional chaining and spreads, everywhere.
- **Never assume it is an `Error`.** `next('a string')` is legal and arrives as a
  primitive with no `message`
  ([Phase 2 · 03 · chunk 01](../../phase-2-middleware/03-next-semantics/01-what-you-can-pass.md)).
  `String(err?.message ?? err)` survives it.
- **Never do I/O you cannot fail safely.** Writing the error to a database from
  the handler means a database outage turns every error into a hang.

## What still is not covered

Two things live outside the handler entirely, and an app without them is not
finished:

```js
process.on('unhandledRejection', (reason) => { logger.fatal({reason}); throw reason; });
process.on('uncaughtException',  (err)    => { logger.fatal({err}); shutdown(1); });
```

A floating promise never reaches your error handler — the request already
succeeded — and by default Node terminates the process on an unhandled rejection.
These two listeners are for **logging before death**, not for continuing: a
process that has thrown out of its call stack has unknown state, and the right
response is a clean shutdown
([Phase 5 · 06](../06-not-found-and-process.md),
[Phase 10 · 06](../../phase-10-app-factory/06-shutdown-and-entrypoint.md)).

## Trade-off

One central error handler gives you a single place where the envelope, the status
mapping and the logging decision live — which is why every guard in a route can be
a bare `throw`. The cost is **distance**: the handler sees an error and a request,
not the context that produced them.

Handling errors locally in each route keeps the context, and you will write the
envelope fifteen times and get it subtly different in three of them.

**Centralise, and put the effort into the error objects instead.** A rich `code`,
an optional `status`, structured `details` and optional `headers` carry exactly
the context the handler lost — and they travel with the error from where it was
raised, which is where the knowledge actually is.

## Gotchas

**Symptom:** `ERR_HTTP_HEADERS_SENT` thrown from inside the error handler
**Cause:** No `res.headersSent` guard, on an error raised after the response
started
**Fix:** `if (res.headersSent) return next(err)` as the **first** line

**Symptom:** The error dashboard is unusable because everything is `error` level
**Cause:** 4xx logged at the same level as 5xx
**Fix:** Split on the status. Client mistakes are `warn`; yours are `error`

**Symptom:** A production error response contains a table name
**Cause:** `err.message` echoed for a 5xx
**Fix:** Expose messages only below 500, and always include a request id so the
detail is retrievable from the log

**Symptom:** `res.status(err.code)` throws `TypeError` inside the handler
**Cause:** Express 5 validates; `err.code` was a string like `'ECONNREFUSED'`
**Fix:** Map codes through a table with a 500 default

**Symptom:** Unknown errors are returned as 400 and nobody investigates them
**Cause:** The mapping defaults to a 4xx
**Fix:** Default to 500. An unrecognised error is a bug until proven otherwise

**Symptom:** The error handler itself crashes for one error type
**Cause:** It assumed a shape — `err.details.field` on an error with no `details`,
or `err.message` on a string
**Fix:** Optional chaining, conditional spreads, and `String(err?.message ?? err)`

## Interview questions

**★ What is the first line of a good error handler, and why?**
`if (res.headersSent) return next(err)`. An error after the response started
cannot be answered; writing throws inside your own handler, and forwarding lets
`finalhandler` destroy the socket so the client sees a transport error rather
than a truncated body it would parse as complete.

**★ Should the client see `err.message`?**
For 4xx, yes — it is about their request and it is the useful part. For 5xx, no —
it is about your internals. Send a generic message plus a request id, and put the
detail in the log where it is retrievable.

**★ Why map error codes through a table instead of `res.status(err.code)`?**
Because `err.code` is often a string, and Express 5's `res.status` throws
`TypeError` for a non-integer — inside the error handler, which has nowhere to go.
A table also gives you a deliberate default, which should be 500.

**★ Why default an unmapped error to 500 rather than 400?**
Because 500 is loud. Defaulting to a 4xx classifies your own bugs as client
mistakes, so they never appear in the error rate and never get investigated.

**★ Why put `code`, `status` and `details` on the error rather than switching on
type in the handler?**
Because the handler is far from the context and a central `switch` makes it learn
about every module in the system. Fields on the error travel from where the
failure was understood, and adding a new failure mode then needs no edit to the
handler.

**What does an error handler not cover?**
Anything that never becomes a `next(err)` — a floating promise, a `setTimeout`
throw, an event-emitter throw. Those need `process.on('unhandledRejection')` and
`process.on('uncaughtException')`, and the correct response there is to log and
shut down cleanly, not to continue.

---

← Prev: [The default handler](02-the-default-handler.md) · Index: [Error middleware](README.md) · Next topic → [Async errors](../02-async-errors/README.md)
