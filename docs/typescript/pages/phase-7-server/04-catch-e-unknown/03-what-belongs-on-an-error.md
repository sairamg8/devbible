---
title: "What belongs on an error"
sidebar_label: "03 · What belongs on it"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **Node.js API docs** (*Errors* — `error.cause`
> added v16.9.0 and its documented purpose, quoted below;
> `Error.captureStackTrace(targetObject[, constructorOpt])` and its frame-omission
> behaviour, quoted; `Error.stackTraceLimit` default **10**, and that changes
> affect traces captured *after* the change) and the **TypeScript `lib`
> declarations shipped with the compiler**, where `cause?: unknown` appears in
> **`lib.es2022.error.d.ts`**. **No sandbox, no console block.**

[Chunk 02](./02-making-an-error-recognisable.md) settled how an error is
*identified*. This chunk is about what it should *carry* — and the three things
people habitually put on one that do not belong.

## `cause`, and chaining without swallowing

Node documents the purpose precisely:

> If present, the `error.cause` property is the underlying cause of the `Error`.
> It is used when catching an error and throwing a new one with a different
> message or code in order to still have access to the original error.

In TypeScript it is `cause?: unknown` in `lib.es2022.error.d.ts` — **`unknown`,
not `Error`**, because the thing you are wrapping is under no obligation to be
an error either ([phase 2](../../phase-2-narrowing/12-unknown-in-catch.md)'s
point about `throw` accepting any expression).

```ts
try {
  return await pool.query(sql, params);
} catch (e) {
  throw new RepositoryError('Failed to load user', { cause: e });
}
```

The rule that makes chains useful rather than noisy: **each layer adds what it
knows and nothing else.** The repository knows the operation; the driver knows
the SQLSTATE; the handler knows the request. Restating the driver's message in
your wrapper produces a three-link chain that says the same thing three times.

Walking a chain is worth writing once, and needs a cycle guard — `cause` is
`unknown`, and nothing prevents a loop:

```ts
export function causeChain(e: unknown): unknown[] {
  const seen = new Set<unknown>();
  const chain: unknown[] = [];
  let current = e;
  while (current !== undefined && current !== null && !seen.has(current)) {
    seen.add(current);
    chain.push(current);
    current = (current as { cause?: unknown }).cause;
  }
  return chain;
}
```

### 🔴 `cause` does not serialise

`JSON.stringify(err)` yields `{}` for a plain `Error`. `message`, `stack` and
`cause` are not part of its JSON representation, so **a logger that stringifies
the error object drops the entire chain silently** — and produces a log entry
that looks like it succeeded in recording something.

Give the base class a `toJSON`, or hand the logger explicit fields:

```ts
export class AppErrorBase extends Error {
  toJSON() {
    return {
      name: this.name,
      code: (this as { code?: unknown }).code,
      message: this.message,
      stack: this.stack,
      cause: this.cause instanceof Error ? this.cause.message : this.cause,
    };
  }
}
```

⚠️ That `toJSON` deliberately flattens `cause` to one level. Serialising the
whole chain recursively is how a single error becomes a megabyte of log when
something wraps in a loop.

## `captureStackTrace` — hiding your own factory

If errors come from a helper rather than from `new` at the call site, the top
frames of every stack point at the helper. Node documents the fix:

> The optional `constructorOpt` argument accepts a function. If given, all
> frames above `constructorOpt`, including `constructorOpt`, will be omitted
> from the generated stack trace. […] useful for hiding implementation details
> of error generation from the user.

```ts
export class AppErrorBase extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    Error.captureStackTrace?.(this, new.target);   // drop the constructor frames
  }
}
```

Passing `new.target` omits the whole constructor chain, so the first frame is
the code that actually threw rather than three layers of your own base classes.

🔴 **The optional call (`?.`) is not defensive padding.** `captureStackTrace` is
**V8-specific** — it is not part of the language, and code shared with another
runtime, or run under a different engine in a test harness, must not assume it.
Note also that TypeScript's `lib` declares it (via `@types/node`), so the
compiler will *not* warn you that you are relying on a non-standard API.

Related, and a real cost: `Error.stackTraceLimit` defaults to **10**, and Node
documents that changes affect any trace captured *after* the change. Raising it
globally to debug one path makes **every** error in the process more expensive to
construct — which matters directly for
[chunk 04](./04-what-you-do-with-it.md)'s argument about throwing on routine
paths.

## What belongs

**A stable `code`.** Chunk 02's discriminant — the thing every consumer matches
on.

