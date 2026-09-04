---
title: "Two head tags are always emitted, six are permanently refused, and the refusals are design decisions with a documented replacement each"
sidebar_label: "01c · The tags the API will not emit"
sidebar_position: 101
description: "The charset and viewport tags Next always writes; the unsupported-metadata table and why each entry is refused; resource hints through ReactDOM rather than metadata; and the `other` escape hatch, including what it cannot do."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-04 against the Next.js
> [`generateMetadata` reference](https://nextjs.org/docs/app/api-reference/functions/generate-metadata),
> sections *Default Fields*, *Unsupported Metadata*, *Resource hints* and *`other`* (page
> `lastUpdated: 2026-08-25`); the WHATWG HTML Standard,
> [4.2.5.4 Specifying the document's character encoding](https://html.spec.whatwg.org/multipage/semantics.html#charset);
> and MDN on
> [`frame-ancestors`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors)
> and [`X-Frame-Options`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Frame-Options).
> Target: **Next.js 16.3.4**, App Router, React 19.2.8. Documentation-verified —
> **no sandbox run**.

**The Metadata API is not a general-purpose `<head>` writer, and treating it as one is how
people end up with a `metadata.other` entry that emits a `<meta>` where a `<link>` was needed.
It emits two tags unconditionally, supports a fixed vocabulary of fields, and refuses a
specific list — each refusal because the tag it would emit is the weaker version of something
the framework already gives you a better route to. This page is that boundary, and the escape
hatches on either side of it.**

## The two you always get

Next always emits these, even for a route with no metadata export at all:

```html
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
```

The viewport one is overridable through the `viewport` export
([01b](01b-the-title-algebra-and-the-viewport-export.md)). The charset one is not something you
should want to change. The HTML Standard requires the document's encoding to be UTF-8 and
requires the declaration, if present, to say so — and it puts a hard limit on placement:

> *"The element containing the character encoding declaration must be serialized completely
> within the first 1024 bytes of the document."*

Because the charset tag is emitted for you and emitted first, one whole class of bug does not
exist in the App Router: the mojibake page where a hand-written `<head>` put the charset
declaration after a `<title>` containing non-ASCII characters.

## The six refusals, and what to use instead

| Refused tag | Documented replacement |
|---|---|
| `<meta http-equiv="...">` | A real HTTP header — the `headers` key in `next.config`, `redirect()`, or `proxy.ts` |
| `<base>` | Render the tag in the layout or page body |
| `<noscript>` | Render the tag in the layout or page body |
| `<style>` | Import a stylesheet — [09 · styling](../09-styling-and-ui/01-css-modules-global-stylesheets-utility-first-tailwind-config.md) |
| `<script>` | `next/script` — [09 · next/script](../09-styling-and-ui/05-next-script-loading-strategies-for-third-party-scripts.md) |
| `<link rel="stylesheet" />` | `import` the stylesheet directly in the layout or page |

Two of those refusals are worth understanding rather than memorising.

**`http-equiv` is refused because it is always the weaker form.** The three people actually
reach for it for are `Content-Security-Policy`, `X-Frame-Options` and `refresh`. A CSP in a
meta tag cannot carry `frame-ancestors` at all — MDN states the directive is not supported in
the `<meta>` element — and there is no report-only form of the meta tag, only of the header.
`X-Frame-Options` in a meta tag is worse: MDN's warning is that setting it there **has no
effect**, because it is only ever enforced as a header. And a `refresh` redirect is a
client-side approximation of the 307 that `redirect()` gives you. Set the header:

```ts
// next.config.ts
import type { NextConfig } from 'next'

const config: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
}

export default config
```

**`<script>` is refused, but JSON-LD is not a script in the sense that matters.** The
`next/script` component exists to schedule the *execution* of JavaScript. A
`type="application/ld+json"` block is inert data that the browser never executes, so the
JSON-LD guide tells you to render a bare `<script>` tag in the component tree — see
**02c · JSON-LD and structured data** *(not written yet)* for the escaping you must do when you take that
route.

## Resource hints are a React API, not a metadata field

`preload`, `preconnect` and `dns-prefetch` are not fields on the metadata object. They are
methods on `react-dom`:

```tsx
// app/preload-payments.tsx
'use client'

import ReactDOM from 'react-dom'

export function PreloadPayments() {
  ReactDOM.preconnect('https://js.stripe.com', { crossOrigin: 'anonymous' })
  ReactDOM.prefetchDNS('https://api.stripe.com')
  return null
}
```

```tsx
// app/checkout/page.tsx
import { PreloadPayments } from '../preload-payments'

export default function CheckoutPage() {
  return (
    <>
      <PreloadPayments />
      <CheckoutForm />
    </>
  )
}
```

The docs state these methods are **only supported in Client Components**, and immediately add
that those still server-render on the initial page load — so the hint does land in the HTML
that reaches the browser. It is the API surface that forces the boundary, not the timing. React
deduplicates repeated calls for the same href, so calling `preconnect` from several components
does not emit several tags.

You need this less often than you think. `next/font` emits its own `preload` links,
`next/image` emits `fetchpriority` and preload hints for eager images
([09 · 04b](../09-styling-and-ui/04b-loading-priority-preload-eager-fetchpriority.md)), and
`next/script` handles third-party script scheduling. What is left is genuinely third-party
*origins* you connect to yourself — payment iframes, analytics collectors, a media CDN on a
different host.

## `other` is the escape hatch, and it only emits `<meta name>`

For a tag the vocabulary does not cover — a vendor verification tag, a spec too new to have a
field — `other` writes an arbitrary meta tag, and an array value writes the tag more than once:

```tsx
export const metadata: Metadata = {
  other: {
    'apple-mobile-web-app-title': 'SprintDesk',
    'msvalidate.01': 'A1B2C3D4E5F6',
    custom: ['meta1', 'meta2'], // two separate <meta name="custom"> tags
  },
}
```

🔴 **`other` cannot emit a `<link>`.** Every entry becomes `<meta name="..." content="...">`.
If what you need is a `rel`, you are looking at either a real field (`alternates`, `icons`,
`archives`, `bookmarks`, `assets`, `pagination`) or a hand-rendered tag in the body. Reaching
for `other` to add `rel="preload"` produces a meta tag with the string `preload` in it and no
error anywhere.

There are also more real fields than most people use, and the reference lists them all —
`verification` (Google, Yandex, Yahoo, plus `other`), `appleWebApp`, `appLinks`, `itunes`,
`facebook` (`appId` **or** `admins`, never both), `pinterest.richPin`, `formatDetection`,
`category`, `pagination`, `archives`, `assets`, `bookmarks`. Check the list before reaching for
`other`; a real field also gets you the correct tag *type*.

## Gotchas

**★ `metadata.other` cannot produce a `<link>` tag.** It only writes `<meta name>`. A
`rel="preload"` or `rel="me"` added this way silently becomes a meta tag with a nonsense name.
Use the matching real field, `ReactDOM.preload`, or render the tag in the body.

**★ A CSP added as `<meta http-equiv>` does not do what a CSP header does.** The Metadata API
refuses it, and that refusal is doing you a favour — the meta form cannot carry
`frame-ancestors` (MDN: not supported in the `meta` element) and has no report-only variant.
Set the header in `next.config` or `proxy.ts`, which is also the only place a per-request nonce
can be generated.

**★ `X-Frame-Options` as a meta tag is ignored by every browser.** MDN's own warning says
setting it in a `meta` element has no effect; it is enforced only as a header. If your
clickjacking protection lives in a meta tag, you do not have clickjacking protection.

**★ Calling `ReactDOM.preconnect` from a Server Component does nothing.** The docs scope these
methods to Client Components. The call will not error usefully; the hint simply never appears.
Put them in a tiny `'use client'` component that returns `null`.

**★ Using `next/script` for JSON-LD is the wrong tool.** `next/script` schedules execution;
structured data is never executed. The documented answer is a plain
`<script type="application/ld+json">` element in the tree, with the payload escaped.

**★ Adding `facebook: { appId, admins }` together is invalid.** The reference states you may
specify one or the other. Setting both is a configuration error rather than a merge.

## Interview questions

**★ Why does the Metadata API refuse `<meta http-equiv>` when browsers still honour some of
them?**
Because for every case people use it for there is a strictly stronger mechanism the framework
already owns. A CSP meta tag is a degraded CSP — `frame-ancestors` is not supported in the
`meta` element and there is no report-only meta form. `X-Frame-Options` in a meta tag has no
effect at all. A `refresh` redirect is a client-side approximation of a 307. Refusing the tag
pushes you to the
`headers` config or `proxy.ts`, which is also the only place you can generate a per-request
nonce.

**★ How do you add a `preconnect` hint to a third-party payment origin?**
Not through the Metadata API; resource hints are on its unsupported list. Call
`ReactDOM.preconnect` from a Client Component that the page renders. The component still
server-renders on first load, so the tag is in the initial HTML — the client boundary is
required by the API surface, not by when the hint needs to exist. React deduplicates repeats,
so it is safe to call from several components.

**★ You need `<link rel="me" href="https://mastodon.social/@team">` for verification. What is
the right field?**
`verification.other`, which takes arbitrary key/value pairs and emits `<meta name="me">` — and
that is what most identity verification actually wants. If you specifically need the `link`
form, `other` cannot give it to you and you render the tag in the layout body instead. This is
the clearest illustration of `other` being meta-only.

**★ Which two tags does Next emit for a route that exports no metadata at all, and why does
that matter?**
`<meta charset="utf-8">` and the viewport tag. The charset one matters because encoding must be
declared within the first 1024 bytes of the document to be honoured reliably — hand-written
heads get this wrong by putting a non-ASCII `<title>` above it, and the framework emitting it
first removes the whole failure mode.

{/* FOOTER */}
