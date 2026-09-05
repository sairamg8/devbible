---
title: "The three cache directives"
sidebar_label: "Overview"
sidebar_position: 0
description: "use cache, use cache: remote and use cache: private — thirteen chunks covering the choice, composition, keys, runtime behaviour, cache handlers, lifetimes, tag invalidation and the prerender timeout."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against the Next.js API reference for
> [`use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache),
> [`use cache: remote`](https://nextjs.org/docs/app/api-reference/directives/use-cache-remote),
> [`use cache: private`](https://nextjs.org/docs/app/api-reference/directives/use-cache-private)
> and [`cacheLife`](https://nextjs.org/docs/app/api-reference/functions/cacheLife).
> Target: **Next.js 16.3.4**, App Router, Cache Components.
> Also verified 2026-09-05 against
> [`cacheHandlers`](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheHandlers),
> [`cacheTag`](https://nextjs.org/docs/app/api-reference/functions/cacheTag),
> [`revalidateTag`](https://nextjs.org/docs/app/api-reference/functions/revalidateTag) and
> [`updateTag`](https://nextjs.org/docs/app/api-reference/functions/updateTag) (all `version: 16.3.4`, `lastUpdated: 2026-08-25`).
> Validated: 2026-09-05 · claims + version spine re-checked against the Next.js 16.3.4 docs · session d2e9b9fe

**Cache Components ship three directives, and the rest of this chapter only covers one of
them.** `use cache` was in the original syllabus; `use cache: remote` and
`use cache: private` were not, and they are where the decisions that matter live — whether a
value may rest on a shared server, whether it may rest on *your* server at all, and what that
costs. All three are enabled by `cacheComponents: true` and share the `cacheLife`/`cacheTag`
vocabulary, which makes them look like three settings of one feature. They are three different
storage locations with three different visibility guarantees.

## The chunks

| # | Chunk | What it settles |
|---|---|---|
| 1 | [Choosing a directive](01-choosing-a-directive.md) | The two questions and the decision tree; the comparison table; why `connection()` is banned in all three |
| 1b | [Composing the three](01b-composing-the-three.md) | The mixed strategy on one page; the nesting rules making `remote` and `private` mutually exclusive both ways |
| 1c | [Slots and pass-through](01c-slots-and-cache-keys.md) | Pass-through `children` and Server Actions; the two different serialization systems |
| 1d | [Cache keys and cardinality](01d-cache-keys-and-cardinality.md) | The four parts of a key; closure capture enlarging it; the shared-cache leak that passes single-user testing |
| 2 | [`use cache` at runtime](02-use-cache-at-runtime.md) | Serverless vs self-hosted; the 30-second client floor; `React.cache` isolation; Draft Mode |
| 3 | [`use cache: remote`](03-use-cache-remote.md) | When a shared durable cache earns its cost, and the four cases where it is worse than nothing |
| 3b | [Configuring `cacheHandlers`](03b-configuring-cache-handlers.md) | The `default` and `remote` slots; the silent in-memory fallback; `'use cache: <name>'` |
| 3c | [Writing a cache handler](03c-writing-a-cache-handler.md) | The five methods; why `set` takes a promise; `getExpiration`'s three return values; `CacheEntry` |
| 3d | [Cache handler failure modes](03d-cache-handler-failure-modes.md) | Soft tags and `revalidatePath`; why a throwing `get` is a 500 and a throwing `set` is not |
| 4 | [`use cache: private`](04-use-cache-private.md) | The compliance escape hatch, and the two `cacheLife` thresholds that gate prefetching and the App Shell |
| 5 | [Revalidation and lifetimes](05-revalidation-and-lifetimes.md) | Time-based vs on-demand; the `default` profile's real numbers; the two-branch nesting rule; the prerender thresholds |
| 5b | [`revalidateTag` vs `updateTag`](05b-revalidatetag-and-updatetag.md) | The two-argument signature and its deprecated single-arg form; the tag limits; why `updateTag` is Server-Action-only |
| 5c | [Build hangs and the prerender timeout](05c-build-hangs-and-the-prerender-timeout.md) | The 50-second cache-fill timeout, its three causes, and how to tell it from `next-request-in-use-cache` |

## The one-paragraph version

Read the value's **placement**, not its speed. If the scope must read `cookies()`, `headers()`
or `searchParams`, the first move is always to hoist that read out and pass a value in — not to
change directive. If it genuinely cannot be hoisted, or compliance forbids the data resting on
a server, use `use cache: private` and accept that the scope now runs on every server render.
Otherwise the value may be shared, and the remaining question is economic: plain `use cache`
when the content is prerenderable, `use cache: remote` when it is deferred to request time and
the upstream is rate-limited, slow, expensive or flaky **and** the cache key has few distinct
values. That last conjunction is the one people skip, and it is what separates a remote cache
that protects a backend from one that is a network round trip attached to a permanent miss.

## The seven facts most likely to catch you

1. **`connection()` is banned in every cache scope** — including `private`, which relaxes the
   other three restrictions.
2. **`private` is not the fix for `next-request-in-use-cache`.** It silences the error by
   forfeiting server caching and prerendering entirely.
3. **The client router enforces a 30-second minimum stale time** regardless of configuration.
4. **Closure capture joins the cache key.** A function with one parameter can have thousands
   of entries.
5. **A hang and an immediate failure are different bugs.** Direct `cookies()` inside
   `use cache` fails at once; an *indirect* runtime Promise times out after 50 seconds.
6. **`revalidateTag(tag)` is deprecated.** It takes a second `profile` argument now, and
   inside a Server Action `updateTag(tag)` is usually what you actually want.
7. **`use cache: remote` with no configured handler is not remote.** It falls back to the same
   in-memory LRU as plain `use cache` — silently, with no error and no warning.
