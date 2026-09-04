---
sidebar_position: 49
title: "Prefetch inlining bundles small segment responses into one request and is already on in your app, so the only decisions left are whether to tune its two byte thresholds or turn it off to debug"
sidebar_label: "13 · Prefetch inlining"
description: "Why Next.js 16 traded transfer size for request count, what experimental.prefetchInlining bundles and what it deliberately leaves separate, the maxSize and maxBundleSize defaults, and why the behaviour is permanent while the config is experimental."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-03 against [`prefetchInlining`](https://nextjs.org/docs/app/api-reference/config/next-config-js/prefetchInlining), the [version 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16) and the [Next.js 16.3 release blog](https://nextjs.org/blog/next-16-3).
> Target: **Next.js 16.3.4** · `experimental.prefetchInlining` added in 16.2.0, enabled by default in 16.3.0.

**Next.js 16 rebuilt prefetching around layout deduplication and incremental prefetching, which cut total transfer sharply and — as the upgrade guide warns — raised the number of individual requests. Prefetch inlining is the correction: below a size threshold, segment responses are bundled into a single response instead of being fetched one by one, while larger shared segments stay separate so they remain reusable across routes. It is on by default and most apps should never touch it. What you need to know is the trade it is making on your behalf, the two thresholds, and the fact that the *behaviour* is permanent while the *configuration option* is experimental and may change shape.**

## Why it exists

The 16.0 upgrade guide sets up the problem:

Two mechanisms were already in play. **Layout deduplication**: prefetching several URLs that
share a layout downloads that layout once. **Incremental prefetching**: only the parts not
already in cache are fetched, rather than whole pages. Both trade request *count* for transfer
*size* — the documented expectation is more individual prefetch requests at much lower total
transfer, which Vercel considers the right trade-off for nearly all applications.

Fine-grained prefetching means many small responses. Many small responses over HTTP is not free — connection scheduling, per-request overhead, and on some infrastructure, per-request cost. 16.3's answer:

16.3 pushes back the other way. Prefetches below a certain payload size are **automatically
bundled together**, cutting the overall number of prefetch requests. Larger shared segments
stay separate, precisely so they remain reusable across multiple routes.

## The trade being made

When the App Router prefetches a route it can bundle small segment responses into a single
response rather than requesting each one. That reduces request count **at the cost of
duplicating some shared segment data across routes** — a deliberate trade, on by default, and
most applications should leave it alone.

Read the cost clause carefully. A segment that is shared by several routes and gets inlined into each of their bundles is now downloaded once *per bundle* rather than once in total. That is why the size cut-off exists at all: small segments are cheap to duplicate, large ones are not, so large shared segments stay separate and keep their deduplication.

The two knobs sit at exactly that boundary:

Lower thresholds preserve more per-segment deduplication; higher thresholds inline more data
and cut the request count further. The dial runs between those two costs.

## Configuration

| Value | Description |
| --- | --- |
| `true` | Inlines prefetch responses with the default thresholds. This is the default. |
| `false` | Disables prefetch inlining. Each segment is prefetched as its own request. |
| `object` | Inlines prefetch responses using the `maxSize` or `maxBundleSize` you set. |

```ts title="next.config.ts"
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    prefetchInlining: false,
  },
}

export default nextConfig
```

```ts title="next.config.ts"
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    prefetchInlining: {
      maxSize: 2048,
      maxBundleSize: 10240,
    },
  },
}

export default nextConfig
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `maxSize` | `number` | `2048` | Largest a single segment response can be to still be eligible for inlining. |
| `maxBundleSize` | `number` | `10240` | Largest total size that can be inlined into one bundled prefetch response along a path. |

Both are measured in **bytes of the gzip-compressed segment response**, and any value you omit keeps its default.

## Where it sits relative to Partial Prefetching

These are two different axes and they compose:

- **Partial Prefetching** reduces how many *route prefetches* you make — one App Shell per route rather than one prefetch per visible link. See [10 · Instant Navigations](10-instant-navigations/README.md).
- **Prefetch inlining** reduces how many *HTTP requests* each prefetch takes, by bundling small segment responses along a path.

You can have either without the other. Inlining is on by default regardless of whether `cacheComponents` is enabled; Partial Prefetching requires it.

## When to touch it

The reference gives exactly two reasons:

`experimental.prefetchInlining` exists to override the behaviour or disable inlining entirely —
useful while debugging a navigation problem or measuring request volume. For most applications
there is no reason to change the default.

Debugging a specific navigation, where seeing one request per segment in the network panel makes the waterfall legible; and measuring, where bundling makes per-segment attribution impossible. Both are temporary local changes, not production settings.

## Gotchas

**★ It is `experimental.prefetchInlining`, not a top-level option.**
The behaviour ships on by default, so many people first meet the name in a release note and reach for the top level of `next.config.ts`. It lives under `experimental`. A misplaced key does not turn inlining off — it does nothing, and the default behaviour continues, which is the most confusing possible outcome when you are trying to debug.

**★ The behaviour is permanent; only the option is experimental.**
🔴 **Read the `experimental.` prefix carefully.** The inlining *behaviour* is a **permanent**
part of the App Router. Only the `experimental.prefetchInlining` **configuration** is
experimental, so its options may still change. The flag is not what turns the feature on.

So do not read the experimental banner as "this might disappear". Read it as "the shape of `maxSize` / `maxBundleSize` might change". Depend on the behaviour freely; pin nothing to the option names.

**★ Setting it to `false` to "reduce prefetch load" does the opposite.**
Disabling inlining means every segment is prefetched as its own request. If your motivation is request volume, `false` is exactly the wrong direction and raising `maxBundleSize` is the right one. This gets inverted surprisingly often because "inlining" sounds like extra work being done.

**★ The thresholds are gzip-compressed bytes, not source bytes.**
`maxSize: 2048` is 2 KB *after* compression, so a segment that looks far larger in your editor may well be eligible. Sizing these values off uncompressed payloads will produce a configuration that behaves nothing like you expect.

**★ Raising `maxBundleSize` buys fewer requests with more duplicated bytes.**
Inlining duplicates shared segment data across routes. A generous bundle limit inlines segments that several routes share, so each of those routes now carries its own copy instead of referencing one cached response. On a route graph with heavy shared structure that can increase total transfer meaningfully while the request count graph looks great.

**★ Large shared segments are excluded on purpose — do not "fix" that by raising `maxSize`.**
The exclusion is the mechanism that preserves cross-route reuse. Raising `maxSize` until big shared segments qualify converts your best-deduplicated payloads into per-route copies.

**★ An object value only overrides the keys you set.**
Passing `{ maxBundleSize: 20480 }` leaves `maxSize` at its default of 2048. That is convenient, and it also means a config that looks like it fully specifies the behaviour may not — read it as a patch, not a replacement.

**★ Turning inlining off to debug changes what you are debugging.**
With `false`, each segment is a separate request, which is the point — but it is also a different network shape from production. Confirm any fix with inlining back on before concluding the problem is solved.

## Interview questions

**★ What problem does prefetch inlining solve, and what created that problem?**
Next.js 16 made prefetching fine-grained — layouts are downloaded once across URLs that share them, and only the parts not already cached are fetched. That cut total transfer substantially and increased the number of individual prefetch requests, which the upgrade guide calls out explicitly. Inlining bundles small segment responses along a path into a single response so request count comes back down.

**★ What is the cost of inlining, and how does Next.js bound it?**
Duplication: a segment inlined into several routes' bundles is downloaded once per bundle instead of once in total. The bound is the size cut-off. Only segments below `maxSize` (2048 gzip bytes by default) are eligible, and a bundle stops at `maxBundleSize` (10240), so larger shared segments stay separate and keep their cross-route deduplication.

**★ Someone wants to cut prefetch request volume and sets `experimental.prefetchInlining: false`. What have they done?**
The opposite of their goal — every segment now goes out as its own request. `false` exists for debugging a navigation waterfall or measuring per-segment volume, not for tuning. To cut request count further they should raise `maxBundleSize`, accepting more duplicated bytes.

**★ How does prefetch inlining relate to Partial Prefetching?**
They act on different axes and compose. Partial Prefetching reduces how many route prefetches happen — one shared App Shell per route instead of one prefetch per visible link — and requires `cacheComponents`. Inlining reduces how many HTTP requests each prefetch costs, and is on by default regardless of Cache Components.

**★ The docs mark this feature experimental. What exactly is experimental?**
Only the configuration option. The reference states that the inlining behaviour is a permanent part of the App Router and that just the `experimental.prefetchInlining` configuration is experimental, so its options may still change. You can rely on the behaviour; do not build tooling around the option's shape.

**★ In what units are `maxSize` and `maxBundleSize` expressed, and why does that matter?**
Bytes of the gzip-compressed segment response. It matters because sizing them against uncompressed payloads — the numbers you see in an editor or a build listing — leads to thresholds several times off, producing either far more inlining than intended or none at all.

---

← [11b · Root params: restrictions and typing](11b-root-params-restrictions-and-typing.md) · [Chapter 2 overview](01-explanation.md) · Next → [13b · Prefetch control and link status](13b-prefetch-control-and-link-status.md)
