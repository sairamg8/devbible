---
title: "`use cache: remote` is only as remote as `cacheHandlers` makes it, and with no handler configured it is not remote at all"
sidebar_label: "3b · Configuring `cacheHandlers`"
sidebar_position: 7
description: "The default and remote handler slots, the silent in-memory fallback when you self-host, named handlers beyond the three directives, and why private can never be redirected."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the Next.js API reference for
> [`cacheHandlers`](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheHandlers)
> (page header `version: 16.3.4`, `lastUpdated: 2026-08-25`) and
> [`use cache: remote`](https://nextjs.org/docs/app/api-reference/directives/use-cache-remote)
> (`version: 16.3.4`, `lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4**, App Router, Cache Components. Documentation-verified; **no sandbox run**.
> Validated: 2026-09-05 · claims + version spine re-checked against the Next.js 16.3.4 docs · session d2e9b9fe

**`use cache: remote` does not come with a remote cache.** It comes with a *slot* that a
remote cache can be plugged into, named `remote`, configured through `cacheHandlers`. On a
hosting platform that supplies one, the directive means what [chunk 3](03-use-cache-remote.md)
says it means. Self-hosted with nothing configured, it means something else entirely, and
nothing errors to tell you so. This chunk is the configuration surface: the two built-in
slots, the fallback that makes a missing handler invisible, and the named handlers that let
you write directives beyond the documented three. Writing the handler itself is
[chunk 3c](03c-writing-a-cache-handler.md).

## The two slots

`cacheHandlers` maps a slot name to a module path. Two names are built in:

> *"**`default`**: Used by the `'use cache'` directive"*
> *"**`remote`**: Used by the `'use cache: remote'` directive"*
> — [`cacheHandlers` › Handler types](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheHandlers)

```ts filename="next.config.ts"
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
  cacheHandlers: {
    default: require.resolve('./cache-handlers/default-handler.js'),
    remote: require.resolve('./cache-handlers/remote-handler.js'),
  },
}

export default nextConfig
```

They are independent. The intended split is the interesting one: leave `default` alone so
plain `use cache` stays fast and in-process, and point only `remote` at external storage.

> *"For example, you can configure a custom `remote` handler for external storage (like a
> key-value store), then use `'use cache'` in your code for in-memory caching and
> `'use cache: remote'` for the external storage, allowing different caching strategies
> within the same application."*

## The fallback is silent, and it is the whole gotcha

> *"If you don't configure `cacheHandlers`, Next.js uses an in-memory LRU (Least Recently
> Used) cache for both `default` and `remote`."*

Read that twice. A `use cache: remote` scope with no configured handler does not throw, does
not warn, and does not stop caching. It writes to the same per-process LRU that plain
`use cache` writes to — the one the same page describes as *"isolated to each Next.js
process"*, where *"each instance will have its own cache that isn't shared with others and is
lost on restart"*. Every property the directive was adopted for — shared across instances,
durable across restarts — is gone, while the source still reads as though it is there.

The docs are also explicit that this is not a defect to be alarmed by in the common case:

> *"**Most applications don't need custom cache handlers.** The default in-memory cache works
> well in the typical use case."*

It is a defect for exactly one shape of deployment: several instances that were supposed to
share a cache. That is precisely the shape [chunk 3](03-use-cache-remote.md) tells you to
reach for `remote` in, which is why the two chunks belong next to each other.

## Named handlers — the directive list is open

The three-directive framing in [chunk 1](01-choosing-a-directive.md) is how the documentation
presents the feature, and it is the right mental model. It is not the full grammar:

> *"You can also define additional named handlers (e.g., `sessions`, `analytics`) and
> reference them with `'use cache: <name>'`."*

So `'use cache: analytics'` is a legal directive if `cacheHandlers.analytics` resolves to a
handler module. This is how you give two workloads different storage — a hot short-lived
Redis for one, an S3-backed store for the other — without either inheriting the other's
eviction pressure. It is an advanced surface: nothing in the type system will tell a reader
what `'use cache: analytics'` means, so a project using it owes that explanation to its own
documentation.

## `use cache: private` cannot be configured, ever

> *"[`'use cache: private'`](https://nextjs.org/docs/app/api-reference/directives/use-cache-private)
> is not configurable."*

> *"Note that `'use cache: private'` does not use cache handlers and cannot be customized."*

This is not an omission waiting to be filled in a later release; it is the guarantee. A
private cache entry never reaches server storage, so there is no storage to point at a
handler. If a compliance review asks *"can this be redirected to our audited store"*, the
answer is no, and that is the point of choosing it.

## Platform support, which is not the same as `use cache: remote`'s

| Deployment | `cacheHandlers` |
|---|---|
| Node.js server | Yes |
| Docker container | Yes |
| **Static export** | **No** |
| Adapters | **Platform-specific** |

`use cache: remote` itself reports a flat **Yes** for adapters; the *configuration* of a
custom handler is platform-specific. On an adapter-based deploy, whether your handler module
is even loaded is the adapter's decision, not yours — check the adapter's own documentation
before assuming a self-written handler runs there.

`cacheHandlers` was introduced in **v16.0.0**, the same release that enabled all three
directives with Cache Components.

## Gotchas

### Self-hosting `use cache: remote` without configuring a handler

**Symptom.** Instances behave as if each had its own cache — nothing shared, everything gone
on restart — and the upstream sees the load you adopted `remote` to remove. No error, no
warning, and the code review passes because the directive is right there in the source.

**Cause.** *"If you don't configure `cacheHandlers`, Next.js uses an in-memory LRU (Least
Recently Used) cache for both `default` and `remote`."* Hosting providers typically supply the
`remote` handler; when you self-host, nobody does, and the directive quietly degrades to the
in-memory behaviour you were trying to escape.

**Fix.** Configure the `remote` slot, and leave `default` alone unless you have a reason:

```ts filename="next.config.ts"
const nextConfig = {
  cacheComponents: true,
  cacheHandlers: {
    remote: require.resolve('./cache-handlers/redis-handler.js'),
  },
}
```

### Pointing `default` at the remote store as well

**Symptom.** Build times get worse and prerendering slows down after adding Redis.

**Cause.** `default` backs plain `use cache`, which is primarily a *prerender* mechanism —
see [chunk 2](02-use-cache-at-runtime.md). Routing it through a network hop adds latency to
the one path that was already local and already fast.

**Fix.** Configure the slots separately. Only set `default` when you have a specific reason,
such as persistence across restarts on a single self-hosted instance.

### Expecting a handler to capture `use cache: private`

**Symptom.** An audit asks where private-cached values are stored and you go looking for a
handler slot to point at the audited store.

**Cause.** `'use cache: private'` does not use cache handlers and cannot be customized.

**Fix.** Nothing to fix — that *is* the compliance answer. The value never reaches server
storage. See [chunk 4](04-use-cache-private.md).

### Shipping `'use cache: <name>'` without documenting the name

**Symptom.** A reviewer cannot tell what `'use cache: analytics'` does, and a later refactor
deletes the handler entry, leaving directives referencing a slot that no longer exists.

**Cause.** Named handlers are a config-level contract with no type-level trace at the call
site. The directive string reads like a built-in but is entirely project-defined.

**Fix.** Treat every named slot as public API of your codebase: document what it stores, where,
with what durability, next to the `cacheHandlers` entry that defines it.

## Interview questions

**★ What are the two built-in `cacheHandlers` slots, and which directive uses each?**
`default` backs `'use cache'`; `remote` backs `'use cache: remote'`. They are configured
independently, which is the intended pattern: in-memory for `default`, external storage for
`remote`.

**★ What happens to `use cache: remote` if no handler is configured?**
Next.js falls back to an in-memory LRU for both slots. The directive does not error and does
not stop caching — it stops being *remote*: per-process, unshared, lost on restart. On a
multi-instance self-hosted deployment that is a silent regression to plain `use cache`, and it
is the single most likely reason a team reports that `remote` "did nothing".

**★ Can `use cache: private` be pointed at a custom store?**
No. It does not use cache handlers and cannot be customized, because its entries are never
stored on the server in the first place. That is the guarantee, not a gap.

**★ Are there only three cache directives?**
Three are documented and named. The grammar is open: define an extra named handler in
`cacheHandlers` and reference it as `'use cache: <name>'`. It is an advanced escape hatch for
giving two workloads different storage, and it is project-specific by construction.

**★ Do most applications need a custom cache handler?**
No — the documentation says so directly: the default in-memory cache works well in the typical
case. Custom handlers exist for two situations, sharing a cache across instances and changing
where the cache lives.

---

**Previous:** [3 · `use cache: remote`](03-use-cache-remote.md) · **Next:** [3c · Writing a cache handler](03c-writing-a-cache-handler.md)
