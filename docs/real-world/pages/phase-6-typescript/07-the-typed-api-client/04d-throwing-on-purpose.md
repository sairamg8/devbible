---
title: "Two things still throw — programmer errors and the bridge into a hook that reads failure from a rejection — and the second one is a deliberate, local surrender of the guarantee that the hook could be rewritten to keep"
sidebar_label: "04d · Throwing on purpose"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the TypeScript handbook on
> [narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
> and the
> [`useUnknownInCatchVariables` option](https://www.typescriptlang.org/tsconfig/#useUnknownInCatchVariables);
> the **`@types/react` 19.2.18** `useState` and `DependencyList` declarations
> read in this repo; MDN on
> [`structuredClone`](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone)
> and [`Error`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error)
> (`message` and `stack` are own, non-enumerable properties).
> Target: **TypeScript 7.0.2** (phase spine), React **19.2.8**.
> Documentation-validated; **no console blocks, no timings**.

**Returning failures does not mean never throwing; it means throwing only where
there is nothing for a caller to decide.** Two places qualify in this client,
and one of them is uncomfortable: the bridge into
[`useAsync`](../06-typing-the-custom-hooks/01-asyncstate-as-a-union.md), which
was written in phase 4 to read failure from a rejected promise. This chunk
shows both, is honest that the bridge trades away the compile-time guarantee
[chunk 04](04-errors-as-a-result.md) just built, and then shows the hook that
does not need it — because "the better alternative is X" is not an argument
until X is on the page.

## 1 · Programmer errors

```ts
// packages/client/src/path.ts
export function interpolate(path: string, opts: Record<string, unknown>): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, (_, key: string) => {
    const value = opts[key];
    if (value === undefined) {
      throw new Error(`route ${path} needs a value for :${key}`);
    }
    return encodeURIComponent(String(value));
  });
}
```

A missing path parameter is not a condition a caller can recover from — the
types already made it impossible
([03b](03b-typed-path-parameters.md)), so reaching this line means a cast, a
spread of a wider object, or a `JSON.parse`d config. There is no branch for the
caller to write, so returning a `Result` would force every call site to handle
an impossibility. **The test is: could a correct caller ever see this?** If
not, throw.

## 2 · The bridge into `useAsync`

```ts
// packages/client/src/client.ts
export class ApiFailureError extends Error {
  constructor(readonly failure: ApiFailure) {
    super(`${failure.kind} on ${failure.path}`);
    this.name = 'ApiFailureError';
  }
}

export async function unwrap<T>(r: Promise<Result<T>>): Promise<T> {
  const result = await r;
  if (result.ok) return result.value;
  throw new ApiFailureError(result.failure);
}
```

```tsx
const state = useAsync((s) => unwrap(client.get('/products/:slug', {slug}, s)), [slug]);
//    ^ UseAsync<ProductDetail>, and state.error is an ApiFailure again
```

⚠️ **This deliberately loses the compile-time guarantee to fit an existing
API.** The failure survives as a *field* on the error, so `useAsync`'s
rejection handler narrows `err instanceof ApiFailureError` and puts
`err.failure` into `AsyncState`'s error member. The union is intact on both
sides; only the middle is unchecked, and the unchecked part is exactly "did
somebody remember to catch this".

```ts
// inside useAsync's effect — the other end of the bridge
(error: unknown) => {
  if (!active || isAbortError(error)) return;
  const failure: ApiFailure = error instanceof ApiFailureError
    ? error.failure
    : {kind: 'offline', path: 'unknown'};        // ← the honest fallback
  setState({status: 'error', error: failure});
}
```

🔴 **That fallback is the cost, in one line.** Any rejection that is not an
`ApiFailureError` — a bug in the fetcher, a thrown string, a library's own
error — becomes `offline`, which is a lie the user reads as "check your
connection". A `Result`-shaped hook has no such branch because there is no
rejection to classify.

## The hook that does not need the bridge

```ts
// apps/web/src/hooks/useAsyncResult.ts
import {useEffect, useState, type DependencyList} from 'react';
import type {ApiFailure, Result} from '@storefront/shared';

type ResultFetcher<T> = (signal: AbortSignal) => Promise<Result<T>>;

export function useAsyncResult<T>(
  fn: ResultFetcher<T> | null,
  deps: DependencyList,
): UseAsync<T> {
  const [state, setState] = useState<AsyncState<T>>({status: 'idle'});
  const fnRef = useRef<ResultFetcher<T> | null>(fn);
  fnRef.current = fn;
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (fnRef.current === null) { setState({status: 'idle'}); return; }
    const controller = new AbortController();
    let active = true;
    setState({status: 'loading'});

    fnRef.current(controller.signal).then((result) => {
      if (!active) return;
      if (result.ok) setState({status: 'success', data: result.value});
      else if (result.failure.kind !== 'cancelled') {
        setState({status: 'error', error: result.failure});
      }
    });                                    // ← no rejection handler needed

    return () => { active = false; controller.abort(); };
  }, [...deps, nonce]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);
  return {...state, retry} as UseAsync<T>;
}
```

```tsx
const state = useAsyncResult((s) => client.get('/products/:slug', {slug}, s), [slug]);
```

**Three differences, all improvements:** there is no `.then` rejection handler
to annotate `unknown`, no `instanceof` to get wrong, and no fallback branch
inventing a failure kind. The cost is a second hook and the discipline of using
the right one — which is why this app ships both and uses `useAsyncResult` for
everything that goes through the client, keeping `useAsync` for the handful of
fetchers that are not client calls.

## Gotchas

**★ `catch (e)` is `unknown`, so a thrown API error must be re-identified by
`instanceof`, and `instanceof` is fragile.** Across bundles, realms, or a
duplicated copy of the package in `node_modules`, an `ApiFailureError` from one
copy fails `instanceof ApiFailureError` from another. A discriminated value
compares a string and does not care where the object was constructed. If you
must keep the throw, check `error instanceof Error && error.name ===
'ApiFailureError'` and narrow the `failure` field with a schema.

**★ Do not put an `Error` instance inside the failure union.** `Error`'s
`message` and `stack` are own non-enumerable properties, so a failure that must
be posted to a logging endpoint, stored in a service worker, or sent through
`postMessage` arrives as `{}` — `JSON.stringify` skips them and
`structuredClone` is not a general answer either. Keep the union plain data and
construct an `Error` only at the moment you throw.

**★ `Result<T>` is not a monad and this app does not pretend otherwise.**
There is no `map`, no `andThen`, no chaining. Three helpers — `fail`, `unwrap`,
and an `isOk` predicate — cover every use in the client, and a combinator
library would be more API surface than six failure kinds justify. If you find
yourself wanting `andThen`, you probably want one client call that does the
whole operation.

**★ 401 is not a failure kind.** A session that expired mid-request is handled
by the refresh-and-replay seam
([phase 4·09](../../phase-4-react-ui/09-auth-in-the-client.md)) *inside*
`request`, so the caller sees either the replayed success or an
`UNAUTHENTICATED` API error after the refresh also failed. Promoting 401 to a
kind would mean every call site implements the refresh, which is the seam phase
4 deliberately put in one place.

**★ `unwrap`'s fallback branch is the one place a wrong failure kind can be
manufactured.** A non-`ApiFailureError` rejection becomes whatever the fallback
says — `offline` here — so a genuine bug in a fetcher is reported to the user
as a network problem. Log the original `unknown` before substituting, or the
real error is gone.

**★ Throwing for a programmer error is right; throwing for a *user* error is
not.** The line is whether a correct caller could reach it. `interpolate`'s
missing parameter is unreachable from typed code; a checkout that fails because
the card was declined is the most ordinary thing the app does, and it is a
value.

**★ An error thrown inside an event handler is not caught by an error
boundary.** Boundaries catch errors thrown during render, so `unwrap` throwing
inside an `onClick` produces an unhandled rejection and no UI change at all
([chapter 06·08b](../06-typing-the-custom-hooks/08b-events-and-contextual-typing.md)).
That asymmetry is another reason mutations in this app go through the
`Result`-returning API rather than through `unwrap`.

**★ `unwrap` swallows nothing, and that is a hazard in a `void`-returning
context.** `void unwrap(client.post(…))` compiles and produces an unhandled
rejection on failure. The `@typescript-eslint/no-floating-promises` rule is the
only thing that catches it, and it is one of the few lint rules genuinely worth
enabling for this codebase.

## Interview questions

**★ You argued for returning failures. When do you still throw?**
When a correct caller could not have reached the line. A missing path parameter
in `interpolate` is prevented by the types, so getting there means something was
cast or spread — there is no branch for a caller to write, and returning a
`Result` would force every call site to handle an impossibility. Everything a
correct caller can genuinely encounter — a declined card, an out-of-stock item,
a network drop — is a value.

**★ `useAsync` expects a rejected promise. How do you bridge without losing the
union?**
With `unwrap`, which awaits the `Result` and throws an `ApiFailureError`
carrying the `failure` as a field. The union survives on both sides — the
client produced it, the hook's catch narrows `instanceof ApiFailureError` and
puts `err.failure` back into `AsyncState`'s error member — and only the throw
in the middle is unchecked. It is a deliberate, local loss of the guarantee to
fit an existing hook.

**★ What does the bridge actually cost, concretely?**
One fallback branch. A rejection that is not an `ApiFailureError` has to become
*some* failure kind, and whatever you pick is wrong — `offline` tells the user
to check their connection when the real cause was a bug in the fetcher. It also
depends on `instanceof`, which fails across duplicated package copies or
realms. The `Result`-shaped hook has neither problem because there is no
rejection to classify.

**★ Show the hook that does not need the bridge.**
`useAsyncResult` takes a fetcher returning `Promise<Result<T>>` and reads the
outcome from the resolved value: `result.ok` sets the success state,
`result.failure` sets the error state, and `kind === 'cancelled'` sets nothing.
There is no `.then` rejection handler to annotate `unknown`, no `instanceof`,
and no invented failure. The cost is a second hook, which is why this app uses
it for everything going through the client and keeps `useAsync` for fetchers
that are not client calls.

**★ Why not store an `Error` in the failure union and get stacks for free?**
Because `Error`'s `message` and `stack` are own non-enumerable properties, so
the object serialises to `{}` through `JSON.stringify` — which is how failures
reach a logging endpoint — and `instanceof` checks on it are unreliable across
bundles. The union is plain data precisely so it can be logged, posted, stored
and compared; a stack, when you want one, is captured at the throw site.

**★ Why is a 401 not one of the failure kinds?**
Because it is handled below the `Result`. The refresh-and-replay seam lives
inside `request`, so a caller either gets the replayed success or, if the
refresh also failed, an ordinary API error with code `UNAUTHENTICATED`. Making
401 a failure kind would push the refresh logic to every call site, undoing the
single-seam design phase 4 argued for — and a client where two screens
implement refresh differently is a client where one of them logs the user out
mid-checkout.

---

← Prev: [Parsing and rendering API errors](04c-parsing-and-rendering-api-errors.md) ·
[Overview](README.md) ·
Next → **Signals, timeouts and retries** *(not written yet)*
