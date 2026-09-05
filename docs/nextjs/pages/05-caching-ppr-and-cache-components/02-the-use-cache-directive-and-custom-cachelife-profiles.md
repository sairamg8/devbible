---
title: "A custom `cacheLife` profile is three numbers in `next.config.ts`, and choosing them badly silently removes your content from the static shell rather than erroring"
sidebar_label: "02 · Custom cacheLife profiles"
sidebar_position: 5
description: "Defining named cache profiles in next.config.ts, redefining the built-ins including default and max, the generated type signature, inline and data-driven profiles, and the three prerendering thresholds that decide whether a profile's output reaches the shell at all."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against the [`cacheLife` config option](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheLife) (docs `lastUpdated` 2026-08-25), the [`cacheLife` function](https://nextjs.org/docs/app/api-reference/functions/cacheLife) (`lastUpdated` 2026-08-25), [Caching](https://nextjs.org/docs/app/getting-started/caching) (`lastUpdated` 2026-08-25) and [Migrating to Cache Components](https://nextjs.org/docs/app/guides/migrating-to-cache-components) (`lastUpdated` 2026-08-25).
> Target: **Next.js 16.3.4**, App Router, Cache Components. Documentation-verified; **no sandbox run**.
> Validated: 2026-09-05 · claims + version spine re-checked against the Next.js 16.3.4 docs · session d2e9b9fe

**The `use cache` directive itself — what it caches, how the key is built, the three variants and how they compose — is taught in depth across the nine chunks of [10 · The three cache directives](10-the-three-cache-directives/README.md), and this page does not repeat any of it. What that topic does not cover, because it is a different upstream document, is the other half of the pairing: the `cacheLife` **configuration** key, where you name your own profiles. Upstream these are genuinely two pages — [`functions/cacheLife`](https://nextjs.org/docs/app/api-reference/functions/cacheLife) is the call you make in a component, [`config/next-config-js/cacheLife`](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheLife) is where a profile comes from. The reason this matters more than a naming convention is that a profile is three numbers, and two of the three are load-bearing in a way the config page never mentions: pick them wrong and your cached content is quietly excluded from the static shell, or from the App Shell, with no error and no warning. You get a slower page and a passing build.**

## What a profile is

Three optional numbers, in seconds, under a name you choose:

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
  cacheLife: {
    blog: {
      stale: 3600,     // 1 hour
      revalidate: 900, // 15 minutes
      expire: 86400,   // 1 day
    },
  },
}

export default nextConfig
```

```tsx
// app/lib/posts.ts — the name is now callable
import { cacheLife } from 'next/cache'

export async function getPost(slug: string) {
  'use cache'
  cacheLife('blog')
  return db.posts.findBySlug(slug)
}
```

The reference table, verbatim, is worth reading for what each number governs rather than how long it is:

| Property | Description | Requirement |
|---|---|---|
| `stale` | *"Duration the client should cache a value without checking the server."* | Optional |
| `revalidate` | *"Frequency at which the cache should refresh on the server; stale values may be served while revalidating."* | Optional |
| `expire` | *"Maximum duration for which a value can remain stale before switching to dynamic."* | Optional — *"Must be longer than `revalidate`"* |

**They govern three different copies of the value, not three aspects of one cache.** `stale` is the browser's copy. `revalidate` and `expire` are the server's. That separation is set out in [01b](01b-what-the-model-costs-persistence-storage-and-the-runtime-floor.md), and it is why a profile with a generous `revalidate` and a tiny `stale` produces a server that barely works and a client that hammers it anyway.

⚠️ **Omitted properties are not zero — they inherit from `default`.** A profile that sets only `revalidate` silently takes `default`'s `stale` of 5 minutes and `default`'s `expire` of never. That is usually fine and occasionally the entire bug.

## 🔴 The three thresholds nobody puts in the config docs

This is the reason to read this page. The `cacheLife` **function** reference documents three cut-offs that decide whether a cached value is eligible for prerendering at all. The **config** page, where you actually choose the numbers, does not mention them. So the natural workflow — open the config docs, invent a profile, ship it — walks straight into them.

> *"`revalidate` of `0`, or `expire` under 5 minutes: excluded from prerenders, becoming a 'dynamic hole' resolved at request time."*

> *"`stale` under 30 seconds: excluded from prerenders, because a prefetch would expire before the user could click."*

> *"`stale` of at least 30 seconds but under 5 minutes: included in prerenders, but excluded from the route's App Shell."*

Read as a decision table, with the consequence in the right-hand column:

| Your numbers | What happens to the content |
|---|---|
| `revalidate: 0` | never prerendered — a dynamic hole at request time |
| `expire` < 5 minutes | never prerendered — a dynamic hole at request time |
| `stale` < 30 seconds | never prerendered — a prefetch would expire before the click |
| 30s ≤ `stale` < 5 minutes | prerendered, but **kept out of the App Shell** |
| `stale` ≥ 5 minutes, `expire` ≥ 5 minutes | prerendered **and** eligible for the App Shell |

**None of these is an error, with one documented exception.** In the ordinary case the build passes, the page works, and the only symptom is that content you believed was static is being rendered per request — which you will notice as a latency regression weeks later, if at all. The exception is nesting: if a short-lived cache is used from another `use cache` scope that calls no `cacheLife` of its own, the short lifetime would propagate outwards silently, so the framework refuses instead —

> *"When a short-lived cache is nested inside another `use cache` without an explicit `cacheLife`, the outer cache's lifetime would silently become short too via propagation. To prevent this accidental misconfiguration, Next.js throws an error during prerendering."*

That error is the reason the docs recommend pairing every `use cache` with an explicit `cacheLife`: an explicit outer lifetime is what makes the nesting legal, in either direction. Set a longer one to keep the outer scope prerendered, or set a short one deliberately and wrap the subtree in `<Suspense>`. A **flat** short profile, the case this section is about, gets no such error.

The framework's own presets are almost all safely above the lines, and the documentation says exactly which one is not:

> *"Of the presets, only `seconds` falls under any of these thresholds: its `expire` of 1 minute excludes it from prerenders."*

That is a useful calibration. `cacheLife('seconds')` is not "a fast cache" — it is an opt-out of prerendering wearing a cache's name. If you reach for it because the data feels fresh-ish, you have converted a static route into a dynamic one on purpose without meaning to.

Here is the trap in the form it actually reaches production:

```ts
// ❌ Looks reasonable. Refreshes every 2 minutes, expires after 4.
// Both `expire` and `stale` are under 5 minutes, so this content is
// excluded from prerenders AND from the App Shell. The route got slower.
cacheLife: {
  dashboard: { stale: 120, revalidate: 120, expire: 240 },
}
```

```ts
// ✅ The same freshness intent, above the thresholds.
// revalidate still refreshes every 2 minutes — that was the actual requirement.
// stale and expire are what decide prerenderability, and they now clear the bar.
cacheLife: {
  dashboard: { stale: 300, revalidate: 120, expire: 3600 },
}
```

The important observation is that **`revalidate` was not the problem here.** Any non-zero server-side refresh frequency is ungated — only `revalidate: 0` is itself a threshold — and it is `stale` and `expire` that decide the rest. People tune `revalidate` because it is the number that sounds like freshness, and leave the two that actually decide the rendering strategy at whatever they first typed.

## Redefining the built-ins

A custom name is not the only option — you may redefine any built-in profile by declaring one with the same name:

> *"You can also override a built-in profile by defining one with the same name (`default`, `seconds`, `minutes`, `hours`, `days`, `weeks`, or `max`)."*

Including `default`, which is the one worth thinking hard about, because `default` is what every un-annotated `use cache` silently gets:

```ts
// next.config.ts — every bare `use cache` in the codebase now means this
const nextConfig: NextConfig = {
  cacheComponents: true,
  cacheLife: {
    default: { stale: 900, revalidate: 3600, expire: 86400 },
  },
}
```

The built-in values this replaces are worth knowing before you overwrite them:

| Profile | `stale` | `revalidate` | `expire` |
|---|---|---|---|
| `default` | 5 minutes | 15 minutes | never |
| `seconds` | 30 seconds | 1 second | 1 minute |
| `minutes` | 5 minutes | 1 minute | 1 hour |
| `hours` | 5 minutes | 1 hour | 1 day |
| `days` | 5 minutes | 1 day | 1 week |
| `weeks` | 5 minutes | 1 week | 30 days |
| `max` | 5 minutes | 30 days | 1 year |

🔴 **Redefining `default` is a whole-codebase change with no diff at the call sites.** Every `use cache` that does not call `cacheLife` — and the framework's own recommendation is to always pair them, precisely because forgetting is easy — takes the new numbers. If your new `default` drops `stale` below 30 seconds, you have just excluded every un-annotated cached value in the application from prerendering, in one line, with a passing build. Redefine `default` when the built-in genuinely does not fit your domain, and check it against the threshold table first.

⚠️ **One more thing writes to `default`'s `stale` from a different config key.** `staleTimes.static` also updates it — *"Updating `staleTimes.static` also updates the `stale` value of the `default` cache profile."* Two keys in `next.config.ts` therefore write the same number. **The documentation does not state which one wins when both are set**, and I could not settle it from the reference; treat the combination as unspecified and set only one. If `default`'s client-side staleness is not the value you configured, check both keys before concluding the profile is being ignored.

## The types are generated, not hand-written

`cacheLife('blog')` type-checks because the profile name was compiled into a generated type — the signature is regenerated by `next dev`, `next build` or `next typegen`.

The practical consequence is a confusing failure mode on a fresh checkout: a colleague adds a profile, you pull, and your editor reports that `'blog'` is not assignable — because your local type has not been regenerated. Nothing is wrong with the config.

```bash
npx next typegen
```

That is the whole fix, and it is worth putting in the repository's post-install or setup script rather than explaining it repeatedly.

## Inline profiles, and profiles chosen at runtime

A profile does not have to be named in config. `cacheLife` accepts an object directly, which is how you express a lifetime that comes from the data itself:

```tsx
// The CMS decides how volatile each post is. The profile follows the data.
import { cacheLife } from 'next/cache'

export async function getPost(slug: string) {
  'use cache'
  const post = await db.posts.findBySlug(slug)
  cacheLife({ revalidate: post.revalidateSeconds ?? 3600 })
  return post
}
```

⚠️ Inline profiles inherit the omitted properties from `default` exactly as named ones do — so the object above has `default`'s `stale` and `expire`, not zero and not infinity. If `default` has been redefined, this call's behaviour changed with it.

Branching between named profiles is also documented, and it is the right shape for content whose volatility depends on its state:

```tsx
// A draft changes constantly; a published post almost never does.
import { cacheLife } from 'next/cache'

export async function getArticle(slug: string) {
  'use cache'
  const article = await db.articles.findBySlug(slug)

  if (!article || article.status === 'draft') {
    cacheLife('minutes')
  } else {
    cacheLife('days')
  }

  return article
}
```

Two rules constrain this and both are easy to violate by accident:

- **`cacheLife` cannot be called at module scope.** It throws. It is a call made during the cached invocation, not a declaration attached to a file.
- **Only one call may execute per invocation** — though, as above, it may sit in several branches, because only one branch runs.

```ts
// ❌ Throws. This is not a declaration site.
import { cacheLife } from 'next/cache'
cacheLife('blog')

export async function getPost(slug: string) {
  'use cache'
  return db.posts.findBySlug(slug)
}
```

## The client half of `stale`

`stale` does not do what its neighbours do, and the difference catches people who assume these numbers all end up in an HTTP header:

> *"The `stale` property controls the Client Cache, not the `Cache-Control` header"*

It travels to the browser as `x-nextjs-stale-time`. And it has a floor you cannot configure away:

> *"**Minimum of 30 seconds is enforced** to ensure prefetched links remain usable."*
> *"This 30-second minimum prevents prefetched data from expiring before users can click on links. It only applies to time-based expiration."*

So a profile with `stale: 5` does not give you a five-second client cache. It gives you thirty seconds, plus exclusion from prerendering for having asked for less. Both halves of that are worth saying out loud, because the number you wrote appears nowhere in the resulting behaviour.

The escape from the floor is not a smaller number — it is invalidation. Calling `revalidateTag`, `revalidatePath`, `updateTag` or `refresh` from a Server Action clears the client cache immediately, bypassing stale time entirely. That is the mechanism for "the user must see their own write", and it is covered at [10 · 05b](10-the-three-cache-directives/05b-revalidatetag-and-updatetag.md).

## Gotchas

**★ Symptom: you define a profile with short lifetimes for a "fresh" dashboard and the route gets measurably slower.** Cause: `expire` under 5 minutes or `stale` under 30 seconds excludes the content from prerenders entirely — it becomes a dynamic hole resolved at request time. Nothing errors. Fix: raise `stale` and `expire` above the thresholds and express the freshness requirement in `revalidate`, which is not gated.

```ts
// ❌ excluded from prerenders and the App Shell
cacheLife: { dashboard: { stale: 120, revalidate: 120, expire: 240 } }
// ✅ same refresh cadence, prerendered and shell-eligible
cacheLife: { dashboard: { stale: 300, revalidate: 120, expire: 3600 } }
```

**★ Symptom: `cacheLife('seconds')` makes a page dynamic.** Cause: it is the one built-in preset that falls under a threshold — its `expire` of 1 minute is under 5 minutes, so it is excluded from prerenders. Fix: this is what `seconds` is *for*. If you wanted a prerendered page that refreshes often, use `minutes` (which clears every threshold) and set `revalidate` down; if you genuinely want per-request data, drop the cache and use `<Suspense>` instead of a very short profile.

**★ Symptom: you redefine `default` and unrelated pages across the app change behaviour.** Cause: `default` is what every `use cache` without a `cacheLife` call receives, so redefining it edits every un-annotated cache site at once with no diff at any of them. Fix: check the new numbers against the threshold table before shipping, and pair every `use cache` with an explicit `cacheLife` so `default` stops being load-bearing:

```tsx
export async function getTeams() {
  'use cache'
  cacheLife('days')   // explicit — immune to a later `default` change
  return db.teams.findAll()
}
```

**★ Symptom: a profile name that exists in `next.config.ts` fails to type-check on your machine only.** Cause: the `cacheLife` signature is generated, and your local generated type predates your colleague's config change. Fix: `npx next typegen` — or run `next dev`/`next build`, both of which regenerate it. Nothing is wrong with the configuration.

**★ Symptom: `stale: 5` behaves like 30 seconds.** Cause: a 30-second client minimum is enforced regardless of configuration, so that prefetched links stay usable. Fix: accept the floor. If you need the client to see a change sooner than that, invalidate rather than expire — a Server Action calling `updateTag` or `refresh` clears the client cache immediately and ignores stale time.

**★ Symptom: you set only `revalidate` in a custom profile and the client caches far longer than you intended.** Cause: omitted properties inherit from `default`, so you also took `default`'s `stale` of 5 minutes and its `expire` of never. Fix: write all three numbers whenever the profile is doing anything unusual — the shorthand is only safe when you have checked what you are inheriting.

**★ Symptom: `cacheLife` throws at import time.** Cause: it was called at module scope. It is a runtime call inside a cached invocation, not a file-level declaration. Fix: move it inside the function body, directly under the `'use cache'` directive.

**★ Symptom: two `cacheLife` calls in one function and the behaviour is not what either specifies.** Cause: only one call may execute per invocation. Branches are fine because only one branch runs; two sequential calls are not. Fix: make it a branch, or compute the profile object and make a single call.

**★ Symptom: `default`'s client staleness is not the value you configured.** Cause: `staleTimes.static` also writes `default`'s `stale`, so two different keys in `next.config.ts` set the same number. Fix: search the config for both before concluding the profile is being ignored.

## Interview questions

**★ A custom `cacheLife` profile has three numbers. Which of them decide whether the content can be prerendered?**
`stale` and `expire` — not `revalidate`, which is the one people tune. The documented cut-offs are that a `revalidate` of exactly `0` or an `expire` under five minutes excludes the value from prerenders entirely, making it a dynamic hole resolved at request time; a `stale` under thirty seconds also excludes it, on the reasoning that a prefetch would expire before the user could click; and a `stale` between thirty seconds and five minutes is prerendered but kept out of the route's App Shell. So a profile can express exactly the server-side refresh cadence you wanted and still cost you the static shell, because the two numbers that gate prerendering are the two nobody thinks of as rendering settings.

**★ Why is `cacheLife('seconds')` not simply "a faster cache"?**
Because its `expire` is one minute, which is under the five-minute threshold, so it is the only built-in preset excluded from prerenders. Choosing it converts the content into a dynamic hole. That is a legitimate thing to want — genuinely real-time data should not be in a static shell — but it means `seconds` is better understood as an opt-out of prerendering than as a short-lived cache. If the intent is a prerendered page that refreshes frequently, `minutes` clears every threshold and its `revalidate` can be lowered.

**★ What are the risks of redefining the `default` profile?**
That it is an application-wide behaviour change with no diff at any call site. `default` is what every `use cache` that does not call `cacheLife` receives, and the framework recommends always pairing them precisely because omitting the call is easy. So redefining `default` silently retimes every un-annotated cache in the codebase. If the new numbers fall under a prerendering threshold — a `stale` below thirty seconds, say — every one of those sites drops out of the static shell at once, and the build passes. The defensive position is to pair every `use cache` with an explicit `cacheLife`, which makes `default` stop mattering.

**★ Why does a colleague's new profile name fail to type-check on your machine?**
Because the `cacheLife` signature is generated rather than hand-written, and it is regenerated by `next dev`, `next build` or `next typegen`. Pulling a config change does not regenerate it, so the local type still lists the old profile names. It is not a configuration error and not a version mismatch; running any of those three commands fixes it. It is worth wiring `next typegen` into the repository's setup script, because the failure looks like a real type error and sends people to read the config.

**Why do `stale`, `revalidate` and `expire` not behave like three settings on one cache?**
Because they govern different physical copies of the value. A cached function's output is serialized once into an RSC payload, and that payload is copied to prerendered HTML, to a server-side store, and to the browser. `revalidate` and `expire` control the server copies — when a background refresh is triggered and how long a stale value may be served. `stale` controls only the browser's copy, and it is not a `Cache-Control` header; it travels as `x-nextjs-stale-time`. This is why revalidating on the server does not make a user's browser show the new value, and why a mismatched pair — a long `revalidate` with a tiny `stale` — produces a server that rarely refreshes being asked for the value constantly by clients that refuse to hold it.

**What is the 30-second client minimum and why can't you go below it?**
The client router enforces a minimum thirty-second stale time regardless of what you configure, so that prefetched links remain usable — without it, data prefetched when a link entered the viewport could expire before the user managed to click, making the prefetch worthless. It applies only to time-based expiration. The consequence for profile design is that writing `stale: 5` gets you two things you did not ask for: thirty seconds of client caching anyway, and exclusion from prerendering for having requested less than thirty. If you need the client to reflect a change sooner, the mechanism is invalidation rather than expiry — `updateTag` or `refresh` from a Server Action clears the client cache immediately and bypasses stale time entirely.

**When would you use an inline `cacheLife` object rather than a named profile?**
When the lifetime is a property of the data rather than of the code path — a CMS where each document carries its own volatility, for instance, makes `cacheLife({ revalidate: post.revalidateSeconds ?? 3600 })` the honest expression. Named profiles are better whenever the lifetime encodes a team convention, because a name is reviewable and greppable and an object literal buried in a data-access function is neither. The caveat that applies to both is that omitted properties inherit from `default`, so an inline object specifying only `revalidate` is quietly taking `default`'s `stale` and `expire` — and will change behaviour if someone later redefines `default`.

**Why can't `cacheLife` be called at module scope, and why only once per invocation?**
Because it is not a declaration, it is a call that participates in the cached invocation — it tells the runtime what lifetime *this* execution's result should have. At module scope there is no invocation to describe, so it throws. The once-per-invocation rule follows from the same thing: a single execution produces a single cache entry, which can have exactly one lifetime. Branching is explicitly allowed because only one branch executes, which is what makes the draft-versus-published pattern legal: two `cacheLife` calls in the source, one on any given run.

---

← [01d · What changes once the flag is on](01d-what-changes-once-the-flag-is-on.md) · [Chapter index](01-explanation.md) · Next → [10 · The three cache directives](10-the-three-cache-directives/README.md)
