---
title: "hreflang has to be declared twice — once in the head and once in the sitemap — and the four metadata files that would most naturally read the locale are Route Handlers, which `next/root-params` does not support"
sidebar_label: "03d · Localized metadata"
sidebar_position: 17
description: "alternates.languages versus the sitemap's xhtml:link alternates, x-default, the reciprocity rule, generating per-locale titles and descriptions from a dictionary, html lang, and why sitemap.ts / robots.ts / opengraph-image.ts cannot read root params."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against the Next.js
> [`generateMetadata` reference](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
> section *`alternates`* (page `lastUpdated: 2026-08-25`), the
> [`sitemap.xml` reference](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap)
> (`2026-08-25`), the
> [Internationalization guide](https://nextjs.org/docs/app/guides/internationalization) (`2026-06-10`),
> and [`next/root-params`](https://nextjs.org/docs/app/api-reference/functions/next-root-params) (`2026-06-24`).
> Version spine: **Next.js 16.3.4** · React 19.2.8. `next` is **not installed in this checkout** —
> documentation-verified only, **no sandbox run**.

**Localised metadata is two separate declarations of the same fact and one restriction nobody expects. The head declaration is `alternates.languages`, which emits `<link rel="alternate" hreflang>`. The sitemap declaration is `alternates.languages` — the same field name, a different type, a different serialisation, in a file that knows nothing about the first one. Keeping them consistent is entirely on you. And the natural instinct, "read the locale from the route and generate everything", collides with a documented limitation: `next/root-params` does not work in Route Handlers, and `sitemap.ts`, `robots.ts`, `opengraph-image.ts` and `icon.ts` are all Route Handlers.**

## The route shape this assumes

The chapter-2 treatment of locale-prefixed routes is [08 · Localized routing](../02-routing-and-navigation/08-localized-routing-i18n-locale-prefixed-routes-locale-detecti.md) and root params are [11](../02-routing-and-navigation/11-root-params.md) and [11b](../02-routing-and-navigation/11b-root-params-restrictions-and-typing.md). This page assumes the shape the internationalization guide recommends: everything under `app/[lang]`, with `generateStaticParams` on the root layout prerendering each locale.

```
app/
└── [lang]/
    ├── layout.tsx          generateStaticParams → [{ lang: 'en' }, { lang: 'es' }, { lang: 'de' }]
    ├── page.tsx
    └── blog/
        └── [slug]/page.tsx
```

## Declaration one: the head

```tsx
// app/[lang]/blog/[slug]/page.tsx
import type { Metadata } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL!
const LOCALES = ['en', 'es', 'de'] as const

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>
}): Promise<Metadata> {
  const { lang, slug } = await params
  const post = await getPost(slug, lang)

  return {
    title: post.title,
    description: post.excerpt,
    alternates: {
      canonical: `${BASE_URL}/${lang}/blog/${slug}`,
      languages: Object.fromEntries(
        LOCALES.map((l) => [l, `${BASE_URL}/${l}/blog/${slug}`])
      ),
    },
    openGraph: {
      locale: lang === 'en' ? 'en_US' : lang === 'es' ? 'es_ES' : 'de_DE',
      title: post.title,
      description: post.excerpt,
    },
  }
}
```

which emits:

```html
<link rel="canonical" href="https://sprintdesk.app/en/blog/hello" />
<link rel="alternate" hreflang="en" href="https://sprintdesk.app/en/blog/hello" />
<link rel="alternate" hreflang="es" href="https://sprintdesk.app/es/blog/hello" />
<link rel="alternate" hreflang="de" href="https://sprintdesk.app/de/blog/hello" />
<meta property="og:locale" content="en_US" />
```

Four things about that block:

- **The set includes the current locale.** hreflang is a reciprocal, self-inclusive set: every localised version links to every version *including itself*. A set that omits the current page is the most common hreflang error there is.
- **`canonical` points at this locale's URL, not at the English one.** Each localised page is its own canonical. Pointing every locale's canonical at `/en/...` tells the engine the translations are duplicates and should be dropped — which is precisely the outcome hreflang exists to prevent.
- **`og:locale` is a separate vocabulary with a separate format.** `en_US`, not `en`. The metadata `alternates.languages` keys are BCP 47 language tags; `og:locale` wants the underscore form.
- **`x-default` is not in the type's key list but is a legal key**, because `Languages<string>` is keyed by string. Add it for the URL a user with no matching locale should land on:

```tsx
languages: {
  ...Object.fromEntries(LOCALES.map((l) => [l, `${BASE_URL}/${l}/blog/${slug}`])),
  'x-default': `${BASE_URL}/en/blog/${slug}`,
}
```

## Declaration two: the sitemap

```tsx
// app/sitemap.ts
import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL!

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${BASE_URL}/en/about`,
      lastModified: new Date('2026-08-02'),
      alternates: {
        languages: {
          es: `${BASE_URL}/es/about`,
          de: `${BASE_URL}/de/about`,
        },
      },
    },
  ]
}
```

serialising to `xhtml:link rel="alternate" hreflang` elements inside each `<url>`, with `xmlns:xhtml` declared on the `<urlset>`.

🔴 **The two declarations use the same field name and are not the same thing.** In metadata, `languages` maps a tag to a URL and produces a head `<link>`. In a sitemap entry, `languages` maps a tag to a URL and produces an `xhtml:link` *inside the entry for one URL*. Neither knows about the other; nothing cross-checks them; and an engine encountering a page whose head advertises three alternates while the sitemap advertises two has been given contradictory information about the same page.

The only durable answer is to generate both from one source:

```tsx
// lib/i18n-urls.ts
export const LOCALES = ['en', 'es', 'de'] as const
export type Locale = (typeof LOCALES)[number]

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL!

