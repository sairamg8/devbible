---
title: "07 · Error handling, loading states and resilience"
sidebar_label: "Overview"
sidebar_position: 0
description: "Every failure in an App Router application is an expected error, an uncaught exception, or a control-flow throw wearing an exception's clothes — and this chapter is the consequences of telling the three apart."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js
> [Error Handling guide](https://nextjs.org/docs/app/getting-started/error-handling)
> (`lastUpdated: 2026-06-10`), the
> [Streaming guide](https://nextjs.org/docs/app/guides/streaming) (`2026-08-25`), the
> [Server Actions guide](https://nextjs.org/docs/app/guides/server-actions) (`2026-06-17`),
> and the `error.js` (`2026-07-10`), `loading.js` (`2026-06-08`), `not-found.js` (`2026-07-10`),
> `route.js` (`2026-04-30`) and `unstable_rethrow` (`2026-03-03`) references.
> Target: **Next.js 16.3.4**, App Router. Documentation-validated; **no sandbox run**.

**Resilience in the App Router looks like a set of file conventions and is really a set of
classification decisions.** `error.tsx`, `global-error.tsx`, `loading.tsx`, `not-found.tsx`,
`forbidden.tsx` and `unauthorized.tsx` are the mechanisms; choosing between them is the work. The
documentation opens the subject by splitting failures into **expected errors**, which are returned
to the client as values, and **uncaught exceptions**, which are thrown and caught by boundaries —
and almost everything that goes wrong in a real application comes from routing a failure through
the wrong one of those two, or from forgetting that a third kind exists: `notFound()` and
`redirect()` are expected outcomes that travel by throwing, which is why an honest `try`/`catch` is
the thing most likely to break them.

Two framework facts run through the whole chapter and are worth carrying into every page:

- 🔴 **Once streaming starts, the status code is spent.** A failure after the first chunk is
  delivered inside a `200 OK`, so it is invisible to uptime checks, health probes, CDN rules and
  every 5xx dashboard you own. The boundary that renders is the only thing that observes it.
- 🔴 **A boundary is a placement decision, not a file-count decision.** An error replaces the
  subtree of whichever boundary catches it, so blast radius is chosen by where the boundary sits —
  and an `error.tsx` in every folder changes nothing if none of them is at the scope that should
  survive.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The unified error model](01-the-unified-error-model-errortsx-boundaries.md)** | The two documented categories, the test that tells them apart, and the decision procedure that picks a mechanism per failure |
| 2 | **[Expected errors are return values](01b-expected-errors-are-return-values.md)** | Why the docs say to avoid `try`/`catch` in Server Functions, and the three things throwing an expected error costs you |
| 3 | **[The typed action result](01c-the-typed-action-result-and-reading-it-back.md)** | `ActionResult<T>` as a discriminated union, and the `aria-live`, `aria-invalid` and `pending` details the documented example carries |
| 4 | **[Control-flow throws](01d-control-flow-throws-and-what-a-catch-swallows.md)** | 🔴 The full list of framework calls that throw — including `cookies()` and `headers()` under a static segment — and what a `catch` silently swallows |
| 5 | **[`unstable_rethrow`](01e-unstable-rethrow-and-its-exact-contract.md)** | The four rules from the reference, why cleanup after the call leaks, and the structural fix the docs prefer to the tool |
| 6 | **[Errors in streaming](02-errors-in-streaming-failures-thrown-mid-suspense-partial-pag.md)** | 🔴 A mid-stream throw is a hole in the page, not an error response — and every status-based monitor is blind to it |
| 7 | **[`notFound()` after the first chunk](02b-notfound-and-redirect-after-the-first-chunk.md)** | 🔴 200 for streamed responses and 404 for non-streamed ones, the injected `noindex`, soft-404 labelling, and the real cost of the documented fix |
| 8 | **[What silently defeats streaming](02c-what-silently-defeats-streaming-in-production.md)** | Nginx, CDN plan tiers, Lambda response streaming mode, compression, WebKit's 1024-byte buffer, static export — and why `curl` is the wrong instrument |
| 9 | **[Server Action error contracts](03-server-action-error-contracts-returning-typed-errors-vs.md)** | One response carrying both a return value and a re-render — and 🔴 the one cache call that does **not** include it |
| 10 | **[Sequential dispatch](03b-sequential-dispatch-and-what-it-does-to-error-ui.md)** | Why `Promise.all` cannot parallelise actions from the client, and why a queued action looks exactly like a failed one |
| 11 | **[An action is a public POST endpoint](03c-an-action-is-a-public-post-endpoint.md)** | 🔴 Render-time gating is not a security boundary, and schema validation cannot answer an ownership question |
| 12 | **[Action IDs rotate](03d-action-ids-rotate-and-what-that-does-to-an-open-tab.md)** | "Failed to find Server Action" — the failure caused purely by deploying, and why its remedy is a UI decision |
| 13 | **[Route Handler error responses](04-route-handler-error-responses-and-consistent-api-error-envel.md)** | No boundary, no fallback, no `digest` — plus the three things wrong with the documentation's only error example |
| 14 | **[Designing the error envelope](04b-designing-the-error-envelope.md)** | ⚠️ Explicitly **this book's recommendation**: the reference prescribes no response shape at all |
| 15 | **[`loading.tsx` vs inline Suspense](05-loadingtsx-vs-inline-suspense-skeleton-strategy-and-layout-s.md)** | Exactly what it wraps, the documented comparison, and 🔴 how it converts a blocking-prerender build error into a silent full-page skeleton |
| 16 | **[The layout that blocks your skeleton](05b-the-layout-that-stops-your-skeleton-appearing.md)** | 🔴 The most-reported "streaming does not work" case, and how Cache Components turns it from silent into a build error |
| 17 | **[Skeletons and layout shift](05c-skeletons-layout-shift-and-the-cost-of-a-boundary.md)** | CLS, why `preload` cannot rescue an LCP element inside a boundary, hydration units, and React's warning that it may use a boundary you did not expect |
| 18 | **[Retry, fallback and degradation](06-retry-fallback-and-graceful-degradation-patterns.md)** | 🔴 The framework specifies no retry policy at all; the degradation ladder that decides what an outage should cost |
| 19 | **[Timeouts, backoff and your own retries](06b-timeouts-backoff-and-the-retries-you-own.md)** | `AbortSignal.timeout`, idempotency, full jitter, and a retry budget — with its per-process caveat stated |
| 20 | **[Partial data with `allSettled`](06c-partial-data-and-promise-allsettled.md)** | Rendering what succeeded, the reporting obligation a never-rejecting promise creates, and when partial data is dishonest |
| 21 | **[Milestone: boundary coverage](07-project-milestone-sprintdesk-gets-full-error-boundary-covera.md)** | SprintDesk's ten-row failure map — the artefact the rest of the milestone is derived from |
| 22 | **[Milestone: placing the boundaries](07b-milestone-placing-the-boundaries.md)** | The tree with a reason per file, and the three rows that deliberately get no `error.tsx` |
| 23 | **[Milestone: action and form contracts](07c-milestone-the-action-and-form-error-contracts.md)** | The optimistic reconcile that must revert *and explain itself*, and the card form's contract |
| 24 | **[Milestone: the three auth answers](07d-milestone-the-boards-three-auth-answers.md)** | Missing board, wrong team, expired session — and the information-disclosure trade-off in the order of the checks |
| 25 | **[Milestone: making failures visible](07e-milestone-skeletons-and-making-failures-visible.md)** | Sizing three states into one slot, why the board gets no `loading.tsx`, and alerting on reported errors rather than status |
| 26 | **[`error.js` props: `retry` and `reset`](09-errorjs-props-retry-and-reset.md)** | 🔴 `retry()` re-fetches, `reset()` only re-renders — and what `error.message` and `error.digest` carry in production |
| 27 | **[Custom error boundaries with `catchError`](10-custom-error-boundaries-with-catcherror.md)** | Component-level boundaries, for when a file-per-segment is the wrong granularity |
| 28 | **[What boundaries do not catch](10b-what-boundaries-do-not-catch.md)** | Event handlers, async code, the `startTransition` exception, and why a hand-rolled catch swallows `notFound()` |
| 29 | **[Where boundaries sit in the hierarchy](10c-where-boundaries-sit-in-the-hierarchy.md)** | 🔴 `error.js` wraps nested layouts but **not** the `layout.js` or `template.js` beside it |
| 30 | **[`global-error` and what it does not inherit](10d-global-error-and-what-it-does-not-inherit.md)** | Its own `<html>`/`<body>`, no global styles or fonts, and the unthemeable built-in 500 page |
| 31 | **[Auth interrupts: `forbidden` and `unauthorized`](11-auth-interrupts-forbidden-and-unauthorized.md)** | The 401/403 file conventions and the flag they need |
| 32 | **[They work by throwing](11b-auth-interrupts-throw.md)** | The four things that breaks, and where the calls may not be placed |
| 33 | **[Network resilience and `useOffline`](12-network-resilience-and-useoffline.md)** | What an application owes a user whose connection is gone |
| 34 | **[Offline Server Actions and testing](12b-offline-server-actions-and-testing.md)** | Retrying mutations across a connection loss, and how any of this gets tested |

## Phase gate

You are done with this chapter when you can take an unfamiliar route, list every way it can fail,
say for each one whether it is an expected error, an uncaught exception or a control-flow throw,
name the file or component that will handle it, predict the HTTP status the user's browser will
actually receive — and explain why your existing monitoring would or would not notice.

## Where this connects

- [03 · Server vs Client Components](../03-server-components-vs-client-components/01-explanation.md) — why every boundary must be a Client Component
- [04 · Data fetching](../04-data-fetching-in-the-app-router/01-explanation.md) — where the failures this chapter catches originate
- [05 · Caching, PPR and Cache Components](../05-caching-ppr-and-cache-components/01-explanation.md) — the mode that turns the layout trap from silent into a build error
- [10 · Forms, authentication and security hardening](../10-forms-authentication-and-security-hardening/01-explanation.md) — the security half of the Server Action contract
- [16 · Deployment, scaling and observability](../16-deployment-scaling-and-observability/01-explanation.md) — where the errors reported here are collected

---

**Start →** [01 · The unified error model](01-the-unified-error-model-errortsx-boundaries.md)
