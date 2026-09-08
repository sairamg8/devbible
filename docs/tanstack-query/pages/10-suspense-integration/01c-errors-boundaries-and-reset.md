---
title: "Suspense Errors: The Default `throwOnError` Is a Predicate, Not `true` — and Resetting a Boundary Needs `QueryErrorResetBoundary`"
sidebar_label: "01c · Errors and reset"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the TanStack Query docs — [Suspense](https://tanstack.com/query/latest/docs/framework/react/guides/suspense), [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults). The error-boundary snippets are the guide's own, written against `react-error-boundary`. Documentation-validated, **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-08 · claims + output provenance · session d0684ffb

# 🔄 Suspense Errors, Boundaries and Reset

**The most common wrong belief about suspense mode is that it throws every error to the nearest
error boundary. It does not, and the docs say so directly:**

> *"Not all errors are thrown to the nearest Error Boundary per default - we're only throwing
> errors if there is no other data to show."*

The default is a **predicate**, printed in the guide as:

```ts
throwOnError: (error, query) => typeof query.state.data === 'undefined'
```

Read it as a rule about *state*, not about *severity*: throw when the cache is empty for this key,
because there is nothing to render; do not throw when data already exists, because replacing a
working screen with an error page over a failed background refetch is worse than showing slightly
stale rows. **Errors on first load reach the boundary. Errors on refetch do not.**

## 1. What that default means in practice

| Situation | Cache for this key | Default behaviour |
|---|---|---|
| First mount, request fails | empty | **Throws** — error boundary renders |
| Background refetch fails, data already cached | populated | **Silent** — stale data stays on screen |
| Key changes to one never fetched, fails | empty for the new key | **Throws** |
| Retry attempts still running | empty | Neither — still suspended |

🔴 **The second row is the one that surprises people, and it is deliberate.** It also means a
suspense-driven page can sit indefinitely showing data that is failing to refresh with no visible
signal, because the mode removed the `isError` flag you would have rendered a banner from. If that
matters — and on a dashboard showing prices or stock levels it does — you either opt into throwing
everything or you surface the failure some other way.

To throw everything, the guide's own pattern is to do it by hand:

> *"you have to throw errors manually if you want all errors to be handled by Error Boundaries:"*

```tsx
import { useSuspenseQuery } from '@tanstack/react-query'

const { data, error, isFetching } = useSuspenseQuery({ queryKey, queryFn })

if (error && !isFetching) {
  throw error
}

// continue rendering data
```

⚠️ **Note what this snippet proves about the result object.** `error` and `isFetching` *are*
available on a suspense query's result — what the mode removes is the *need* to branch on them,
not the fields themselves. The `!isFetching` guard is load-bearing: without it you throw during
the retry window, defeating the retry policy you are about to read about.

## 2. Retries happen before the boundary ever sees the error

The default query retry policy still applies underneath suspense:

> *"Queries that fail are silently retried 3 times, with exponential backoff delay before capturing
> and displaying an error to the UI."*

So a component suspends, four requests go out over a few seconds, and only then does the error
propagate. From the boundary's point of view a "failed query" is a *settled* failure, not a first
attempt — which is usually what you want, and occasionally not: a form submission gate or a
health check that should fail fast needs `retry: false` set explicitly, or the user stares at a
skeleton through the whole backoff.

```tsx
// Fail fast: this query gates a checkout step, and a four-attempt backoff is worse than an
// immediate, retryable error screen.
const { data } = useSuspenseQuery({
  queryKey: ['checkout', 'eligibility', cartId],
  queryFn: () => fetchEligibility(cartId),
  retry: false,
});
```

## 3. Resetting the boundary — why a plain "Try again" button does not work

An error boundary that has caught an error stays in its error state until something resets it.
`react-error-boundary` gives you `resetErrorBoundary()` for that. But resetting the *boundary*
does not reset the *query* — the query is still in an error state in the cache, so the component
re-mounts, reads the cached error, and throws again immediately. The button appears to do nothing.

TanStack Query solves this with a component and a hook whose whole job is to tie the two resets
together.

The component form — *"When using the component it will reset any query errors within the
boundaries of the component:"*

```tsx
import { QueryErrorResetBoundary } from '@tanstack/react-query'
import { ErrorBoundary } from 'react-error-boundary'

const App = () => (
  <QueryErrorResetBoundary>
    {({ reset }) => (
      <ErrorBoundary
        onReset={reset}
        fallbackRender={({ resetErrorBoundary }) => (
          <div>
            There was an error!
            <button onClick={() => resetErrorBoundary()}>Try again</button>
          </div>
        )}
      >
        <Page />
      </ErrorBoundary>
    )}
  </QueryErrorResetBoundary>
)
```

The hook form — *"When using the hook it will reset any query errors within the closest
`QueryErrorResetBoundary`."*

```tsx
import { useQueryErrorResetBoundary } from '@tanstack/react-query'
import { ErrorBoundary } from 'react-error-boundary'

const App = () => {
  const { reset } = useQueryErrorResetBoundary()
  return (
    <ErrorBoundary
      onReset={reset}
      fallbackRender={({ resetErrorBoundary }) => (
        <div>
          There was an error!
          <button onClick={() => resetErrorBoundary()}>Try again</button>
        </div>
      )}
    >
      <Page />
    </ErrorBoundary>
  )
}
```

🔴 **The wiring is `onReset={reset}` on the error boundary, and `resetErrorBoundary()` in the
fallback.** Two different resets, connected. The fallback's button clears the *boundary*; the
`onReset` handler clears the *query errors*; and the component then re-mounts into a clean cache
and refetches. Omit either half and you get a button that either does nothing or clears the UI
into an instant re-throw.

⚠️ **The hook resets errors within the closest `QueryErrorResetBoundary`** — note *closest*, not
*global*. With no `QueryErrorResetBoundary` in the tree the hook still works, scoped to the
provider's default; with several, placement decides which errors a given "Try again" clears. On a
page with independently-failing regions, put one around each region rather than one at the root,
or a retry in the sidebar silently resets the main panel too.

---

## Gotchas

**★ 🔴 Symptom: a background refetch fails and the page shows stale data with no indication
anything is wrong.** Cause: the default `throwOnError` predicate is `typeof query.state.data ===
'undefined'` — data exists, so nothing throws, and suspense mode removed the `isError` you would
have rendered a banner from. Fix: read the fields the hook still returns and surface it yourself,
or opt that query into throwing everything:

```tsx
const { data, error, isFetching } = useSuspenseQuery({ queryKey, queryFn });
return (
  <>
    {error && !isFetching && <StaleBanner error={error} />}
    <Rows rows={data.rows} />
  </>
);
```

**★ 🔴 Symptom: the "Try again" button in the error fallback does nothing — the error screen
re-renders instantly.** Cause: `resetErrorBoundary()` resets the boundary but not the query, so the
remounted component reads the cached error and throws again in the same tick. Fix: wire
`onReset={reset}` from `QueryErrorResetBoundary` or `useQueryErrorResetBoundary`, per §3. This is
the single most common suspense bug and it looks like an error-boundary bug, which is why people
debug the wrong library for an afternoon.

**★ Symptom: the error boundary catches, but seconds after the failure rather than immediately.**
Cause: the default retry policy — three silent retries with exponential backoff — runs first, and
the component is suspended throughout. Fix: nothing, if the delay is acceptable; `retry: false` or
a smaller `retry: 1` on queries where fast failure is better than eventual success.

**★ 🔴 Symptom: you added the manual `throw error` pattern and now the boundary fires during
normal retries.** Cause: the `!isFetching` guard was dropped. Between attempts, `error` is
populated and a fetch is in flight; throwing then converts a recoverable retry into a terminal
failure. Fix: keep the guard exactly as the docs write it — `if (error && !isFetching) throw error`.

**★ Symptom: `Suspense` is in place, the query fails, and the whole app unmounts to a blank
screen.** Cause: there is no error boundary — `Suspense` handles suspensions only, and an
uncaught throw during render unmounts the tree at the root. Fix: pair every suspense boundary
with an error boundary at the same level. Note the precondition: this only happens when the cache
is empty for that key, per the default predicate, so it reproduces on a cold load and not on a
warm one — which is why it so often escapes local testing and appears in production.

**★ Symptom: retrying one failing region resets an unrelated region that was fine.** Cause: a
single `QueryErrorResetBoundary` at the root scopes every reset to the whole tree. Fix: one
boundary per independently-failing region — the hook resets *"any query errors within the closest
`QueryErrorResetBoundary`"*, so placement is the control you have.

**★ Symptom: an error thrown in the fallback UI itself takes down the boundary.** Cause: a
fallback that renders `error.response.data.message` on an error object that is a `TypeError` from
a network failure — the fallback assumes a shape the error does not have. Fix: type the error
narrowly before reading it, and give the fallback a shape-independent default:

```tsx
fallbackRender={({ error }) => (
  <ErrorPage message={error instanceof HttpError ? error.detail : 'Something went wrong'} />
)}
```

**★ Symptom: switching a query to `throwOnError: true` made unrelated screens brittle.** Cause:
`true` throws on refetch failures too, so a transient network blip on a screen the user was
already reading now replaces working content with an error page. Fix: prefer a predicate over
`true` — `(error, query) => typeof query.state.data === 'undefined' || isFatal(error)` keeps the
default's good behaviour and adds only the class you actually want escalated.

---

## Interview questions

**★ Does `useSuspenseQuery` throw every error to the error boundary?**
No. The default is a predicate — *"we're only throwing errors if there is no other data to show"*,
implemented as `throwOnError: (error, query) => typeof query.state.data === 'undefined'`. So a
cold-load failure reaches the boundary and a background-refetch failure does not. The reasoning is
that tearing down a working screen because a refresh failed is a worse outcome than showing
briefly-stale data, and the library declines to make that call for you.

**★ A user clicks "Try again" in your error fallback and nothing happens. Diagnose it.**
The boundary was reset; the query was not. The component remounts, `useSuspenseQuery` reads the
error still sitting in the cache for that key, and throws again before paint — so the error screen
appears to persist. The fix is `QueryErrorResetBoundary` (or `useQueryErrorResetBoundary`) wired
into the boundary's `onReset`, which clears the cached query errors in the same gesture. It is
worth naming why the two resets are separate: the cache outlives the component tree by design, and
an error is cache state.

**★ Why does the docs' manual-throw snippet guard on `!isFetching`?**
Because during the retry window both an error and an in-flight request exist at once. Throwing on
the presence of `error` alone converts every retryable failure into a terminal one, defeating the
default three-retry-with-backoff policy before it has finished. The guard says "throw only once
the failure has settled", which is the same judgement the default predicate makes from a different
angle.

**★ When would you set `retry: false` on a suspense query?**
When the user is staring at a skeleton and a fast, actionable error beats an eventual success.
Checkout eligibility, a permissions probe that gates a whole route, a health check behind a
"connect" button — anything where four attempts over several seconds reads as a hang. The
trade-off is real: you are converting transient failures into user-visible errors, so it belongs
on specific queries, never as a global default.

**★ Where do you place `QueryErrorResetBoundary` on a dashboard with six independent panels?**
One per panel, alongside each panel's error boundary — not one at the root. The hook resets *"any
query errors within the closest `QueryErrorResetBoundary`"*, so a root-level boundary makes every
panel's "Try again" reset all six, refetching five queries that were never failing. Scoping resets
to the region that failed is the whole point of having placement be a decision.

**★ How does an error boundary interact with a suspense boundary that is above it?**
They are independent mechanisms with independent placement, and the relative nesting decides how
much of the screen an error replaces. An error boundary *above* several suspense boundaries
replaces all of them; one *inside* a suspense boundary scopes the error to that subtree while the
skeleton logic stays outside. The practical rule is to pair them at the same level, around the same
subtree, so that "what is loading" and "what has failed" describe the same region of the page.

---

← [What suspense removes](./01b-what-suspense-mode-removes.md) · [Topic index](../README.md) · Next → [Fetch-on-render and streaming](./01d-fetch-on-render-and-streaming.md)
