---
title: "Programmer errors and the fallback"
sidebar_label: "03 · Programmer errors and the fallback"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

**A `TypeError` from a typo is not a failure mode you handle — it is a bug that
escaped. The fallback's job is to keep the process serving, tell the client
nothing, and record everything.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run and
> no console block.** The
> [error handling guide](https://expressjs.com/en/guide/error-handling.html)
> states that an error passed to `next()` with no custom handler goes to the
> built-in handler, which writes the stack trace to the client and that *"the
> stack trace is not included in the production environment"*; that if
> `next(err)` is called **after the response has started**, Express *"delegates to
> the default Express error handler, which closes the connection and fails the
> request"*; and that a custom handler must delegate with `next(err)` in that
> case rather than respond. `res.headersSent` is the documented test
> ([response reference](https://expressjs.com/en/5x/api/response.html)).
> Process-level `uncaughtException` and `unhandledRejection` are **Node's**, not
> Express's ([Node · process](https://nodejs.org/api/process.html)), and are
> argued in [Node Phase 0](../../../../nodejs/pages/phase-0-runtime-model/README.md).
> **The response policy, the crash argument and the test design are this bible's.**

## Programmer errors are not a category you serve

```js
const total = order.items.reduce(…);   // order is undefined
// TypeError: Cannot read properties of undefined (reading 'items')
```

A `TypeError`, a `ReferenceError`, a `RangeError` from unbounded recursion — none
of them describe something the caller did wrong, and none has a status that means
anything to them. **The only honest answer is 500 with no detail**
([topic 05](../05-operational-vs-programmer.md)).

🔴 **A programmer error is still triggered by input.** "Malformed body caused a
`TypeError`" does not make it a 400 — it makes it a bug *and* a missing validation
([Phase 8 · 01](../../phase-8-validation-authz/01-validate-at-boundary/README.md)).
Answering 400 hides it: the client sees a plausible message, the metric records a
client error, and nobody fixes the crash that a different input will trigger
again.

## What the fallback actually does

Four steps, in this order:

```js
export function errorHandler(err, req, res, next) {
  const e = normalise(err);                         // chunk 01

  if (res.headersSent) return next(e);              // 1 · Express must finish this

  const status = e.status ?? 500;                   // 2 · only trusted if we set it
  const expose = e.expose ?? status < 500;

  logger[status >= 500 ? 'error' : 'warn']({        // 3 · everything, always
    err: e, requestId: req.id, route: req.route?.path,
  }, 'request failed');

  if (e.headers) res.set(e.headers);                // 4 · WWW-Authenticate, Retry-After
  res.status(status).json({
    error: {
      code: expose ? e.code : 'INTERNAL',
      message: expose ? e.message : 'Something went wrong',
      requestId: req.id,                            // the only internal fact worth sending
      ...(expose && e.details ? {details: e.details} : {}),
    },
  });
}
```

**`requestId` is the whole trick.** It gives the client something to quote and
support something to search, while the response carries no stack, no SQL, no
hostname, no library name
([topic 03 · chunk 02](../03-error-contract/02-what-is-safe-to-expose.md),
[Phase 10 · 02](../../phase-10-app-factory/02-request-id.md)).

⚠️ **Do not trust `err.status` from a library.** Some libraries attach a
`status` — `http-errors`-based ones deliberately, others accidentally — and a
number arriving from code you did not write is not a decision you made. Trust the
status on **your** error classes; treat anything else as 500 unless you recognise
its source.

## Headers already sent: the case with no good answer

If the response has begun — a stream, a partial JSON body, an early
`res.write()` — the status line is already on the wire and nothing can change it.

```js
if (res.headersSent) return next(err);     // ✅ delegate; Express closes the connection
```

Express's documentation is explicit that a custom handler must delegate in this
case, and that the built-in handler then closes the connection and fails the
request. **A truncated response is the honest outcome**: the client sees an
incomplete body and a broken connection rather than a 200 that was a lie
([topic 01 · chunk 03](../01-error-middleware/03-designing-the-handler.md),
[Phase 4 · 04](../../phase-4-responses/04-headers-already-sent.md)).

The design lesson is upstream: **do not start writing until the work that can
fail has succeeded.** Streaming from a query that may error mid-flight is exactly
how this happens ([Phase 4 · 08](../../phase-4-responses/08-streaming-and-downloads.md)).

## The client that went away

Not every failure is an error. A user hitting Escape, closing a tab, or a mobile
network dropping produces an aborted request, and its symptoms — `ECONNABORTED`,
`ECONNRESET`, an `AbortError` from your own cancellation
([chunk 02](02-database-and-network.md)) — look like infrastructure failures.

**Do not alert on them, and do not log them as errors.** They are traffic. The tell
is that the response has no destination: nothing you write will be read, so the
work worth doing is cancelling downstream calls, not composing a status. An alert
threshold tuned by client disconnections is an alert threshold that ignores real
5xx.

## Should it crash?

The classic answer is that an `uncaughtException` leaves the process in an unknown
state and it should exit. That is right **for the process-level handler** and
wrong as a description of what Express does for you:

| Where the bug throws | What happens | What you should do |
|---|---|---|
| Inside a request handler | Express 5 forwards it to your handler | **500 and keep serving** — one request is affected |
| Inside the error handler | falls through to Express's built-in one | fix it; guard the handler |
| In a timer, or a floating promise | never reaches Express | it reaches `unhandledRejection` |
| At module scope, at boot | the process never becomes ready | crash — fail the deploy |

🔴 **Do not exit the process because one request threw.** Express 5 already
isolates it: the request gets a 500, every other in-flight request is unaffected,
and restarting would fail them all to fix a bug that a restart does not fix
([topic 02](../02-async-errors/README.md)).

**Do exit on a process-level `uncaughtException`** — after logging it and giving
in-flight requests a moment to finish — because by definition nothing caught it
and no code in the app claims to know the state. That handler belongs in the
entrypoint with shutdown, not in the factory
([Phase 10 · 06](../../phase-10-app-factory/06-shutdown-and-entrypoint.md)), and
the reasoning is Node's ([topic 06](../06-not-found-and-process.md)).

## Test the taxonomy as a table

Every family in [chunk 01](01-the-taxonomy.md) is one row, and the test is worth
more than testing the handler in isolation because it asserts the *whole* path —
translation included:

```js
const CASES = [
  ['domain error',       () => { throw new NotFoundError('ORDER_NOT_FOUND'); }, 404, 'ORDER_NOT_FOUND'],
  ['validation',         () => { throw zodIssues(); },                          400, 'VALIDATION_FAILED'],
  ['unique violation',   () => { throw pgError('23505', 'users_email_key'); },  409, 'EMAIL_TAKEN'],
  ['undefined column',   () => { throw pgError('42703'); },                     500, 'INTERNAL'],
  ['dependency refused', () => { throw sysError('ECONNREFUSED'); },             502, 'INTERNAL'],
  ['programmer error',   () => { undefined.x; },                               500, 'INTERNAL'],
  ['non-Error throw',    () => { throw 'nope'; },                               500, 'INTERNAL'],
];

for (const [name, fail, status, code] of CASES) {
  it(`${name} → ${status} ${code}`, async () => {
    const app = createApp({orderService: {get: fail}, config});
    const res = await request(app).get('/api/orders/1');

    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(code);
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.js:|users_email_key|ECONNREFUSED/);
  });
}
```

Three things this pins that nothing else does:

1. **Every 500 says `INTERNAL`** — one line proves the fallback does not leak a
   driver's vocabulary, a constraint name, or a stack frame.
2. **The recognised codes stay recognised.** A refactor that moves the repository's
   translation shows up as `409 EMAIL_TAKEN` becoming `500 INTERNAL`.
3. **Non-`Error` throws are covered**, which no unit test of the handler will do
   because nobody thinks to call it with a string.

## Gotchas

**Symptom:** A `TypeError` is reported to the client as 400
**Cause:** "The input caused it" read as "the client's fault"
**Fix:** 500 and a bug ticket — plus the validation that should have rejected the
input

**Symptom:** A stack trace appears in a production response
**Cause:** No custom handler, so Express's built-in one answered — or a handler
that echoes `err.message` at 500
**Fix:** A four-argument handler, and `expose` gating every message

**Symptom:** "Cannot set headers after they are sent" in the logs
**Cause:** The error handler responded to a request that had already started
**Fix:** `if (res.headersSent) return next(err)` as the first line after
normalising

**Symptom:** Alert noise from `ECONNRESET`
**Cause:** Client disconnections logged and counted as server errors
**Fix:** Aborted requests are traffic; cancel downstream work and move on

**Symptom:** A library's error produced a 403 nobody intended
**Cause:** `err.status` trusted from code you did not write
**Fix:** Trust the status on your own error classes only

**Symptom:** The process restarts whenever one endpoint throws
**Cause:** Exiting on a request-scoped error
**Fix:** Express 5 isolates it — 500 and keep serving; exit only on process-level
`uncaughtException`

**Symptom:** The error response has no way to trace it
**Cause:** Nothing correlating the response with the log line
**Fix:** `requestId` in the body — the one internal fact worth exposing

## Interview questions

**★ What status does a `ReferenceError` deserve, and why not 400 even when input
triggered it?**
500. It describes a bug, not something the caller did wrong, and there is no
detail that is safe or useful to them. Answering 400 hides it — the metric
records a client error and the crash stays unfixed for the next input that
triggers it.

**★ What must the handler do when the response has already started?**
Delegate with `next(err)`. The status line is on the wire and cannot be changed;
Express's built-in handler then closes the connection and fails the request,
which is the honest outcome. The real fix is upstream: do not start writing until
the work that can fail has succeeded.

**★ Should the process exit when a request handler throws?**
No. Express 5 forwards it to your handler, so one request gets a 500 and the rest
are unaffected; restarting would fail them all without fixing the bug. Exit on a
process-level `uncaughtException`, where nothing caught it and the state is
genuinely unknown — and that handler belongs in the entrypoint.

**★ How do you prove the fallback does not leak?**
A table test with one row per error family — domain, validation, driver code,
your-bug driver code, dependency failure, programmer error, non-`Error` throw —
asserting both the status and that the serialised body contains no stack frame,
constraint name or system error code.

**Why not trust `err.status` from a library?**
Because a number attached by code you did not write is not a decision you made.
Some libraries set it deliberately, others incidentally, and one of those becomes
a 403 nobody intended. Trust your own error classes and treat the rest as 500.

**Is `ECONNRESET` an error?**
Usually not — it is a client that went away. Nothing you write will be read, so
the useful work is cancelling downstream calls, and counting it as a 5xx is how
alert thresholds end up ignoring real ones.

---

← Prev: [Database and network](02-database-and-network.md) · Index: [Every error that arrives](README.md) · Next → [Phase 6](../../phase-6-rest-surface/README.md)
