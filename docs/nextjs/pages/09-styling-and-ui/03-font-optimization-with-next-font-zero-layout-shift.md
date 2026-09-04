---
title: "next/font is a build-time self-hosting step first and a performance feature second — and the layout shift it removes is removed by a metric-matched fallback face, not by font-display"
sidebar_label: "03 · next/font and layout shift"
sidebar_position: 15
description: "Why next/font exists: it downloads and self-hosts the font at build time so no request reaches a third-party host, and it generates an adjusted fallback face so the swap does not move the page."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against **Next.js 16.3.4** documentation — [Font Module reference](https://nextjs.org/docs/app/api-reference/components/font) (doc `version: 16.3.4`, `lastUpdated: 2025-08-06`) and [Font Optimization](https://nextjs.org/docs/app/getting-started/fonts) (`lastUpdated: 2026-05-27`); web-platform behaviour against MDN — [`size-adjust`](https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/size-adjust). Both nextjs.org URLs and the MDN URL resolved.
> Version spine: **Next.js 16.3.4** · React 19.2.8 · Node 20.9 floor. `next` is **not installed in this checkout**, so nothing here is probed — every claim is quoted from documentation. **No sandbox run**; no timings, no CLS numbers.

**Almost everyone can recite that `next/font` "gives you zero layout shift", and almost nobody can say how. The answer is not `font-display`. `font-display` decides whether you see fallback text during the load; it has nothing to say about whether the eventual swap moves the page. What removes the movement is a second, generated `@font-face` — a locally-available font whose metrics have been overridden to match the web font, so the fallback occupies the same space the real font will occupy. And before any of that, `next/font` is a build step: it downloads the font and serves it from your own origin, which means a visitor's browser never contacts a third-party font host at all. That is a privacy and reliability property, and it is the reason the module exists.**

## What the build actually does

`next/font` is not a runtime loader. For a Google font, the fetch happens on your build machine and the bytes land in your own static output:

> *"You can also conveniently use all Google Fonts. CSS and font files are downloaded at build time and self-hosted with the rest of your static assets. **No requests are sent to Google by the browser.**"*
> — [Font Module reference](https://nextjs.org/docs/app/api-reference/components/font)

The getting-started guide says the same thing from the deployment angle:

> *"Fonts are included as static assets and served from the same domain as your deployment, meaning no requests are sent to Google by the browser when the user visits your site."*
> — [Font Optimization](https://nextjs.org/docs/app/getting-started/fonts)

So the output of `Inter({ subsets: ['latin'] })` is not a URL to `fonts.gstatic.com`. It is a generated `@font-face` block pointing at a hashed asset on your own origin, plus a class name that references it:

```tsx filename="app/layout.tsx"
import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.className}>
      <body>{children}</body>
    </html>
  )
}
```

The headline sentence for the whole module is deliberately ordered — privacy comes first:

> *"`next/font` automatically optimizes your fonts (including custom fonts) and removes external network requests for improved privacy and performance."*

## The privacy and reliability argument, which is the real one

The thing `next/font` replaces is a `<link>` element in `<head>` pointing at a font host. Three consequences follow from that element, and only one of them is about speed.

**Every visitor's browser makes a request to a third party.** An HTTP request carries the client's IP address and `User-Agent` to whoever answers it. With a CDN-hosted font that party is not you, it happens on every page view, and you have no way to inspect or throttle it. Whether that is acceptable under a given privacy regime is a question for your legal team; the point of `next/font` is that the question stops arising, because the request does not happen.

**It is a second origin on the critical path.** Before the browser can even see the font file URL, it must resolve DNS for the font host, open a TCP connection, complete a TLS handshake, and download a stylesheet — and a `<link rel="stylesheet">` is render-blocking, so the document will not paint until it comes back. Self-hosted, the font is on the connection the browser already has open for the document.

**It is a failure mode you do not control.** If the font host is slow, blocked by a corporate proxy, or unreachable in a particular country, your text renders in a fallback and you never find out. A self-hosted font shares the availability of the rest of your site: if it is down, so is everything else, and you already have an alarm for that.

⚠️ The old counter-argument — "the user probably has the font cached already from another site" — depended on a shared, unpartitioned HTTP cache. Browsers now partition the cache by top-level site, which kills that sharing. I did not verify the partitioning behaviour against a browser vendor's own documentation in this pass, so treat it as context rather than as a citation; it is not load-bearing for anything below.

## Why `font-display` is not the answer to layout shift

`display` is a real option with a real default:

> *"The font `display` with possible string values of `'auto'`, `'block'`, `'swap'`, `'fallback'` or `'optional'` with default value of `'swap'`."*

Read what each value actually controls. It is a policy for the **block period** and the **swap period** — how long the browser hides text waiting for the font, and whether it is still allowed to swap once the font arrives. `block` hides the text and then shows it in the real font. `swap` shows fallback text immediately and swaps when the font lands. `optional` may decide never to swap at all.

Every one of those is a decision about *what the user reads while waiting*. None of them is a decision about *whether the swap moves the page*. If your fallback is Arial at 16px and your web font is Inter at 16px, the two faces have different ascent, descent, line gap and per-glyph advance widths. The moment the swap happens, every line box changes height and every line of text changes width. Text reflows, and everything below it slides.

That is the shift. `font-display: swap` does not cause it and cannot prevent it — it only decides *when* it happens.

## The mechanism that does remove it: an adjusted fallback face

The web-platform technique is to declare a second `@font-face` whose `src` is a *local* font the user already has, and then override that font's metrics so it lays out like the web font. MDN states the purpose of the descriptor plainly:

> *"The `size-adjust` property can help when overriding the metrics of a fallback font to better match those of a primary web font."*
> — MDN, [`size-adjust`](https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/size-adjust)

and what it does:

> *"The `size-adjust` CSS descriptor for the `@font-face` at-rule defines a multiplier for glyph outlines and metrics associated with this font."* … *"All metrics associated with this font are scaled by the given percentage. This includes glyph advances, baseline tables, and overrides provided by `@font-face` descriptors."*

With a fallback face scaled that way, the fallback text occupies close to the space the real font will occupy. The swap becomes a **repaint** — the letterforms change — rather than a **reflow** — the boxes change size. CLS is a measure of unexpected movement, so a repaint costs nothing.

In `next/font` that generated face is the `adjustFontFallback` option, and it is on by default:

> *"For `next/font/google`: A boolean value that sets whether an automatic fallback font should be used to reduce Cumulative Layout Shift. The default is `true`."*

> *"For `next/font/local`: A string or boolean `false` value that sets whether an automatic fallback font should be used to reduce Cumulative Layout Shift. The possible values are `'Arial'`, `'Times New Roman'` or `false`. The default is `'Arial'`."*

🔴 **Do not overstate what the documentation confirms.** The Next.js docs say *that* an automatic fallback font is generated to reduce CLS. They do **not** name the CSS descriptors used to build it, and I could not settle that from the primary source. What the docs do confirm is the shape of the technique, from the other direction: the local-font-only `declarations` option exists precisely to write font-face descriptors yourself, and the documented example is a metric override.

> *"`declarations` — An array of font face descriptor key-value pairs that define the generated `@font-face` further."* Example given: `declarations: [{ prop: 'ascent-override', value: '90%' }]`.

So: *metric override on a generated `@font-face`* is unambiguously the family of mechanism in play. The exact descriptor set Next.js emits is an implementation detail its documentation does not publish. Say that in an interview and you are ahead of the room; assert a specific descriptor list and you are guessing.

## The two defaults are load-bearing together

`display` defaults to `'swap'`. `adjustFontFallback` defaults to `true`. Those defaults are safe **as a pair**, and this is the part that bites:

| `adjustFontFallback` | `display` | What the user gets |
|---|---|---|
| `true` (default) | `'swap'` (default) | Text immediately, in a metric-matched fallback; the swap repaints and does not move anything |
| `false` | `'swap'` | Text immediately in a mismatched fallback; the swap **reflows** — the worst CLS outcome available |
| `false` | `'optional'` | No shift, because the browser may simply never apply your font |
| `true` | `'block'` | Invisible text for the block period, then a matched swap — you paid an FOIT for nothing |

Turning `adjustFontFallback` off is not a neutral tweak. It silently changes what the *other* default means.

## What still moves, even with all of this correct

**Line-break reflow.** Metric matching harmonises the vertical box and the average advance; it does not make every glyph exactly as wide as its counterpart in the other face. MDN is explicit that the adjustment is statistical rather than per-glyph: *"It calculates an adjustment per font by matching ex heights."* A paragraph that fits in four lines in the fallback and five in the real font still pushes everything below it down by one line height. Short, single-line text is effectively immune; a dense justified article is not.

**Non-Latin text.** For local fonts, the only automatic fallbacks the documentation offers are `'Arial'` and `'Times New Roman'`. Neither is a plausible metric donor for a CJK, Devanagari or Arabic face. The documentation does not say what `next/font/google` picks for non-Latin subsets, and I could not confirm it — if your product is not primarily Latin-script, treat the CLS guarantee as unproven rather than assuming it transfers.

**Weights you never loaded.** If your CSS asks for `font-weight: 700` and you only loaded `'400'`, the browser synthesises a bold by smearing the regular face, and a synthesised bold has different advance widths from the real one. This is CSS font-matching behaviour rather than anything `next/font` does; it is worth knowing because it looks exactly like a font bug.

**Everything that is not a font.** Images without reserved dimensions, third-party widgets injecting themselves into the flow, and late-arriving CSS all shift layout, and they do it for reasons `next/font` cannot touch. See [04 · next/image](04-next-image-priority-blur-placeholders-remote-patterns-avif-w.md) for the image half and [05 · next/script strategies](05-next-script-loading-strategies-for-third-party-scripts.md) for the widget half. **Measuring** any of it — CLS, the audit workflow, the field-versus-lab distinction — belongs to [ch11 · Core Web Vitals tuning](../11-performance-optimization-turbopack/05-core-web-vitals-tuning-lcp-inp-cls-auditing-workflows.md), not here.

## Gotchas

**★ Symptom: you migrated to `next/font` and CLS got *worse*.** Cause: you copied `adjustFontFallback: false` from a snippet, or you kept a hand-written `@font-face` alongside the loader, so the default `display: 'swap'` is now swapping between two genuinely mismatched faces. Fix: delete the override and let both defaults stand.

```tsx filename="app/fonts.ts"
import { Inter } from 'next/font/google'

// adjustFontFallback defaults to true and display defaults to 'swap'.
// Setting one without the other is what regresses CLS.
export const inter = Inter({ subsets: ['latin'], display: 'swap' })
```

**★ Symptom: the `<link>` to Google Fonts is still in the HTML after the migration.** Cause: `next/font` added a self-hosted face but nobody deleted the old markup from the root layout or from a `head` fragment. You now download the family twice and the third-party request you removed is back — so the privacy property, which was the whole point, is gone. Fix: grep the repo for `fonts.googleapis.com` and `fonts.gstatic.com` and remove every hit.

**Symptom: `display: 'optional'` looks like the perfect CLS setting, and the brand font never appears for some users.** Cause: `optional` gives the browser permission to skip the swap entirely if the font is not ready in time. Zero shift, wrong typeface. Fix: use `optional` only when you would genuinely rather ship the fallback than move the page — a marketing landing page scored on CLS, not a product UI where the typeface is the brand.

**Symptom: CI builds started failing on a machine with restricted egress.** Cause: "downloaded at build time" means your build makes a real network request to Google's font hosts. A Google font turns your build into a networked build. Fix: for air-gapped or egress-restricted pipelines, vendor the font files into the repo and use `next/font/local`, which resolves entirely from disk.

```tsx filename="app/fonts.ts"
import localFont from 'next/font/local'

// Resolves from the filesystem — no build-time network access required.
export const brand = localFont({
  src: './fonts/Brand-Variable.woff2',
  display: 'swap',
})
```

**Symptom: legal asks where the font file in `public/` came from.** Cause: self-hosting is redistribution. An SIL Open Font License family is fine to ship; a commercially licensed face may price web self-hosting separately from a CDN-served licence. Fix: check the EULA before you commit the `.woff2`, not after. This is a consequence of self-hosting in general, not a `next/font` behaviour, and the Next.js documentation says nothing about it.

**Symptom: someone "fixed" a slow first paint by setting `display: 'block'`.** Cause: `block` hides the text for the block period. Combined with the metric-matched fallback that is already doing its job, you have swapped a harmless repaint for a period of invisible text. Fix: leave `display` at `'swap'`; if the font is arriving late, the problem is preloading or subsetting — see **03c · subsetting, preloading and scope** below.

## Interview questions

**★ How does `next/font` achieve "zero layout shift", and why is `font-display` not the answer?**
`font-display` only sets the policy for the block and swap periods — whether the browser hides text while waiting and whether it is still allowed to swap later. It decides *when* the typeface changes, never whether that change moves anything. The movement comes from a metric mismatch: the fallback face and the web font have different ascent, descent, line gap and glyph advances, so the swap changes every line box. `next/font` generates a second `@font-face` from a locally-available font with its metrics overridden to match the web font, so the fallback already occupies the space the real font will need. The swap then repaints rather than reflows. In Next.js that generated face is the `adjustFontFallback` option, on by default for both loaders.

**★ Why is `next/font` described as a privacy feature before it is described as a performance feature?**
Because the module's first sentence is literally that it "removes external network requests for improved privacy and performance", and the mechanism is that the font is downloaded at build time and served from your origin — *"No requests are sent to Google by the browser."* A `<link>` to a font CDN means every visitor's browser sends a request carrying their IP and User-Agent to a third party on every page view. Self-hosting deletes that request. The speed win — one fewer origin to resolve, connect to and TLS-handshake with, on a render-blocking path — is real but secondary.

**★ Is "zero layout shift" literally true? What can still move?**
It is true for the dominant cause and approximate for the rest. Metric overriding harmonises the line box and the average advance; MDN describes the adjustment as one calculated per font *by matching ex heights*, not per glyph. So a long paragraph can still break to a different number of lines after the swap and push its successors down. Beyond that: non-Latin scripts have no plausible metric donor among the documented fallbacks (`'Arial'`, `'Times New Roman'` for local fonts); weights you never loaded get synthesised with different advances; and images, widgets and late CSS shift layout for reasons the font module cannot influence.

**If you disable `adjustFontFallback`, which other default becomes dangerous, and why?**
`display`, which defaults to `'swap'`. With the adjusted fallback in place, swapping is free — the boxes do not change. Without it, `swap` guarantees a visible reflow at the exact moment the font lands, which is the single worst CLS behaviour on the menu. If you have a reason to disable the adjusted fallback, you must also revisit `display`; `'optional'` is the honest pairing, at the cost of the font sometimes never appearing.

**What does the documentation confirm about *how* the fallback is adjusted, and what does it not?**
It confirms *that* an automatic fallback font is generated to reduce Cumulative Layout Shift, for both `next/font/google` and `next/font/local`, and it names the fallback candidates for local fonts. It does **not** publish which `@font-face` descriptors are emitted. The only descriptor named anywhere in the reference is `ascent-override`, and only as the worked example for the separate `declarations` option. So the correct answer is "a metric-overridden generated `@font-face`" — naming a specific descriptor list is an assumption, not a documented fact.

**What did you actually give up by self-hosting?**
Three things. Your build now depends on network access to the font host at build time, which matters in restricted CI. You are redistributing the font file, which is a licensing question a CDN-hosted licence may not cover. And you lost nothing on caching, because browsers partition the HTTP cache per top-level site, so the "already cached from another site" benefit that once justified a shared font CDN no longer exists.

**Why is a `<link>` to a font stylesheet worse than an extra image request?**
Because a `<link rel="stylesheet">` is render-blocking: the browser will not paint the document until it has been fetched and parsed. A font CDN therefore inserts a full DNS-plus-TCP-plus-TLS round trip to an origin you do not control *in front of first paint*, before the browser has even learned the URL of the actual font file. An image request is not on that path.

---

← [02 · CSS-in-JS at the server boundary](02-css-in-js-caveats-at-server-component-boundaries.md) · [Chapter index](01-explanation.md) · Next → [03b · the loader API: Google, local and variable fonts](03b-the-loader-api-google-local-and-variable-fonts.md)
