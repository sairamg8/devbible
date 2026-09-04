---
title: "The App Router has no built-in i18n routing — the next.config i18n block is a Pages Router feature, and localizing an app directory means owning the locale segment, the negotiation and the redirect yourself"
sidebar_label: "08 · Localized routing"
sidebar_position: 44
description: "Why the next.config i18n block is a Pages Router feature with no App Router counterpart, the six behaviours you inherit when you give it up, the app/[lang] segment every route has to sit under, and setting html lang yourself."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against [Internationalization (App Router)](https://nextjs.org/docs/app/guides/internationalization) (`lastUpdated: 2026-06-10`), [How to implement internationalization in Next.js (Pages Router)](https://nextjs.org/docs/pages/guides/internationalization) (`lastUpdated: 2026-03-03`), [`next/root-params`](https://nextjs.org/docs/app/api-reference/functions/next-root-params) (`lastUpdated: 2026-06-24`) and [Dynamic Route Segments](https://nextjs.org/docs/app/api-reference/file-conventions/dynamic-routes) (`lastUpdated: 2026-06-09`); doc paths resolved through [the docs sitemap](https://nextjs.org/docs/sitemap.md).
> Target: **Next.js 16.3.4** — documentation-verified, **no sandbox run**.

**Most i18n advice for Next.js is written for a feature the App Router does not have. `i18n: { locales, defaultLocale, domains }` in `next.config.js` is documented — in the *Pages Router* guide, which opens by announcing built-in support for internationalized routing and language detection since v10. The App Router guide describes something entirely different: a `[lang]` dynamic segment, a locale you negotiate yourself, a redirect you write yourself, and dictionaries you load yourself. Nothing in the App Router reads `NEXT_LOCALE` for you, nothing sets `html lang` for you, and nothing gives the default locale a prefix-free URL. The upside is that everything is explicit; the cost is that four features you never had to think about are now yours.**

## 🔴 The built-in i18n routing is Pages Router only

The `i18n` config block is documented on the Pages Router guide, whose own frontmatter carries `router: Pages Router`, and which opens with:

> *"Next.js has built-in support for internationalized (i18n) routing since `v10.0.0`. You can provide a list of locales, the default locale, and domain-specific locales and Next.js will automatically handle the routing."*

```js title="next.config.js — Pages Router ONLY"
module.exports = {
  i18n: {
    locales: ['en-US', 'fr', 'nl-NL'],
    defaultLocale: 'en-US',
  },
}
```

The App Router guide covers the same subject and **never mentions that config at all**. Its routing section instead says:

> *"Routing can be internationalized by either the sub-path (`/fr/products`) or domain (`my-site.fr/products`). With this information, you can now redirect the user based on the locale inside Proxy."*

⚠️ **What I could and could not confirm.** I resolved every path through the docs sitemap: there is no `i18n` page under `app/api-reference/config/next-config-js`, and no such page under `pages/` either — the block is documented only inside the Pages Router *guide*. I did **not** find a sentence anywhere in the current documentation that says in so many words *"the `i18n` config does not apply to the App Router."* What the docs establish is that the config is a Pages Router feature and that the App Router guide prescribes a hand-built alternative. Treat any App Router tutorial that configures `i18n` in `next.config` as writing against the wrong router.

### What you give up, and now own

Each of these is a documented Pages Router behaviour with no App Router counterpart in the guide:

| Built-in behaviour (Pages Router) | In the App Router |
|---|---|
| `locales` / `defaultLocale` config | a `[lang]` segment plus your own list |
| Automatic `Accept-Language` redirect | you write the redirect in `proxy.ts` |
| `NEXT_LOCALE` cookie taking priority over the header | you read the cookie yourself |
| Default locale served **without** a prefix | every locale is prefixed unless you build otherwise |
| Domain routing (`domains: [...]`) | your own host inspection |
| *"Next.js knows what language the user is visiting it will automatically add the `lang` attribute to the `<html>` tag"* | you set `lang` on `<html>` yourself |

That last one is a one-line fix and an easy accessibility regression, so it is worth doing first.

Two of those rows are big enough to own pages: dictionaries and reading the locale without prop-drilling are [08b · Dictionaries and reading the locale](08b-dictionaries-and-reading-the-locale.md), and negotiation plus the redirect are [08c · Negotiating a locale and redirecting](08c-negotiating-a-locale-and-redirecting.md).

## Sub-path or domain

> *"Routing can be internationalized by either the sub-path (`/fr/products`) or domain (`my-site.fr/products`)."*

The sub-path form is what the rest of this page describes, and it is the one the App Router guide develops. The domain form is a deployment concern rather than a routing one under the App Router: there is no `domains` config to declare, so the mapping from host to locale is something your redirect layer performs by inspecting the request. ⚠️ The App Router guide names domain routing as an option but does not work through an example of it, so treat any specific recipe — including cookie interaction and cross-domain links — as something you design and test, not something the framework specifies.

## The three pieces you now own

```text
proxy.ts                       1 · negotiate a locale, redirect an unprefixed path
app/[lang]/layout.tsx          2 · the segment: every route lives under it, and
app/[lang]/**                       <html lang> is set here
app/[lang]/dictionaries.ts     3 · load only the requested locale's strings
```

Each is small. What makes the migration from the Pages Router feel large is that all three used to be one config block, so there is no partial adoption: a `[lang]` segment with no redirect leaves `/` broken, and a redirect with no dictionaries gives you prefixed URLs that render English.

## The `[lang]` segment

> *"Finally, ensure all special files inside `app/` are nested under `app/[lang]`. This enables the Next.js router to dynamically handle different locales in the route, and forward the `lang` parameter to every layout and page."*

```text
app/
  [lang]/
    layout.tsx        ← the root layout, with <html lang={…}>
    page.tsx
    products/
      page.tsx
    dictionaries.ts
  proxy.ts            ← at the project root, beside app/
```

The whole tree moves under the segment. That is not a stylistic choice: it is what makes `lang` available to every route, and it is what makes `lang` a **root parameter**, which is where the ergonomics come from.

```tsx title="app/[lang]/page.tsx"
// You now have access to the current locale
// e.g. /en-US/products -> `lang` is "en-US"
export default async function Page({ params }: PageProps<'/[lang]'>) {
  const { lang } = await params
  return <p>{lang}</p>
}
```

> *"**Good to know:** `PageProps` and `LayoutProps` are globally available TypeScript helpers that provide strong typing for route parameters."*

`params` is a promise here as everywhere in 16 — see [03 · Dynamic routes](03-dynamic-routes-slug-catch-all-optional-catch-all.md).

### Set `html lang` in the root layout

Nothing does this for you now, and it is the attribute screen readers use to choose a voice:

```tsx title="app/[lang]/layout.tsx"
export default async function RootLayout({
  children,
  params,
}: LayoutProps<'/[lang]'>) {
  return (
    <html lang={(await params).lang}>
      <body>{children}</body>
    </html>
  )
}
```

## Locale identifiers are a standard, not a convention

> *"Locales are UTS Locale Identifiers, a standardized format for defining locales. Generally a Locale Identifier is made up of a language, region, and script separated by a dash: `language-region-script`. The region and script are optional."*
>
> *"`en-US` - English as spoken in the United States · `nl-NL` - Dutch as spoken in the Netherlands · `nl` - Dutch, no specific region"*

The App Router guide's own terminology section says the same, defining a locale as *"An identifier for a set of language and formatting preferences. This usually includes the preferred language of the user and possibly their geographic region."*

The fallback advice from the Pages Router guide still applies as a *design* rule even though the mechanism is gone:

> *"If user locale is `nl-BE` and it is not listed in your configuration, they will be redirected to `nl` if available, or to the default locale otherwise. If you don't plan to support all regions of a country, it is therefore a good practice to include country locales that will act as fallbacks."*

In the App Router nothing performs that redirect for you — but a locale matcher will do the equivalent, and the advice to include the bare-language codes as fallbacks is the reason it can.

## Gotchas

**★ Symptom: `i18n` is configured in `next.config.ts` and nothing is localized.** Cause: that block is a Pages Router feature; the App Router guide describes a hand-built approach and never references it. Fix: delete the config and build the three pieces — the segment, the negotiation, the redirect.

```text
app/[lang]/…      ← the segment
proxy.ts          ← negotiate + redirect
app/[lang]/dictionaries.ts
```

**★ Symptom: screen readers announce a French page in an English voice, and Lighthouse flags a missing `lang`.** Cause: the Pages Router set `html lang` automatically — *"Since Next.js knows what language the user is visiting it will automatically add the `lang` attribute"* — and nothing in the App Router does. Fix: set it in the root layout from the segment.

```tsx title="app/[lang]/layout.tsx"
export default async function RootLayout({ children, params }: LayoutProps<'/[lang]'>) {
  return (
    <html lang={(await params).lang}>
      <body>{children}</body>
    </html>
  )
}
```

**★ Symptom: half the app is under `app/[lang]` and half is not, and the routes outside it have no locale.** Cause: a partial migration. The guide is explicit that *"all special files inside `app/` are nested under `app/[lang]`"* — a route left outside is not merely unlocalized, it also means `lang` is no longer a segment above **the** root layout for the whole app. Fix: move everything, including `not-found`, `error` and the API routes you want localized.

**★ Symptom: hreflang tags are missing and Search Console reports duplicate content across locales.** Cause: nothing emits them; the Pages Router did not either — *"Next.js doesn't know about variants of a page so it's up to you to add the `hreflang` meta tags."* Fix: emit `alternates.languages` from `generateMetadata` and the matching sitemap alternates; the full rule set, including the reciprocity requirement and `x-default`, is [12 · 03d · Localized metadata](../12-seo-metadata-and-accessibility/03d-localized-metadata-for-i18n-routes.md).

**★ Symptom: `not-found.tsx` renders in English on a French route.** Cause: the file was left at `app/not-found.tsx` when the rest of the tree moved under `[lang]`, so it is outside the locale segment and has no `lang` to read. Fix: move it inside — *"ensure all special files inside `app/` are nested under `app/[lang]`"* means the special files too.

```text
app/[lang]/not-found.tsx     ← localized
app/not-found.tsx            ← the global fallback for paths with no locale at all
```

**★ Symptom: a route group is used to keep marketing pages out of the locale prefix, and the locale disappears everywhere.** Cause: a route group removes a folder from the URL but not from the tree — the routes inside it are still nested under whatever segments wrap the group, and moving them *outside* `app/[lang]` is what actually removes the locale. Fix: decide per route whether it is localized; if it is not, it lives outside `[lang]` and cannot read `lang` at all, including through `next/root-params`.

**★ Symptom: `next/root-params` reports no `lang` getter after the tree was restructured.** Cause: the segment is no longer *above* the root layout — usually because a `layout.tsx` was left at `app/layout.tsx` while the locale segment sits beneath it. Fix: the root layout must be `app/[lang]/layout.tsx`; the guide notes that *"The root layout can also be nested in the new folder (e.g. `app/[lang]/layout.js`)"*, and for root params it must be.

## Interview questions

**★ Does the App Router support the `i18n` option in `next.config.js`?**
No — that block is documented in the Pages Router guide, which describes Next.js's built-in internationalized routing and language detection since v10. The App Router guide covers the same subject and never mentions it, prescribing instead a `[lang]` dynamic segment, a locale negotiated in `proxy.ts` and a redirect you write. Being precise: I could not find a sentence in the current docs that explicitly says the config is ignored under the App Router, so the accurate statement is that it is a Pages Router feature with no App Router counterpart. Any tutorial that configures it for an `app/` directory is written against the other router.

**★ Name the concrete things you lose by moving from the built-in i18n routing to the App Router approach.**
The locale list and default locale as config; automatic redirection based on `Accept-Language`; the `NEXT_LOCALE` cookie taking priority over the header; the default locale being served without a URL prefix; domain routing; and the automatic `lang` attribute on `<html>`. Every one of those becomes code you write. The compensation is that all of it is now visible, testable and overridable, which the built-in version was not.

**★ Why does the entire `app/` tree have to move under `[lang]`?**
Because the segment has to be an ancestor of every route for the locale to be available everywhere — and because it is being *above the root layout* that makes `lang` a root parameter with an importable getter. A route left outside the segment has no locale at all, and it undermines the root-param property for the rest of the app. The guide states the requirement directly.

**★ What is a locale identifier, and why does the shape matter?**
It is a UTS Locale Identifier: `language-region-script`, with region and script optional — `en-US`, `nl-NL`, `nl`. The shape matters because negotiation is a matching problem: a browser sending `nl-BE` needs something to fall back to, and it can only fall back to `nl` if `nl` is in your supported list. The Pages Router guide's advice to include the bare-language codes as fallbacks is still the right design even though its automatic redirect is gone.

**★ Sub-path or domain routing — what changes in the App Router?**
Both are still possible, but only the sub-path form is developed in the guide. With no `domains` config to declare, host-to-locale mapping becomes something your redirect layer does by reading the request, which means you also own the consequences the built-in version handled: which host a locale switcher links to, and how a cookie set on one domain affects another. The guide names the option without specifying the mechanics, so a domain-routed App Router deployment is a design you have to validate rather than configure.

**★ Can you keep some routes out of the locale prefix with a route group?**
A route group changes the URL, not the tree, so it does not by itself remove a route from under `[lang]`. To have a genuinely unlocalized route you place it outside the locale segment — and then it has no `lang`, neither as a prop nor through `next/root-params`. That is a real architectural decision rather than a formatting one: it splits your app into localized and unlocalized halves, and anything shared between them cannot assume a locale exists.

---

← [07 · `proxy.ts`: the deployment boundary](07-the-proxyts-layer-successor-to-middlewarets-request-intercep.md) · [Chapter 2 overview](01-explanation.md) · Next → [08b · Dictionaries and reading the locale](08b-dictionaries-and-reading-the-locale.md)
