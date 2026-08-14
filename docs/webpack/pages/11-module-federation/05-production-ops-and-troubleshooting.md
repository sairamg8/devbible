---
title: "Module Federation: Production Ops, Resilience & Troubleshooting"
sidebar_label: "Module Federation"
sidebar_position: 5
---

# ⚙️ Module Federation: Production Ops, Resilience & Troubleshooting

## 1. Under-The-Hood Mechanics

Running federated micro-frontends in production introduces a category of failure mode that doesn't exist in a monolithic bundle: **a remote your host depends on can be unreachable, broken, or on an incompatible version — at any moment, independently of your own deploys.**

### `remoteEntry.js` Caching Must Be Deliberately Short-Lived
Unlike content-hashed application chunks (`app.[contenthash].js`, safe to cache forever), `remoteEntry.js` itself is typically requested by a **stable, unhashed filename** so hosts can always find it at a known URL — which means it must be served with a short or no-cache HTTP header (`Cache-Control: no-cache` or a short `max-age`), or hosts will keep loading a stale container pointing at old chunk hashes long after a remote redeploys.

### Health-Checking & Circuit Breaking a Remote
A federated `import()` is just a Promise — it can reject (network failure, 404, malformed container) exactly like any other async operation, and should be wrapped with the same resilience patterns applied to any critical external dependency: timeouts, retries with backoff, and a **circuit breaker** that stops repeatedly trying a remote known to be currently down, falling back to a degraded UI immediately instead.

### TypeScript Types for Federated Modules
Because a federated import's actual module shape is only known at runtime (fetched from a URL, not resolved by the local TypeScript compiler), `import('design_system/Button')` types as `any` by default. Production setups typically either (a) publish a lightweight `@acme/design-system-types` package containing **only** ambient type declarations (no runtime code) that both remote and hosts import for type-checking, or (b) use a build plugin (`@module-federation/enhanced`'s type generation) that extracts and publishes `.d.ts` files alongside the remote's `remoteEntry.js` automatically.

### Runtime Plugin API
Newer Module Federation tooling (`@module-federation/enhanced`) exposes a runtime plugin hook system — intercepting remote resolution, adding custom retry/fallback logic, or injecting authentication headers into remote fetch requests — without hand-rolling the dynamic-loading machinery shown in [dynamic remotes](./03-dynamic-remotes-and-runtime-loading.md) from scratch.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Remote's Deploy Pipeline Failure Taking Down an Unrelated Part of the Host App.
A recommendations remote's deploy pipeline pushed a broken `remoteEntry.js` (a build misconfiguration produced a container that threw on `init()`). Because the host's product page federated-imports the recommendations widget with no error boundary or fallback, the exception propagated up and crashed the **entire product page** — including the checkout button, completely unrelated to recommendations. The fix was twofold: (1) an error boundary scoped tightly around just the federated import, so a remote's failure degrades gracefully to "recommendations unavailable" instead of crashing the page, and (2) a circuit breaker that, after N consecutive failures fetching that remote, stops retrying for a cooldown window and serves the fallback immediately rather than repeatedly re-attempting a known-broken fetch on every page view.

---

## 3. Production-Grade Code Example

```tsx
// components/FederatedBoundary.tsx — isolating a remote's failure from the rest of the host page
import { Component, Suspense, type ReactNode } from 'react';

interface Props { fallback: ReactNode; children: ReactNode; }
interface State { hasError: boolean; }

class FederatedErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    // Report to monitoring, tagged distinctly from host-app-native errors
    reportError(error, { source: 'module-federation', remote: this.props.fallback });
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return <Suspense fallback={this.props.fallback}>{this.props.children}</Suspense>;
  }
}

export function RecommendationsSlot() {
  const Recommendations = lazy(() => import('recommendations/Widget'));
  return (
    <FederatedErrorBoundary fallback={<div className="text-xs text-slate-500">Recommendations unavailable</div>}>
      <Recommendations />
    </FederatedErrorBoundary>
  );
}
```

```typescript
// lib/loadRemoteWithCircuitBreaker.ts — timeout, retry, and circuit-breaking around a federated import
const failureLog = new Map<string, { count: number; openUntil: number }>();
const CIRCUIT_THRESHOLD = 3;
const COOLDOWN_MS = 60_000;

export async function loadRemoteWithResilience<T>(remoteName: string, loader: () => Promise<T>): Promise<T> {
  const entry = failureLog.get(remoteName);
  if (entry && entry.count >= CIRCUIT_THRESHOLD && Date.now() < entry.openUntil) {
    throw new Error(`Circuit open for remote "${remoteName}" — skipping fetch during cooldown.`);
  }

  try {
    const result = await Promise.race([
      loader(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Remote load timeout')), 5000)),
    ]);
    failureLog.delete(remoteName); // reset on success
    return result;
  } catch (err) {
    const current = failureLog.get(remoteName) ?? { count: 0, openUntil: 0 };
    failureLog.set(remoteName, { count: current.count + 1, openUntil: Date.now() + COOLDOWN_MS });
    throw err;
  }
}
```

```
# CDN / server config for remoteEntry.js — MUST be short-lived, unlike hashed chunks
Cache-Control: no-cache, must-revalidate   # for remoteEntry.js specifically
Cache-Control: public, max-age=31536000, immutable   # for [name].[contenthash].js chunks
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Long-Lived Cache Headers on `remoteEntry.js`
```
❌ WRONG: Cache-Control: public, max-age=31536000, immutable   (applied to remoteEntry.js)
A host that cached this a year ago keeps referencing chunk hashes from a build that no longer
exists on the CDN — every federated import from that remote 404s until the browser cache expires
or the user hard-refreshes, and the remote team has no idea their "successful" deploy isn't visible.

✅ CORRECT: Cache-Control: no-cache, must-revalidate   (applied ONLY to remoteEntry.js, NOT the hashed chunks it references)
```

### ⚠️ Pitfall 2: No Error Boundary Around a Federated Import
As the scenario above illustrates, an uncaught exception from a remote's container `init()`/`get()` (or any error inside the remote's own component code) propagates up through React's tree exactly like any other render error — without a **tightly scoped** error boundary around each federated import, one remote's bug can crash an entire otherwise-healthy host page. Every federated import in production code should have its own dedicated boundary, not one shared boundary wrapping the whole app (which would still take down more than necessary).

### ⚠️ Pitfall 3: No Type Safety on Federated Module Shapes, Discovered Only at Runtime
```typescript
// ❌ RISKY: `Button` types as `any` — a remote silently changing its exposed component's prop
// shape (removing a prop, renaming one) produces no compile-time signal in the host at all,
// only a runtime crash or silently-ignored prop the FIRST time a user hits that code path
const Button = lazy(() => import('design_system/Button'));

// ✅ CORRECT: publish ambient .d.ts declarations (or generate them via tooling) so the host's
// own TypeScript compiler catches a shape mismatch during the HOST'S build, not in production
declare module 'design_system/Button' {
  const Button: React.ComponentType<{ label: string; onClick?: () => void }>;
  export default Button;
}
```
