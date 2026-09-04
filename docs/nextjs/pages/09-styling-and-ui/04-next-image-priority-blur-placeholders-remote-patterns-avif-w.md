---
title: "`next/image` is a sizing contract before it is an optimizer — the `width`/`height` you are forced to supply exist to reserve layout space, and `sizes` is what decides whether the browser downloads a 32px thumbnail or a 3840px original"
sidebar_label: "04 · next/image sizing"
sidebar_position: 29
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js Image component API reference
> ([nextjs.org/docs/app/api-reference/components/image](https://nextjs.org/docs/app/api-reference/components/image),
> the page's own header declares `version: 16.3.4`, `lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4 · React 19.2.8 · Node 20.9 floor**.
> 🔴 `next` is **not installed in this checkout** — `require('next/package.json')` throws
> `MODULE_NOT_FOUND` — so **no T1 probe of the package was possible**; every claim here is
> quoted from the reference. `react` probes at **19.2.8**. **No sandbox run, no build, no
> measurement.**

**Almost everyone meets `next/image` as the component that yells at them about `width` and `height`, decides the rule is bureaucratic, and reaches for `fill` to make the error go away. That is exactly backwards. The dimensions are not for the optimizer — the optimizer never needs them, it reads them off the file it is resizing. They are for the *browser*, which must reserve a box of the right aspect ratio before a single byte of image has arrived, or the text below the image jumps down when it lands. `next/image` is a layout-shift prevention component that happens to also resize images. Everything else on this page — priority, placeholders, formats — is optional. The sizing contract is not.**

## What the component actually renders

`<Image />` produces a plain `<img>` element. There is no wrapper `<div>` any more (that was removed in v13.0.0), no runtime layout engine, no measurement. What it adds is a generated `srcset` whose entries point at the built-in optimization endpoint, which defaults to the path `/_next/image`.

The reference publishes the generated markup for the simplest possible case, `<Image src="/profile.jpg" />`:

```html
<img
  srcset="
    /_next/image?url=%2Fprofile.jpg&w=640&q=75 1x,
    /_next/image?url=%2Fprofile.jpg&w=828&q=75 2x
  "
  src="/_next/image?url=%2Fprofile.jpg&w=828&q=75"
/>
```

Three things to read out of that, because they explain most later confusion:

1. **The optimizer is an HTTP endpoint on your own origin**, parameterised by `url`, `w` and `q`. It is not a build step for remote images. A request arrives, it fetches or reads the source, transcodes, caches to disk, and responds. That is a server doing image processing per unique `(url, w, q, Accept)` combination.
2. **`q=75` appears without you asking for it.** Quality defaults to 75.
3. 🔴 **Only two `srcset` candidates were generated — `1x` and `2x`.** That is the *no-`sizes`* code path, and it is the single most consequential default on this page. See below.

If you need the generated attributes without the component — for a `<picture>` element, a canvas, or a CSS `image-set()` — `getImageProps` from `next/image` hands you the same props object:

```tsx
import { getImageProps } from 'next/image';

export function CaptionedShot() {
  const { props } = getImageProps({
    src: '/board-screenshot.png',
    alt: 'The SprintDesk board in review',
    width: 1200,
    height: 800,
  });

  return (
    <figure>
      <img {...props} />
      <figcaption>The SprintDesk board in review</figcaption>
    </figure>
  );
}
```

## Why `width` and `height` are required

The reference is unusually blunt about the purpose:

> *"The `width` and `height` properties represent the intrinsic image size in pixels. This property is used to infer the correct **aspect ratio** used by browsers to reserve space for the image and avoid layout shift during loading. It does not determine the *rendered size* of the image, which is controlled by CSS."*

Two independent facts sit in that paragraph and people routinely merge them:

- The numbers are **intrinsic** dimensions — the shape of the source file. If your CSS renders that image at 300px wide, `width={1200}` is still correct.
- The numbers **do not size the image on the page**. CSS does. `width` and `height` become HTML attributes on the `<img>`, and modern browsers compute `aspect-ratio` from them, so the box is reserved at the right proportion before the bytes land.

That is the whole mechanism. There is no clever measurement pass; there is an attribute the browser has understood since it shipped aspect-ratio-from-attributes, and a component that refuses to let you forget it.

The escape hatches are enumerated, and there are exactly two:

> *"You **must** set both `width` and `height` properties unless: The image is statically imported. The image has the `fill` property."*
> *"If the height and width are unknown, we recommend using the `fill` property."*

**A static import already knows.** `import avatar from './avatar.png'` gives you an object carrying the real dimensions, extracted at build time from the file, so passing them again is redundant.

**A remote URL never knows**, and the reference says so plainly: *"Since Next.js does not have access to remote files during the build process, you'll need to provide the `width`, `height` and optional `blurDataURL` props manually."* This is the sentence people are actually fighting when they call the rule bureaucratic — the framework cannot invent the aspect ratio of a URL it has not fetched, and it will not fetch it at build time on your behalf.

```tsx
// Static import — dimensions come from the file. Do not re-declare them.
import Image from 'next/image';
import logo from '@/assets/sprintdesk-logo.png';

export function Logo() {
  return <Image src={logo} alt="SprintDesk" />;
}
```

```tsx
// Remote URL — you own the numbers, because the build never saw the file.
import Image from 'next/image';

export function TenantLogo({ url }: { url: string }) {
  return <Image src={url} alt="" width={160} height={40} />;
}
```

## `fill` is not "skip the rule" — it moves the rule to the parent

`fill` is *"a boolean that causes the image to expand to the size of the parent element."* You have not removed the sizing contract; you have delegated it. The parent must now have a size and a positioning context, and if it does not, the image collapses or escapes.

> *"The parent element **must** assign `position: "relative"`, `"fixed"`, `"absolute"`."*
> *"By default, the `<img>` element uses `position: "absolute"`."*
> *"If no styles are applied to the image, the image will stretch to fit the container."*

```tsx
import Image from 'next/image';

export function AttachmentThumb({ url, label }: { url: string; label: string }) {
  return (
    <div style={{ position: 'relative', width: 160, height: 120 }}>
      <Image
        src={url}
        alt={label}
        fill
        sizes="160px"
        style={{ objectFit: 'cover' }}
      />
    </div>
  );
}
```

`objectFit: 'contain'` scales down inside the box and preserves the aspect ratio; `'cover'` fills the box and crops. With neither, the image *stretches* — a distorted avatar is nearly always a `fill` with no `objectFit`.

🔴 **`fill` trades a known layout shift for an unknown one.** With `width`/`height`, the browser reserves the right box from the attributes. With `fill`, the browser reserves whatever the parent's CSS says — so if the parent is sized from content, or from a value that only resolves after a font loads, the shift comes back through the parent instead. The measurement side of that lives in [ch11 · Core Web Vitals tuning](../11-performance-optimization-turbopack/05-core-web-vitals-tuning-lcp-inp-cls-auditing-workflows.md); the font side in [03 · font optimization](03-font-optimization-with-next-font-zero-layout-shift.md).

## `sizes` — the prop that decides how many bytes ship

This is the highest-leverage prop on the component and the one most often absent. Its job is to tell the browser how wide the image will be *laid out* at each breakpoint, so the browser can pick the right `srcset` candidate. Without it the browser guesses, and its guess is the worst case:

> *"If `sizes` is missing, the browser assumes the image will be as wide as the viewport (`100vw`). This can cause unnecessarily large images to be downloaded."*

And it does not merely change the browser's choice — it changes what Next.js generates in the first place:

> *"In addition, `sizes` affects how `srcset` is generated: Without `sizes`: Next.js generates a limited `srcset` (e.g. 1x, 2x), suitable for fixed-size images. With `sizes`: Next.js generates a full `srcset` (e.g. 640w, 750w, etc.), optimized for responsive layouts."*

So there are two distinct code paths:

| | `srcset` generated | Browser's assumption | Correct for |
|---|---|---|---|
| **No `sizes`** | density descriptors — `1x`, `2x` | the CSS width you gave it | a fixed-size image (a 40px avatar, a 160px logo) |
| **With `sizes`** | width descriptors — `640w`, `750w`, … | your declared layout width | anything responsive, and **everything using `fill`** |

The reference names when to use it: *"`sizes` should be used when: The image is using the `fill` prop. CSS is used to make the image responsive."*

The candidate widths come from two configurable lists:

```js
// next.config.js — these are the documented defaults, shown for reference
module.exports = {
  images: {
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [32, 48, 64, 96, 128, 256, 384],
  },
};
```

> *"`imageSizes` is only used for images which provide a `sizes` prop, which indicates that the image is less than the full width of the screen. Therefore, the sizes in `imageSizes` should all be smaller than the smallest size in `deviceSizes`."*

That is the mechanism behind a very common waste: a 32px avatar with no `sizes` cannot be served from `imageSizes` at all, because `imageSizes` is only consulted when `sizes` is present. The smallest thing the device list offers is 640px wide.

```tsx
// A 32px avatar. `sizes` is what unlocks the 32/48/64 candidates.
<Image src={user.avatarUrl} alt="" width={32} height={32} sizes="32px" />
```

```tsx
// A responsive card image in a three-column grid.
<Image
  src={cover}
  alt=""
  fill
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
  style={{ objectFit: 'cover' }}
/>
```

Read `sizes` right to left: the last entry is the default, each earlier entry is a media query. It describes *layout width*, not file width — `33vw` means "this image occupies a third of the viewport", and the browser combines that with the device pixel ratio to choose a candidate.

## `quality`, and the allow-list that became mandatory in 16

`quality` is *"an integer between `1` and `100`"*, default 75. What changed in Next.js 16 is that the set of permitted values is now configuration:

> *"This field is required starting with Next.js 16 because unrestricted access could allow malicious actors to optimize more qualities than you intended."*

The default is `qualities: [75]` — a single value. Anything else has to be declared:

```js
// next.config.js
module.exports = {
  images: {
    qualities: [50, 75, 90],
  },
};
```

> *"If you've configured `qualities` in `next.config.js`, a value outside that list is coerced to the closest allowed entry. For example, with `qualities: [50, 75, 100]`, a `quality` of `80` is served as `75`. Development logs a warning so you can add the value to the allowlist."*
> *"If the REST API is visited directly with a quality that does not match a value in this array, the server will return a 400 Bad Request response."*

The reason is the same reason `remotePatterns` exists, covered in [04d](04d-remote-patterns-is-a-security-control.md): every free parameter on `/_next/image` is a dimension along which a stranger can multiply the work your server does and the disk your cache consumes. `q` was one of them until 16 closed it.

## `overrideSrc` — for migrations that must not lose image rankings

When you convert an existing site from `<img src="/profile.jpg">` to `<Image />`, the `src` attribute in the shipped HTML changes to an `/_next/image?...` URL. The reference gives the reason this matters and the escape:

> *"when upgrading an existing website from `<img>` to `<Image>`, you may wish to maintain the same `src` attribute for SEO purposes such as image ranking or avoiding recrawl."*

```tsx
<Image src="/profile.jpg" overrideSrc="/profile.jpg" width={400} height={400} alt="" />
```

The `srcset` still points at the optimizer, so modern browsers still get optimized bytes; only the fallback `src` keeps the stable URL.

## Gotchas

**★ Symptom: the page content jumps down after images load, even though every `<Image>` has `width` and `height`.** Cause: CSS is overriding one dimension without restoring the ratio — typically `width: 100%` with no `height`. The attributes reserve the aspect ratio, but a stylesheet that sets only one axis discards it. Fix: set `height: 'auto'` whenever you set width in CSS, which the reference states directly — *"If you're using the `style` prop to set a custom width, be sure to also set `height: 'auto'` to preserve the image's aspect ratio."*

```tsx
<Image src={cover} alt="" sizes="100vw" style={{ width: '100%', height: 'auto' }} />
```

**★ Symptom: a 40×40 avatar downloads a 640px-wide file.** Cause: no `sizes`, so Next.js generated only `1x`/`2x` density candidates from `deviceSizes`, and `imageSizes` — which is where 32, 48 and 64 live — was never consulted, because it is *"only used for images which provide a `sizes` prop"*. Fix: give small images an explicit pixel `sizes`.

```tsx
<Image src={url} alt="" width={40} height={40} sizes="40px" />
```

**★ Symptom: `fill` images render at zero height, or spill over the whole page.** Cause: the parent has no positioning context, so `position: absolute` on the `<img>` resolves against a further-out ancestor — or the parent has position but no height, so there is nothing to fill. Fix: the parent needs both a positioning value and a size.

```tsx
<div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9' }}>
  <Image src={url} alt="" fill sizes="100vw" style={{ objectFit: 'cover' }} />
</div>
```

**★ Symptom: avatars look squashed after switching to `fill`.** Cause: no `objectFit`. *"If no styles are applied to the image, the image will stretch to fit the container."* Fix: `style={{ objectFit: 'cover' }}` to crop, `'contain'` to letterbox.

**★ Symptom: a `quality={85}` prop silently produces the same bytes as `quality={75}`.** Cause: 85 is not in `qualities`, and out-of-list values are *"coerced to the closest allowed entry"*. The dev server logs a warning; production does not surface it in the page. Fix: add the value to the allow-list, or stop passing a value that is not there.

**Symptom: hitting `/_next/image?...&q=88` directly returns 400.** Cause: same allow-list, enforced at the endpoint — *"the server will return a 400 Bad Request response."* This is the control working; it is what stops a stranger generating an unbounded number of cache entries by walking `q` from 1 to 100.

**Symptom: `width`/`height` passed alongside a static import, and the two disagree.** Cause: the import already carries the intrinsic size; explicit props override it and can therefore declare a wrong aspect ratio, reintroducing the exact layout shift the props exist to prevent. Fix: pass nothing, or pass numbers that match the file.

**Symptom: search traffic to images drops after migrating to `next/image`.** Cause: every image's `src` attribute changed to an `/_next/image` URL, so crawled image URLs 404 or need recrawling. Fix: `overrideSrc` on the migrated images to keep the original path in the `src` attribute.

**Symptom: `srcSet` passed as a prop is ignored.** Cause: the reference lists it as the one prop not forwarded to the underlying element — *"`srcSet`: Use Device Sizes instead."* Fix: configure `deviceSizes`/`imageSizes`, or drop to `getImageProps` and a hand-written `<picture>`.

**Symptom: `sizes` is set to the image's *file* width rather than its layout width.** Cause: reading `sizes` as "how big is this image" instead of "how much of the viewport does this occupy". A `sizes="1200px"` on an image laid out at 300px asks the browser for the largest candidate at every viewport. Fix: describe the CSS box — `sizes="300px"`, or a media-query list for responsive layouts.

## Interview questions

**★ Why does `next/image` require `width` and `height` when the optimizer could just read them from the file?**
Because the numbers are not for the optimizer, they are for the browser. The optimizer runs on the server, after the HTML has already been sent; by the time it knows the intrinsic size, the browser has long since laid out the page. The attributes exist so the browser can compute an aspect ratio and reserve a correctly-shaped box *before* any image bytes arrive. That is why a static import is exempt — the build read the file, so the numbers are already known — and why a remote URL is not: Next.js never fetched it at build time and cannot invent its shape.

**★ What actually changes when you add `sizes`?**
Two things, on two different machines. On the server, Next.js switches from generating a small density-descriptor `srcset` (`1x`, `2x`) to a full width-descriptor one (`640w`, `750w`, …), and starts drawing candidates from `imageSizes` as well as `deviceSizes`. In the browser, the default assumption changes from "this image is `100vw`" to whatever you declared, which is what lets it pick a small candidate. Omitting `sizes` on a responsive image is therefore a double loss: the small candidates were never generated, and the browser would not have chosen them anyway.

**★ Is `fill` a way to avoid the sizing rule?**
No — it relocates it. `fill` makes the image `position: absolute` inside the nearest positioned ancestor, so the layout box is now entirely the parent's responsibility. If the parent has an intrinsic or declared size, you have the same guarantee. If the parent is sized by its content, or by something that resolves late, you have reintroduced layout shift through a path that is harder to see. Use `fill` when the aspect ratio genuinely is not knowable up front — user-uploaded attachments, a background — and give the parent an explicit `aspect-ratio` or height when you do.

**★ You are reviewing a PR that adds `<Image src={url} alt="" fill />` inside a card. What do you ask for?**
Three things. A `sizes` value, because `fill` without it means the browser assumes `100vw` and downloads the largest candidate for a card that is a third of the screen. An `objectFit`, because the default is to stretch. And a positioned, sized parent, because `fill` alone will either collapse to nothing or escape to the nearest positioned ancestor. All three are documented requirements of `fill`, and all three fail silently in a way that looks like "the image is a bit wrong" rather than an error.

**Why did `qualities` become required in Next.js 16?**
Because `q` is an attacker-controllable parameter on a public endpoint that does CPU-bound work and writes to disk. Before 16, any value from 1 to 100 was accepted, so a stranger could request the same image a hundred times at a hundred qualities and get a hundred transcodes and a hundred cache entries. Restricting it to a declared allow-list — default `[75]` — bounds the cardinality of the cache key. The reference gives exactly that reason: *"unrestricted access could allow malicious actors to optimize more qualities than you intended."*

**What does `next/image` render, and what does it not render any more?**
It renders a single `<img>` with a generated `srcset` and `src` pointing at `/_next/image`, plus whatever loading, decoding and placeholder attributes you configured. It does not render a wrapper element — the `<span>` wrapper was removed in v13.0.0 along with `layout`, `objectFit`, `objectPosition`, `lazyBoundary` and `lazyRoot` as props. Styling is ordinary CSS on an ordinary `<img>`; positioning for `fill` is the parent's job.

**When would you use `getImageProps` instead of the component?**
When you need the generated `srcset` somewhere the component cannot go: a `<picture>` element for art direction with different sources per media query, a CSS `image-set()` background, or a `<figure>` where you want to control the element yourself. The reference notes it also avoids a `useState()` call — but it comes with a hard limitation: *"it cannot be used with the `placeholder` prop because the placeholder will never be removed."*

---

← [03 · Font optimization](03-font-optimization-with-next-font-zero-layout-shift.md) · [Chapter index](01-explanation.md) · Next → [04b · Loading priority](04b-loading-priority-preload-eager-fetchpriority.md)
