---
title: "Format negotiation happens per request against the `Accept` header, so the optimizer's cache key is the product of source URL, width, quality and negotiated format — and every knob on this page is really a knob on the size of that product"
sidebar_label: "04e · Format negotiation"
sidebar_position: 15
description: "The formats array and Accept-header negotiation at Next.js 16.3.4, why AVIF is not a free win, qualities as a required allow-list since Next 16, deviceSizes and imageSizes as srcset generators, and bounding the disk cache with minimumCacheTTL and maximumDiskCacheSize."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against **Next.js 16.3.4** — [Image Component](https://nextjs.org/docs/app/api-reference/components/image) (page self-reports `version: 16.3.4`, `lastUpdated: 2026-08-25`); every default and every quoted sentence below is from that reference. 🔴 **The AVIF section is additionally checked against advisory GHSA-2xp9-vwfh-vxw4**, whose mitigation in **16.3.3** the Image reference does not mention — see [ch10 · the 2026 CVE record](../10-forms-authentication-and-security-hardening/14-the-2026-cve-record-eleven-vulnerabilities-and-what-each-one-teaches.md). Documentation-verified; **no sandbox run**, no timings, no measured file sizes.

**[04d](04d-remote-patterns-is-a-security-control.md) argued that `remotePatterns` decides who may hand bytes to your decoder. This page is the other half of the same argument: once the bytes are in, what comes out is not one file but a matrix — one entry per combination of source URL, requested width, quality and the format negotiated from that particular browser's `Accept` header. Every option here changes the size of that matrix, and the matrix is what you pay for in CPU on first request and in disk forever after. The single most common mistake is reading `formats: ['image/avif', 'image/webp']` as "better compression" when the documentation describes it as a trade with two costs and one benefit, and the costs land on exactly the request that a user is waiting for.**

## Negotiation, precisely

The optimizer does not choose a format from your config alone. It intersects your list with what the browser said it accepts:

> *"Next.js automatically detects the browser's supported image formats via the request's `Accept` header in order to determine the best output format."*
> — [Image Component](https://nextjs.org/docs/app/api-reference/components/image), `formats`

Three consequences follow, and the documentation states all three:

> *"If the `Accept` header matches more than one of the configured formats, the first match in the array is used. Therefore, the array order matters. If there is no match (or the source image is animated), it will use the original image's format."*

1. **Order is preference**, not a set. `['image/avif', 'image/webp']` prefers AVIF; the reverse prefers WebP; the two configs are different.
2. **No match is not an error** — you get the source format back. So a misconfigured `formats` list degrades silently to "no optimization of format", which looks like working software.
3. 🔴 **An animated source is never format-converted**, regardless of your list. An animated GIF stays an animated GIF. This is the sentence people miss when they wonder why the GIF on the marketing page is still 4 MB.

The default is one entry:

```js
// next.config.js — this is the default; you get it without writing it.
module.exports = {
  images: {
    formats: ['image/webp'],
  },
}
```

## AVIF is a trade, and the documentation prices it

Adding AVIF is the most common change made to this config and the one most often made on vibes. The reference states the trade explicitly, and it is worth reading as three separate claims rather than one:

> *"We still recommend using WebP for most use cases."*
>
> *"AVIF generally takes 50% longer to encode but it compresses 20% smaller compared to WebP. This means that the first time an image is requested, it will typically be slower, but subsequent requests that are cached will be faster."*
>
> *"When using multiple formats, Next.js will cache each format separately. This means increased storage requirements compared to using a single format, as both AVIF and WebP versions of images will be stored for different browser support."*
> — [Image Component](https://nextjs.org/docs/app/api-reference/components/image), `formats`

🔴 **Before you act on any of that: on the version this track pins, AVIF optimization is DISABLED, and the reference above does not say so.** The August 2026 security release — **16.3.3** and **15.5.24**, advisory **GHSA-2xp9-vwfh-vxw4**, CVSS 9.5 — responded to an unauthenticated RCE reachable through `libheif` under `sharp` by **disabling AVIF optimization**, and *"AVIF outputs stop being produced"*. We pin **16.3.4**, which is after that. So `formats: ['image/avif']` is a configuration whose effect the patched runtime does not deliver: negotiation finds no usable match and falls back, exactly as the no-match rule above describes.

⚠️ **The disablement is documented as temporary, and the distinction matters for how you write it down.** The advisory's own framing is that AVIF optimization is off *until an upstream fix has propagated*, not permanently — so this is a live state to re-check on a bump, not a permanent property of the component. It is also why the `formats` reference still reads as though AVIF works: the API surface is unchanged and only the behaviour was withdrawn. 🔴 **A configuration page that quotes the reference and stops is how a team spends an afternoon wondering why their AVIF is not being served.** The incident is written up in full at [ch10 · the 2026 CVE record](../10-forms-authentication-and-security-hardening/14-the-2026-cve-record-eleven-vulnerabilities-and-what-each-one-teaches.md) and its supply-chain lesson at [ch18 · supply-chain vigilance](../18-advanced-ecosystem-topics/03b-supply-chain-vigilance.md); the exposure argument is [04d](04d-remote-patterns-is-a-security-control.md). **Do not re-derive any of it here.**

**Everything below is the trade as the reference states it, and it is what you will be deciding once AVIF returns.**

**Read the first sentence as the recommendation it is.** Next.js recommends WebP for most cases and describes AVIF as a conditional improvement. The encode cost is paid on a cache miss — a real user waiting — and the compression benefit is paid out on cache hits. So the shape of your traffic decides it: a long-tail catalogue where most images are requested once or twice keeps paying the encode cost and rarely collects; a small set of hot images pays once and collects forever.

⚠️ **And enabling both formats does not double your storage — it multiplies your matrix by two on the format axis**, on top of every width in your `srcset` and every allowed quality. That interaction is the actual budget, and it is why the next two sections belong on this page rather than somewhere else.

🔴 **If you self-host behind a proxy or CDN, negotiation is not automatic — it is a configuration you must make:**

> *"If you self-host with a Proxy/CDN in front of Next.js, you must configure the Proxy to forward the `Accept` header."*

A proxy that strips or normalises `Accept` gives every browser the same answer. The failure mode is not an error; it is that modern browsers quietly stop receiving modern formats, or — worse, if the proxy caches without varying on `Accept` — that a browser receives a format it cannot display.

## `qualities` — an allow-list, and required since Next 16

```js
module.exports = {
  images: {
    // Default
    qualities: [75],
  },
}
```

> *"**Good to know**: This field is required starting with Next.js 16 because unrestricted access could allow malicious actors to optimize more qualities than you intended."*

That sentence is the whole rationale and it is a cardinality argument, not an image-fidelity one: `/_next/image` takes `q` from the query string, so before the allow-list existed a stranger could request one hundred distinct qualities of the same image and mint one hundred cache entries with one hundred transcodes.

Two distinct behaviours, and they are easy to conflate:

- **Through the component**, an out-of-list value is coerced rather than rejected — *"a value outside that list is coerced to the closest allowed entry. For example, with `qualities: [50, 75, 100]`, a `quality` of `80` is served as `75`. Development logs a warning so you can add the value to the allowlist."*
- **Through the endpoint directly**, it is rejected — *"If the REST API is visited directly with a quality that does not match a value in this array, the server will return a 400 Bad Request response."*

So a `quality={80}` in your code does not fail the build or the request; it silently serves 75 and warns in development only. **A quality prop that never appears in the allow-list is dead code that looks like a tuning decision.**

## `deviceSizes` and `imageSizes` — the width axis of the matrix

These two arrays generate the `srcset`, and the split between them is not arbitrary:

```js
module.exports = {
  images: {
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],   // defaults
    imageSizes: [32, 48, 64, 96, 128, 256, 384],                  // defaults
  },
}
```

> *"`imageSizes` allows you to specify a list of image widths. These widths are concatenated with the array of device sizes to form the full array of sizes used to generate image `srcset`."*
>
> *"`imageSizes` is only used for images which provide a `sizes` prop, which indicates that the image is less than the full width of the screen. Therefore, the sizes in `imageSizes` should all be smaller than the smallest size in `deviceSizes`."*

**The `sizes` prop is what selects between the two behaviours**, and the reference is explicit about the consequence of omitting it:

> *"Without `sizes`: Next.js generates a limited `srcset` (e.g. 1x, 2x), suitable for fixed-size images."* · *"With `sizes`: Next.js generates a full `srcset` (e.g. 640w, 750w, etc.), optimized for responsive layouts."*

> *"If `sizes` is missing, the browser assumes the image will be as wide as the viewport (`100vw`). This can cause unnecessarily large images to be downloaded."*

⚠️ **This is where trimming the arrays to save cache actually costs you bytes on the wire.** Fewer widths means a coarser `srcset`, which means the browser picking a larger image than it needs. Narrow the arrays to the breakpoints your CSS genuinely uses — not to an arbitrary short list.

## Bounding the cache: `minimumCacheTTL` and `maximumDiskCacheSize`

```js
module.exports = {
  images: {
    minimumCacheTTL: 14400,               // the default: 4 hours, in seconds
    maximumDiskCacheSize: 500_000_000,    // 500 MB
  },
}
```

**`minimumCacheTTL` is a floor, not a value:**

> *"The expiration (or rather Max Age) of the optimized image is defined by either the `minimumCacheTTL` or the upstream image `Cache-Control` header, whichever is larger."*

🔴 **And there is no invalidation:**

> *"There is no mechanism to invalidate the cache at this time, so its best to keep `minimumCacheTTL` low. Otherwise you may need to manually change the `src` prop or delete the cached file `<distDir>/cache/images`."*

That sentence is the argument against the tempting `minimumCacheTTL: 2678400` (31 days) that the reference itself shows as a cost-reduction example. It is a real option and it has a real consequence: for 31 days the only ways to change what a URL serves are to change the URL or to delete files on the server. **The clean way out is content-addressed URLs**, which static imports give you for free:

> *"In many cases, it's better to use a Static Image Import which will automatically hash the file contents and cache the image forever with a `Cache-Control` header of `immutable`."*

**`maximumDiskCacheSize` was added in `v16.1.7`** and its default is the surprising part:

> *"If no value is configured, the default behavior is to check the current available disk space once during startup and use 50%."*
>
> *"When the disk cache exceeds the configured size, the least recently used optimized images will be deleted until the cache is under the limit again."*

Three things follow. **It is measured once, at startup** — a container whose disk fills for unrelated reasons keeps the budget it computed when it booted. **50% of available disk on a small container is a small number**, and on a large shared volume it is a large one, so the same image workload behaves differently on two hosts with identical config. And **eviction is LRU**, so a wide, low-traffic matrix evicts the entries you actually wanted to keep. Setting the number explicitly is the fix; `0` disables the disk cache entirely.

> *"Alternatively, you can implement your own cache handler using `cacheHandler` which will ignore the `maximumDiskCacheSize` configuration."*

⚠️ **That last sentence is a real trap on self-hosted multi-container deployments** — if you set a `cacheHandler` for ISR, your carefully chosen `maximumDiskCacheSize` stops applying to images. Ignoring is not merging.

One more bound worth setting, because its default is generous:

> *"The default image optimization loader will fetch source images up to 50 MB in size."* · *"If you know all your source images are small, you can protect memory constrained servers by reducing this to a smaller value such as 5 MB."*

```js
module.exports = { images: { maximumResponseBody: 5_000_000 } }
```

## The whole matrix, in one place

The number of cache entries for a single source image is roughly:

```text
widths in the generated srcset  ×  allowed qualities  ×  negotiated formats
```

With the defaults and a `sizes` prop, that is up to 15 widths × 1 quality × 1 format. Add AVIF and widen `qualities` to four values and the same image becomes up to 15 × 4 × 2 — and every entry is a separate transcode on first request. **Nothing about the page's appearance changed. The bill did.**

## What I could not confirm

- **Actual encode times or output sizes.** The reference gives relative figures — *"50% longer to encode"*, *"20% smaller"* — and no absolutes. There is no sandbox here and none should be built for this; measure on your own images, because the ratios depend on content.
- **Whether `maximumDiskCacheSize` re-checks disk space after startup.** The documentation says the default *"check[s] the current available disk space once during startup"* and says nothing about later re-checks, so the safe reading is that it does not. Treat the observation as documented-once, not as a guarantee about runtime behaviour.
- **How the disk cache interacts with a multi-instance deployment.** The documentation describes a disk cache and a `cacheHandler` escape hatch, and does not state whether instances share or duplicate entries. On any horizontally-scaled deployment, assume duplication unless your cache handler says otherwise.

## Gotchas

**★ Symptom: `formats: ['image/avif']` is configured and every response is still WebP or the source format.** Cause: on **16.3.3 and later** AVIF optimization is disabled — the mitigation for GHSA-2xp9-vwfh-vxw4 — so negotiation finds no usable match and falls back, silently, exactly as the documented no-match rule says it should. Fix: nothing to fix in your config; the behaviour is correct for this version. Re-check on a bump, because the advisory frames the disablement as lasting *until an upstream fix has propagated*. Do not chase it through the `Accept` header or the CDN first — check the version.

**★ Symptom: AVIF is enabled, the Lighthouse score is unchanged, and p75 image LCP got worse.** Cause: encode cost lands on the cache miss and the benefit lands on the hit — *"the first time an image is requested, it will typically be slower, but subsequent requests that are cached will be faster"* — so on long-tail traffic most users pay and few collect. Fix: restrict AVIF to the small set of hot images by giving them their own path, or accept the documented default.

```js
module.exports = { images: { formats: ['image/webp'] } }   // the documented recommendation
```

**★ Symptom: after moving from Vercel to a self-hosted deployment behind a CDN, every browser gets JPEG.** Cause: the CDN is not forwarding `Accept`, so negotiation cannot see what the browser supports and there is no match — and *"If there is no match … it will use the original image's format."* Fix: forward the header, and make the CDN vary on it so one browser's answer is not served to another.

**★ Symptom: an animated GIF is still enormous after enabling AVIF and WebP.** Cause: the parenthetical in the negotiation rule — *"(or the source image is animated)"* — the source format is used unchanged. Fix: this is not a config problem. Convert the asset to a video and use `<video>`, or accept it; no `formats` value will change the outcome.

**★ Symptom: `quality={90}` was set for hero images and the bytes never changed.** Cause: `qualities` defaults to `[75]` and out-of-list values are coerced to the closest allowed entry, silently in production. Fix: add the value to the allow-list — deliberately, because each entry multiplies the cache matrix.

```js
module.exports = { images: { qualities: [75, 90] } }
```

**★ Symptom: disk fills on one host and not on an identically-configured one.** Cause: `maximumDiskCacheSize` is unset, so the default is 50% of whatever disk was available *at that host's startup*. Two hosts, two different budgets, same config. Fix: set the number explicitly rather than inheriting a value that depends on boot-time conditions.

```js
module.exports = { images: { maximumDiskCacheSize: 500_000_000 } }
```

**★ Symptom: a `cacheHandler` was added for ISR and image disk usage started growing again.** Cause: *"Alternatively, you can implement your own cache handler using `cacheHandler` which will ignore the `maximumDiskCacheSize` configuration."* Fix: bound it inside the cache handler; the images config no longer applies.

**★ Symptom: a logo was replaced and the old one keeps being served for hours.** Cause: `minimumCacheTTL` is a floor and there is no invalidation mechanism. Fix: change the URL — a static import gives you a content hash for free and an `immutable` header with it — rather than raising or lowering the TTL.

```tsx
import logo from './logo.png'   // hashed by content; the URL changes when the bytes do
<Image src={logo} alt="SprintDesk" />
```

**Symptom: `minimumCacheTTL` was raised to 31 days to cut costs, and a mistaken image is now stuck in production.** Cause: the documentation's own warning, applied. Fix: the two documented remedies are to change the `src` prop or to delete `<distDir>/cache/images` — both are deploys. Decide before raising the TTL whether you are willing to deploy to fix a typo.

**Symptom: `deviceSizes` was trimmed to three entries to shrink the cache, and images got heavier.** Cause: a coarser `srcset` makes the browser round up to the next available width. Fix: match the arrays to your real CSS breakpoints; the axis to cut is usually `qualities` or `formats`, which have no effect on which width is chosen.

**Symptom: `sizes` is absent on a `fill` image and the largest source is downloaded on mobile.** Cause: *"If `sizes` is missing, the browser assumes the image will be as wide as the viewport (`100vw`)"*, and without `sizes` only a limited `srcset` is generated anyway. Fix: state `sizes` wherever CSS makes the image responsive.

```tsx
<Image fill src="/hero.jpg" alt="" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />
```

**Symptom: a 40 MB source TIFF pins memory on a small container.** Cause: the loader fetches source images up to 50 MB by default. Fix: `maximumResponseBody` set to what your real assets need, so an oversized upload fails fast instead of being decoded.

## Interview questions

**★ Why does the order of the `formats` array matter, and what happens when nothing in it matches?**
Because the array is a preference list, not a set: *"If the `Accept` header matches more than one of the configured formats, the first match in the array is used."* So `['image/avif', 'image/webp']` and `['image/webp', 'image/avif']` are genuinely different configurations for a browser that accepts both. When nothing matches — or the source is animated — the original format is used. That last part is the operationally important half, because it means a broken negotiation path does not raise an error; it silently returns to serving the source, which is indistinguishable from working software until someone looks at the response headers.

**★ Is enabling AVIF a free improvement? Argue it from the documentation.**
It is not enabled at all on the version we pin, which is the first thing to say — 16.3.3 disabled AVIF optimization to mitigate an unauthenticated RCE in `libheif` under `sharp`, and the published `formats` reference still documents the option as though it worked. That gap between a documented API and a withdrawn behaviour is the real lesson. Setting the argument aside and answering the version-independent question: No, and the documentation prices it in one sentence: AVIF *"generally takes 50% longer to encode but it compresses 20% smaller compared to WebP"*, and it says plainly *"We still recommend using WebP for most use cases."* The asymmetry is what decides it — the encode cost is paid on a cache miss, with a user waiting, and the size benefit is collected on cache hits. Hot images with high hit rates collect many times and pay once. A long-tail catalogue pays repeatedly and collects rarely. There is also a third cost that is easy to forget: each format is cached separately, so enabling both doubles the storage for the format axis of an already multiplicative cache key.

**★ Why did Next.js 16 make `qualities` a required field?**
Because `/_next/image` reads the quality from a query string, and an unbounded parameter on a public endpoint is an unbounded cache key. The reference's own reason is *"because unrestricted access could allow malicious actors to optimize more qualities than you intended"* — each distinct `q` is a separate transcode and a separate stored file, so a stranger could spend your CPU and your disk at will. It is the same cardinality argument as narrowing `remotePatterns` and pinning `search` in [04d](04d-remote-patterns-is-a-security-control.md), applied to a different axis of the same key.

**★ A `quality={80}` prop is in the code and the allow-list is `[50, 75, 100]`. What is served, and where would you find out?**
75 — the closest allowed entry, since values outside the list are coerced rather than rejected. You would find out in development, where the reference says a warning is logged so you can add the value to the allow-list; in production it is silent. Direct hits on the endpoint behave differently and return 400, so the coercion is a component-level convenience rather than a property of the API. The practical consequence is that a quality prop nobody added to the list is dead tuning that reviews cleanly.

**★ What is actually cached, and why is "the image is cached" the wrong mental model?**
The cache key is the combination of source URL, width, quality and negotiated output format — so one source image corresponds to many entries, not one. That is why every option on this page is a cache-size decision in disguise: `deviceSizes` and `imageSizes` set the width axis, `qualities` sets the quality axis, `formats` sets the format axis, and `remotePatterns` decides how many distinct source URLs can enter the key at all. Reasoning about "the image" leads to the mistake of enabling two formats and four qualities as independent small improvements, when the effect on stored bytes and CPU is their product.

**★ Your image disk cache fills on one production host and not on its identically-configured sibling. What is your first hypothesis?**
That `maximumDiskCacheSize` is unset, because its default is not a constant — the documented behaviour is to *"check the current available disk space once during startup and use 50%"*. Two hosts that booted with different amounts of free disk get different budgets from the same config file, and the value does not follow the disk afterwards. The fix is to state the number, and the related trap is that adding a custom `cacheHandler` makes the setting inapplicable entirely, which the reference says outright.

**Why is `minimumCacheTTL` described as a floor rather than as the cache duration?**
Because the effective max-age is *"either the `minimumCacheTTL` or the upstream image `Cache-Control` header, whichever is larger"* — so an upstream asset with a long `Cache-Control` overrides your short local setting, and lowering `minimumCacheTTL` cannot shorten it. That combines badly with the absence of any invalidation mechanism: the two documented remedies are changing the `src` or deleting `<distDir>/cache/images`. Content-hashed URLs from static imports sidestep the whole question, which is why the reference recommends them in the same breath.

**A teammate proposes trimming `deviceSizes` from eight entries to three to shrink the image cache. What is the objection?**
That it cuts the wrong axis. Fewer widths do not make the served image smaller — they make the `srcset` coarser, so the browser rounds up to the nearest available width and downloads more bytes than it needs. The axes that can be cut without a bandwidth penalty are `qualities` and `formats`, because neither affects which width is chosen. If the width axis genuinely needs narrowing, the way to do it is to match the arrays to the breakpoints the CSS actually uses, which is a different exercise from picking three round numbers.

**How does an animated source interact with all of this?**
It opts out of format conversion entirely — the negotiation rule's parenthetical says the original format is used when *"the source image is animated"*, independently of what `formats` contains. So an animated GIF is not a configuration problem and no image option will shrink it. The correct fix is at the asset level: convert it to a video and stop routing it through the image pipeline, which also gets you codecs the image optimizer was never going to produce.

---

← [04d · remotePatterns](04d-remote-patterns-is-a-security-control.md) · [Chapter index](01-explanation.md) · Next → [04f · When not to optimize](04f-when-not-to-use-the-optimizer.md)