/** Every localised URL for one logical page, keyed by locale. */
export function alternates(path: string): Record<string, string> {
  return Object.fromEntries(LOCALES.map((l) => [l, `${BASE_URL}/${l}${path}`]))
}

export function canonicalFor(locale: Locale, path: string): string {
  return `${BASE_URL}/${locale}${path}`
}
```

Both `generateMetadata` and `sitemap.ts` then call `alternates('/blog/hello')`, and the sets cannot diverge because there is only one of them.

## Per-locale titles and descriptions

Metadata is data, so it comes from the dictionary like anything else:

```tsx
// app/[lang]/pricing/page.tsx
import type { Metadata } from 'next'
import { getDictionary } from '@/lib/dictionaries'
import { alternates, canonicalFor, type Locale } from '@/lib/i18n-urls'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: Locale }>
}): Promise<Metadata> {
  const { lang } = await params
  const dict = await getDictionary(lang)

  return {
    title: dict.pricing.metaTitle,
    description: dict.pricing.metaDescription,
    alternates: {
      canonical: canonicalFor(lang, '/pricing'),
      languages: alternates('/pricing'),
    },
  }
}
```

Two disciplines make this survive:

- **The dictionary keys for metadata are separate from the page's visible copy.** `metaTitle` is not the `<h1>`; it has a length budget and often a different emphasis. Sharing one key means one of the two is always wrong.
- **A missing translation must not fall back silently to English.** A German page with an English title is worse than a German page with a title someone flagged as missing. The internationalization guide's `hasLocale()` narrowing plus `notFound()` for an unknown locale is the load-bearing half of this; for a *missing key* within a known locale, make the dictionary type require the key so it cannot compile.

## The `<html lang>` attribute

The one piece of localisation that is not metadata at all, and is a WCAG Level A requirement — **3.1.1 Language of Page**: *"The default human language of each web page can be programmatically determined."*

```tsx
// app/[lang]/layout.tsx
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  return (
    <html lang={lang}>
      <body>{children}</body>
    </html>
  )
}
```

It is easy to forget because nothing in the metadata system emits it, and its absence is invisible to everyone except screen-reader users — whose synthesiser will pronounce German text with English phonemes. [04](04-accessibility-semantic-html-aria-safe-hydration-keyboard-fir.md) covers this as a semantics question; here it is enough to note that `app/[lang]/layout.tsx` is the only place it can be set correctly.

## 🔴 The restriction: metadata files cannot read root params

`next/root-params` exports one async getter per dynamic segment above the root layout, which is exactly the API you want for "what locale is this". Its documented limitation:

> *"It cannot be used in Client Components, Server Actions, or Route Handlers. Support for Route Handlers is planned for a future release."*

And `sitemap.ts`, `robots.ts`, `opengraph-image.ts` and `icon.ts` are each documented on their own reference pages as **special Route Handlers**.

⚠️ **Putting those two statements together is an inference, not a sentence any documentation page states.** The docs do not say what happens if you call a root-param getter inside `sitemap.ts` — whether it throws, returns `undefined`, or something else. **This page does not assert a failure mode.** What it asserts is the safe consequence: **do not build a localised sitemap, robots file or OG image by reading root params.** Pass the locale explicitly instead.

For a sitemap, that means iterating the locales yourself rather than asking the framework which one you are in:

```tsx
// app/sitemap.ts — one file, every locale, no root params
import type { MetadataRoute } from 'next'
import { LOCALES, alternates } from '@/lib/i18n-urls'

const PATHS = ['/', '/pricing', '/about']
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL!

