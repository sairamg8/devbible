---
title: "The retry wrapper takes the operation as a function so its type parameter is inferred rather than declared, which is the difference between one retry and a retry per endpoint"
sidebar_label: "05b · Typing the retry wrapper"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the TypeScript handbook on
> [generic functions and inference](https://www.typescriptlang.org/docs/handbook/2/generics.html)
> and
> [narrowing / exhaustiveness](https://www.typescriptlang.org/docs/handbook/2/narrowing.html);
> the `AbortSignal` declarations in `lib.dom.d.ts` (`typescript@6.0.3`) —
> `throwIfAborted(): void`,
> `addEventListener` inherited from `EventTarget`; MDN on
> [`AbortSignal.timeout()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static);
> and the idempotency contract fixed in
> [phase 3·07](../../phase-3-express-api/07-the-checkout-endpoint.md).
> Target: **TypeScript 7.0.2** (phase spine), Node **24.20.0**.
> Documentation-validated; **no console blocks, no timings**.

**A retry that has to be told what it is retrying is not a wrapper, it is a
template you paste per endpoint.** Taking the operation as a function makes `T`
recoverable from an argument — the rule
[chapter 06·02](../06-typing-the-custom-hooks/02-generic-hooks-and-inference.md)
set for hooks — and one `withRetry` then serves every route in the map. The
part the types genuinely decide is *which failures are retryable*, because that
is an exhaustive switch over the union from
[chunk 04](04-errors-as-a-result.md); the part they decide nothing about is
whether replaying a `POST` is safe.

## The retry wrapper, generic over the operation

```ts
// packages/client/src/retry.ts
export interface RetryPolicy {
  attempts: number;                          // total, including the first
  baseDelayMs: number;
  retryable: (failure: ApiFailure) => boolean;
}

export async function withRetry<T>(
  op: (signal: AbortSignal) => Promise<Result<T>>,
  signal: AbortSignal,
  policy: RetryPolicy,
): Promise<Result<T>> {
  let last: Result<T> | undefined;
  for (let attempt = 1; attempt <= policy.attempts; attempt++) {
    last = await op(signal);
    if (last.ok || !policy.retryable(last.failure)) return last;
    if (attempt === policy.attempts) break;
    await delay(policy.baseDelayMs * 2 ** (attempt - 1), signal);
  }
  return last!;
}
```

```ts
const page = await withRetry(
  (s) => client.get('/products', {query}, s),
  signal,
  {attempts: 3, baseDelayMs: 200, retryable: isRetryable},
);
//    ^ Result<ProductPage> — T inferred from the operation, nothing annotated
```

**`T` is inferred from `op`'s return type**, so the wrapper never has to be
told what it is retrying. That is what keeps it *one* function — a retry that
had to be written per endpoint would be a second client to maintain, drifting
from the first.

📌 **`op` takes the signal rather than closing over it.** The wrapper could
close over the outer `signal` and take `op: () => Promise<Result<T>>`, and it
deliberately does not: passing the signal through means the operation cannot
accidentally use a stale one, and it keeps the shape identical to the fetcher
signature `useAsync` and `useAsyncResult` already take.

## `retryable` is an exhaustive switch, and that is the payoff

```ts
export function isRetryable(f: ApiFailure): boolean {
  switch (f.kind) {
    case 'offline':
    case 'timeout':   return true;
    case 'cancelled':
    case 'malformed':
    case 'contract':  return false;
    case 'api':       return f.status >= 500 || f.error.code === 'RATE_LIMITED';
  }
  return assertNever(f, 'isRetryable');
}
```

🔴 **Adding a failure kind forces a retry decision for it, at build time, in
the one place retry decisions live.** Without the union that question gets
answered accidentally and per call site, by whether somebody wrote a `catch`
and what they put in it. This function is the clearest single argument in the
chapter for failures being values.

## A `delay` that respects the signal

```ts
// packages/client/src/delay.ts
export function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const id = setTimeout(finish, ms);
    signal.addEventListener('abort', onAbort, {once: true});

    function finish() {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }
    function onAbort() {
      clearTimeout(id);
      reject(signal.reason);                 // `any` — classified upstream
    }
  });
}
```

⚠️ **Nothing in `withRetry`'s signature says `delay` honours the signal.** A
`delay` that ignores it keeps a dead screen's retries alive for seconds after
navigation, and the type is identical. `signal.reason` is `any`
([chapter 06·06b](../06-typing-the-custom-hooks/06b-abort-and-the-unknown-rejection.md)),
so what it rejects with is classified upstream like every other rejection.

## Retrying safely: the idempotency key belongs to the attempt

```ts
// apps/web/src/components/CheckoutForm.tsx
const idempotencyKey = useMemo(() => crypto.randomUUID(), []);   // per checkout ATTEMPT

