---
title: "What you do with it"
sidebar_label: "04 · What you do with it"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **Node.js API docs** (*Process* —
> `'uncaughtException'`'s default of printing the stack to `stderr` and exiting
> 1, the *"not safe to resume normal operation"* warning, and
> `'unhandledRejection'` being raised as an uncaught exception with
> `--unhandled-rejections` defaulting to `throw`; *Command-line API* — the
> `--enable-source-maps` `Error.stack` latency note, quoted in
> [topic 02](../02-shipping-to-production/02-source-maps-and-stack-traces.md)).
> The claim that TypeScript does not type thrown values is a property of the
> language: a function type is parameters and a return type, with no throws
> clause. **No sandbox, no console block.**

Chunks [01](./01-proving-it-on-a-server.md), [02](./02-making-an-error-recognisable.md)
and [03](./03-what-belongs-on-an-error.md) were about *knowing what you caught*.
This one is about the decision that knowledge exists to serve, and it starts with the
observation that makes error handling a **type-system** problem rather than a
logging problem:

> **TypeScript cannot type what a function throws.** A function's type is its
> parameters and its return type. There is no throws clause, no checked
> exceptions, and no inference of them. Every `throw` is an **untyped side
> channel** out of a typed function.

That is not a gap to work around; it is the fact that decides the design. If a
possible outcome matters to the caller, expressing it as a `throw` makes it
**invisible to the compiler** — nobody is forced to handle it, and adding a new
one breaks no build.

## The first decision: should this be thrown at all?

Split every failure into two kinds. The distinction is not in any specification
— it is a design taxonomy — but it is the one that determines behaviour:

| | **Expected outcome** | **Genuine fault** |
|---|---|---|
| Examples | user not found · duplicate email · invalid input · payment declined | null dereference · failed invariant · config missing at boot · connection pool exhausted |
| Frequency | routine, many per minute | rare, and each one is news |
| Caller | must handle it | usually cannot do anything useful |
| Right shape | **a return value in the type** | **`throw`** |

🔴 **An expected outcome modelled as a thrown error is the most common
error-handling mistake in a typed codebase**, and it has three separate costs:

1. **It is invisible to the compiler.** `findUser` that throws `NotFoundError`
   has the same type as one that cannot fail. The caller who forgot is not told.
2. **It is expensive.** Constructing an `Error` captures a stack trace —
   `Error.stackTraceLimit` frames of it, defaulting to 10.
3. 🔴 **It makes `--enable-source-maps` a latency problem.** This is the thread
   [topic 02](../02-shipping-to-production/02-source-maps-and-stack-traces.md)
   deferred here. Node documents that enabling source maps *"can introduce
   latency to your application when `Error.stack` is accessed"* and to take that
   into account *"if you access `Error.stack` frequently"*. A service that throws
   on every 404 and logs each stack is doing source-map resolution on its normal
   path — and the p99 regression looks like the flag's fault when the flag is
   only revealing a design choice.

The fix for all three is one change:

```ts
type FindResult =
  | { ok: true; user: User }
  | { ok: false; reason: 'not-found' | 'suspended' };

async function findUser(id: UserId): Promise<FindResult> { … }
```

Now the failure is **in the signature**. The caller must discriminate, adding a
third `reason` breaks every consumer at compile time, and no stack is captured
for something that was never exceptional.

📌 Do not over-apply this. A `Result` type on *every* function reproduces
checked exceptions and their well-known ergonomic cost. The line is the table
above: **routine and actionable → return it; rare and unrecoverable → throw
it.**

## Wrapping: add context, never swallow

For genuine faults, the value of a `catch` block is almost always to **add what
this layer knows** and re-throw ([chunk 03](./03-what-belongs-on-an-error.md)'s
`cause`):

```ts
catch (e) {
  throw new RepositoryError(`Loading user ${id}`, { cause: e });
}
```

Three anti-shapes, all common:

**The empty catch.**

```ts
try { await audit(event); } catch {}
```

Sometimes deliberate — an audit write that must not fail a request. Deliberate
needs a comment saying so; without one it is indistinguishable from a bug, and
it is the only construct in a codebase that guarantees a silent failure.

**Catch, log, re-throw.**

```ts
catch (e) { logger.error(e); throw e; }
```

Each layer doing this produces N log entries for one failure, N stack
serialisations, and an on-call engineer counting timestamps to work out whether
they had one incident or four. **Log where you handle, not where you pass
through.**

**Catch and return a default.**

```ts
catch { return []; }
```

An empty list is indistinguishable from a successful empty result. The caller
renders "no items" for a database outage. If the fallback is right, say so in
the type — `{ ok: false, reason: 'unavailable' }` — so the caller can decide.

## One handler at the boundary

The shape that follows from all of it: **layers wrap and re-throw; exactly one
place converts an error into a response.**

```ts
// the only place that decides what the outside world sees
function toResponse(e: unknown): { status: number; body: ErrorBody } {
  if (isAppError(e)) return { status: statusFor(e), body: publicBody(e) };
  logger.error({ err: serialise(e) });                // unknown fault: log once
  return { status: 500, body: { code: 'INTERNAL' } }; // and say nothing else
}
```

Two rules that boundary enforces, both about the second branch:

- **An unrecognised error is a 500 and an opaque body.** Echoing
  `e.message` leaks table names, file paths and connection strings. The message
  goes to the log; a correlation id goes to the client.
