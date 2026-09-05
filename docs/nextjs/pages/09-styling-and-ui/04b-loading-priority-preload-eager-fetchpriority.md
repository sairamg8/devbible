---
title: "The `priority` prop your syllabus names was deprecated in Next.js 16 — and its replacement, `preload`, is a prop the documentation tells you not to reach for first"
sidebar_label: "04b · Loading priority"
sidebar_position: 12
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js Image component API reference
> ([nextjs.org/docs/app/api-reference/components/image](https://nextjs.org/docs/app/api-reference/components/image)),
> `#preload`, `#priority`, `#loading` and the Version History table (page header declares
> `version: 16.3.4`, `lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4 · React 19.2.8 · Node 20.9 floor**.
> 🔴 `next` is **not installed in this checkout**, so **no T1 probe was possible** — the
> deprecation below is quoted, not observed. **No sandbox run, no Lighthouse, no timings.**

**Every tutorial written before late 2026, and the chapter syllabus line this page answers to, tells you to put `priority` on your hero image. The Next.js 16 reference records that `priority` was deprecated in `v16.0.0` in favour of `preload`. That is not a rename with a codemod attached — it is the framework admitting that one boolean called "priority" was doing three separable things (turn off lazy loading, emit a preload link, raise fetch priority) and that most people wanted only one of them. The reference then goes further and says that in most cases you should use neither: `loading="eager"` or `fetchPriority="high"` is the right tool. This page is about which of those four levers actually applies, and about the failure mode that survives every rename — marking everything urgent, which is arithmetically identical to marking nothing.**

## The deprecation, verbatim

> *"Starting with Next.js 16, the `priority` property has been deprecated in favor of the `preload` property in order to make the behavior clear."*

And from the Version History table, the `v16.0.0` row:

> *"`qualities` default configuration changed to `[75]`, `preload` prop added, `priority` prop deprecated, `dangerouslyAllowLocalIP` config added, `maximumRedirects` config added."*

⚠ **Deprecated: `priority`.** Successor: `preload`, or — more often — `loading="eager"` / `fetchPriority="high"`. The reference does not state whether `priority` still functions on 16.3.4 or merely warns; **it says only that it is deprecated, and I could not confirm the runtime behaviour without an installed package.** Treat it as working-but-on-notice and migrate deliberately rather than assuming either outcome.

The phrase *"in order to make the behavior clear"* is the whole argument. `priority` was a single boolean that changed **loading strategy** and **resource hints** at once, and the two are not the same decision.

## The four levers, and what each one does

| Prop | What it changes | Default |
|---|---|---|
| `loading` | when the browser *starts* fetching — `lazy` defers until near the viewport, `eager` fetches immediately | `lazy` |
| `preload` | whether a `<link>` is inserted in the `<head>` so the fetch starts before the `<img>` is parsed | `false` |
| `fetchPriority` | the browser's *relative* priority for a fetch that is already happening | browser default |
| `decoding` | whether decode blocks presentation of other content — `async`, `sync`, `auto` | `async` |

`loading`, verbatim:

> *"`lazy`: Defer loading the image until it reaches a calculated distance from the viewport. `eager`: Load the image immediately, regardless of its position in the page."*
> *"Use `eager` only when you want to ensure the image is loaded immediately."*

`preload`, verbatim:

> *"A boolean that indicates if the image should be preloaded."*
> *"`true`: Preloads the image by inserting a `<link>` in the `<head>`. `false`: Does not preload the image."*

Note what the documentation does **not** say: it does not enumerate the attributes on that `<link>`, and it does not say `preload` implies `loading="eager"`. I could not confirm either from the reference, so this page does not assert them.

## `preload` — what it does mechanically

An `<img>` deep in the `<body>` is discovered by the preload scanner when the parser reaches it. On a streamed RSC response with a large layout above the fold, that can be meaningfully late. A `<link>` in the `<head>` is discovered on the first chunk of HTML, so the connection opens and the bytes start moving while the rest of the document is still arriving. That is the entire benefit: **discovery time, not bandwidth priority.**

The reference gives the applicability rule as two explicit lists.

**Use it when:**

> *"The image is the Largest Contentful Paint (LCP) element. The image is above the fold, typically the hero image. You want to begin loading the image in the `<head>`, before its discovered later in the `<body>`."*

**Do not use it when:**

> *"When you have multiple images that could be considered the Largest Contentful Paint (LCP) element depending on the viewport. When the `loading` property is used. When the `fetchPriority` property is used."*

And then, load-bearing:

> 🔴 *"In most cases, you should use `loading="eager"` or `fetchPriority="high"` instead of `preload`."*

Read the two lists together and the rule falls out. **`preload` is for the one image you are certain is the LCP element at every viewport.** The moment there is more than one candidate — a desktop hero and a mobile hero, an art-directed pair, a carousel — you cannot know which one to preload, and preloading both means the browser fetches an image it will never paint, on the critical path, competing with the one it will.

```tsx
// The one hero. Known LCP element, same image at every viewport.
import Image from 'next/image';
import hero from '@/assets/board-hero.png';

export default function Landing() {
  return (
    <section>
      <Image src={hero} alt="" preload sizes="100vw" style={{ width: '100%', height: 'auto' }} />
      <h1>Ship the sprint, not the status meeting</h1>
    </section>
  );
}
```

```tsx
// Above the fold, but not the LCP element and not viewport-invariant.
// `eager` removes the lazy delay without adding a head-of-document fetch.
<Image src={url} alt="" width={64} height={64} sizes="64px" loading="eager" />
```

```tsx
// Two candidates depending on the viewport — `preload` is wrong here by the
// documentation's own rule. Raise priority on a fetch that is already happening.
<Image src={url} alt="" fill sizes="(max-width: 768px) 100vw, 50vw" fetchPriority="high" />
```

`fetchPriority` is not a Next.js prop; it is a standard `<img>` attribute, and the reference's "Other Props" rule is that everything except `srcSet` is forwarded to the underlying element. That is why it works and why it is not documented as a Next.js prop.

## The rule for which images get the treatment, stated as a procedure

1. **Is it below the fold?** Leave it alone. `lazy` is the default and it is correct.
2. **Is it above the fold but not the largest painted element** — an avatar row, a nav logo, an icon? `loading="eager"` at most. It removes the intersection-observer delay without claiming bandwidth.
3. **Is it the LCP element, and the *same* element at every viewport?** `preload`.
4. **Is it the LCP element at some viewports and not others?** `fetchPriority="high"`, not `preload`. You cannot preload a conditional.
5. **Is it a theme-swapped pair, an art-directed pair, or a carousel?** `fetchPriority="high"` on the one most likely to win, and nothing on the others — the reference's own theme-detection example spells this out:

> *"The default behavior of `loading="lazy"` ensures that only the correct image is loaded. You cannot use `preload` or `loading="eager"` because that would cause both images to load. Instead, you can use `fetchPriority="high"`."*

That last quote is the clearest statement in the whole reference of why the old single `priority` boolean was a bad abstraction. A light/dark image pair needs *higher priority* and *lazy loading at the same time* — a combination `priority` could not express.

## 🔴 Marking everything urgent is identical to marking nothing

Priority is a **relative ordering over a fixed pipe**. If ten images preload, the browser opens ten fetches on the critical path against the same connection budget it had before, and the hero now competes with nine images the user may never scroll to. You have not made the hero faster; you have made it slower, and you have also disabled lazy loading on nine images that did not need loading at all.

The tell in a codebase is mechanical:

```bash
# More than one or two hits per route is the smell.
grep -rn "preload" app/ components/
grep -rn "priority" app/ components/   # the deprecated form, still in older code
```

The correct end state for a typical page is **zero or one** preloaded image. A dashboard route with no above-the-fold photography — SprintDesk's board view, for instance — should have zero.

## Where the measurement lives

This page owns the mechanism: which attribute changes which browser behaviour, and the rule for choosing. **It does not own LCP, its thresholds, or how to attribute a regression to an image.** That is [ch11 · Core Web Vitals tuning (LCP, INP, CLS)](../11-performance-optimization-turbopack/05-core-web-vitals-tuning-lcp-inp-cls-auditing-workflows.md). The division matters in practice: you cannot decide which image gets `preload` from the source alone, because "is it the LCP element" is an observation about real viewports, not a property of the JSX. Pick the candidate here; confirm it there.

## Gotchas

**★ Symptom: a codemod or upgrade guide told you to rename `priority` to `preload`, and LCP got worse.** Cause: they are not equivalent for every image. `priority` also disabled lazy loading; `preload` is documented only as inserting a `<link>` in the `<head>`. And a blanket rename preserves the original mistake of marking many images urgent. Fix: audit each site individually against the five-step procedure above, and expect most of them to become `loading="eager"` or nothing at all.

**★ Symptom: `preload` on both the light and dark variants of a themed image, and both download.** Cause: the CSS hides one, but a `<link rel=preload>` in the head is not gated by `prefers-color-scheme` — the fetch happens regardless. The reference states this outright for its own theme-detection example. Fix: leave both lazy and use `fetchPriority="high"`.

```tsx
<Image {...rest} src={srcLight} className={styles.imgLight} fetchPriority="high" />
<Image {...rest} src={srcDark} className={styles.imgDark} fetchPriority="high" />
```

**★ Symptom: every above-the-fold image has `preload`, and the hero paints later than it did before.** Cause: preload is a relative ordering, so preloading N images buys the hero nothing while forcing N−1 fetches onto the critical path. Fix: exactly one preloaded image per route, or zero.

**★ Symptom: `preload` and `loading="lazy"` on the same image.** Cause: two props that express contradictory intentions — start the fetch as early as possible, and defer the fetch. The reference lists *"When the `loading` property is used"* under **when not to use** `preload`. Fix: pick one. Early fetch → drop `loading`. Deferred fetch with higher priority → drop `preload`, add `fetchPriority="high"`.

**★ Symptom: a carousel preloads slide 1, and the LCP element is slide 1 on desktop but the headline on mobile.** Cause: the LCP element is viewport-dependent, which is the documented "do not use `preload`" case. Fix: `fetchPriority="high"` on the first slide, `loading="lazy"` (the default) on the rest, and verify per-viewport in ch11's workflow rather than assuming.

**Symptom: images below the fold still download immediately.** Cause: something set `loading="eager"` globally — a shared wrapper component, or a spread of default props. Fix: make the wrapper's default `lazy` and require callers to opt in explicitly.

```tsx
type Props = React.ComponentProps<typeof Image>;
export function AppImage({ loading = 'lazy', ...rest }: Props) {
  return <Image loading={loading} {...rest} />;
}
```

**Symptom: `fetchPriority` is rejected by TypeScript on an `<Image>`.** Cause: it is not a Next.js prop; it arrives through the "all other props are forwarded to the underlying `img`" rule, so its type comes from React's `ImgHTMLAttributes`. If your React types predate it, it will not typecheck. Fix: on **React 19.2.8** it is present; if you hit this, the React types are stale, not the Next.js ones.

**Symptom: a lazy image shows a grey border while loading in Safari.** Cause: a documented browser bug — *"Safari 15 - 16.3 display a gray border while loading"*, fixed in Safari 16.4. Fix: the reference offers a CSS workaround or `loading="eager"` for above-the-fold images:

```css
@supports (font: -apple-system-body) and (-webkit-appearance: none) {
  img[loading='lazy'] { clip-path: inset(0.6px); }
}
```

**Symptom: nothing you change to `preload` makes any difference on a route with no images above the fold.** Cause: the LCP element is text or a font-dependent heading, not an image. Fix: stop tuning images and go to [03 · font optimization](03-font-optimization-with-next-font-zero-layout-shift.md) and ch11.

## Interview questions

**★ `priority` is deprecated in Next.js 16. What replaced it, and why was one prop split up?**
`preload` replaced it, and the reference gives the reason as *"in order to make the behavior clear"*. The old boolean conflated a loading strategy (do not lazy-load this) with a resource hint (tell the browser about it early), and those are independent decisions. The clearest proof is the light/dark image pair: it wants lazy loading, so only one variant is fetched, *and* elevated priority for whichever one wins. `priority` could not express that; `loading="lazy"` plus `fetchPriority="high"` can.

**★ The documentation introduces `preload` and then says most people should not use it. Reconcile that.**
`preload` solves one narrow problem — the LCP image is discovered late because it sits below a lot of markup, so a `<link>` in the `<head>` starts the fetch sooner. That problem only exists when you can identify a single, viewport-invariant LCP element. Everywhere else, either the image just needs to skip the lazy delay (`loading="eager"`) or it needs to win a race against other in-flight fetches (`fetchPriority="high"`), and both of those are cheaper and safer than putting a speculative fetch at the top of the document. Hence *"In most cases, you should use `loading="eager"` or `fetchPriority="high"` instead of `preload"`*.

**★ Why is marking every above-the-fold image as high priority the same as marking none?**
Because priority is an ordering, not a resource. The browser has the same connections and the same bandwidth either way; all you control is which fetch goes first. If everything is first, the relative order is whatever it would have been anyway — except you have now also disabled lazy loading on images the user may never reach, so you have added real work to the critical path. The net effect of "prioritise everything" is strictly worse than the default, which is the part people find counter-intuitive.

**★ How do you decide, in a code review, whether an image should be preloaded?**
You cannot decide it from the diff, and that is the honest answer. "Is this the LCP element" is an observation about rendered viewports; the JSX only tells you the image is above the fold. What a reviewer can enforce is the negative rule set: no `preload` if the route already has one, no `preload` alongside `loading`, no `preload` on a themed or art-directed pair, no `preload` below the fold. Then the positive case gets confirmed with the measurement workflow in ch11 rather than asserted.

**What is the difference between `loading="eager"` and `preload`?**
`loading="eager"` says: when the parser reaches this `<img>`, fetch it immediately instead of waiting for it to approach the viewport. `preload` says: put a `<link>` in the `<head>` so the fetch begins before the parser ever reaches the `<img>`. The first removes a *deferral*; the second removes a *discovery delay*. On a short document they are nearly the same; on a long streamed document with the hero halfway down the markup, only the second helps. The reference does not state that `preload` implies `eager`, so do not assume it does.

**What does `decoding` change, and when would you touch it?**
It is a hint about whether the browser may present other content before this image finishes decoding. The default `async` lets the rest of the page update while decoding proceeds; `sync` asks for atomic presentation with surrounding content. It is not a loading-priority control and it does not affect network scheduling. In practice you leave it alone; the case for `sync` is a small image that must appear in the same frame as adjacent text, and even then the win is a paint-flicker, not a metric.

**Why is `fetchPriority` not listed among the Image component's props?**
Because it is a standard HTML attribute, and the component forwards every unrecognised prop to the underlying `<img>` — with one exception, `srcSet`, which is deliberately intercepted in favour of `deviceSizes`. So `fetchPriority`, `crossOrigin`, `referrerPolicy` and friends all work by pass-through. It also means their behaviour is the browser's, documented on MDN, not something Next.js can change.

---

← [04 · next/image sizing](04-next-image-priority-blur-placeholders-remote-patterns-avif-w.md) · [Chapter index](01-explanation.md) · Next → [04c · Blur placeholders](04c-blur-placeholders-where-the-bytes-come-from.md)
