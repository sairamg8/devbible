---
title: "The `twitter` block is a second vocabulary rather than a copy of `openGraph`, it uses `name=` where Open Graph uses `property=`, and four smaller blocks ride along in the same object with rules of their own"
sidebar_label: "02b · Twitter cards and companions"
sidebar_position: 9
description: "The twitter namespace and why it is not a duplicate of openGraph, the name= versus property= split that breaks hand-written tags and head assertions, the app card's fan-out, and the alternates / facebook / pinterest / robots / other blocks."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against the Next.js
> [`generateMetadata` reference](https://nextjs.org/docs/app/api-reference/functions/generate-metadata),
> sections *`twitter`*, *`alternates`*, *`facebook`*, *`pinterest`*, *`robots`* and *`other`*
> (page `lastUpdated: 2026-08-25`).
> ⚠️ `docs.x.com` returned **404** for the Cards documentation path on 2026-09-04, so **no claim
> on this page describes X's own rendering, caching or validator** — only what Next.js emits.
> Version spine: **Next.js 16.3.4** · React 19.2.8. `next` is **not installed in this checkout** —
> documentation-verified only, **no sandbox run**.

**One `metadata` export carries six vocabularies that do not agree with each other. Open Graph uses `property=`; the Twitter card vocabulary uses `name=`; `alternates` produces `<link>` rather than `<meta>`; `facebook` mixes both. The Metadata API hides that disagreement, which is a genuine service right up to the moment you hand-write a tag, assert on one in a test, or wonder why the block you copied from `openGraph` into `twitter` doubled your maintenance without changing a single preview. This page is the second half of the social-metadata surface: the `twitter` namespace in full, and the four smaller blocks that ride along in the same object.**

## `twitter` is a second namespace, not a mirror

The reference is dry but the sentence matters:

> *"The Twitter specification is (surprisingly) used for more than just X (formerly known as Twitter)."*

Several unfurlers read `twitter:*` in preference to `og:*` when both are present. That is why the block exists separately, and why copying `openGraph` into `twitter` wholesale is usually wrong — you want `twitter` to carry only what differs.

```tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  twitter: {
    card: 'summary_large_image',
    title: 'Next.js',
    description: 'The React Framework for the Web',
    siteId: '1467726470533754880',
    creator: '@nextjs',
    creatorId: '1467726470533754880',
    images: ['https://nextjs.org/og.png'],
  },
}
```

```html
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site:id" content="1467726470533754880" />
<meta name="twitter:creator" content="@nextjs" />
<meta name="twitter:creator:id" content="1467726470533754880" />
<meta name="twitter:title" content="Next.js" />
<meta name="twitter:description" content="The React Framework for the Web" />
<meta name="twitter:image" content="https://nextjs.org/og.png" />
```

🔴 **Note the attribute.** Open Graph tags use `property=`; Twitter tags use `name=`. That is not a Next.js choice, it is the two specifications disagreeing, and it is why a hand-written `<meta property="twitter:card">` copied from a blog post does nothing. If you are asserting on head tags in a test, you must select on the right attribute for the right namespace.

Note also the key-to-tag mapping in that block: `siteId` becomes `twitter:site:id` and `creatorId` becomes `twitter:creator:id`. The `Id` suffix is not a Next.js invention appended to a name — it maps onto a distinct `:id` sub-property in the Twitter vocabulary. ⚠️ The reference's examples show only `siteId` and `creatorId`; whether a bare `site` key exists alongside them is not documented on that page and is not asserted here.

## The `app` card fans out harder than anything else in the API

```tsx
export const metadata: Metadata = {
  twitter: {
    card: 'app',
    title: 'Next.js',
    description: 'The React Framework for the Web',
    siteId: '1467726470533754880',
    creator: '@nextjs',
    creatorId: '1467726470533754880',
    images: { url: 'https://nextjs.org/og.png', alt: 'Next.js Logo' },
    app: {
      name: 'twitter_app',
      id: {
        iphone: 'twitter_app://iphone',
        ipad: 'twitter_app://ipad',
        googleplay: 'twitter_app://googleplay',
      },
      url: { iphone: 'https://iphone_url', ipad: 'https://ipad_url' },
    },
  },
}
```

The reference's output for the `app` block alone:

```html
<meta name="twitter:app:name:iphone" content="twitter_app" />
<meta name="twitter:app:id:iphone" content="twitter_app://iphone" />
<meta name="twitter:app:id:ipad" content="twitter_app://ipad" />
<meta name="twitter:app:id:googleplay" content="twitter_app://googleplay" />
<meta name="twitter:app:url:iphone" content="https://iphone_url" />
<meta name="twitter:app:url:ipad" content="https://ipad_url" />
<meta name="twitter:app:name:ipad" content="twitter_app" />
<meta name="twitter:app:name:googleplay" content="twitter_app" />
```

One `app.name` string produces **three** tags — `:iphone`, `:ipad` and `:googleplay` — because the specification has no platform-independent name field. `url` was supplied for two platforms and produced exactly two tags; `id` was supplied for three and produced three. So the emitted tag count for this block is *not* the number of keys you wrote, which matters the moment you write a test that counts `meta[name^="twitter:"]`.

Also worth reading twice: `images` here is an **object**, not an array, and it still works. Most image-valued fields in this API accept a string, an object, or an array of either. Do not infer from one example that a field is array-only.

## The companion blocks

| Block | Emits | Rule you will trip over |
|---|---|---|
| `alternates.canonical` | `<link rel="canonical">` | Composes with `metadataBase`; must agree with your `og:url`. |
| `alternates.languages` | one `<link rel="alternate" hreflang>` per key | Covered in full in [03d](03d-localized-metadata-for-i18n-routes.md). |
| `alternates.media` | `<link rel="alternate" media="…">` | For a separate mobile origin. Almost always a legacy answer. |
| `alternates.types` | `<link rel="alternate" type="application/rss+xml">` | The only sanctioned way to advertise a feed from metadata. |
| `facebook.appId` | `<meta property="fb:app_id">` | > *"You can specify either appId or admins, but not both."* |
| `facebook.admins` | one `fb:admins` per array element | Array support exists specifically for multiple admins. |
| `pinterest.richPin` | `<meta name="pinterest-rich-pin" content="true">` | A boolean that emits the string `"true"`. |
| `robots` | `<meta name="robots">` and `<meta name="googlebot">` | The per-page indexing switch. Its full semantics are [03b](03b-robotsts-and-the-crawl-directives.md). |
| `other` | `<meta name>` only | Never a `<link>`. See [01c](01c-the-tags-the-metadata-api-will-not-emit.md). |

Two of those rows deserve more than a table cell.

**`facebook` is the one block using the Open Graph `property=` attribute while sitting outside the `og:` namespace.** `fb:app_id` and `fb:admins` are Facebook's own vocabulary, expressed in RDFa like Open Graph. If you are auditing head tags with a generic *"every `og:` tag is present"* rule, `fb:*` will not match it and should not.

**`robots` is the only block in this group that changes what a crawler does rather than what it displays.** It emits two tags from one object:

```tsx
export const metadata: Metadata = {
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}
```

```html
<meta name="robots" content="index, follow" />
<meta
  name="googlebot"
  content="index, follow, max-video-preview:-1, max-image-preview:large, max-snippet:-1"
/>
```

The booleans flatten to a comma-joined directive list, and the hyphenated keys — which must be quoted, because they are not valid identifiers — flatten to `key:value`. `nocache: false` emitted nothing at all: a `false` on a negative directive is the default and is simply omitted rather than emitted as `cache`. That asymmetry is why reading the emitted string is more reliable than reasoning about the object.

## The `other` escape hatch, and its one shape

```tsx
export const metadata: Metadata = {
  other: {
    custom: 'meta',
  },
}
```

emits `<meta name="custom" content="meta" />`, and the array form:

```tsx
export const metadata: Metadata = {
  other: {
    custom: ['meta1', 'meta2'],
  },
}
```

emits two `<meta name="custom">` tags. That repetition rule is consistent with `facebook.admins` and `openGraph.authors` — **an array is always a repeated tag in this API, never a joined string.**

What `other` cannot do is emit a `<link>`, a `<meta property>`, or anything with `http-equiv`. [01c](01c-the-tags-the-metadata-api-will-not-emit.md) is the full list of refusals and the replacement for each.

## Gotchas

**★ `<meta property="twitter:card">` copied from a snippet emits nothing useful.** Twitter tags are `name=`, Open Graph tags are `property=`. The Metadata API gets this right for you; hand-written tags and head-assertion tests do not. Fix: never hand-write these — and in a test, select `meta[name="twitter:card"]`, not `meta[property=...]`.

**★ A `twitter` block copied wholesale from `openGraph` doubles your maintenance and drifts.** Every title change now has to be made twice, and the second one gets forgotten. Fix: set `twitter` only where it must differ — usually just `card` and `creator` — and let the unfurlers fall back to `og:*` for the rest.

**★ You set `facebook: { appId, admins }` together and the build does not complain.** The reference says you may specify one or the other. Fix: pick `appId` if you use Facebook Insights, `admins` otherwise — and encode the choice as a union in your own helper's parameter type so both cannot be passed:

```tsx
type FacebookMeta = { appId: string } | { admins: string | string[] }

export function facebook(fb: FacebookMeta) {
  return fb
}
```

**★ A test that counts `meta[name^="twitter:"]` fails when you add one key.** `app.name` alone emits three tags, one per platform present in `app.id`. The count is a function of the platform set, not of the key count. Fix: assert on specific tags by name, never on a total.

**★ `robots: { nocache: false }` emits nothing, and you conclude the block was ignored.** A `false` on a negative directive is the default; it is omitted rather than inverted. Fix: read the emitted `content` string, not the object — and if you need `noarchive`-style behaviour, set the positive directive rather than a `false` on its opposite.

**★ `alternates.canonical` set in a layout applies to every child route.** Canonical is a normal metadata field, so it inherits, and a canonical pointing at the layout's own URL from every child page tells a crawler that the entire subtree is one page. Fix: set `canonical` in the leaf `page.tsx` (or in `generateMetadata` from `params`), never in a shared layout.

**★ You add `alternates.types` for an RSS feed and the feed 404s at build time.** Nothing validates that the URL you advertised exists — `alternates` is a string in an object. Fix: point it at a real Route Handler and add a smoke test that fetches it, the same as any other route.

**★ `other: { custom: 'a, b' }` when you meant two tags.** The joined string is one tag whose content contains a comma. Fix: `other: { custom: ['a', 'b'] }`.

## Interview questions

**★ Why does the `twitter` block exist at all, given `openGraph` already carries a title, description and image?**
Because several consumers read the `twitter:*` namespace in preference to `og:*` when both are present, and the two vocabularies are not isomorphic — `twitter:card` has no Open Graph equivalent, and the `app` card has a whole structure that Open Graph does not model. The docs note the Twitter specification is used by more than just X. The practical consequence is that `twitter` should be a *delta*, not a copy: set `card` and `creator`, let everything else fall back to Open Graph, and you halve the number of places a title can go stale.

**★ You are writing a Playwright assertion that the product page has a large-image Twitter card. What selector do you use, and what is the trap?**
`meta[name="twitter:card"]` with content `summary_large_image`. The trap is the attribute: Open Graph uses `property=` and the Twitter card vocabulary uses `name=`, so a selector written as `meta[property="twitter:card"]` matches nothing — and a test asserting *absence* with the wrong attribute passes vacuously forever. The second trap is *where* to look: on a dynamically-rendered route the tags may be appended to `<body>` rather than sitting in `<head>` ([01e](01e-streaming-metadata-and-html-limited-bots.md)), so the selector must not be anchored to `head`.

**★ What does `robots: { index: true, follow: true, nocache: false }` actually emit, and why is the third key invisible?**
It emits `<meta name="robots" content="index, follow" />` and nothing for `nocache`. The block flattens truthy booleans into a comma-joined directive list; a `false` on a negative directive means "the default", and the default is not emitted — there is no `cache` directive to write. This is the general shape of the block: it is a *builder* for a directive string, not a serialisation of the object. Reading the emitted `content` is the only reliable way to know what you asked for, which is why per-page indexing is worth asserting in CI rather than reasoning about.

**★ A page needs `<link rel="me" href="…">` for identity verification. Can `other` do it?**
No. `other` emits `<meta name>` and only that. There is no metadata field that emits an arbitrary `<link>`, so a `rel="me"` link has to be rendered as a real element in the component tree — which is legal, because React hoists `<link>` and `<meta>` elements rendered anywhere in the tree into the document head. That is also the mechanism JSON-LD uses ([02c](02c-json-ld-and-structured-data.md)), and it is the general escape hatch for every tag the Metadata API refuses.

**★ Where should `alternates.canonical` be declared, and what goes wrong if you put it in a layout?**
In the leaf, almost always computed from `params` in `generateMetadata`. Metadata inherits, so a canonical declared in a layout is emitted by every route beneath it, and every one of those routes then tells crawlers that its content really lives at the layout's URL. The visible symptom is a whole section of the site collapsing to a single indexed URL, with the rest reported as duplicates — and because a canonical is a *hint* rather than a directive, the behaviour is inconsistent enough between engines that it is often misdiagnosed as a crawl-budget problem.

---

← [Open Graph](02-open-graph-twitter-cards-structured-json-ld.md) · [Chapter 12 overview](01-explanation.md) · Next → [JSON-LD and structured data](02c-json-ld-and-structured-data.md)
