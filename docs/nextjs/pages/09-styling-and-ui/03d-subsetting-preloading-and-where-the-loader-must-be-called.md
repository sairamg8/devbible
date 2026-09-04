---
title: "Where you call the font loader decides which routes preload it, subsets decides what gets a preload tag at all, and both are build-time facts — which is why the call belongs at module scope and nowhere else"
sidebar_label: "03d · Subsetting and preload scope"
sidebar_position: 18
description: "The subsets warning, the preload default, the page/layout/root-layout preload scoping rule, and the documented evidence for calling the loader at module scope."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against **Next.js 16.3.4** documentation — [Font Module reference](https://nextjs.org/docs/app/api-reference/components/font) (doc `version: 16.3.4`, `lastUpdated: 2025-08-06`) and [Font Optimization](https://nextjs.org/docs/app/getting-started/fonts) (`lastUpdated: 2026-05-27`). Both URLs resolved.
> Version spine: **Next.js 16.3.4** · React 19.2.8 · Node 20.9 floor. `next` is **not installed in this checkout** — nothing here is probed, and where the documentation is silent this page says so. **No sandbox run**; no byte counts, no timings.

**Two options and one placement decision determine when the font actually reaches the browser, and all three are resolved at build time. `subsets` decides whether a preload tag is emitted; `preload` decides whether that happens at all; and the *file* you called the loader in decides which routes carry the tag. That last one is the rule people never read: a font declared in a leaf page is preloaded on exactly that route, and a font declared in the root layout is preloaded on every route in the application — including the ones that never render a character of it. None of this can work if the loader call is not statically visible, which is the real reason it lives at module scope.**

## Subsets, and the warning you will see if you skip them

> *"Google Fonts are automatically subset. This reduces the size of the font file and improves performance. You'll need to define which of these subsets you want to preload. Failing to specify any subsets while `preload` is `true` will result in a warning."*
> — [Font Module reference](https://nextjs.org/docs/app/api-reference/components/font)

A subset is a slice of the family restricted to a character range — `latin`, `latin-ext`, `cyrillic`, `cyrillic-ext`, `greek`, `vietnamese` and so on, with the exact list depending on the family. The reference points you at the source of truth: *"You can find a list of all subsets on the Google Fonts page for your font."*

The option is described entirely in terms of preloading:

> *"The font `subsets` defined by an array of string values with the names of each subset you would like to be preloaded. Fonts specified via `subsets` will have a link preload tag injected into the head when the `preload` option is true, which is the default."*

🔴 **Read that carefully, because it is narrower than people assume.** The documentation says `subsets` controls **which subsets get a preload tag**. It does *not* state what happens to a subset you did not name — whether those glyphs are excluded from the build entirely, or still reachable but fetched later. I could not settle that from the primary source, and I am not going to guess. The safe practice follows either way: **name every subset your content actually contains.** If it is excluded you needed it; if it is merely un-preloaded you still wanted it early.

⚠️ The exact text of the "failing to specify any subsets" warning is not published in the reference, so it is not quoted here. Expect a build-time warning, not an error — the documented word is *warning*.

```tsx filename="app/fonts.ts"
import { Inter } from 'next/font/google'

// A product with Polish, Turkish and Czech customers needs latin-ext,
// not just latin. Name every range your copy actually contains.
export const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
})
```

## `preload`, and what it costs when it is wrong

> *"A boolean value that specifies whether the font should be preloaded or not. The default is `true`."*

A preload tag is a `<link rel="preload">` in the document head telling the browser to start fetching the font immediately, at high priority, before the CSS that references it has even been parsed. That is exactly right for the font your above-the-fold text is rendered in — it shortens the window during which the metric-matched fallback is on screen, which is the window described in [03 · next/font and layout shift](03-font-optimization-with-next-font-zero-layout-shift.md).

It is exactly wrong for a font only used in a modal nobody has opened. A preload is a *high-priority* fetch competing for bandwidth with your LCP image and your first-party JavaScript. Preloading a font that is not needed for the first paint makes the things that *are* needed arrive later.

```tsx filename="app/fonts.ts"
import localFont from 'next/font/local'

// A decorative face used only inside a settings dialog. Do not put it
// in front of the LCP resource; let CSS pull it when the dialog opens.
export const decorative = localFont({
  src: './fonts/Decorative.woff2',
  display: 'swap',
  preload: false,
})
```

## The preload scoping rule — the part nobody reads

This is the most operationally important paragraph in the whole font reference:

> *"When a font function is called on a page of your site, it is not globally available and preloaded on all routes. Rather, the font is only preloaded on the related routes based on the type of file where it is used:*
> *· If it's a unique page, it is preloaded on the unique route for that page.*
> *· If it's a layout, it is preloaded on all the routes wrapped by the layout.*
> *· If it's the root layout, it is preloaded on all routes."*

And the getting-started guide states the application-level consequence:

> *"Fonts are scoped to the component they're used in. To apply a font to your entire application, add it to the Root Layout."*

So the placement decision is a real performance decision with a real trade on both sides:

| Where the loader is called | Preloaded on | The cost |
|---|---|---|
| A leaf `page.tsx` | That one route | Navigate to a sibling route that also uses it and the preload advantage is gone for that route |
| A segment `layout.tsx` | Every route under that segment | Routes in the segment that never render the font still pay the preload |
| The root `layout.tsx` | Every route in the app | The whole site pays for a font that may only appear on the marketing pages |

The recommended shape for most applications is: one body face in the root layout, and anything decorative or section-specific declared in the layout of the section that uses it. The documentation gives exactly this pattern as its "multiple fonts" example — `Inter` applied globally on `<html>`, `Roboto_Mono` imported into the page that needs it, with the comment *"This ensures the font is preloaded only when it's rendered."*

## Why the loader call belongs at module scope

Every example in both documents calls the loader at the top level of a module, never inside a component body. The documentation does not spell out a rule in those words — but three documented facts leave no other workable placement.

**One: the download happens at build time.** *"CSS and font files are downloaded at build time and self-hosted with the rest of your static assets."* A call whose arguments are only known when a component renders cannot be resolved by a build.

**Two: preload scope is determined by the type of file the call sits in** — page, layout, or root layout. That is a file-level, static classification. It has no meaning for a call that appears conditionally inside a branch.

**Three: one call is one hosted instance.** *"Every time you call the `localFont` or Google font function, that font will be hosted as one instance in your application."* Instances are counted per call site at build time, not per invocation at runtime.

```tsx filename="app/page.tsx"
// ✅ Module scope, literal options — statically resolvable at build time.
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'], display: 'swap' })

export default function Page() {
  return <p className={inter.className}>Hello</p>
}
```

```tsx filename="app/broken-page.tsx"
// ❌ Do not do this. The call is inside the component and the options are
// computed, so neither the build-time download nor the preload scoping
// has anything static to work with.
import { Inter } from 'next/font/google'

export default function BrokenPage({ locale }: { locale: string }) {
  const subsets = locale === 'ru' ? ['cyrillic'] : ['latin']
  const inter = Inter({ subsets, display: 'swap' })
  return <p className={inter.className}>Hello</p>
}
```

⚠️ **What I could not confirm:** the exact diagnostic Next.js emits for a non-literal option or a call inside a component. I did not verify an error string against the primary source, so none is quoted here — do not expect a particular message, expect the build to reject it. If you need per-locale typography, declare *all* the fonts at module scope and pick between the resulting objects at render time; that is a branch over `className` values, which is free.

```tsx filename="app/fonts.ts"
import { Inter, Noto_Sans_JP } from 'next/font/google'

// Both declared statically; the branch happens over the results.
export const latin = Inter({ subsets: ['latin', 'latin-ext'], display: 'swap' })
export const japanese = Noto_Sans_JP({ subsets: ['latin'], display: 'swap' })

export function fontForLocale(locale: string) {
  return locale === 'ja' ? japanese : latin
}
```

## Gotchas

**★ Symptom: the build prints a font warning you have been ignoring for months.** Cause: *"Failing to specify any subsets while `preload` is `true` will result in a warning."* You called `Inter({ display: 'swap' })` with no `subsets`, so Next.js has nothing to emit a preload tag for. Fix: add `subsets`, or set `preload: false` deliberately if the font genuinely is not on the critical path — the warning is tied to the combination, not to `subsets` alone.

**★ Symptom: Polish, Turkish or Vietnamese characters render in a visibly different face, mid-word.** Cause: you named `subsets: ['latin']` and your copy contains `ł`, `ğ` or `ệ`, which live in `latin-ext` and `vietnamese`. Fix: name every range your content contains. This is a content question, not an engineering one — ask what languages the CMS is allowed to publish, not what the current copy happens to say.

```tsx filename="app/fonts.ts"
import { Inter } from 'next/font/google'

export const inter = Inter({
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  display: 'swap',
})
```

**★ Symptom: every route preloads a display font that appears on one marketing page.** Cause: the loader was called in the root layout because that is where the first example put it, and *"if it's the root layout, it is preloaded on all routes."* Fix: move the call into the layout or page of the section that uses it, and keep only the body face in the root layout.

**Symptom: the LCP image arrives late after a "performance" change that added a preload.** Cause: a preload is a high-priority fetch; two high-priority fetches share the same connection and the same bandwidth. A font preloaded for content below the fold is directly competing with the largest contentful paint. Fix: `preload: false` for anything not rendered in the first viewport. The measurement side of this argument belongs to [ch11 · Core Web Vitals tuning](../11-performance-optimization-turbopack/05-core-web-vitals-tuning-lcp-inp-cls-auditing-workflows.md).

**Symptom: you set `preload: false` and now there is a visible reflow when the font lands.** Cause: without the preload the font arrives later, so the fallback is on screen for longer and any residual mismatch has more opportunity to be noticed. Fix: this is the trade, not a bug — either restore the preload, or accept it and confirm `adjustFontFallback` is left at its default so the fallback is metric-matched. See [03](03-font-optimization-with-next-font-zero-layout-shift.md).

**Symptom: a font declared in a route group's layout is unstyled outside that group.** Cause: preload scope follows the layout tree — *"if it's a layout, it is preloaded on all the routes wrapped by the layout"* — and so does the `className` that applies it. Routes outside the group were never wrapped. Fix: if the font is genuinely global, it belongs in the root layout; if it is not, the routes outside the group should not be using it.

**Symptom: adding a subset made the font file noticeably larger.** Cause: subsets are additive slices of the character set; `cyrillic-ext` on top of `latin-ext` on top of `latin` is more glyph data on every route that preloads it. Fix: only name ranges you publish content in, and reconsider the same question for `axes` — the two costs compound on the same file.

**Symptom: someone tried to select a font by locale inside the component and the build refuses it.** Cause: the loader is resolved at build time; a computed `subsets` array cannot be. Fix: declare each locale's font at module scope and branch over the returned objects, as shown above.

## Interview questions

**★ Where should a font be declared, and what does that placement actually change?**
It changes which routes preload it. The reference is explicit: a font called in a unique page is preloaded on that route only, one called in a layout is preloaded on every route that layout wraps, and one called in the root layout is preloaded on every route in the app. So placement is not organisational tidiness — it decides how many pages pay for a high-priority font fetch they may never need. The usual shape is the body face in the root layout and anything section-specific in that section's layout.

**★ Why must the font loader be called at module scope rather than inside a component?**
Because everything the feature does happens before your component runs. The font is downloaded and self-hosted at build time, the preload scope is decided from the *type of file* the call appears in, and each call site becomes one hosted instance. All three require the call and its arguments to be statically visible to the build. A call inside a component with computed options has none of those properties. The documentation does not phrase this as a rule, but those three documented facts leave no other placement that works. If you need to vary the font, declare every candidate at module scope and choose between the resulting objects at render time.

**★ What happens if you omit `subsets` on a Google font?**
You get a build warning — the reference says failing to specify any subsets while `preload` is `true` will result in one — because there is nothing for Next.js to emit a preload tag for. The subtler risk is naming *too few*: `subsets: ['latin']` on a site that publishes Polish or Vietnamese leaves those characters outside the range you asked for, and they will not render in the same face. Name the ranges your content can contain, not the ranges it happens to contain today.

**Does `subsets` control what gets downloaded, or only what gets preloaded?**
The documentation only ever describes it in terms of preloading — *"the names of each subset you would like to be preloaded"*, and *"will have a link preload tag injected into the head"*. It does not state what happens to an unnamed subset. That is a genuine gap, and the honest answer in an interview is to say so and then give the practice that is correct under either reading: name every subset your content needs, because if unnamed subsets are excluded you have broken your text, and if they are merely un-preloaded you have made it slow.

**When is `preload: false` the right call?**
When the font is not used in the first viewport. A preload is a high-priority fetch that competes with your LCP resource and your first-party JavaScript, so preloading a face that only appears in a modal, a footer, or a chart legend actively harms the page. Set `preload: false` and let the CSS pull the font when the element that needs it is actually rendered. Accept that the swap will then happen later and lean on `adjustFontFallback` — which is on by default — to keep the swap from moving anything.

**You have one global body font and one display font used on three marketing pages. How do you wire it?**
Body font in the root layout, so `className` and the preload apply everywhere. Display font declared in the marketing section's `layout.tsx`, so only those three routes carry the preload tag, and applied via `className` or its own CSS variable on that layout's wrapper. Both loaders live in a shared `app/fonts.ts`, exported, so neither is instantiated twice — the definitions-file rule in [03c](03c-applying-the-font-classname-style-css-variables-and-tailwind.md) is about instance count and is independent of the placement question here.

**Why is a preload tag for a font different from just letting CSS request it?**
Because CSS cannot request the font until the browser has parsed the stylesheet that references it, and the browser cannot parse that stylesheet until it has been fetched. A `<link rel="preload">` in the head short-circuits that chain: the fetch starts on the first bytes of the document. The price is that it starts at high priority, so an unnecessary preload does not just waste bandwidth, it takes priority from something that needed it.

---

← [03c · applying the font](03c-applying-the-font-classname-style-css-variables-and-tailwind.md) · [Chapter index](01-explanation.md) · Next → [04 · next/image](04-next-image-priority-blur-placeholders-remote-patterns-avif-w.md)
