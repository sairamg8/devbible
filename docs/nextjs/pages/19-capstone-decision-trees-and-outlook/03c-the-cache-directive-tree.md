---
title: "Choosing between `use cache`, `use cache: remote`, `use cache: private` and no directive is settled by two questions asked in a fixed order — whether the scope reads request data, and whether the data may rest on a server — and the first correct move is almost never a change of directive"
sidebar_label: "03c · The cache directive tree"
sidebar_position: 13
description: "The fourth tree: hoisting the request read before touching a directive, the conjunction that justifies remote, the price list for private, and the two failure shapes that look like one bug."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 — every branch of this tree terminates in a page of this book that already argues it, verified there against the Next.js 16.3.4 documentation. This page introduces no new framework claims of its own.
> Documentation-verified; **no sandbox run, no timings**.
> Target: **Next.js 16.3.4** · React canary bundled by the App Router · Node.js **24.20.0**.

**[Chapter 5 already has a directive decision tree](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/01-choosing-a-directive.md), and it is correct; reproducing it here would be exactly the dead weight this topic exists to avoid. What that tree cannot do, because a chapter may only argue its own subject, is tell you that its own question 2 — *is this content in the static shell?* — has no answer inside chapter 5. It is [the rendering tree's](03-architecture-decision-trees-rendering-strategy.md) answer, arrived at through a `cookies()` read in a layout three directories away. And its question 3 asks whether a remote handler is worth its infrastructure, which is [the runtime tree's](03e-the-runtime-and-deployment-target-tree.md) answer, because on some platforms the handler is supplied for you and on others you operate it. This page is the same three directives with those two dependencies made explicit, plus the price list nobody reads before choosing `private`.**

The settling question here is not *"which one is fastest"*. It is **"where in the call graph does the request enter, and can I move that point outward?"** — which is the same settling question as the rendering tree, asked about a function instead of a route.

## Preconditions, before any branch

All three directives require `cacheComponents: true`. **Anything a cache directive covers must be `async`.** At file level the directive covers **every export**, including framework exports like `generateMetadata` and `generateStaticParams` if they live in that file — so a single synchronous helper sharing the file is a build failure with a confusing shape.

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
}

export default nextConfig
```

## The cache directive tree

```text
CACHE DIRECTIVE TREE — use cache / use cache: remote / use cache: private / none

Q1. Does this scope read a request API?
    cookies() · headers() · searchParams
    The restriction follows the WHOLE CALL STACK: a helper that the cached
    function calls, which reads one of them, fails identically.
    |
    +- No ------------------------------------------------------> Q2
    |
    +- Yes, and the read can happen OUTSIDE and the value be
    |  passed in as an argument or a prop ----------------------> HOIST IT.
    |      This is the first move, always. It is not a change of
    |      directive - it is a change of call graph. Then Q2.
    |
    +- Yes, and you genuinely cannot: a compliance rule, or a
       call graph that cannot be refactored --------------------> use cache: private
                                                                   but read Q5 first.

Q1a. Does the scope call connection()?
    |
    +- Yes -> NO DIRECTIVE, and there is no branch that rescues this.
              connection() is banned in EVERY cache scope, private included.
              Read the other way round, that is what connection() is FOR:
              deliberately deferring a component to request time when nothing
              else it reads would have deferred it.

Q2. May this data rest on a server at all?
    |
    +- No - it must never be written to shared server storage ---> use cache: private
    |        (the only directive that stores nothing on a server)
    +- Yes ------------------------------------------------------> Q3

Q3. Is this content in the STATIC SHELL - prerendered, rather than deferred to
    request time?
    🔴 You cannot answer this inside this tree. It is the RENDERING tree's
       answer, and it was probably decided by a request-API read in an
       ancestor file.
    |
    +- Yes -> use cache. The entry is filled at prerender; a remote round trip
    |         buys nothing.
    +- No, it renders at request time ---------------------------> Q4

Q4. Are BOTH of these true - not either, both?
      (a) the upstream is rate-limited, slow, expensive or flaky, AND
      (b) the cache key has FEW DISTINCT VALUES.
    |
    +- Both ------> use cache: remote. It earns its infrastructure bill.
    +- Only (a) --> a remote cache on a near-unique key has near-zero
    |               utilization and still pays a lookup on every miss:
    |               strictly worse than no cache. Plain use cache, or none.
    +- Only (b) --> plain use cache. There is nothing expensive to avoid.
    +- Neither ---> NONE. Not caching is a terminal, not a failure to decide.

Q5. The price of private, before you commit to it:
      - NO server-side caching at all: the scope runs on every server render
      - excluded from static shell generation entirely
      - stale must be >= 30 seconds or per-link prefetching does not work
      - stale must be >= 5 minutes or the content is excluded from the App Shell
      - it cannot nest with remote, in EITHER direction
    If those are acceptable, private is right. If you are only accepting them
    to make an error message go away, go back to Q1 and hoist.
