---
title: "`use cache` is primarily a prerender tool, and its runtime cache depends on where you host"
sidebar_label: "2 · `use cache` at runtime"
sidebar_position: 4
description: "The in-memory LRU, why serverless and self-hosted behave differently, the client-side 30-second floor, and the isolation rules that make cached scopes self-contained."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against the Next.js API reference for
> [`use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache).
> Target: **Next.js 16.3.4**, App Router, Cache Components.

**`use cache` is designed first to get uncached data into the static shell, and only second to
cache at runtime — and the second job works very differently depending on where you deploy.**
On a self-hosted Node server the in-memory LRU persists across requests and behaves the way
most people picture a cache. On serverless it frequently does not, because each request can
land on a different instance whose memory is discarded afterwards. The directive is identical
in both cases; the hit rate is not. Reading `use cache` as "a cache" without asking where the
memory lives is how teams end up surprised that their upstream still sees full traffic.

## Where the entry actually lives

Outputs are stored by a **cache handler**, in memory by default, and last until they
revalidate. On the server, entries respect the `revalidate` and `expire` times from the
`cacheLife` profile. You can replace the storage by configuring `cacheHandlers` in
`next.config.js`.

| Environment | Runtime caching behaviour |
|---|---|
| **Serverless** | Entries typically **do not persist across requests** — each request can be a different instance — or during revalidation. Build-time caching works normally. |
| **Self-hosted** | Entries **persist across requests**. Bound the size with `cacheMaxMemorySize`. |

The practical illustration: in serverless, a cached function shared by two pages executes on
each static-shell revalidation. On a self-hosted server, the cached output is reused while it
is still fresh.

This is precisely the gap **`use cache: remote`** exists to close — see
**[chunk 3](03-use-cache-remote.md)**.

> Even where the server-side hit rate is poor, `use cache` still earns its place: it tells
> Next.js **what can be prefetched** and **defines stale times for client-side navigation**.
> Those benefits do not depend on a server-side hit at all.

## The client half, and its 30-second floor

Content from the server cache is also held **in the browser's memory** for the duration of the
`stale` time. The `x-nextjs-stale-time` response header carries the lifetime from server to
client so both halves agree.

🔴 **The client router enforces a minimum 30-second stale time, regardless of configuration.**
Setting `stale` below 30 seconds does not produce sub-30-second client freshness — the floor
wins. If a value must be fresher than that on the client, caching is the wrong mechanism;
fetch it at request time.

## Prerendering is the primary job

With Cache Components, prerendering **fills the entry and keeps rendering**, so the output
contributes to the route's static shell and can contribute to its prefetch.

The consequence worth internalising: **a cache life too short to store safely leaves a hole in
the shell that resolves at request time instead.** The directive is still doing something —
it is deciding what is prerenderable — even when no server-side hit ever occurs.

## Cached scopes are isolated on purpose

### `React.cache` does not cross the boundary

`React.cache` operates in an **isolated scope** inside `use cache` boundaries. Values stored
via `React.cache` outside a cached function are **not visible inside it**.

```tsx
import { cache } from 'react'

const store = cache(() => ({ current: null as string | null }))

function Parent() {
  const shared = store()
  shared.current = 'value from parent'
  return <Child />
}

async function Child() {
  'use cache'
  const shared = store()
  // shared.current is null — NOT 'value from parent'
  return <div>{shared.current}</div>
}
```

This is not a bug to route around. It is what makes a cached function's behaviour predictable
and self-contained: its output depends only on its inputs. **To get data into a cached scope,
use function arguments.**

### Draft Mode disables caching wholesale

When Draft Mode is enabled, **all cached functions and components re-execute on every request
and results are not saved to the cache.** Draft content is always fresh with no changes to
your caching code.

One API is carved out: you may read `isEnabled` from `draftMode()` inside a cached scope —
but `cookies()` and `headers()` remain forbidden **even when Draft Mode is active**.

```tsx filename="app/components/content.tsx"
import { draftMode } from 'next/headers'

async function Content() {
  'use cache'
  const { isEnabled } = await draftMode()
  const url = isEnabled
    ? 'https://draft.example.com/content'
    : 'https://production.example.com/content'
  const data = await fetch(url)
  return <article>{/* ... */}</article>
}
```

Calling `enable()` or `disable()` inside a caching directive scope **throws**. Draft Mode is
toggled only in Route Handlers or Server Actions.

## Debugging what the cache is doing

```bash
NEXT_PRIVATE_DEBUG_CACHE=1 npm run dev
# or against a production build
NEXT_PRIVATE_DEBUG_CACHE=1 npm run start
```

This also logs ISR and other caching mechanisms, so expect more than `use cache` output. In
development, console logs from inside cached functions appear with a `Cache` prefix, which is
how you tell a replayed log from a fresh execution.

## Gotchas

### Expecting serverless to behave like your laptop

**Symptom.** Cache hit rate looks fine locally and the upstream still sees near-full traffic
in production.

**Cause.** Locally you are self-hosted: one process, memory persists. In serverless each
request can be a different instance and memory is typically destroyed after serving.

**Fix.** Do not tune runtime cache behaviour against a local dev server. If the entry must be
shared across instances, that is what `use cache: remote` is for. If it belongs in the static
shell, make sure it is prerenderable rather than deferred.

### Setting `stale` below 30 seconds and expecting it to apply

**Symptom.** A `cacheLife` with a short `stale` does not produce the client-side freshness you
configured.

**Cause.** The client router enforces a **minimum 30-second stale time regardless of
configuration**.

**Fix.** Treat 30 seconds as the floor for client-side freshness. Anything that must be
fresher should not be served from cache at all.

### Trying to pass data into a cached scope through `React.cache`

**Symptom.** A value set in a parent reads back as `null` or `undefined` inside the cached
child, with no error.

**Cause.** `React.cache` is isolated inside `use cache` boundaries. The silence is the
problem — nothing throws, you simply get the uninitialised value.

**Fix.** Pass it as an argument.

```tsx
// BAD — relies on ambient React.cache state
async function Child() {
  'use cache'
  const shared = store()
  return <div>{shared.current}</div>   // null
}

// GOOD — explicit input, so the key reflects it
async function Child({ value }: { value: string }) {
  'use cache'
  return <div>{value}</div>
}
```

### Assuming Draft Mode still serves cached content

**Symptom.** Performance drops sharply for editors previewing content, and cache metrics go
flat for those sessions.

**Cause.** Draft Mode makes every cached function re-execute on every request and stores
nothing. This is intended.

**Fix.** Nothing to fix — but size preview traffic accordingly, and never benchmark cache
behaviour from a session that has Draft Mode enabled.

### Calling `draftMode().enable()` inside a cached scope

**Symptom.** A throw at the call site.

**Cause.** Only `isEnabled` is readable inside a caching directive; toggling is prohibited.

**Fix.** Toggle Draft Mode in a Route Handler or a Server Action, and read `isEnabled` where
you need to branch.

### Reading `cookies()` inside a cached scope because Draft Mode is on

**Symptom.** `next-request-in-use-cache` in a code path that only runs for editors.

**Cause.** The Draft Mode carve-out covers `draftMode()` alone. `cookies()` and `headers()`
stay forbidden **even when Draft Mode is active**.

**Fix.** Hoist the read, as everywhere else.

## Interview questions

**★ What is `use cache` primarily designed to do?**
Include otherwise-uncached data in the **static shell**. Runtime caching via the in-memory LRU
is a secondary capability whose usefulness depends on the hosting environment.

**★ How does runtime cache behaviour differ between serverless and self-hosted?**
Serverless: entries typically do not persist across requests, because each request can hit a
different instance whose memory is discarded. Self-hosted: entries persist, bounded by
`cacheMaxMemorySize`.

**★ If server-side hit rate is poor in serverless, is `use cache` pointless there?**
No. It still tells Next.js what can be prefetched and defines stale times for client-side
navigation — neither depends on a server-side hit.

**★ What is the client-side stale-time floor?**
**30 seconds**, enforced by the client router regardless of configuration. The
`x-nextjs-stale-time` header communicates the lifetime from server to client.

**★ Why can't you pass data into a cached scope with `React.cache`?**
`React.cache` is isolated inside `use cache` boundaries — values set outside are not visible
inside. This keeps cached functions self-contained and predictable. Use arguments.

**★ What happens to caching under Draft Mode?**
All cached functions and components re-execute on every request and nothing is written to the
cache, so draft content is always fresh.

**★ Which request API may be read inside a cached scope, and which stay forbidden under Draft
Mode?**
`draftMode()`'s `isEnabled` may be read. `cookies()` and `headers()` remain forbidden even
when Draft Mode is active. Calling `enable()`/`disable()` inside a cached scope throws.

**★ How do you inspect what the cache is doing?**
`NEXT_PRIVATE_DEBUG_CACHE=1` for verbose logging in dev or against a production build. In
development, logs replayed from cached functions carry a `Cache` prefix.

**★ What does a too-short cache life do to the static shell?**
It leaves a hole that resolves at request time instead of being stored in the shell.

---

**Previous:** [1c · Slots and cache keys](01c-slots-and-cache-keys.md)