- **It logs exactly once, with the whole `cause` chain**, using an explicit
  serialiser rather than `JSON.stringify` — which, per chunk 03, yields `{}`.

The Express-shaped version of this, with the four-argument signature TypeScript
cannot enforce, is **topic 08 · Typed middleware** *(dropped 2026-08-15)*; the
error-union-to-status-code mapping with its exhaustiveness check is **topic 13 ·
Typed errors → HTTP responses** *(dropped 2026-08-15)*. This chunk is why they are
each one function in one place.

## The process-level handlers are not a safety net

```ts
process.on('uncaughtException', (err, origin) => { … });
process.on('unhandledRejection', (reason) => { … });
```

Node's documentation is blunt, and it is worth quoting rather than paraphrasing:

> `'uncaughtException'` is a crude mechanism for exception handling intended to
> be used only as a last resort. The event *should not* be used as an equivalent
> to `On Error Resume Next`. Unhandled exceptions inherently mean that an
> application is in an undefined state. […] **It is not safe to resume normal
> operation after `'uncaughtException'`.**

Registering a handler **disables** the default — printing the stack to `stderr`
and exiting with code 1 — so the common "log it and carry on" version converts a
crash into a process in an undefined state that keeps taking traffic. That is
strictly worse: the orchestrator's restart was the recovery mechanism.

The defensible handler logs synchronously, then exits and lets the supervisor
restart the process.

`'unhandledRejection'` reaches the same place: an unhandled one *"will be raised
as an uncaught exception"*, and `--unhandled-rejections` defaults to `throw`. So
a forgotten `await` terminates the process by default on current Node — correct,
and a strong argument for `no-floating-promises` in lint, since the type system
will not catch it either.

⚠️ **Neither handler receives a typed value.** `uncaughtException` gives you
`err: Error` by declaration, but `throw 42` reaches it too; `unhandledRejection`
gives you `reason: unknown`. Everything in chunk 01 applies here with less
information than anywhere else — which is the final argument for handling errors
at a boundary you control rather than at the one Node gives you.

## Gotchas

**Symptom:** p99 latency regressed after enabling `--enable-source-maps`, and
the service reports no errors.
**Cause:** it has errors — routine ones. Expected outcomes are thrown, and
something reads `err.stack` on each, so every 404 pays source-map resolution.
**Fix:** stop throwing for expected outcomes. The flag was revealing the design,
not causing the cost.

**Symptom:** one failure produces five log entries at five severities.
**Cause:** catch-log-re-throw at every layer.
**Fix:** wrap with `cause` on the way up; log once, at the boundary.

**Symptom:** a caller forgot to handle a failure mode and nothing flagged it.
**Cause:** the failure is a `throw`, which does not appear in any signature.
TypeScript has no checked exceptions.
**Fix:** if callers must handle it, it belongs in the return type as a
discriminated union.

**Symptom:** the service stays up but every request fails after one bad request.
**Cause:** an `'uncaughtException'` handler that logs and continues, leaving the
process in the undefined state Node warns about.
**Fix:** log synchronously, then exit non-zero. Let the supervisor restart it.

**Symptom:** a client receives an error body naming a database column.
**Cause:** the boundary echoed `e.message` for an unrecognised error.
**Fix:** recognised errors get a mapped public body; everything else gets 500
and a correlation id, with the detail in the log.

**Symptom:** the process exits with no obvious cause after adding an async call.
**Cause:** a floating promise rejected; `--unhandled-rejections` defaults to
`throw`, so it became an uncaught exception.
**Fix:** `await` it or `.catch()` it, and enable `no-floating-promises` — the
compiler will not tell you.

## Interview questions

**Why is throwing for an expected outcome a type-system problem, not a style
preference?**
Because TypeScript cannot type what a function throws — a function type is
parameters and a return type, with no throws clause. A `findUser` that throws
`NotFoundError` is indistinguishable, to the compiler and to every caller, from
one that cannot fail. Nobody is forced to handle it, and adding a new failure
mode breaks no build. Returning a discriminated union puts the outcome in the
signature, where it is checked.

**Where should an error be logged?**
Once, where it is handled — the boundary that converts it into a response. Layers
in between wrap with `cause` and re-throw. Logging at every layer multiplies one
failure into several entries and several stack serialisations, and destroys the
one-incident-one-record property on-call depends on.

**Is an `'uncaughtException'` handler that logs and continues a good idea?**
No. It disables Node's default of printing the stack and exiting 1, and the
documentation states it is not safe to resume normal operation — the application
is in an undefined state. It turns a crash the supervisor would have recovered
from into a process that keeps accepting traffic. Log synchronously, then exit.

**A forgotten `await` on a rejecting promise — what happens on current Node?**
The rejection is unhandled, is raised as an uncaught exception because
`--unhandled-rejections` defaults to `throw`, and the process terminates. The
type system does not catch it, which is why `no-floating-promises` is worth
enabling.

**How does throwing for routine failures interact with source maps?**
Node documents that `--enable-source-maps` adds latency whenever `Error.stack`
is accessed. If routine outcomes are thrown and logged with stacks, that
resolution happens on the normal request path rather than on rare failures — so
a correct observability flag becomes a measurable latency cost, caused by the
error design rather than by the flag.

---

← [03 · What belongs on an error](./03-what-belongs-on-an-error.md) · Next → [Phase 7 index](../README.md)
