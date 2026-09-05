---
title: "The optimizer is a server that fetches a URL you gave it, decodes it and re-encodes it — so the question is never whether an image *can* go through it but whether that round trip buys anything, and for four whole classes of image it demonstrably does not"
sidebar_label: "04f · When not to optimize"
sidebar_position: 16
description: "unoptimized as a prop and as config, the four image classes the documentation names as not benefiting, why authenticated images cannot work through the default loader, custom loaders and loaderFile as the third option, and what you give up each way."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-05 against **Next.js 16.3.4** — [Image Component](https://nextjs.org/docs/app/api-reference/components/image) (page self-reports `version: 16.3.4`, `lastUpdated: 2026-08-25`); every quoted sentence and default below is from that reference. Documentation-verified; **no sandbox run**, no measured file sizes.

**Three pages have now argued for care with the optimizer — [04b](04b-loading-priority-preload-eager-fetchpriority.md) about what loads first, [04d](04d-remote-patterns-is-a-security-control.md) about who may feed it, [04e](04e-format-negotiation-and-bounding-the-optimizer.md) about the cache matrix it produces. This page argues the opposite case, and it is not a fallback or a workaround: for several kinds of image the correct configuration is to route around the optimizer entirely, and the documentation names them. Keeping `<Image>` while opting out of optimization is a deliberate, first-class configuration — you keep the layout guarantees, the `srcset` machinery goes quiet, and the round trip through your server disappears. The failure mode this page exists to prevent is the opposite one: an image that cannot work through the optimizer being made to work through it by loosening a security control.**

## The four classes the documentation names

> *"A boolean that indicates if the image should be optimized. This is useful for images that do not benefit from optimization such as small images (less than 1KB), vector images (SVG), or animated images (GIF)."*
> — [Image Component](https://nextjs.org/docs/app/api-reference/components/image), `unoptimized`

Three named there, and a fourth stated elsewhere in the same reference:

| Class | Why the optimizer buys nothing |
|---|---|
| **Small images (< 1 KB)** | The re-encode overhead and an extra cache entry cost more than the bytes saved |
| **Vector (SVG)** | *"SVG is a vector format meaning it can be resized losslessly"* — there is no resizing work to do |
| **Animated (GIF)** | Format conversion is skipped for animated sources anyway ([04e](04e-format-negotiation-and-bounding-the-optimizer.md)), so the round trip produces the source back |
| **Authenticated images** | The optimizer's fetch carries no credentials, so it cannot retrieve the source at all |

**The behaviour of the flag is exactly two lines and worth stating precisely, because "unoptimized" sounds like a degradation and is not:**

> *"`true`: The source image will be served as-is from the `src` instead of changing quality, size, or format."*
> *"`false`: The source image will be optimized."*

You still get the component. You still get `width`/`height` reserving space and the layout-shift guarantee that is the main reason to use `<Image>` at all. What you lose is resizing, quality reduction and format negotiation — which for these four classes is a list of things that were not going to happen usefully.

## SVG: automatic, and the flag people reach for instead is the wrong one

```jsx
<Image src="/my-image.svg" unoptimized />
```

> *"We recommend using the `unoptimized` prop when the `src` prop is known to be SVG. This happens automatically when `src` ends with `\".svg\"`."*

🔴 **So for a URL ending in `.svg` you do not need the prop at all** — and the practical corollary is that an SVG served from a URL that does *not* end in `.svg` (a signed CDN URL, a route handler, an object-store key with a query string) misses the automatic path and needs the prop stated explicitly. That is the single most common SVG surprise, and it presents as "SVGs work in dev and 400 in production" when the two environments serve them from different URL shapes.

**The flag people reach for instead is `dangerouslyAllowSVG`, and it is answering a different question.** The reference gives two reasons SVG is excluded by default, and only one of them is about optimization:

> *"SVG is a vector format meaning it can be resized losslessly."*
> *"SVG has many of the same features as HTML/CSS, which can lead to vulnerabilities without proper Content Security Policy (CSP) headers."*

The first reason says the optimizer has nothing to offer. The second says letting it process SVG is a security decision. `unoptimized` answers the first and sidesteps the second; `dangerouslyAllowSVG` takes the second on. If your reason is "I want SVG logos to render", you want the first. And if you genuinely need the second, the reference does not present it as a single flag:

> *"In addition, it is strongly recommended to also set `contentDispositionType` to force the browser to download the image, as well as `contentSecurityPolicy` to prevent scripts embedded in the image from executing."*

```js
// next.config.js — the three settings the reference presents together.
module.exports = {
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
}
```

## Authenticated images: not a configuration problem

> *"If the `src` image requires authentication, consider using the `unoptimized` property to disable Image Optimization."*

The mechanism is in [04d](04d-remote-patterns-is-a-security-control.md) and it is worth restating as a structural fact rather than a limitation: the optimizer is a **separate, shared, cacheable** server-side fetch. Forwarding the user's cookie into it would mean putting one user's credentials on a request whose result is cached and served to others. So the documented behaviour is not to forward headers, and no option turns that off.

**Which leaves exactly three honest shapes for a private image**, and choosing between them is the actual decision:

```tsx
// 1 · Signed, short-lived URL the optimizer can fetch anonymously. Optimization survives.
<Image src={await signedUrl(key, { expiresIn: 300 })} alt="" width={800} height={600} />

// 2 · unoptimized, letting the browser fetch it with the user's own cookies.
<Image src="/api/attachments/abc123" alt="" width={800} height={600} unoptimized />

// 3 · A route handler that authorizes and streams the bytes, with the optimizer bypassed.
//     Same as 2 from the component's point of view; the difference is where the check lives.
```

⚠️ **Option 1 is the only one that keeps resizing and format negotiation**, which for a gallery of user uploads is a large difference. Option 2 is the smallest change and the most common, and its cost is that every viewer downloads the full-size original. The chapter-16 material on ownership predicates applies to option 3 unchanged — a route that streams bytes is a row-returning query wearing a different costume, and it needs the same predicate.

## The third road: a custom loader

Neither optimizing on your server nor serving the source, but delegating to someone else's image service.

> *"`loaderFiles` allows you to use a custom image optimization service instead of Next.js."*

```js
// next.config.js
module.exports = {
  images: {
    loader: 'custom',
    loaderFile: './my/image/loader.js',
  },
}
```

> *"The path must be relative to the project root. The file must export a default function that returns a URL string"*

```js
// my/image/loader.js
'use client'

export default function myImageLoader({ src, width, quality }) {
  return `https://example.com/${src}?w=${width}&q=${quality || 75}`
}
```

**Read what that function is and is not.** It returns a *URL string*. It does no work, fetches nothing and decodes nothing — it is a URL builder, and everything downstream of it is the third-party service's problem. That is the whole appeal: the CPU, the disk cache from [04e](04e-format-negotiation-and-bounding-the-optimizer.md), the 50 MB source fetch and the SSRF surface from [04d](04d-remote-patterns-is-a-security-control.md) all move off your server.

⚠️ **Note the `'use client'` at the top of the documented example.** The loader is a function that has to be available where the `src` is computed, and the per-instance `loader` prop has the same constraint as any function prop — *"Using props like `onLoad`, which accept a function, requires using Client Components to serialize the provided function."* `loaderFile` is the way to apply one everywhere without pushing components across the boundary:

> *"Alternatively, you can use the `loaderFile` configuration in `next.config.js` to configure every instance of `next/image` in your application, without passing a prop."*

**What you give up:** `remotePatterns`, `qualities`, `formats`, `minimumCacheTTL` and `maximumDiskCacheSize` are all configuration for the *default* loader. With a custom loader they stop being where the answer lives — the equivalent controls are the third-party service's, and they are the ones you now have to reason about.

## Turning it off globally

```js
module.exports = { images: { unoptimized: true } }
```

The reference notes this has been available *"Since Next.js 12.3.0"*. It is the right setting more often than its reputation suggests — a fully static export has no server to run an optimizer on, and an application whose images are all pre-sized artwork from a design pipeline is paying for a transform that repeats work already done. **What makes it a bad setting is choosing it to make an error go away**, because the errors it silences are usually [04d](04d-remote-patterns-is-a-security-control.md)'s telling you something true about where your images come from.

Two smaller escape hatches belong here, because both come up while deciding this:

- **`disableStaticImages`** turns off `import icon from './icon.png'`. The documented reason is narrow — *"In some cases, you may wish to disable this feature if it conflicts with other plugins that expect the import to behave differently."* ⚠️ It costs you the content hashing and `immutable` caching that make static imports the clean answer to [04e](04e-format-negotiation-and-bounding-the-optimizer.md)'s no-invalidation problem, so it is a plugin-conflict remedy and not a preference.
- **`path`** re-prefixes the endpoint — *"The default value for `path` is `/_next/image`."* Useful behind a proxy that routes on path; it changes nothing about what the endpoint does.

## What I could not confirm

- **Where exactly the 1 KB threshold comes from.** The reference names *"small images (less than 1KB)"* as an example of images that do not benefit, and states no rule, no measurement and no behaviour change at that size. Treat it as the documentation's rule of thumb, not a boundary the code enforces.
- **Whether the automatic SVG behaviour inspects content type or only the URL suffix.** The documented trigger is that *"`src` ends with `\".svg\"`"* — a string test. Whether anything else can trigger it is not stated, so assume the suffix is the whole rule.
- **What a custom loader does to the `srcset` widths.** The loader receives `width` and returns a URL, and the reference does not say whether `deviceSizes`/`imageSizes` still generate the candidate list. The safe assumption is that they do — they are what produce the `width` values passed in — but this is inference, not a quoted guarantee.

## Gotchas

**★ Symptom: SVGs render locally and return 400 in production.** Cause: the automatic `unoptimized` path is triggered by the `src` *"end[ing] with `\".svg\"`"*, and production serves them from a signed or query-stringed CDN URL that does not. Fix: state the prop rather than relying on the suffix.

```tsx
<Image src={cdnUrl} alt="" width={120} height={40} unoptimized />
```

**★ Symptom: `dangerouslyAllowSVG: true` was enabled to fix broken logos.** Cause: the wrong flag for the problem — the logos needed the optimizer skipped, not admitted to processing SVG. Fix: `unoptimized`, and revert the dangerous flag. If it must stay, it goes with both companions in the same change, because the reference presents all three together.

**★ Symptom: an authenticated image is a broken icon through `<Image>` and fine when opened directly.** Cause: the browser sent your cookie; the optimizer's own fetch did not, and does not. Fix: a signed URL if you want optimization kept, `unoptimized` if you do not. There is no header-forwarding option to find.

**★ Symptom: `images: { unoptimized: true }` was added and a whole class of real problems went quiet.** Cause: the setting silences errors from `remotePatterns` as effectively as it silences transcoding. Fix: turn it back on and read the errors — a 400 from the allow-list is information about where your images come from, and it is the cheapest form that information will ever arrive in.

**★ Symptom: a custom loader is configured and `formats`, `qualities` and `minimumCacheTTL` have stopped having any effect.** Cause: those configure the default loader, which is no longer in the path. Fix: this is correct behaviour, not a bug — move the equivalent settings to the third-party service and delete the dead config so the next reader is not misled by it.

**★ Symptom: adding a `loader` prop turned a Server Component into a Client Component.** Cause: it is a function prop, and function props require a Client Component to be serialized. Fix: use `loaderFile` in `next.config.js`, which the reference names as the way to configure every instance *"without passing a prop"*.

**Symptom: static imports were disabled to fix a plugin conflict and image cache staleness appeared weeks later.** Cause: static imports were also what hashed file contents and served them `immutable`; without them, URLs stopped changing when bytes did. Fix: if `disableStaticImages` must stay, put a content hash in the URL some other way — the staleness is the direct consequence of losing it, per [04e](04e-format-negotiation-and-bounding-the-optimizer.md).

**Symptom: an animated GIF was routed through the optimizer with AVIF enabled and is unchanged.** Cause: animated sources skip format conversion entirely. Fix: mark it `unoptimized` so it stops costing a server round trip and a cache entry to produce the file you already had — and if the size matters, the real fix is a video element, not an image setting.

**Symptom: `unoptimized` was added and the layout started shifting.** Cause: something else changed at the same time — `unoptimized` does not affect `width`/`height` or the space they reserve. Fix: look for a removed dimension or a `fill` without a positioned parent; this symptom is not caused by the flag, and chasing it there wastes the afternoon.

## Interview questions

**★ Is `unoptimized` a degradation or a configuration? Defend the answer with what it changes.**
A configuration. The reference defines it as serving the source *"as-is from the `src` instead of changing quality, size, or format"* — so what you lose is exactly resizing, quality reduction and format negotiation. Everything else about the component survives, including the `width`/`height` contract that reserves space and prevents layout shift, which is the single most valuable thing `<Image>` does. For the four classes the documentation names — sub-1 KB images, SVG, animated images, and authenticated sources — none of the three lost capabilities was going to produce a benefit, so the round trip through the optimizer is pure cost. Reading the flag as "the fast path off" gets the trade backwards.

**★ A teammate enables `dangerouslyAllowSVG` so designers can upload SVG logos. Walk through the response.**
That it answers a different question from the one being asked. The documentation gives two separate reasons SVG is excluded: it *"can be resized losslessly"*, so the optimizer has nothing to contribute, and it *"has many of the same features as HTML/CSS, which can lead to vulnerabilities"*. The logos need the first — skip the optimizer — and the component already does that automatically when the `src` ends in `.svg`. `dangerouslyAllowSVG` takes on the second, which is a decision about letting your public image endpoint process a scriptable format. If it genuinely has to go on, the reference pairs it with `contentDispositionType: 'attachment'` and a restrictive `contentSecurityPolicy`, and shipping it without both is shipping the risk without the mitigations.

**★ Why can the image optimizer not serve authenticated images, and why is that a design property rather than a gap?**
Because the optimizer performs its own server-side fetch of the source, and the result is cached and shared. Forwarding the user's credentials into that fetch would put one user's authorization on a request whose output other users receive — the cache would be the vulnerability. So the documented behaviour is not to forward headers at all, and the reference names `unoptimized` as the way out. The design property is that a shared cache and per-user authorization are in tension by construction; you resolve it by making the fetch anonymous (a short-lived signed URL) or by making it not happen (serve the bytes yourself and skip the optimizer).

**★ Of the three ways to serve a private image, which keeps optimization and what does it cost?**
The signed URL. It works precisely because it converts an authorization problem into a capability problem: the URL itself is the credential, it is anonymous from the optimizer's point of view, and it expires. What it costs is that the URL is now a bearer token — anyone holding it within its lifetime can fetch the image, including the optimizer's cache, so short expiries and narrow scopes matter. The other two shapes — `unoptimized` on an authenticated route, or a route handler streaming bytes — keep the authorization check but give up resizing and format negotiation, which for a gallery of user uploads is the expensive half.

**★ What does a custom loader actually do, and what stops applying when you configure one?**
It is a URL builder — the documented example returns a template string and nothing else — so it moves the entire decode-and-re-encode step to a third-party service. What stops applying is everything that configures the default loader: `remotePatterns`, `qualities`, `formats`, `minimumCacheTTL`, `maximumDiskCacheSize`, `maximumResponseBody`. That is a genuine trade rather than a simplification, because those settings were not decoration — they were the SSRF boundary, the cache-cardinality bound and the memory bound. With a custom loader the same questions still exist and the answers now live in someone else's dashboard.

**★ Why is `loaderFile` usually preferable to the `loader` prop?**
Because `loader` is a function prop, and function props force the component that passes them to be a Client Component so the function can be serialized — the reference states this for `onLoad` and the constraint is the same. A per-instance loader therefore drags components across the client boundary for a reason that has nothing to do with interactivity. `loaderFile` is described as configuring *"every instance of `next/image` in your application, without passing a prop"*, which gets the same behaviour with no boundary consequence and no duplication.

**When is `images: { unoptimized: true }` the right global setting, and when is it a smell?**
Right when there is no server to optimize on — a fully static export — or when every image is already produced at its final size and format by a design pipeline, in which case the optimizer repeats work. A smell when it is reached for to make an error stop: the errors it silences are usually the `remotePatterns` allow-list refusing a host, and that refusal is information about where the images actually come from. The distinguishing question is whether you can state what optimization was buying before you turned it off. If you cannot, the setting is hiding something rather than saving something.

**Why does disabling static image imports cause cache staleness later, when the two look unrelated?**
Because a static import does two things and only one of them is obvious. It gives the component intrinsic dimensions, and it also *"automatically hash[es] the file contents and cache[s] the image forever with a `Cache-Control` header of `immutable`"*. That content hash is what makes the URL change when the bytes change, which is the clean answer to the optimizer's documented absence of any invalidation mechanism. Turn imports off for a plugin conflict and you keep the dimensions problem in view and lose the hashing silently — so the staleness surfaces weeks later, at the first image replacement, looking like a caching bug rather than a consequence of a build setting.

---

← [04e · Format negotiation](04e-format-negotiation-and-bounding-the-optimizer.md) · [Chapter index](01-explanation.md) · Next → [05 · `next/script` strategies](05-next-script-loading-strategies-for-third-party-scripts.md)
