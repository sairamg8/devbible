---
title: "useAsync and the API client"
sidebar_label: "01 · useAsync & the API client"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against react.dev (Effects, cleanup, Strict Mode) and
> MDN (`AbortController`). Concept home:
> [React — hooks that wrap effects](../../../react/pages/phase-7-custom-hooks/08-hooks-that-wrap-effects/README.md)
> and [writing a custom hook](../../../react/pages/phase-7-custom-hooks/02-writing-a-custom-hook.md).

## The problem

Every screen in this app fetches: catalog pages, product detail, the cart,
orders. Hand-rolled `useEffect` fetching fails the same three ways
everywhere — the race (slow response A overwrites fresh response B), the
leak (setState after unmount), and the double-fire confusion under Strict
Mode. One base hook solves them once; every data hook in later chapters
composes it.

## The implementation

```jsx
// src/hooks/useAsync.js
import {useCallback, useEffect, useRef, useState} from 'react';

/** Runs an async function tied to `deps`. The function RECEIVES an
 *  AbortSignal and must pass it to fetch — cancellation is cooperative. */
export function useAsync(fn, deps) {
  const [state, setState] = useState({status: 'loading', data: null, error: null});
  const [nonce, setNonce] = useState(0);          // retry() bumps this
  const fnRef = useRef(fn);
  fnRef.current = fn;                             // latest fn, stable identity

  useEffect(() => {
    const controller = new AbortController();
    let active = true;                            // belt: signal is the braces

    setState((s) => ({...s, status: 'loading', error: null}));
    fnRef.current(controller.signal).then(
      (data) => { if (active) setState({status: 'success', data, error: null}); },
      (error) => {
        if (!active || error.name === 'AbortError') return;
        setState((s) => ({...s, status: 'error', error}));
      },
    );
    return () => { active = false; controller.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);
  return {...state, retry};
}
```

```js
// src/lib/api.js — the thin client every hook calls (Phase 5's wrapper
// adds retry/dedupe; this is the contract-aware core)
export class ApiClientError extends Error {
  constructor(status, body) {
    super(body?.title ?? `HTTP ${status}`);
    this.status = status;
    this.code = body?.code ?? 'UNKNOWN';
    this.body = body;
  }
}

export async function api(path, {method = 'GET', body, signal, headers} = {}) {
  const res = await fetch(`/api${path}`, {
    method, signal,
    credentials: 'same-origin',                  // the __Host- cookie rides along
    headers: {...(body && {'content-type': 'application/json'}), ...headers},
    ...(body && {body: JSON.stringify(body)}),
  });
  if (res.status === 204) return null;
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiClientError(res.status, json);
  return json;
}
```

```jsx
// a consumer — the product page's data in one line
function ProductPage({slug}) {
  const {status, data, error, retry} =
    useAsync((signal) => api(`/products/${slug}`, {signal}), [slug]);

  if (status === 'loading') return <ProductSkeleton />;
  if (status === 'error')   return <ErrorPanel error={error} onRetry={retry} />;
  return <ProductDetail product={data} />;
}
```

## Why each piece is there

- **The signal is the race fix and the leak fix at once.** Navigating from
  product A to B re-runs the effect; cleanup aborts A's fetch, so its
  response can never arrive to overwrite B's. The same abort fires on
  unmount, so no setState-after-unmount — the `active` flag covers the
  window where a non-abortable promise resolves after cleanup.
- **Strict Mode double-invocation is *handled by design*, not silenced.**
  Mount → cleanup → mount runs fetch, abort, fetch — the first request
  dies, the second lands. If that pattern hurts (it shouldn't — aborted
  requests are free), the bug is in treating effects as
  run-exactly-once, which
  [the effects material](../../../react/pages/phase-4-effects/README.md)
  spends a phase unlearning.
- **`fnRef` keeps the callback fresh without widening deps.** The effect
  re-runs on `deps` (the data identity — `[slug]`), not on the function's
  identity, which changes every render. The alternative — `useCallback` in
  every caller — pushes the discipline to every call site; the ref keeps
  it in the hook.
- **`retry` is state, not a re-call.** Bumping the nonce re-runs the same
  effect with the same cancellation guarantees — a retry *is* a refetch,
  so it goes through the only door fetches use.
- **`status` is a discriminant, not booleans.** `isLoading && !isError`
  logic rots; a single `status` makes the render a switch over states
  that cannot coexist — and Phase 6 will type it as a discriminated
  union.

## The 401 seam

The client deliberately does *not* handle 401s here — chapter 09 wraps
`api` with the refresh-and-replay logic, and the cart chapters rely on
that seam existing in exactly one place. A base hook that silently
redirects to login on 401 makes half the app impossible to build.

## Gotchas

- **Symptom:** "flash of old product" when navigating between products.
  **Cause:** the hook keeps `data` while `status` returns to `loading` —
  deliberate (it enables keep-previous-while-loading UIs) — but the
  consumer rendered `data` without checking `status`. **Fix:** render on
  `status`; when keep-previous is *wanted* (the infinite list), read
  `data` knowingly.
- **Symptom:** effect loops forever refetching. **Cause:** an object or
  array literal in `deps` (`[{slug}]`) — new identity every render.
  **Fix:** deps are primitives from props/state; anything structured is
  destructured first. The exhaustive-deps suppression in the hook is the
  *one* sanctioned suppression — callers never copy it.
- **Symptom:** tests see `AbortError` unhandled-rejection warnings.
  **Cause:** the test unmounted mid-fetch and the fake fetch rejected
  without the hook's catch attached — usually a mock that rejects on a
  microtask before effects ran. **Fix:** the hook's rejection handler
  ignores aborts already; align the mock to resolve/reject *after* mount
  (the [hook-testing page](../../../react/pages/phase-7-custom-hooks/11-testing-a-custom-hook.md)
  has the harness).

## Interview questions

1. **★ Walk through how this hook prevents the classic fetch race.** Each
   effect run owns a controller; cleanup aborts it before the next run
   starts. So when `slug` changes A→B, A's fetch is aborted *before* B's
   starts — A's `then` either never fires or is filtered by the abort
   check. Ordering is enforced by React's cleanup sequencing, not by
   comparing timestamps or request ids.
2. **★ Why must the async function receive the signal instead of the hook
   aborting "its own" fetch?** The hook doesn't fetch — the caller does,
   and only the caller knows what to cancel (one fetch, two chained
   fetches, none for a computed promise). Passing the signal makes
   cancellation part of the *contract*: any `fn` that ignores it opts out
   visibly, and greps for `signal` audit the compliance.
3. **Why is `data` kept during reloads instead of cleared?** Clearing
   forces every consumer into skeleton-flash on every param change;
   keeping enables stale-while-loading UIs and costs one discipline
   (render on `status`). The hook picks the policy that supports both
   and documents the discipline — the alternative supports only one.
4. **Where does global error handling (401s, toasts) belong relative to
   this hook?** Below it, in the client layer (`api` and its wrappers) —
   cross-cutting protocol concerns are client concerns. The hook owns
   *lifecycle* (race, leak, retry); mixing protocol into it couples every
   data hook to auth policy. One seam each.

---

Next → [`useDebounce` and the search box](02-usedebounce-and-search.md) ·
Phase index: [Phase 4 — The React UI](README.md)
