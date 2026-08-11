---
title: "Error design"
sidebar_label: "16 · Error design"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**Errors are an API. Design them so callers can branch on them programmatically,
not by matching on message strings.**

## Codes, not messages

```js
// ❌ breaks the day someone improves the wording
if (err.message.includes('not found')) return res.status(404).end();

// ✅ stable, greppable, translatable
if (err.code === 'ERR_USER_NOT_FOUND') return res.status(404).end();
```

Node's own errors work this way — every built-in error carries a stable `code`:

```js
// nodeerrors.mjs
import { readFile } from 'node:fs/promises';
try { await readFile('/nope/missing'); }
catch (e) { console.log('node error →', e.code, '|', e.syscall); }
```

```console
$ node nodeerrors.mjs
node error → ENOENT | open
```

`e.code === 'ENOENT'` is documented and will not change. `e.message` is not a
contract. Do the same in your own code.

## Custom error classes

```js
// errors.mjs
class ValidationError extends Error {
  constructor(field, options) {
    super(`invalid field: ${field}`, options);
    this.name = 'ValidationError';
    this.code = 'ERR_VALIDATION';
    this.field = field;
  }
}

try {
  try { JSON.parse('{ broken'); }
  catch (low) { throw new ValidationError('payload', { cause: low }); }
} catch (e) {
  console.log(e.name, '|', e.code, '|', e.message);
  console.log('cause:', e.cause.constructor.name, '—', e.cause.message.slice(0, 40));
  console.log('instanceof Error:', e instanceof Error, '| instanceof ValidationError:', e instanceof ValidationError);
}
```

```console
$ node errors.mjs
ValidationError | ERR_VALIDATION | invalid field: payload
cause: SyntaxError — Expected property name or '}' in JSON at
instanceof Error: true | instanceof ValidationError: true
```

Four things every custom error should do:

1. **Extend `Error`** so stacks, `instanceof` and logging all work.
2. **Set `name`** — it is what appears in stack traces and log output.
3. **Set a `code`** — the stable identifier callers branch on.
4. **Carry structured context** (`field`, `userId`, `statusCode`) as properties, not
   interpolated into the message.

Pass `options` through to `super` so `{ cause }` keeps working.

**Do not build a deep hierarchy.** Two or three types plus codes covers almost
everything; `NotFoundError extends AppError extends DomainError extends Error` is
ceremony that no caller uses.

## `error.cause`

The standard way to wrap without losing the original:

```js
throw new PaymentError('charge failed', { cause: gatewayError });
```

Every layer can add meaning while the root cause stays reachable at `.cause`, and
`console.log` prints the chain. Before `cause` existed people stuffed the original
into a custom property or concatenated messages; you will still see both.

The rule: **wrap when you add information, rethrow bare when you do not.** A
`catch` that wraps an error in a new error with the same message is noise.

## `AggregateError`

For when several things failed and one reason is not enough:

```js
const agg = new AggregateError([new Error('a'), new Error('b')], 'both failed');
console.log(agg.name, '|', agg.message, '|', agg.errors.length, 'errors');
```

```console
AggregateError | both failed | 2 errors
```

`Promise.any` throws one when every input rejects —
[combinators](09-combinators.md). Use it yourself for batch operations where the
caller needs every failure, not the first.

## Operational vs programmer errors

The distinction that decides whether to handle or crash:

| | Operational | Programmer |
|---|---|---|
| Examples | Network timeout, 404, invalid user input, disk full | `undefined is not a function`, bad argument type, typo |
| Cause | The world | Your code |
| Response | **Handle it** — retry, fall back, return 4xx | **Crash** — the assumption is wrong |
| Expected | Yes, in normal operation | No, it is a bug |

Retrying a `TypeError` accomplishes nothing; it will fail identically forever.
Crashing on a 404 is absurd. Most bad error handling is one of these two mistakes.

A common encoding — mark the ones you expect:

```js
class AppError extends Error {
  constructor(message, { code, statusCode = 500, ...options } = {}) {
    super(message, options);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = true;      // ← the flag the boundary checks
  }
}
```

Then one boundary decides:

```js
// express error handler — pseudo-code for the shape
app.use((err, req, res, next) => {
  if (err.isOperational) {
    log.warn({ err }, 'operational');
    return res.status(err.statusCode).json({ error: err.code });
  }
  log.fatal({ err }, 'programmer error — shutting down');
  shutdown(1);                       // see page 15
});
```

## Never leak internals

```js
// ❌ hands the client your stack trace and SQL
res.status(500).json({ error: err.message, stack: err.stack });

// ✅ log everything, return a code and a correlation id
log.error({ err, requestId });
res.status(500).json({ error: 'INTERNAL', requestId });
```

The `requestId` is what makes this workable — the user reports it, you find the
full error in your logs.

## Gotchas

**Symptom:** Error handling breaks after a message is reworded
**Cause:** Branching on `err.message`.
**Fix:** Branch on `err.code`.

**Symptom:** `instanceof MyError` is false for something that clearly is one
**Cause:** Two copies of the module defining it — the
[dual package hazard](../phase-1-modules/08-exports-map.md), or a bundler
duplicating it.
**Fix:** Branch on `err.code` instead; it survives module duplication.

**Symptom:** The stack trace points at the wrapper, not the real failure
**Cause:** The original was discarded when rethrowing.
**Fix:** `{ cause: original }`.

**Symptom:** A custom error prints as `Error` in logs
**Cause:** `this.name` was never set.
**Fix:** Set it in the constructor.

**Symptom:** Clients see database column names in error responses
**Cause:** Raw `err.message` returned to the caller.
**Fix:** Return a code plus a request id; log the detail server-side.

**Symptom:** A retry loop spins forever on a `TypeError`
**Cause:** Retrying a programmer error.
**Fix:** Only retry errors marked operational, and only ones that are plausibly
transient.

## Interview questions

**★ Why branch on `err.code` rather than `err.message`?**
Messages are prose — they get reworded, translated and interpolated, and any of
those breaks a caller matching on them. `code` is a stable identifier that is part
of the contract. Node's own errors follow this convention with values like
`ENOENT`.

**★ What is `error.cause` for?**
Attaching the underlying error when you wrap one in a higher-level error, so a
layer can add meaning without discarding the root cause. It is standard, so
loggers and stack printers display the chain.

**★ What is the difference between an operational and a programmer error?**
Operational errors come from the world — timeouts, missing files, bad input — and
are expected in normal running, so you handle them. Programmer errors are bugs in
your code; the correct response is to crash and restart, because the process's
assumptions are wrong and retrying reproduces the same failure.

**★ What should a custom error class do?**
Extend `Error`, set `name`, set a stable `code`, carry structured context as
properties rather than in the message, and forward `options` to `super` so
`{ cause }` works. Keep the hierarchy shallow — codes do the discriminating.

**★ Why can `instanceof` fail for a custom error?**
If the module defining the class is loaded twice — a dual CJS/ESM package, or a
bundler duplicating it — there are two distinct class objects and `instanceof`
compares against the wrong one. Checking `err.code` avoids the problem entirely.

**What should an error response to a client contain?**
A stable error code, an appropriate status, and a correlation id. Never the stack
trace or raw message, which leak internal structure. The full detail goes to your
logs, findable by that id.

---

← Prev: [Unhandled rejections](15-unhandled-rejections.md) · Next → [Promise anti-patterns](17-promise-antipatterns.md)