const result = await withRetry(
  (s) => client.post('/checkout', {body}, s, {headers: {'idempotency-key': idempotencyKey}}),
  signal,
  {attempts: 3, baseDelayMs: 500, retryable: isRetryable},
);
```

⚠️ **Nothing in the type system knows which methods are safe to retry.**
`withRetry` will happily replay a `POST /checkout` three times, and only the
idempotency key
([phase 3·07](../../phase-3-express-api/07-the-checkout-endpoint.md)) makes that
harmless. The type could be tightened — a `retryable: true` marker on route
specs that `withRetry` requires — and this app does not, because the honest
boundary is "endpoints with an idempotency key are retryable", which is a
property of the *server's* implementation. Restating it on the client gives you
a declaration that can drift. It is a review rule with a test behind it, like
the route parity check.

📌 **The key is memoised per checkout attempt, not per request.** All three
retries carry the same key, which is what makes them one operation to the
server. A key regenerated per request turns a retry into three orders, and the
types are identical either way — `useMemo(() => crypto.randomUUID(), [])` and
`crypto.randomUUID()` both produce a `string`.

## Gotchas

**★ A retry loop that ignores the signal keeps retrying after the component
unmounts.** The `delay` between attempts must take the signal and reject or
resolve early when it fires; otherwise a three-attempt retry with backoff keeps
a dead screen's requests alive for seconds after navigation. Nothing in
`withRetry`'s type says `delay` respects the signal — read the helper.

**★ `withRetry` will retry a `POST` and the types will not stop it.** Retry
safety is a property of the endpoint, expressed at run time by an idempotency
key. A `retryable: true` flag on route specs is possible and would only be a
restatement of the server's behaviour on the client's side, where it can drift.
The check that means something is the server's test that a replayed
idempotency key returns the first response.

**★ Exponential backoff with no jitter synchronises every client.** After a
shared outage, `200, 400, 800` from every browser at once is a thundering herd
against the recovering service. Adding jitter is arithmetic, not typing, and it
belongs in `delay` — but it is the kind of thing a chapter about types happily
forgets to mention.

**★ `RATE_LIMITED` deserves the server's delay, not yours.** The extras schema
carries `retry_after_seconds`
([04b](04b-narrowing-errorbody-by-code.md)), so a retryable rate-limit failure
should wait *that* long rather than the policy's backoff. `withRetry`'s policy
type has no slot for it; threading it through means either a `delayFor(failure)`
function on the policy or handling `RATE_LIMITED` outside the generic wrapper.
Pick one deliberately — ignoring `retry_after_seconds` is how a client gets
itself blocked.

**★ `last!` at the end of the loop is a non-null assertion covering a case the
compiler cannot see.** The loop runs at least once whenever `attempts >= 1`, so
`last` is always assigned — but `attempts` is a `number` and could be `0`.
Either constrain the policy (`attempts: 1 | 2 | 3 | 4 | 5`) or handle the zero
case explicitly; the assertion is the version that will eventually throw
`undefined is not an object`.

**★ A regenerated idempotency key turns a retry into three orders, and both
versions have type `string`.** Where the key is created — inside the retried
operation versus outside it in a `useMemo` — is the whole difference, and it is
invisible in every signature involved. This is the single most expensive
type-invisible mistake in the chapter.

**★ `policy.retryable` typed `(failure: ApiFailure) => boolean` accepts a
predicate that ignores its argument.** `retryable: () => true` compiles and
retries contract failures forever against a body that will never parse. The
exhaustive `isRetryable` is the shared implementation for a reason; a policy
that supplies its own predicate should be doing so to *narrow* the default, not
to replace it.

**★ Retrying a `GET` that is not idempotent on the server is still a bug.**
"Safe method" is an HTTP convention, not a guarantee: a `GET` that increments a
view counter or issues a one-time token is retried three times by this wrapper
with no complaint. The route map is where such an endpoint should be marked, if
you have one — and having one is usually the actual problem.

**★ Timeouts compose badly with retries if the timeout is per attempt.** Three
attempts at a 10-second timeout is a 30-second wait plus backoff before the user
sees anything. Either budget the whole operation with one
`AbortSignal.timeout` outside the loop, or shorten the per-attempt timeout
deliberately. The type shows neither number, and the default table in
[chunk 05](05-signals-timeouts-and-retries.md) is per attempt.

## Interview questions

**★ How is the retry wrapper typed so it works for every endpoint?**
By taking the operation as a function — `op: (signal: AbortSignal) =>
Promise<Result<T>>` — so `T` is inferred from the operation's return type and
never written at a call site. That is the same rule as any generic hook: the
type parameter must be recoverable from an argument. It is what keeps retry a
single function instead of a per-endpoint wrapper, which would be a second
client to maintain.

**★ Which failures are retryable, and how does the type system help?**
`offline` and `timeout` always; `api` when the status is 5xx or the code is
`RATE_LIMITED`; `cancelled`, `malformed` and `contract` never — retrying them
re-fetches the same unreadable body or fights a deliberate abort. The types
help by making that decision one exhaustive `switch` over the failure union
with `assertNever` at the end, so adding a failure kind forces a retry decision
at build time instead of leaving it to whichever `catch` happens to run.

**★ Does the type system stop you retrying a `POST /checkout`?**
No. `withRetry` is generic over any operation, so it will replay a checkout
happily, and what makes that safe is the idempotency key the request carries —
a runtime property of the server's implementation. A `retryable` flag on the
route spec would restate the server's behaviour on the client's side, where it
can drift; the assertion that actually means something is the server's test
that a replayed key returns the first response rather than a second order.

**★ Where does the idempotency key have to be created, and why does no type
say so?**
Outside the retried operation, once per user-visible attempt —
`useMemo(() => crypto.randomUUID(), [])` in the checkout form. Created inside
the operation, every retry carries a new key and the server treats each as a
new order. Both spellings produce a `string` and satisfy every signature
involved, so the correctness lives entirely in where the call sits relative to
the loop.

**★ What is wrong with the `last!` at the end of `withRetry`?**
It asserts that the loop body ran at least once, which is true for
`attempts >= 1` and false for `attempts: 0` — and `attempts` is typed `number`.
The assertion converts a possible `undefined` into a value the compiler
believes in, so the failure appears later as a property access on `undefined`.
Constraining the field to a literal union of small numbers, or returning an
explicit failure when `attempts < 1`, removes the assertion instead of hiding
the case.

**★ Why does `op` take the signal instead of closing over it?**
So the operation cannot use a stale signal, and so its shape matches the
fetcher signature the hooks already accept — `(signal: AbortSignal) =>
Promise<…>`. It also makes the wrapper composable with anything else that
threads a signal, including a future variant that gives each attempt its own
per-attempt timeout composed with the caller's signal.

---

← Prev: [Signals and timeouts](05-signals-timeouts-and-retries.md) ·
[Overview](README.md) ·
Next → [Emitting the contract](06-emitting-the-contract.md)