**A message safe to log.** Assume it will be copied into an aggregator, a ticket
and a Slack channel.

**Structured context as real properties**, not interpolated into the message:

```ts
class NotFoundError extends Error {
  readonly code = 'NOT_FOUND' as const;
  constructor(readonly resource: string, readonly id: string) {
    super(`${resource} not found`);
    this.name = 'NotFoundError';
  }
}
```

`resource` and `id` are queryable in a structured logger. The same values baked
into a message string are a regex away from being useful, and every distinct id
becomes a distinct message — which defeats grouping in every error tracker.

**`cause`**, always, when wrapping.

## What does not belong

**An HTTP status code.** It couples your domain to a transport. The mapping is a
function at the boundary — topic 13 — and keeping it there is what lets the same
`NotFoundError` mean 404 over HTTP and something else entirely over a queue or a
CLI. A `status: 404` field on a domain error is the single most common version
of this mistake, and it looks harmless until the second transport arrives.

**Anything you would not want in a log aggregator.** Tokens, password hashes,
connection strings, full request bodies. An error object is one of the
most-copied values in a system: it is logged, serialised, attached to traces and
sent to a third-party service. Treat every property as public.

⚠️ The subtle version: `cause` inherits this. Wrapping a driver error that
embedded the connection string in *its* message means your safe wrapper now
carries an unsafe chain.

**A message assembled for an end user.** Presentation needs the locale and the
audience, neither of which the throw site has. The boundary renders; the error
reports.

## Gotchas

**Symptom:** the log shows `{}` where the error should be.
**Cause:** `JSON.stringify` on an `Error`. Its useful properties are not part of
the JSON representation, and `cause` goes with them.
**Fix:** a `toJSON` on the base class, or pass fields to the logger explicitly.

**Symptom:** the error tracker shows ten thousand distinct issues that are all
the same bug.
**Cause:** the id was interpolated into the message, so every occurrence has a
unique message and grouping fails.
**Fix:** a constant message plus structured properties.

**Symptom:** every stack trace starts inside your error factory.
**Cause:** the error is constructed in a helper, so those frames are on top.
**Fix:** `Error.captureStackTrace?.(this, new.target)`.

**Symptom:** a connection string appeared in a third-party error dashboard.
**Cause:** a driver error whose message contained it was attached as `cause` to
an otherwise-safe wrapper.
**Fix:** sanitise at the boundary before reporting, and never assume the chain
is as safe as the outermost error.

**Symptom:** logs became enormous after adding error wrapping.
**Cause:** a `toJSON` that serialises the whole `cause` chain recursively, or a
raised `Error.stackTraceLimit`.
**Fix:** flatten `cause` to one level; leave the limit at its default of 10.

**Symptom:** the same error needs a different status code in a new consumer.
**Cause:** the status was baked onto the error class.
**Fix:** move it to a mapping function per transport. The error keeps its
`code`; the boundary decides what that means.

## Interview questions

**Why is `cause` typed `unknown` rather than `Error`?**
Because `throw` accepts any expression, so the value you are wrapping may be a
string, a number or `null`. Typing it `Error` would be the same lie as
`catch (e: any)` — a claim about external data that nothing verified. It is
declared `cause?: unknown` in `lib.es2022.error.d.ts` for exactly that reason.

**Your logger prints `{}` for errors. Why?**
`JSON.stringify` on an `Error` produces `{}` — `message`, `stack` and `cause`
are not part of its JSON representation. The whole cause chain disappears with
them, and the log line looks successful. Add a `toJSON`, or extract fields
before logging.

**Should an error carry its HTTP status code?**
No. It couples the domain to a transport, and the same error may cross more than
one. Map error `code` to status in one function at the HTTP boundary, driven by
an exhaustive switch so a new error type cannot be forgotten.

**What does `Error.captureStackTrace(this, new.target)` do, and what is the
catch?**
It removes every frame at and above the constructor, so the trace begins at the
code that actually threw rather than inside your error base classes. The catch is
that it is V8-specific — not part of the language — and `@types/node` declares
it, so the compiler will not warn you that you have taken a runtime dependency.

**Why put the resource id in a property instead of the message?**
Because error trackers group by message. An id in the message makes every
occurrence unique, turning one bug into thousands of issues, and makes the value
extractable only by regex. As a property it is both groupable and queryable.

---

← [02 · Making it recognisable](./02-making-an-error-recognisable.md) · Next → [04 · What you do with it](./04-what-you-do-with-it.md)