export default function sitemap(): MetadataRoute.Sitemap {
  return PATHS.flatMap((path) =>
    LOCALES.map((locale) => ({
      url: `${BASE_URL}/${locale}${path}`,
      lastModified: new Date('2026-08-02'),
      alternates: { languages: alternates(path) },
    }))
  )
}
```

For a per-locale OG image, the locale is a normal route param because the file sits inside `app/[lang]/`, and route params *are* available to these handlers — it is specifically the `next/root-params` API that is unsupported, not the `params` prop.

## Gotchas

**★ Every locale's canonical points at the English URL.** Someone reasoned that English is "the real page". This tells the engine the translations are duplicates and asks for them to be dropped. Fix: each locale's canonical is its own URL; hreflang expresses the relationship between them.

**★ The hreflang set omits the current page.** hreflang is reciprocal and self-inclusive. A set of "the other languages" is the single most common implementation error. Fix: build the set from the full locale list, including the current one.

**★ The head advertises three alternates and the sitemap advertises two.** Two independent declarations, no cross-check. Fix: generate both from one exported function; there must be exactly one array of locales in the codebase.

**★ `og:locale` is set to `en` and nothing renders differently.** Open Graph wants the underscore form, `en_US`. Fix: map your BCP 47 tags to OG locales explicitly — it is a small lookup table, and there is no automatic conversion.

**★ A missing translation ships as English under a German URL.** The dictionary lookup fell back. Fix: type the dictionary so every locale must supply every key, and use `hasLocale()` plus `notFound()` for an unknown locale so an unsupported one 404s rather than half-rendering.

**★ `<html lang>` is hard-coded to `en` in a localised app.** The root layout was written before i18n and never revisited. It is a WCAG 3.1.1 failure and completely invisible without a screen reader. Fix: `<html lang={lang}>` in `app/[lang]/layout.tsx`.

**★ You tried to read the locale in `sitemap.ts` with `next/root-params`.** Root params are documented as unsupported in Route Handlers, and metadata files are Route Handlers. Fix: iterate the locale list explicitly in the sitemap; do not ask the framework which locale it is in.

**★ The metadata title is the same string as the `<h1>`.** One dictionary key serving two purposes with different length budgets. Fix: separate `metaTitle` and `heading` keys — the duplication is the point.

**★ hreflang points at URLs that redirect.** Locale detection redirects `/blog/x` to `/en/blog/x`, and the alternate set lists the unprefixed form. Every alternate must be a final URL. Fix: build alternates from the prefixed pattern only.

**★ A locale was added and forty pages still advertise three alternates.** The locale list was written out in each `generateMetadata`. Fix: one `LOCALES` constant, imported everywhere; adding a locale should be a one-line change.

## Interview questions

**★ Why does hreflang have to be declared in both the head and the sitemap?**
It does not *have* to be — either channel is sufficient on its own — but teams end up with both because the head declaration is natural per page and the sitemap declaration is natural when generating the whole set. The problem is that they are independent: the same field name, different types, different serialisations, no cross-validation, and an engine given two contradictory sets has to pick. So the real answer is: pick one channel deliberately, or generate both from one function so they cannot disagree. What you must not do is let two people implement them separately.

**★ Where should each locale's `canonical` point?**
At its own URL. A canonical is a statement that "this content really lives at that address"; pointing `/de/pricing` at `/en/pricing` says the German page is a duplicate of the English one and invites the engine to drop it — the exact opposite of what a translated site wants. hreflang is the mechanism for saying "these are the same content in different languages", and it only works when each page is its own canonical.

**★ Why can't `sitemap.ts` read the locale from `next/root-params`?**
Because root params are documented as unsupported in Route Handlers — with support "planned for a future release" — and `sitemap.ts` is documented on its own page as a special Route Handler. The two statements are on different pages and the combination is an inference rather than something the docs spell out, so the honest position is: do not rely on it, and do not claim a specific failure mode. Practically it does not matter, because a sitemap should enumerate *all* locales anyway rather than being invoked once per locale — the restriction pushes you toward the design you wanted.

**★ What is `x-default` for, and where does it go?**
It names the URL to serve a user whose language does not match any of your alternates — typically a language selector or the most widely-understood version. It goes in the same `alternates.languages` object as an ordinary key, which works because the type is keyed by string rather than by a closed union of language tags. Omitting it is not an error; it just means the engine chooses for you, which for a site with three European locales and worldwide traffic is a choice worth making yourself.

**★ A localised sitemap is being rejected as too large at 30,000 URLs. Why?**
Because the limit that bound first was 50 MB, not 50,000 URLs. Each `<url>` entry now carries an `xhtml:link` element per locale, so with six locales an entry is roughly seven times the bytes of a bare one and the file crosses the size limit well before the row limit. The fix is to shard on bytes rather than rows — cut the per-shard page size to something like 10,000 — which is the case that makes the byte half of the limit worth remembering at all ([03c](03c-splitting-a-sitemap-generatesitemaps-and-the-50000-url-rule.md)).

---

← [Splitting a sitemap and the 50,000-URL rule](03c-splitting-a-sitemap-generatesitemaps-and-the-50000-url-rule.md) · [Chapter 12 overview](01-explanation.md) · Next → [Accessibility: semantic HTML](04-accessibility-semantic-html-aria-safe-hydration-keyboard-fir.md)
