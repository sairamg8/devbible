---
title: "Making the signal a required positional parameter of every client method is the only check a type system can offer against a fetcher that forgets it, and composing it with AbortSignal.timeout is what keeps a timeout distinguishable from a cancellation"
sidebar_label: "05 · Signals and timeouts"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the `AbortController` / `AbortSignal` declarations
> in `lib.dom.d.ts` (`typescript@6.0.3`; TypeScript is not installed in this
> checkout) — `abort(reason?: any): void`, `readonly reason: any`,
> `static any(signals: AbortSignal[]): AbortSignal`,
> `static timeout(milliseconds: number): AbortSignal`,
> `throwIfAborted(): void` — MDN on
> [`AbortSignal.timeout()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static)
> and [`AbortSignal.any()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/any_static),
> the [`RequestInit.signal` member](https://developer.mozilla.org/en-US/docs/Web/API/RequestInit),
> and the TypeScript handbook on
> [generic constraints](https://www.typescriptlang.org/docs/handbook/2/generics.html).
> Target: **TypeScript 7.0.2** (phase spine), Node **24.20.0**.
> Documentation-validated; **no console blocks, no timings**.

**[Chapter 06·06b](../06-typing-the-custom-hooks/06b-abort-and-the-unknown-rejection.md)
ended on a complaint: nothing checks that a fetcher forwards its `AbortSignal`
to `fetch`.** That is true of hand-written fetchers and it stops being true the
moment the client builds the request itself — a required parameter is a check,
and the only structural fix available. This chunk makes the signal required,
composes it with a per-request timeout, and hands the retry wrapper to
[05b](05b-typing-the-retry-wrapper.md).

## Make the signal a parameter, not an option

```ts
// packages/client/src/client.ts
export function get<P extends GetPath>(
  path: P,
  opts: GetOptions<P>,
  signal: AbortSignal,                       // ← required, third, positional
): Promise<Result<ResponseOf<Routes['get'][P]>>>;
```

```ts
// ✗ does not compile — and that is the entire mechanism
client.get('/products/:slug', {slug});
```

📌 **Optional would have been friendlier and useless.** `signal?: AbortSignal`
compiles at every call site that forgets it, which is exactly the population of
call sites you are trying to reach. Required costs a `AbortSignal.timeout(30_000)`
at the two or three call sites that genuinely have no signal — a script, a
prefetch — and that is a small, visible, greppable price.

⚠️ **It is still not a proof that the request is cancellable.** The signal
reaches `fetch` because `request` puts it there; what the type guarantees is
that the *caller* supplied one. A call site passing a fresh, never-aborted
`new AbortController().signal` satisfies the type and cancels nothing. The type
raises the floor; it does not close the hole.

## Composing the caller's signal with a timeout

```ts
// packages/client/src/request.ts
export interface RequestOptions {
  signal: AbortSignal;
  timeoutMs?: number;                        // default per method, below
}

function withTimeout(signal: AbortSignal, ms: number): AbortSignal {
  return AbortSignal.any([signal, AbortSignal.timeout(ms)]);
}
```

```ts
export const DEFAULT_TIMEOUT_MS = {
  get:    10_000,
  post:   30_000,                            // checkout talks to a payment provider
  put:    10_000,
  patch:  10_000,
  delete: 10_000,
} as const satisfies Record<keyof ApiMap, number>;
```

MDN describes exactly this composition — a signal that aborts *"using either a
timeout signal or by calling `AbortController.abort()`"* — and the two sources
abort with **different `DOMException` names**, which is the only way the failure
classifier can tell them apart:

```ts
if (isTimeout(e))   return fail({kind: 'timeout',   path, ms});     // TimeoutError
if (isUserAbort(e)) return fail({kind: 'cancelled', path});         // AbortError
```

🔴 **Without `AbortSignal.any`, a timeout implemented with your own controller
produces an `AbortError` indistinguishable from the user's navigation**, and
every timeout is then reported as a cancellation and silently swallowed. The
distinction is not a nicety; it is the difference between a slow endpoint being
invisible and being on a dashboard.

📌 **`as const satisfies Record<keyof ApiMap, number>` on the timeout table.**
Same reason as the route map: `satisfies` checks that every method has a
timeout and that no typo'd key sneaks in, while `as const` keeps the numbers
literal so a lookup is a literal type rather than `number`. An annotation would
allow a missing method and give `number` back.

## Gotchas

**★ An optional `signal` is a check that fires nowhere.** Every call site that
would have forgotten it still compiles. Required-and-positional is the only
version that reaches the code you are worried about, and the two call sites
with genuinely no signal pass `AbortSignal.timeout(30_000)` explicitly, which
documents their budget.

**★ Passing a fresh controller's signal satisfies the type and cancels
nothing.** `client.get(path, opts, new AbortController().signal)` compiles and
is a leak with extra steps. The type raises the floor — it cannot express "this
signal is wired to something that will abort".

**★ Rolling your own timeout with a second controller loses the distinction
between timeout and cancellation.** Both abort with `AbortError` and the
classifier cannot tell them apart, so timeouts get reported as cancellations
and disappear. `AbortSignal.timeout` aborts with a `TimeoutError`, which is the
only reason `isTimeout` can exist.

**★ `AbortSignal.any` returns a signal that aborts when *any* input does, and
it does not abort the inputs.** Aborting the composed signal does not abort the
caller's controller, which is correct and occasionally surprising: cleanup still
has to call `controller.abort()` on its own controller.

**★ Timeouts measured client-side do not stop the server.** A 10-second timeout
aborts the *request*, and the checkout it started may still complete. That is
precisely why the idempotency key exists and why a `timeout` failure on a
mutation must never be presented as "it did not happen".

## Interview questions

**★ Why is `signal` a required positional parameter rather than an option?**
Because the failure mode being prevented is *forgetting it*, and an optional
parameter compiles at exactly the call sites that forget. Making it required
turns the omission into a build error everywhere, at the cost of two or three
call sites that genuinely have no signal writing
`AbortSignal.timeout(30_000)` — which is an improvement, because it makes their
budget explicit. It is the strongest guarantee available here: the compiler can
check that a signal was supplied, never that it will be aborted.

**★ Why compose with `AbortSignal.any` instead of a second controller and a
`setTimeout`?**
Because of the exception name. A hand-rolled timeout calls
`controller.abort()`, which produces an `AbortError` — indistinguishable from
the user navigating away — so the classifier reports timeouts as cancellations
and they vanish from both the UI and the logs. `AbortSignal.timeout` aborts
with a `TimeoutError`, which MDN documents explicitly, and `AbortSignal.any`
composes it with the caller's signal so both sources remain distinguishable.

---

← Prev: [Throwing on purpose](04d-throwing-on-purpose.md) ·
[Overview](README.md) ·
Next → [Typing the retry wrapper](05b-typing-the-retry-wrapper.md)