```

## Why Q1's middle branch is the whole tree

`cookies()`, `headers()` and `searchParams` are forbidden inside `use cache` and `use cache: remote`, and the error is `next-request-in-use-cache`. The instinctive fix — switch to the directive that *is* allowed to read cookies — is the wrong one, and the documentation frames `private` as the escape hatch for when you cannot refactor rather than the general answer to the error.

```tsx
// BAD — private chosen to silence the error. You have just forfeited every
// server-side cache hit and excluded this scope from prerendering.
async function getRecommendations(productId: string) {
  'use cache: private'
  const sessionId = (await cookies()).get('session-id')?.value
  return db.recommendations.findMany({ where: { productId, sessionId } })
}

// GOOD — read at the boundary, cache on the low-cardinality dimension
async function Recommendations({ productId }: { productId: string }) {
  const language = (await cookies()).get('language')?.value ?? 'en'
  const content = await getCMSContent(language)
  return <Recs content={content} />
}

async function getCMSContent(language: string) {
  'use cache: remote'
  cacheLife({ expire: 3600 })
  return cms.getHomeContent(language)
}
```

Notice what the hoist did beyond fixing the error: it changed the cache key from *(product, session)* — unique per user, hit rate near zero — to *(language)*, which has a handful of values. **Hoisting is a cache-design move, not only an error fix**, and that is why it comes before every other branch.

## The key is everything the body touches, not the parameter list

The second reason a one-parameter function can have thousands of entries has nothing to do with request APIs. When a cached function references a variable from an outer scope, that variable is **automatically captured and bound as an argument**, so it joins the cache key — and the signature does not show it.

```tsx
// The key here is (userId, filter). Nothing in the call site says so.
async function Component({ userId }: { userId: string }) {
  const getData = async (filter: string) => {
    'use cache'
    const res = await fetch(`https://api.example.com/users/${userId}/data?filter=${filter}`)
    return res.json()
  }
  return getData('active')
}

// Fixed: module scope, nothing can be captured, the key is exactly what you read.
async function getUserData(userId: string, filter: string) {
  'use cache'
  const res = await fetch(`https://api.example.com/users/${userId}/data?filter=${filter}`)
  return res.json()
}
```

[Slots and cache keys](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/01c-slots-and-cache-keys.md) is the full argument, including what a slot does instead — children passed through a cached component are not part of the key.

## Two failure shapes that people report as one bug

They are different bugs and they want different fixes, and telling them apart costs nothing once you know the distinction exists.

| What you did | What happens | Fix |
|---|---|---|
| A **direct** `cookies()`/`headers()`/`searchParams` read inside `use cache` | Fails **immediately** with `next-request-in-use-cache` | Hoist the read (Q1) |
| Passing an **un-awaited runtime Promise** into a cached scope, which then awaits it | **Hangs**, then the prerender fill times out after **50 seconds** | Await it *outside* and pass a **value** in |

The second is the one that reads as "the build is stuck". [Revalidation and lifetimes](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/05-revalidation-and-lifetimes.md) documents the timeout and its error text, and the shape of the mistake is always the same: something request-shaped crossed the boundary as a Promise instead of as a value.

```tsx
// BAD — the cached scope awaits a Promise created outside it; the fill hangs.
async function Dynamic() {
  const cookieStore = cookies()             // not awaited
  return <Cached promise={cookieStore} />
}

