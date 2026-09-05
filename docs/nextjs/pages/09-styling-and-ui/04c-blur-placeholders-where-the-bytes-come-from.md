---
title: "A blur placeholder is a base64 image inlined into your HTML, and the only question that matters is who produced those bytes — the build did it for you on a static import, and nobody will do it for a remote URL"
sidebar_label: "04c · Blur placeholders"
sidebar_position: 13
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js Image component API reference
> ([nextjs.org/docs/app/api-reference/components/image](https://nextjs.org/docs/app/api-reference/components/image)),
> sections `#placeholder`, `#blurdataurl`, `#getimageprops` and *Known browser bugs*
> (page header declares `version: 16.3.4`, `lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4 · React 19.2.8 · Node 20.9 floor**.
> 🔴 `next` is **not installed in this checkout** — no T1 probe was possible. Every claim is
> quoted from the reference. **No sandbox run; no byte counts were measured.**

**`placeholder="blur"` looks like a feature you switch on. It is not — it is a promise that a data URL exists, and the component will not manufacture one. There are exactly two ways that data URL comes into being: the build extracted it from a file it could read, or you produced it yourself and passed it in. Static imports get it free; remote URLs never do, and the `placeholder="blur"` you added to a remote image is either failing silently or crashing, depending on how you wrote it. Everything else about placeholders — the shimmer trick, the solid-colour trick, the Safari fallback — is a variation on that single fact.**

## The three placeholder modes

> *"`empty`: No placeholder while the image is loading. `blur`: Use a blurred version of the image as a placeholder. Must be used with the `blurDataURL` property. `data:image/...`: Uses the Data URL as the placeholder."*

Default is `empty`. Note the third mode: `placeholder` itself accepts a data URL directly, which is how the shimmer and solid-colour patterns work without touching `blurDataURL` at all.

```tsx
<Image placeholder="empty" src={url} alt="" width={400} height={300} />
<Image placeholder="blur" blurDataURL={tiny} src={url} alt="" width={400} height={300} />
<Image placeholder="data:image/svg+xml;base64,PHN2ZyB4bWxucz0i…" src={url} alt="" width={400} height={300} />
```

The mechanism is the same in all three: the component renders a background on the `<img>` from the supplied data URL and removes it once the real image loads. Because it is a data URL, **the placeholder's bytes are inside your HTML**, not a separate request. That is the point — a placeholder that required a network round trip would be no better than the image.

## Where `blurDataURL` comes from — the two cases

> *"A Data URL to be used as a placeholder image before the image successfully loads. Can be automatically set or used with the `placeholder="blur"` property."*
> *"The image is automatically enlarged and blurred, so a very small image (10px or less) is recommended."*

That second sentence explains why this is cheap at all. You are not shipping a small version of the image; you are shipping something on the order of ten pixels across, and CSS blurs it up to fill the box. The eye reads a colour field, which is all a placeholder needs to be.

### Case 1 — a static import: the build does it

> *"If `src` is a static import of a `jpg`, `png`, `webp`, or `avif` file, `blurDataURL` is added automatically—unless the image is animated."*

Three constraints hide in that one sentence, and each one is a real failure someone has debugged:

- **It must be a static import**, not a string path. `src="/hero.png"` is a string; `import hero from './hero.png'` is an object with dimensions and a `blurDataURL` attached.
- **The format must be `jpg`, `png`, `webp` or `avif`.** A statically imported SVG or GIF is outside the list.
- **Animated images are excluded** even in a listed format — an animated WebP gets no automatic `blurDataURL`.

```tsx
import Image from 'next/image';
import hero from '@/assets/board-hero.png';

// blurDataURL is already on `hero`. Turning on the placeholder is the whole change.
export function Hero() {
  return <Image src={hero} alt="" placeholder="blur" sizes="100vw" style={{ width: '100%', height: 'auto' }} />;
}
```

### Case 2 — a remote or dynamic URL: nobody does it

> *"If the image is dynamic or remote, you must provide `blurDataURL` yourself. To generate one, you can use: A online tool like png-pixel.com. A library like Plaiceholder."*

There is no build-time fetch, no lazy generation, no optimizer round trip that produces one. The reference's remote-images example says the same thing from the other direction: *"you'll need to provide the `width`, `height` and optional `blurDataURL` props manually."*

**The architectural consequence is that placeholder generation belongs to your upload pipeline, not your render path.** For an application with user-uploaded images — SprintDesk's avatars and ticket attachments — the moment to compute the tiny data URL is when the file is accepted, and the place to keep it is the same row as the file's URL, width and height.

```ts
// db/schema.ts — the columns an uploaded image needs in order to be renderable
// without layout shift and with a placeholder. All four are produced at upload time.
export const attachments = pgTable('attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  url: text('url').notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  blurDataUrl: text('blur_data_url'), // nullable: SVGs and animated files have none
});
```

```tsx
// components/attachment-image.tsx — a Server Component; every value is already in the row.
import Image from 'next/image';

type Attachment = {
  url: string;
  width: number;
  height: number;
  blurDataUrl: string | null;
};

export function AttachmentImage({ file, alt }: { file: Attachment; alt: string }) {
  return (
    <Image
      src={file.url}
      alt={alt}
      width={file.width}
      height={file.height}
      sizes="(max-width: 768px) 100vw, 480px"
      placeholder={file.blurDataUrl ? 'blur' : 'empty'}
      blurDataURL={file.blurDataUrl ?? undefined}
    />
  );
}
```

🔴 **That conditional is the load-bearing line.** `placeholder="blur"` with no `blurDataURL` is a broken state — the reference says blur *"Must be used with the `blurDataURL` property"* — so the component must derive the mode from whether the value exists, never assume it.

## The size budget nobody sets

> *"A large blurDataURL may hurt performance. Keep it small and simple."*

Because the data URL is inlined, it is paid for in **every HTML document that renders that image**, uncompressed by any image CDN, and re-sent on every uncached navigation. A list of forty ticket attachments with generous placeholders inlines forty data URLs into one response.

The docs recommend a source *"10px or less"* and give no byte figure; **I did not measure one and will not invent one.** What you can do is make the budget explicit and enforce it where the value is produced:

```ts
// lib/uploads.ts — reject an oversized placeholder at the point it is created,
// not at the point a page gets slow.
const MAX_BLUR_DATA_URL_CHARS = 1200;

export function assertPlaceholderBudget(blurDataUrl: string): string {
  if (blurDataUrl.length > MAX_BLUR_DATA_URL_CHARS) {
    throw new Error(
      `blurDataURL is ${blurDataUrl.length} chars; budget is ${MAX_BLUR_DATA_URL_CHARS}. ` +
        'Generate it from a smaller source (10px or less).',
    );
  }
  return blurDataUrl;
}
```

Pick the constant deliberately for your own payload; the number above is a starting budget, not a measured threshold.

## The two placeholders that are not blurs

Because `placeholder` accepts a raw data URL, two patterns exist that need no per-image generation at all — the reference links demos of both (*"Shimmer effect with data URL `placeholder` prop"*, *"Color effect with `blurDataURL` prop"*).

**A solid colour** is the cheapest possible placeholder and is often better than a blur for UI chrome — avatars, logos, icons — where a blurred thumbnail reads as a smudge rather than a hint.

```tsx
// A 1×1 PNG of your surface colour, reused for every avatar. One constant, no pipeline.
const AVATAR_PLACEHOLDER =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

export function Avatar({ url, name }: { url: string; name: string }) {
  return (
    <Image
      src={url}
      alt={name}
      width={40}
      height={40}
      sizes="40px"
      placeholder="blur"
      blurDataURL={AVATAR_PLACEHOLDER}
    />
  );
}
```

**A shimmer** is an inline SVG data URL with an animated gradient. It is a *skeleton*, not a preview of the image — appropriate when you want to signal "loading" rather than "here is roughly what is coming".

## What `getImageProps` cannot do

> *"This also avoid calling React `useState()` so it can lead to better performance, but it cannot be used with the `placeholder` prop because the placeholder will never be removed."*

That sentence also tells you how the component works internally: **removing the placeholder is client state.** The `<img>` renders with the placeholder background, an `onLoad` fires, state flips, the background is dropped. `getImageProps` hands you a static props object with no component around it, so nothing ever flips the state — the placeholder would stay forever, behind a fully-loaded image.

The practical consequence: art direction with `<picture>`, background `image-set()`, and canvas rendering are all mutually exclusive with placeholders. Pick one.

## Browser reality

> *"When using the blur-up placeholder, older browsers before Safari 12 will fallback to empty placeholder."*
> *"Firefox 67+ displays a white background while loading."* — for which the reference's suggested fixes are enabling AVIF `formats` or using `placeholder`.

The Firefox note is worth reading twice: a placeholder is not only a perceived-performance nicety, it is the fix for a browser painting a white box where your dark-themed card should be.

## Gotchas

**★ Symptom: `placeholder="blur"` on a remote image and the build fails, or the placeholder never appears.** Cause: no `blurDataURL`. The reference is explicit that blur *"Must be used with the `blurDataURL` property"* and that for remote or dynamic images *"you must provide `blurDataURL` yourself"*. Nothing generates it at request time. Fix: produce it at upload time and store it; render `placeholder` conditionally.

```tsx
placeholder={file.blurDataUrl ? 'blur' : 'empty'}
blurDataURL={file.blurDataUrl ?? undefined}
```

**★ Symptom: `blurDataURL` is missing on a statically imported image.** Cause: one of the three documented exclusions — it is not a `jpg`/`png`/`webp`/`avif`, or it is animated, or the "static import" is actually a string path. Fix: check which. A string path is the usual culprit and is invisible in review because both spellings typecheck.

```tsx
import hero from '@/assets/hero.png';   // object: has width, height, blurDataURL
<Image src={hero} placeholder="blur" alt="" />

<Image src="/hero.png" placeholder="blur" alt="" />  {/* string: no blurDataURL exists */}
```

**★ Symptom: HTML responses grow noticeably after adding placeholders to a list view.** Cause: every data URL is inlined into the document, once per image, and a list of N attachments inlines N of them. Fix: budget the placeholder size where it is generated, and consider a single shared solid-colour constant for uniform UI images instead of a per-image blur.

**★ Symptom: a blurred avatar looks like a smudge and reviewers call it a bug.** Cause: a blur-up preview is designed for photographic content at size; at 40px it conveys nothing and reads as a rendering fault. Fix: use a solid colour matched to the surface for small UI images, and reserve blur for content images.

**★ Symptom: switching to `getImageProps` for a `<picture>` element leaves the placeholder permanently on screen.** Cause: the placeholder is removed by client state driven by the component's load handler, and `getImageProps` returns props with no component to hold that state — the reference states it *"cannot be used with the `placeholder` prop because the placeholder will never be removed."* Fix: drop the placeholder for that image, or keep the component and give up the `<picture>`.

**Symptom: the placeholder shows the wrong aspect ratio and snaps when the image lands.** Cause: the placeholder fills the box the sizing contract reserved, so a wrong `width`/`height` shows up as a mis-shaped blur first and a jump second. Fix: this is a sizing bug surfacing early — see [04 · the sizing contract](04-next-image-priority-blur-placeholders-remote-patterns-avif-w.md), not a placeholder bug.

**Symptom: `blurDataURL` values were generated once and are now stale after images were re-uploaded in place.** Cause: the URL stayed the same, the bytes changed, and the stored placeholder was not regenerated — so the blur previews the previous image. Fix: regenerate the placeholder in the same transaction that replaces the file, or version the URL so a replacement is a new row.

**Symptom: an SVG avatar has a null placeholder and the conditional renders `placeholder="empty"`, which reviewers flag as inconsistent.** Cause: SVG is genuinely outside the automatic set, and it is also the format you should be serving `unoptimized` anyway — see [04f · When not to optimize](04f-when-not-to-use-the-optimizer.md). Fix: it is not an inconsistency; give vector images the shared solid-colour placeholder if you want visual uniformity.

**Symptom: no placeholder appears in an old Safari during QA on a legacy device.** Cause: documented — *"older browsers before Safari 12 will fallback to empty placeholder."* Fix: nothing to fix. It degrades to `empty`, which is the pre-placeholder behaviour.

## Interview questions

**★ Where does the blur placeholder image actually come from?**
From one of two places, and the distinction is the whole topic. For a static import of a `jpg`, `png`, `webp` or `avif` that is not animated, the build reads the file and attaches a `blurDataURL` to the imported object automatically. For anything remote or dynamic, nothing produces one — you generate it yourself and pass it in. There is no third path: the optimizer does not create placeholders at request time, and the component does not fetch the image to make one.

**★ Why is `placeholder="blur"` on a remote image a bug rather than a no-op?**
Because blur is documented as requiring `blurDataURL`, so you are declaring a contract you have not satisfied. Depending on how the code is written you get a build-time failure or an image that renders with no placeholder at all — and the second is worse, because the code says one thing, the page does another, and nobody notices until someone on a slow connection reports a flash of empty box. The correct shape is a conditional: derive `placeholder` from whether the data URL exists.

**★ What is the cost of a blur placeholder, and where is it paid?**
It is paid in HTML bytes, on every render of the page containing the image, by every visitor, uncached and uncompressed by the image pipeline. A data URL is not a separate request — that is the feature — but it is also not free, and it scales with the number of images on the page rather than with the number the user actually sees. The mitigation is to keep the source tiny (the docs say 10px or less) and to prefer one shared constant over per-image blurs where the images are small UI chrome.

**★ Why can't `getImageProps` be used with a placeholder?**
Because removing the placeholder requires client state. The component renders the placeholder as a background, waits for the load event on the underlying `<img>`, and then clears it. `getImageProps` deliberately returns a plain props object and avoids `useState`, which is part of why it is cheaper — but it also means there is nothing to observe the load and nothing to clear the background, so the placeholder would remain behind the loaded image forever. The documentation says exactly this, and it is a useful window into how the component is built.

**Your product has user-uploaded avatars and attachments. Where in the system does placeholder generation belong?**
In the upload pipeline, alongside the code that already has the file bytes in hand. At that moment you can extract width, height and a tiny placeholder in one pass and persist all three next to the URL. Doing it later means fetching the image again from a server render, which is a network round trip on the critical path for something that is meant to make loading feel faster. It also means the render path can be a pure Server Component reading a row, with nothing async or conditional about it.

**When is a solid-colour placeholder better than a blur?**
Whenever the image is small or non-photographic. At 40px an avatar blur is a smudge; a colour matched to the card surface reads as an intentional empty state. It also removes an entire per-image pipeline: one constant serves every avatar, so there is no storage column, no regeneration on replacement, and no per-image HTML cost that varies with content. Blur earns its complexity on large content images where the preview genuinely resembles what arrives.

**What does the Firefox note in "Known browser bugs" tell you about placeholders?**
That they are not purely cosmetic. Firefox 67+ paints a white background while an image loads, which on a dark surface is a visible flash that looks like a rendering fault. The reference lists using `placeholder` as one of the two fixes. So on a dark-themed application, a placeholder is closer to a correctness fix than to a perceived-performance nicety.

---

← [04b · Loading priority](04b-loading-priority-preload-eager-fetchpriority.md) · [Chapter index](01-explanation.md) · Next → [04d · remotePatterns](04d-remote-patterns-is-a-security-control.md)
