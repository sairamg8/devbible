---
title: "Full boundary coverage is not a file in every folder — it is a failure map, one decision per dependency about what its outage should cost, and boundaries placed to match those decisions rather than to match the directory tree"
sidebar_label: "07 · Milestone: boundary coverage"
sidebar_position: 7
description: "Chapter 7's capstone, act one: enumerating SprintDesk's failure modes, choosing a degradation rung per dependency, placing error.tsx and catchError boundaries where the blast radius should stop, and acceptance criteria you can check by reading the tree rather than by breaking production."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-04 against the Next.js
> [Error Handling guide](https://nextjs.org/docs/app/getting-started/error-handling)
> (`version: 16.3.4`, `lastUpdated: 2026-06-10`), the
> [`error.js` reference](https://nextjs.org/docs/app/api-reference/file-conventions/error)
> (`lastUpdated: 2026-07-10`) and the
> [Streaming guide](https://nextjs.org/docs/app/guides/streaming) (`lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4**, App Router. Documentation-validated; **no sandbox run** —
> 🔴 **no failure-injection runs, error rates or timings appear on this page.** Every criterion
> below is something you can verify by reading your own tree.

**"Add error boundaries" is not a task, and treating it as one is how a codebase ends up with an
`error.tsx` in every folder and the same blast radius it had before.** A boundary does nothing
until you have decided what should survive the failure it catches, and that decision is per
dependency, not per directory. This milestone is three acts in a fixed order: map what can fail
and pick a rung for each, place boundaries where the map says the damage should stop, then make
the failures observable. The order matters because the placement is meaningless without the map,
and the observability is guesswork until the placement is settled. This page is step one — the map. Placing the boundaries it
implies is [07b](07b-milestone-placing-the-boundaries.md); the action and form contracts are
[07c](07c-milestone-the-action-and-form-error-contracts.md); the loading and observability pass
is [07e](07e-milestone-skeletons-and-making-failures-visible.md).

## SprintDesk, as a thing that fails

The running project is a multi-tenant task dashboard. The properties that decide where its
failures land:

- **The dashboard shell is prerendered and the board streams in.** Cache Components is on, so
  Partial Prerendering is the default and the shell is committed before the board resolves.
- **The board is the interactive surface** — columns of cards, drag-and-drop that mutates
  optimistically and reconciles against a Server Action.
- **Filters live in the URL**, so filtering is a navigation rather than a client-side array
  operation.
- **Card detail renders user-authored markdown**, including fenced code blocks in bug reports.
- **Data is Drizzle on Neon**, team-scoped by a predicate in the data layer.

Four of those five can fail in a way a user sees, and each fails differently.

## Act 1, step 1 — the failure map

Write this table for the real application before touching any code. It is the whole milestone;
everything after it is mechanical.

| # | What fails | Category | Rung | Blast radius should be |
|---|---|---|---|---|
| 1 | Neon is unreachable | uncaught | **4 · fatal** | the board area, **not** the app chrome |
| 2 | One column's card query fails | uncaught | **3 · announced** | that column only |
| 3 | A card's markdown fails to parse | uncaught | **2 · degraded** | that card's body — show the raw text |
| 4 | The activity feed's upstream is down | uncaught | **1 · invisible** | nothing; omit the panel |
| 5 | A drag-and-drop reconcile is rejected | expected | **3 · announced** | the card reverts, with a message |
| 6 | A card title fails validation | expected | — | the form field |
| 7 | The board id in the URL does not exist | expected | — | `not-found.js` |
| 8 | The user is not on this team | expected | — | `forbidden.js` |
| 9 | The session has expired | expected | — | `unauthorized.js` |
| 10 | A stale tab submits after a deploy | uncaught | **3 · announced** | a reload affordance |

The rungs come from
[06 · Retry, fallback and degradation](06-retry-fallback-and-graceful-degradation-patterns.md); the
expected/uncaught column is
[01 · The unified error model](01-the-unified-error-model-errortsx-boundaries.md)'s test. Rows 6
to 9 have no rung because they never reach a boundary at all — they are returned values and
control-flow throws.

🔴 **Row 1 is the one that is nearly always wrong before this milestone**, and it is the failure
the chapter's own scenario records: a column fetch failed and blanked the entire `/app` layout,
because `error.tsx` sat at the top of the tree. The database being down should cost you the board.
It should not cost you the navigation the user needs in order to leave the board.

## Scope

| In scope | Out of scope, and where it lands |
|---|---|
| The failure map and a rung per dependency | — |
| `error.tsx` / `global-error.tsx` placement | [07b](07b-milestone-placing-the-boundaries.md) |
| Component-level boundaries for per-column recovery | [07b](07b-milestone-placing-the-boundaries.md) |
| Degrading the markdown renderer and the activity feed | [07b](07b-milestone-placing-the-boundaries.md) |
| Action return contracts and the form error paths | [07c](07c-milestone-the-action-and-form-error-contracts.md) |
| Skeletons, `loading.tsx` and the observability wiring | [07e](07e-milestone-skeletons-and-making-failures-visible.md) |
| What `retry()` and `reset()` each do | [09 · `error.js` props](09-errorjs-props-retry-and-reset.md) |
| How `catchError` works | [10 · Custom error boundaries](10-custom-error-boundaries-with-catcherror.md) |
| What a boundary cannot catch | [10b · What boundaries do not catch](10b-what-boundaries-do-not-catch.md) |
| Which segment's boundary catches what | [10c · Where boundaries sit](10c-where-boundaries-sit-in-the-hierarchy.md) |
| `forbidden()` / `unauthorized()` mechanics | [11 · Auth interrupts](11-auth-interrupts-forbidden-and-unauthorized.md) |
| Offline behaviour and network resilience | [12 · Network resilience](12-network-resilience-and-useoffline.md) |

## Gotchas

### An `error.tsx` in every folder, and the same blast radius as before
**Symptom.** The tree looks thoroughly covered and a single failing query still blanks the whole
dashboard.
**Cause.** The failure lands on the *nearest* boundary, and the nearest one is whichever segment
the throwing component sits in — adding files further out changes nothing for it.
**Fix.** Place boundaries by working backwards from the map: for each row, find the component
that throws, then put the boundary at the smallest scope that should survive.

### A failure map written after the boundaries
**Symptom.** The map is a description of what the code already does, and every row conveniently
has a handler.
**Cause.** It was reverse-engineered rather than decided.
**Fix.** Write it from the dependency list — every external call the application makes, one row
each — before looking at the tree. The rows with no handler are the output of the exercise.

### Auth interrupts routed through the boundary
**Symptom.** An expired session renders "Something went wrong" instead of the sign-in prompt.
**Cause.** The auth check threw a plain `Error`, so it was caught as an uncaught exception rather
than routed to `unauthorized.tsx`.
**Fix.** Use the interrupt functions where the flag is enabled — see
[11](11-auth-interrupts-forbidden-and-unauthorized.md) — and keep them outside any `try`.

## Interview questions

**★ What does "full error boundary coverage" actually mean?**
Not a file per directory. It means every dependency that can fail has a decision attached to it —
what its outage costs the user — and a boundary placed at the scope where that damage should
stop. Coverage is a property of the map, not of the file count; a tree with ten `error.tsx` files
and no map has the same blast radius it always had.

**★ Three of the failure-map rows get no `error.tsx`. Why not?**
Because `error.tsx` is per segment and those failures are inside one. A per-column failure needs a
component-level boundary — `catchError` — to have a per-column blast radius. A card body that can
fall back to raw text and an activity panel that can be omitted need no boundary at all; a
component that can render something sensible should do that rather than throw.

**★ What is the reporting obligation created by rungs 1 and 2?**
Every deliberate `catch` that degrades has to report. Rung 1 makes the feature vanish and rung 2
replaces it with something reduced; both hide the failure from the user by design, and neither
hides it from you unless you let it. Without the reporting call the pattern is indistinguishable
from a bug that nobody has noticed.

**★ In what order should this milestone be done, and why does the order matter?**
Map, place, observe. Placement without the map is guesswork about blast radius, and observability
without the placement instruments boundaries that are about to move. The map is also the only
artefact of the three that outlives the code — it is the document that says what an outage in each
dependency is *supposed* to cost.

---

← [06c · Partial data with `allSettled`](06c-partial-data-and-promise-allsettled.md) · **Next → [07b · Placing the boundaries](07b-milestone-placing-the-boundaries.md)**