// GOOD — await outside, pass a value.
async function Dynamic() {
  const theme = (await cookies()).get('theme')?.value ?? 'light'
  return <Cached theme={theme} />
}
```

## The terminals

| Terminal | Reached from | Where the book argues it |
|---|---|---|
| **`use cache`** | Q3 yes, or Q4 with only (b) | [`use cache` at runtime](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/02-use-cache-at-runtime.md) |
| **`use cache: remote`** | Q4, both (a) and (b) | [`use cache: remote`](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/03-use-cache-remote.md) |
| **`use cache: private`** | Q1 last branch, or Q2 no | [`use cache: private`](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/04-use-cache-private.md) |
| **No directive** | Q1a, or Q4 neither | [Choosing a directive](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/01-choosing-a-directive.md) |
| **More than one on the same page** | The normal case | [Composing the three](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/01b-composing-the-three.md) · [the topic index](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/README.md) |

One page normally uses all three, because one page normally has all three kinds of data. What the model does **not** allow is arbitrary nesting: `remote` cannot nest inside `private` and `private` cannot nest inside `remote`, in either direction, because the two make contradictory promises about where the value rests.

## What each terminal costs you later

| Terminal | The bill |
|---|---|
| **`use cache`** | The runtime half depends on where you host: in serverless, memory is per-instance, ephemeral and not preserved across requests, so the hit rate outside the prerender is a deployment property you did not choose here. |
| **`use cache: remote`** | You now operate a cache. Self-hosted, you configure the storage yourself; the lookup is a network round trip on every miss; and it becomes a dependency of every request that reaches it. |
| **`use cache: private`** | Permanently no server cache and no prerendering for that scope, plus two thresholds — `stale` below 30 seconds kills per-link prefetching, and below 5 minutes excludes the content from the App Shell — that show up as "navigation feels slower" with nothing pointing at the directive. |
| **No directive** | The upstream takes every request. This is correct far more often than it feels, and wrong the day traffic multiplies. |

## Are there one-way doors on this tree?

**No, and it is worth saying so explicitly, because this is the tree teams are most nervous about.** Changing a directive is a line edit; the hoist in Q1 is a refactor of one component boundary; abandoning `remote` means deleting a handler configuration and accepting more upstream traffic. Nothing here is irreversible in the sense that [static export](../06-ssg-isr-and-ssr-strategy/04d-the-migration-back-and-the-one-way-door.md) is irreversible.

What *is* sticky is a habit rather than a decision: once `private` has been used twice to make an error message go away, it becomes the team's answer to that error, and the two thresholds in Q5 start degrading navigation across the application with no single commit to blame. That is a review problem, not an architecture problem — but it is the reason Q1's ordering is stated as *always*.

## Gotchas

**★ Symptom: `next-request-in-use-cache`, and switching the directive to `private` makes it go away.** Cause: `private` may read all three request APIs, so it silences the error — by forfeiting server caching and prerendering for that scope entirely. Fix: hoist the read to the component boundary and pass a value, as in the `getCMSContent` example above. Reach for `private` only when Q2 says the data may not rest on a server, or when the call graph genuinely cannot be refactored.

**★ Symptom: the build hangs and then fails after about fifty seconds.** Cause: a cached scope is awaiting a Promise that resolves to request-specific or uncached data created **outside** the boundary — it cannot resolve during a prerender, and the fill times out. Fix: await outside the cached scope and pass the resolved value in. Note the diagnostic value of the *shape*: a direct request-API read fails at once, a smuggled Promise hangs.

**★ Symptom: a cached function takes one parameter and the cache has thousands of entries.** Cause: closure capture — every variable the body reads from an outer scope is bound as an argument and joins the key. Fix: hoist the function to module scope so nothing can be captured by accident, and read the key as *everything the body touches from outside itself*.

**★ Symptom: `use cache: remote` was added to the slow endpoint and nothing improved.** Cause: only half of Q4 was checked. The upstream was slow, but the key carried search filters or a user id, so utilization is near zero and every request now pays a cache lookup **and** the upstream call. Fix: cache on the low-cardinality dimension instead — which usually means hoisting the high-cardinality part out of the key, exactly as in Q1 — or accept that this call is not cacheable.

**★ Symptom: CI is green and the route 500s in production with `next-request-in-use-cache`.** Cause: on a dynamically rendered route the forbidden read is only reached when the route actually runs, and nothing forces that path during the build. Fix: never treat a green build as proof that no cached scope reads request data. Exercise dynamic routes against a production build, and prefer hoisting reads to the component boundary where the constraint is visible in the source rather than buried in a helper.

**★ Symptom: an error at a nesting site, appearing after a refactor that moved a function.** Cause: `remote` and `private` cannot nest, in either direction — the nesting would falsify one of the two promises about where the value rests. Fix: do not nest them. Compute the shared part in a `remote` scope, call it *outside*, and pass the result in as an argument.

**★ Symptom: adding a directive at the top of a file breaks exports that were fine a moment ago.** Cause: a file-level directive covers **every** export, and all of them must be `async` — framework exports included. Fix: move synchronous helpers to another file; they were never cacheable anyway.

```ts
// BAD
'use cache'
export function formatCurrency(n: number) { return `$${n}` }   // not async

