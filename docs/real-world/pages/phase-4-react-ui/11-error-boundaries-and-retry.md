---
title: "Error boundaries and retry UX"
sidebar_label: "11 · Error boundaries & retry"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against react.dev (error boundaries, `componentDidCatch`)
> and the Phase 3 error contract. Concept home:
> [React — correctness](../../../react/pages/phase-14-correctness/README.md);
> the error taxonomy is [chapter 3·09's](../phase-3-express-api/09-the-error-contract.md).

## The problem

Two unrelated failure families share the word "error": **render crashes**
(a bug — undefined deep in a component tree) and **operation failures**
(the network, a 4xx/5xx — expected weather). Boundaries catch the first;
the second never reaches them (async errors bypass boundaries entirely).
Conflating the two produces the worst UX in each direction: whole-page
"something went wrong" for a failed refetch, or a silent blank panel for
a crash. This chapter builds one of each, wired to the app's real
contract.

## The implementation

```jsx
// src/components/ErrorBoundary.jsx — for CRASHES
import {Component} from 'react';

export class ErrorBoundary extends Component {
  state = {error: null};
  static getDerivedStateFromError(error) { return {error}; }

  componentDidCatch(error, info) {
    // the client's error telemetry seam — one place, like the server's funnel
    reportClientError(error, {componentStack: info.componentStack});
  }

  reset = () => this.setState({error: null});

  render() {
    if (this.state.error) {
      return this.props.fallback
        ? this.props.fallback({error: this.state.error, reset: this.reset})
        : <CrashPanel reset={this.reset} />;
    }
    return this.props.children;
  }
}
```

```jsx
// placement — boundaries follow the layout's blast radii
function AppShell() {
  return (
    <ErrorBoundary fallback={AppCrash}>          {/* last resort: whole app */}
      <Header />                                  {/* header survives page crashes */}
      <ErrorBoundary fallback={PageCrash}>        {/* per-route */}
        <Outlet />
      </ErrorBoundary>
    </ErrorBoundary>
  );
}

function ProductPageLayout({product}) {
  return (
    <>
      <ProductDetail product={product} />
      <ErrorBoundary fallback={SectionCrash}>     {/* reviews may die alone */}
        <ReviewsSection slug={product.slug} />
      </ErrorBoundary>
    </>
  );
}
```

```jsx
// src/components/ErrorPanel.jsx — for OPERATION failures (the one every
// chapter has been rendering)
import {ApiClientError} from '../lib/api.js';

const MESSAGES = {                    // ch. 3·09's codes → human sentences
  RATE_LIMITED:  {text: 'Too many requests — give it a moment.', retry: true},
  TIMEOUT:       {text: 'That took too long. Worth another try.', retry: true},
  NOT_FOUND:     {text: 'This item is no longer available.',      retry: false},
  VALIDATION:    {text: 'Something about that request was off.',  retry: false},
  INTERNAL:      {text: 'Something broke on our side.',           retry: true},
};

export function ErrorPanel({error, onRetry}) {
  const known = error instanceof ApiClientError ? MESSAGES[error.code] : null;
  const offline = !navigator.onLine;
  const m = offline
    ? {text: 'You appear to be offline.', retry: true}
    : known ?? {text: 'Something went wrong.', retry: true};

  return (
    <div role="alert" className="error-panel">
      <p>{m.text}</p>
      {m.retry && onRetry && <button onClick={onRetry}>Try again</button>}
      {error instanceof ApiClientError && (
        <p className="error-ref">Ref: {error.body?.request_id}</p>
      )}
    </div>
  );
}
```

## The decisions

- **Boundary placement mirrors independence.** The reviews section
  failing must not take the buy button with it; the header must survive
  any page. A boundary belongs exactly where the UI could honestly
  carry on without the subtree — three levels here (app, route,
  optional section), not one per component.
- **`reset` + remount is the boundary's retry** — clearing the error
  re-renders the children from scratch. For crashes caused by a bad
  data shape, the reset alone loops; pairing it with a refetch (the
  fallback calls `retry` from the enclosing data hook) gives the only
  honest second chance. Boundaries don't fix bugs; they contain them
  and report them.
- **The panel's retryability comes from the error code.** The
  [server taxonomy](../phase-3-express-api/09-the-error-contract.md)
  already encodes "is trying again sensible" — `RATE_LIMITED` yes (after
  a beat), `VALIDATION` no (same input, same answer). The client reads
  the contract instead of inventing a parallel judgment.
- **The `request_id` renders, small and copyable.** Support tickets that
  contain it skip the "when exactly did this happen" archaeology —
  the [correlation design](../../../nodejs/pages/phase-10-observability/03-correlation-ids.md)
  paying off at the pixel level.
- **`reportClientError` is one function** — console in dev, the
  telemetry endpoint in prod. The client mirrors the server's
  single-funnel rule: every crash flows through one reporter, so
  coverage is a property, not a hope.

## Gotchas

- **Symptom:** a failed fetch shows the whole-page crash screen.
  **Cause:** someone `throw`s the `ApiClientError` during *render* (a
  `use`-style promise unwrap, or `if (error) throw error` in the
  component body) — turning an operation failure into a render crash.
  **Fix:** the app's convention: async errors are *state* (`status:
  'error'` → `ErrorPanel`); only genuinely broken renders throw. (With
  Suspense-based data layers that line moves by design — chapter 12 —
  but it moves *deliberately*, with boundaries placed for it.)
- **Symptom:** the boundary's "try again" loops the crash forever.
  **Cause:** reset-without-change — same props, same bug. **Fix:** the
  fallback wires reset to the data retry when one exists; when it
  doesn't, after the second failure the panel swaps to "reload the
  page" honesty. Count in the boundary state, two strikes.
- **Symptom:** crashes in event handlers don't hit the boundary.
  **Cause:** by design — boundaries catch render/lifecycle only; handler
  code is ordinary try/catch territory. **Fix:** handlers that mutate
  (the cart's `setQuantity`) already `.catch` and toast
  ([chapter 06](06-cart-state.md)); the reporter is called in those
  catches too, so telemetry sees both families.

## Interview questions

1. **★ Why can't error boundaries catch async/await failures?** A
   boundary catches exceptions thrown while React executes the tree —
   render and lifecycle. An awaited rejection happens later, on a
   microtask, when no component is being rendered; there is no tree
   position to attribute it to. That is why async errors must become
   *state* that a component renders — the transformation `useAsync`
   performs — or be thrown *during* a render that a boundary wraps
   (the Suspense model).
2. **★ How do you decide where boundaries go?** By asking, per region:
   "if this crashed, could the rest of the page still do its job
   honestly?" Each yes is a candidate boundary; each no means the
   crash should propagate to the parent's. The result maps to product
   priorities — here, commerce survives reviews dying, nothing
   survives the shell dying — rather than to the component hierarchy's
   shape.
3. **Why derive retryability from server error codes instead of retrying
   everything?** Retrying a `VALIDATION` failure resubmits the same
   wrong input — a loop wearing a button. The server already knows
   which failures are transient (that knowledge shaped its own retry
   and rate-limit design); the code channel ships it to the UI for
   free. A retry button is a promise that trying again might work;
   the contract says when that promise is true.

---

← Prev: [The admin data table](10-the-admin-data-table.md) ·
Next → [When to switch to TanStack Query](12-when-tanstack-query.md)
