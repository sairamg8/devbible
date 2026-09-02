---
title: "A rejected promise arrives as any unless you annotate it, an aborted request and a timed-out request throw two different DOMException names, and signal.reason is typed any all the way down"
sidebar_label: "06b · Abort and the unknown rejection"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the `AbortController` / `AbortSignal` declarations
> in `lib.dom.d.ts` (`typescript@6.0.3`, the newest TypeScript on this machine;
> TypeScript is not installed in this checkout) — `abort(reason?: any): void`,
> `readonly reason: any`, `throwIfAborted(): void`,
> `static any(signals: AbortSignal[]): AbortSignal`,
> `static timeout(milliseconds: number): AbortSignal` — MDN on
> [`AbortSignal.timeout()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static)
> and [`AbortSignal.reason`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/reason),
> and the TypeScript reference for
> [`useUnknownInCatchVariables`](https://www.typescriptlang.org/tsconfig/#useUnknownInCatchVariables).
> Target: **TypeScript 7.0.2** (phase spine), React **19.2.8**, Node
> **24.20.0**. Documentation-validated; **no console blocks, no timings**.

**The cancellation path is the one place in the client where the types are
weakest exactly where the logic is most subtle.** A rejected promise's reason
is `any` unless you annotate it, `signal.reason` is declared `any` with no flag
that changes it, and the difference between "the user navigated away" and "the
request took ten seconds" is a string on a `DOMException` that no type
distinguishes. This chunk is the small amount of typed code that makes that
path honest.

## Typing the rejection

```ts
fnRef.current?.(controller.signal).then(
  (data) => { if (active) setState({status: 'success', data}); },
  (error: unknown) => {                       // ← the annotation is the whole fix
    if (!active || isAbortError(error)) return;
    setState({status: 'error', error: toApiFailure(error)});
  },
);
```

Without `: unknown`, the parameter is contextually typed from `Promise.then`,
whose rejection handler is declared to take `any` — so `error.nmae` compiles
and `error.response.data.message` compiles, and both fail at run time on a
`TypeError`. One word restores every guard, exactly as
[chapter 05·03c](../05-typed-express-handlers/03c-the-typed-error-handler.md)
does for the Express error handler's `err: any`.

📌 **`catch (e)` and `.then(onFulfilled, onRejected)` are not equally safe by
default.** The `catch` binding becomes `unknown` under
`useUnknownInCatchVariables`, which `strict` enables; a `.then` handler's
parameter comes from the `Promise` declaration and no flag touches it.

## Two abort names, one guard

```ts
// apps/web/src/lib/abort.ts
export function isAbortError(e: unknown): boolean {
  return e instanceof DOMException
    && (e.name === 'AbortError' || e.name === 'TimeoutError');
}
```

Both names, because they come from different places. MDN on
`AbortSignal.timeout()`:

> *"The signal aborts with its `AbortSignal.reason` property set to a
> `TimeoutError` `DOMException` on timeout."*

…while a user-initiated `controller.abort()` with no argument aborts with an
`AbortError`. A helper that checks only `'AbortError'` turns every timeout into
a rendered error panel — which is arguably the right product decision, and
should be a decision rather than an omission. If timeouts *should* surface,
split the guard:

```ts
export function isUserAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError';
}
export function isTimeout(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'TimeoutError';
}
```

…and the effect renders an error for `isTimeout` while staying silent for
`isUserAbort`.

## The declarations, and the `any` in the middle of them

```ts
// lib.dom.d.ts
abort(reason?: any): void;          // AbortController
readonly reason: any;               // AbortSignal
throwIfAborted(): void;
static any(signals: AbortSignal[]): AbortSignal;
static timeout(milliseconds: number): AbortSignal;
```

⚠️ **`signal.reason` is `any`.** Passing a typed reason —
`controller.abort({kind: 'navigation'})` — gets you nothing back: the reason
arrives as `any` and must be narrowed like any other unknown value. Launder it
at the read site and the rest of the function is safe:

```ts
const reason: unknown = controller.signal.reason;
if (typeof reason === 'object' && reason !== null && 'kind' in reason) { … }
```

`AbortSignal.any` is how a per-request timeout composes with the effect's own
cleanup without either one owning the other — MDN describes exactly this use,
*"to abort a download using either a timeout signal or by calling
`AbortController.abort()`"*:

```ts
const controller = new AbortController();
const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]);
// cleanup still calls controller.abort(); the timeout fires independently
```

## Gotchas

**★ A `.then` rejection handler's parameter is `any` by default and needs the
annotation.** Unlike `catch`, no compiler flag makes it `unknown`; the
contextual type comes from `Promise.then`. Write `(error: unknown) => …`
explicitly. This is easy to miss precisely because the equivalent
`try`/`catch` is safe under `strict`, so the same defensive code is guarded in
one form and wide open in the other.

**★ `catch (e)` gives `unknown` only under `useUnknownInCatchVariables`.**
That flag is on under `strict`, and off in a `tsconfig` that sets
`"strict": false` and enables individual flags — a common shape in a migrating
codebase. Without it every catch binding is `any`, and `e.name ===
'AbortError'` compiles whatever `e` is. Check the flag before trusting a catch
block's narrowing.

**★ `AbortSignal.timeout` aborts with `TimeoutError`, not `AbortError`.**
A guard that tests only for `'AbortError'` classifies a timeout as a real
failure and renders the error panel. Whether that is right depends on the
screen; what is never right is discovering it from a support ticket.

**★ `signal.reason` is `any`, so a structured abort reason arrives untyped.**
If you abort with a reason object to distinguish navigation from timeout from
user cancel, assign it to an `unknown` at the read site and narrow. Otherwise
`reason.kind === 'navigatoin'` type-checks forever, and the branch it guards
never runs.

**★ Nothing checks that the signal reaches `fetch`.** `useAsync` hands the
fetcher an `AbortSignal`; a fetcher that accepts it and forgets to pass it on
compiles perfectly and aborts nothing, so the race and the leak both come back
while the code *looks* cancel-aware. The parameter's presence is the only
signal a reviewer gets. A client method that takes the signal and builds the
request itself —
[chapter 07·05](../07-the-typed-api-client/05-signals-timeouts-and-retries.md) —
makes the omission impossible rather than merely detectable.

**★ The `active` flag and the `AbortController` are both needed, and neither is
typed as such.** `abort()` cancels the request; the flag covers a promise that
had already resolved before cleanup ran, and any non-abortable work in the
fetcher. Deleting either one leaves code that compiles and races. This is the
clearest case in the chapter of a correctness property that lives entirely in
review.

**★ `instanceof DOMException` is a browser check.** In Node, a `fetch` aborted
through undici rejects with an error whose `name` is `AbortError`, and this
app's `isAbortError` is written for the browser build. A helper shared with a
Node script needs a name-based check that does not require `DOMException` to
exist — and a name-based check on an `unknown` needs its own narrowing:

```ts
function hasName(e: unknown): e is {name: string} {
  return typeof e === 'object' && e !== null && 'name' in e
    && typeof (e as {name: unknown}).name === 'string';
}
```

**★ `throwIfAborted()` returns `void`, so it is a statement and not a
guard.** `signal.throwIfAborted()` throws the reason if the signal is already
aborted, and returns nothing when it is not; it does not narrow anything and it
is not a predicate. Use it at the top of a long fetcher between awaited steps,
and keep the classification of what it threw in the same `isAbortError` helper.

**★ Aborting after the promise settles is a no-op and is *supposed* to be.**
The cleanup calls `controller.abort()` unconditionally, including after a
successful response. That is correct and costs nothing; guarding it with
`if (!done)` adds a mutable flag whose only job is to skip a no-op.

## Interview questions

**★ Why annotate a `.then` rejection handler's parameter as `unknown` when
`catch` already gives you that?**
Because they get their types from different places. The `catch` binding is
`unknown` under the `useUnknownInCatchVariables` flag, which `strict` turns on;
a `.then` handler's parameter is contextually typed from `Promise.then`, whose
declaration says `any`, and no flag changes it. So the same defensive code is
safe in one form and unguarded in the other, and the annotation costs one word.

**★ How do you decide whether a rejection is a cancellation?**
By checking for a `DOMException` whose `name` is `AbortError` or
`TimeoutError` — the first from `controller.abort()` with no argument, the
second from `AbortSignal.timeout()`, which MDN documents as aborting with a
`TimeoutError` `DOMException`. Checking `e.name` alone does not compile against
an `unknown`, and checking only `AbortError` silently reclassifies every
timeout as a failure worth rendering. Which of the two should reach the user is
a product decision, and it should be written as two named guards so the
decision is visible.

**★ What does the type system guarantee about the signal reaching `fetch`?**
Nothing. `useAsync` passes an `AbortSignal` to the fetcher; whether the fetcher
forwards it to `fetch` is invisible to the compiler, and a fetcher that ignores
it produces code that looks cancel-aware and cancels nothing. The structural
fix is to stop hand-writing fetchers: a client method that takes the signal and
builds the request itself makes the omission impossible.

**★ You want a ten-second timeout *and* cancellation on unmount. How do the
types help?**
They do not, beyond `AbortSignal.any(signals: AbortSignal[]): AbortSignal`
existing and being correctly typed. Compose
`AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)])`, pass the
composed signal to the fetcher, and keep calling `controller.abort()` in the
cleanup. The two abort sources then produce two different `DOMException` names,
which is the only way downstream code can tell them apart — so the composition
and the classification have to be designed together.

**★ `controller.abort(reason)` accepts a typed reason. What do you get back?**
`any`. `AbortSignal.reason` is declared `readonly reason: any`, so a carefully
structured reason object arrives with no type at all and every property access
on it compiles. Assign it to an `unknown` at the read site and narrow properly;
otherwise the abort-reason design gives you the illusion of typed cancellation
metadata and the reality of an untyped one.

---

← Prev: [Effects and cleanup, typed](06-effects-cleanup-and-abort.md) ·
[Overview](README.md) ·
Next → [Context with no `undefined` to consume](07-context-without-undefined.md)