// GOOD — it belongs in a utility module with no directive
```

**★ Symptom: `connection()` inside a cached scope, and no directive makes it legal.** Cause: it is banned in all of them, `private` included, because it exposes connection-specific information that cannot be safely cached at all. Fix: take the directive off that scope. Read the ban the other way and it is a feature — calling `connection()` is how you deliberately push a component to request time when nothing else it reads would have.

**★ Symptom: `stale` was set to 10 seconds and client freshness did not improve.** Cause: the client router enforces a **minimum 30-second stale time regardless of configuration**. Fix: treat 30 seconds as the floor for client-side freshness; anything that must be fresher has to arrive in a Server Action's own response, which is [the caching tree's](03b-the-caching-tree.md) Q2, not a `cacheLife` setting.

**★ Symptom: per-link prefetching stopped working after a lifetime was tuned down.** Cause: `stale` must be at least 30 seconds for per-link prefetching to work at all. Fix: raise it to 30 seconds, or accept that this content is not prefetchable. And note the second, higher threshold nobody expects: content with `stale` of at least 30 seconds but under 5 minutes is included in prerenders yet excluded from the route's App Shell — two different numbers, two different symptoms.

**Symptom: a whole route was expected to prerender and only part of it did.** Cause: the directive is per entry point. Each route segment is cached independently, so prerendering a whole route means the directive on **every segment file it renders** — the `page`, the `layout`, and any parallel-route slots. Fix: add it to each of them, and re-check the rendering tree, because the segment that failed to prerender usually failed for a request-API reason rather than a directive one.

**Symptom: a team convention appears that says "use `remote` for anything slow".** Cause: reading the three directives as fast, faster and fastest rather than as three storage locations with different visibility. Fix: replace the convention with the two questions. `remote` on a key with per-request-unique values is strictly worse than no cache, and the convention guarantees it will be applied there first, because that is where the slow calls are.

## Interview questions

**★ You hit `next-request-in-use-cache`. What is your first move, and why is it not choosing a different directive?**
Hoist the read out of the cached scope and pass the value in as an argument. The error is telling me the request enters the call graph deeper than it should, and moving that entry point outward fixes the error *and* usually improves the cache key — the recommendations example goes from a key of (product, session), which is unique per user, to a key of (language), which has a handful of values. Switching to `private` also removes the error, but it removes it by giving up server caching and prerendering for that scope, which is a permanent cost paid to silence a message.

**★ Why is `use cache: private` not the safe default?**
Because it stores nothing on the server. The scope runs on every server render, it is excluded from static shell generation, and it carries two thresholds — `stale` below 30 seconds kills per-link prefetching, and below 5 minutes excludes the content from the App Shell — that degrade navigation with no obvious cause. It is a targeted escape hatch for data that may not rest on a server, or a call graph that cannot be refactored, and using it for anything else trades a build-time error for a permanent runtime cost.

**★ What exactly justifies `use cache: remote`, and what is the mistake people make?**
A conjunction: the upstream is rate-limited, slow, expensive or flaky **and** the cache key has few distinct values. The mistake is checking only the first half. A remote cache keyed on search filters or user ids has utilization near zero, and you still pay a network lookup on every miss — so you have added latency and infrastructure to get a cache that never hits. It is strictly worse than not caching.

**★ Why can this tree's third question not be answered inside chapter 5?**
Because "is this content in the static shell?" is a rendering fact, and the rendering fact is usually decided somewhere else entirely — a `cookies()` read in a shared layout defers everything beneath it to request time, which changes the right directive for a function that was never touched. That is the cross-chapter constraint: the directive decision has an input that lives in another chapter and often in another directory, and a tree that does not say so will be answered confidently and wrongly.

**★ Where does the request-API restriction apply — only in the function carrying the directive?**
Along the whole call stack. A helper called by the cached function that reads `cookies()` fails identically, which is why the restriction cannot be checked by reading the cached function alone. It is also why hoisting is stated as the general move: it makes the point where the request enters visible at a component boundary rather than buried three calls down.

**★ A cached function takes one string parameter. How many entries can it have?**
As many as the product of that parameter's distinct values and every outer-scope variable the body reads, because closure-captured variables are automatically bound as arguments and join the key. The signature is not the key. The fix is to move genuinely shared functions to module scope so there is nothing to capture, and then the key is exactly the parameter list.

**★ A build hangs. A route 500s with a request-API error. Are these the same bug?**
No, and the difference is diagnostic. A direct `cookies()`, `headers()` or `searchParams` read inside a cached scope fails immediately. A hang followed by a failure after about fifty seconds is the prerender fill timing out because the scope is awaiting a Promise created outside the boundary — something request-shaped crossed as a Promise instead of as a value. The immediate failure is fixed by hoisting the read; the hang is fixed by awaiting outside and passing the resolved value.

**★ Can `use cache: remote` and `use cache: private` be composed?**
Not by nesting, in either direction. They make contradictory promises — `private` says the value never rests on a server, `remote` says it does — so nesting would falsify one of them. They compose on the same page, which is the normal case, by being called as siblings: compute the shared part in a `remote` scope, call it outside, and pass the result into the private scope as an argument.

**Is any branch of this tree a one-way door?**
No, and that is worth stating plainly, because it is the tree people hesitate over most. A directive is a line; the hoist is a one-component refactor; dropping `remote` is deleting a handler configuration. The thing that is hard to reverse is not a decision but a habit: once `private` becomes the team's reflex for a class of error, it spreads through code review rather than through architecture, and the resulting navigation regressions have no single commit to revert.

---

← [03b · The caching tree](03b-the-caching-tree.md) · Next → [03d · The state placement tree](03d-the-state-placement-tree.md)
