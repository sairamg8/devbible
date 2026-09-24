---
name: research-nextjs-ch12-seo-metadata-a11y
description: Banked primary-source research for Next.js chapter 12 (SEO, metadata, accessibility) — every load-bearing sentence with its URL and the page's own lastUpdated date. Fetched once, 2026-09-04, so no later chunk needs to re-fetch.
metadata:
  type: research
---

# Research bank — Next.js ch12: SEO, metadata, accessibility

**Fetched 2026-09-04** against `nextjs.org/docs` markdown (`curl` + `.md` suffix). Every page
carried `version: 16.3.4`. `lastUpdated:` per page is recorded below and is the date to cite.
`next` is **not installed** in the devbible checkout — **no T1 probe was possible**, all of this
is T0 (doc text) or T2 (fetched non-Next source).

## Pages fetched, with their real review dates

| `lastUpdated` | Page | URL |
|---|---|---|
| 2026-08-25 | generateMetadata | `/docs/app/api-reference/functions/generate-metadata` |
| 2026-08-25 | Metadata and OG images | `/docs/app/getting-started/metadata-and-og-images` |
| 2026-08-25 | sitemap.xml | `/docs/app/api-reference/file-conventions/metadata/sitemap` |
| 2026-08-25 | ImageResponse | `/docs/app/api-reference/functions/image-response` |
| 2026-08-25 | ESLint Plugin | `/docs/app/api-reference/config/eslint` |
| 2026-07-09 | opengraph-image and twitter-image | `/docs/app/api-reference/file-conventions/metadata/opengraph-image` |
| 2026-06-24 | next/root-params | `/docs/app/api-reference/functions/next-root-params` |
| 2026-06-10 | Internationalization | `/docs/app/guides/internationalization` |
| 2026-06-09 | generateViewport | `/docs/app/api-reference/functions/generate-viewport` |
| 2026-05-01 | robots.txt | `/docs/app/api-reference/file-conventions/metadata/robots` |
| 2026-03-10 | Production checklist | `/docs/app/guides/production-checklist` — **STALE, see below** |
| 2026-03-03 | favicon, icon, apple-icon | `/docs/app/api-reference/file-conventions/metadata/app-icons` |
| 2026-03-02 | JSON-LD | `/docs/app/guides/json-ld` |
| 2025-12-09 | generateSitemaps | `/docs/app/api-reference/functions/generate-sitemaps` |
| 2025-10-17 | Metadata Files index | `/docs/app/api-reference/file-conventions/metadata` |
| 2025-10-08 | generateImageMetadata | `/docs/app/api-reference/functions/generate-image-metadata` |
| 2025-10-03 | htmlLimitedBots | `/docs/app/api-reference/config/next-config-js/htmlLimitedBots` |
| **2024-11-06** | **Accessibility** | `/docs/architecture/accessibility` — **the oldest page in this area** |
| n/a | blocking-prerender-metadata-runtime | `/docs/messages/blocking-prerender-metadata-runtime` |
| n/a | blocking-prerender-metadata-dynamic | `/docs/messages/blocking-prerender-metadata-dynamic` |

## 1 · `metadata` / `generateMetadata` — the rules

- Both exports are **Server Components only**. **You cannot export both from the same route
  segment.** File-based metadata has **higher priority** and overrides both.
- `fetch` inside `generateMetadata` is memoized across `generateMetadata`,
  `generateStaticParams`, layouts, pages and Server Components. React `cache` when `fetch` is
  unavailable.
- `redirect()` and `notFound()` are usable inside `generateMetadata`. `searchParams` is only
  available in `page.js` segments.
- Evaluation order is root → leaf. **Merging is SHALLOW.** *"Duplicate keys are **replaced**
  based on their ordering."* A child that sets `openGraph: { title }` **drops every other
  `openGraph` field the parent set** — the docs' own worked example shows the missing
  `og:description`. A child that sets **no** `openGraph` inherits the parent's whole object.
  🔴 The old ch12 stub claimed field-by-field merge of nested objects. **That is wrong.**
- `title.template` applies **to child segments only**; `title.default` is required with it;
  `title.template` in a `page.js` has no effect (a page is terminating); `title.absolute`
  ignores parent templates.
- Default tags always emitted: `<meta charset="utf-8">` and
  `<meta name="viewport" content="width=device-width, initial-scale=1">`.
- Deprecated in **14.0**: `viewport`, `themeColor`, `colorScheme` inside `metadata` → move to
  `generateViewport`. Version history: 13.2 introduced, 15.2 streaming.
- Unsupported and must be rendered by hand: `<meta http-equiv>`, `<base>`, `<noscript>`,
  `<style>`, `<script>`, `<link rel=stylesheet>`. Resource hints go through
  `ReactDOM.preload / preconnect / prefetchDNS`, **client components only**.

### `metadataBase`

- Turns relative URLs in URL-valued metadata fields (current segment and below) into absolute.
- **A relative URL with no `metadataBase` is a build error.**
- URL composition *"favors developer intent over default directory traversal semantics"* —
  `/payments`, `payments`, `./payments` and **`../payments`** all resolve to
  `https://acme.com/payments`. `/` and `./` both give the bare origin. An absolute URL wins.
- With `'use cache'` in `generateMetadata`, the return value must be serializable and **`URL`
  instances are not supported by Cache Functions** — return `url.toString()`.

## 2 · Streaming metadata (15.2+)

- When metadata streams, *"the resulting metadata tags are appended to the `<body>` tag"*.
  Vercel state they verified Googlebot interprets this correctly.
- **HTML-limited bots** (can't run JS) get **blocking** metadata in `<head>`; detected by
  User-Agent. Default list includes Google crawlers (Mediapartners-Google, AdsBot-Google,
  Google-PageRenderer), Bingbot, Twitterbot, Slackbot — source file
  `packages/next/src/shared/lib/router/utils/html-bots.ts`.
- `htmlLimitedBots: /regex/` **overrides** (does not extend) the default list.
  `htmlLimitedBots: /.*/` disables streaming metadata entirely, at a TTFB cost.
- **Prerendered pages never stream metadata** — it is resolved at build time.
- `generateViewport` **cannot** stream: *"viewport cannot be streamed because it affects
  initial page load UI"*. Fix is `use cache` or a `<Suspense>` around the document `<body>`.

## 3 · Metadata under Cache Components

Two distinct errors, two distinct fixes:

- **`blocking-prerender-metadata-runtime`** — metadata read `cookies()`/`headers()`/`params`/
  `searchParams` while the rest of the route was prerenderable. Fixes: static `metadata`, or
  `generateStaticParams` + `generateMetadata` with `'use cache'`, or a dynamic marker.
- **`blocking-prerender-metadata-dynamic`** — metadata did an **uncached** `fetch`/DB call/
  `connection()`. Fixes: `'use cache'` (+ `cacheTag` for invalidation), or a dynamic marker.
  `use cache` does **not** apply to `connection()`.
- **Dynamic marker**: a component that `await connection()` and returns `null`, **wrapped in
  `<Suspense>`**. Without the boundary it propagates and the whole page blocks.
- `use cache` cannot be combined with `cookies()`/`headers()` in the same scope. `params` read
  inside a cached metadata function become part of the cache key automatically.
- A `cacheLife` profile whose `revalidate` is shorter than the prerender's effective lifetime
  **keeps the metadata out of the prerender** and makes the route partially dynamic.
- 🔴 **Framework-synthesized routes `/_not-found` and `/_global-error` inherit the root
  layout's `generateMetadata` and must be statically prerendered.** The dynamic marker cannot
  help — they have no page body. Fix: static metadata in the root layout, or
  `global-not-found.js`, which bypasses the root layout entirely.
- File-based metadata inside a dynamic segment (`icon.js`, `opengraph-image.js`) **implicitly
  depends on `params`** and is therefore treated as dynamic. Pair with `generateStaticParams`
  or switch to a static `icon.png`.
- Debugging: `next build --debug-prerender` for full user-frame stacks,
  `next build --debug-build-paths /dashboard /settings` to iterate. Opt out per segment with
  `export const instant = false`; app-wide with
  `experimental.instantInsights.validationLevel: 'manual-warning'`.

## 4 · Open Graph, Twitter, images

- `og:image` etc. must be **absolute URLs** unless `metadataBase` supplies the origin.
- `openGraph.type: 'article'` emits `article:published_time` and one `article:author` per
  author. Twitter card types include `summary_large_image` and `app`.
- Facebook: **`appId` or `admins`, not both.** Pinterest: `pinterest: { richPin: true }`.
- `other: { custom: ['meta1','meta2'] }` emits repeated `<meta name="custom">` tags.
- **File conventions beat the config object** — the docs recommend the file API for both OG
  images and icons *"rather than having to sync the config export with actual files"*.
- File sizes: **`twitter-image` ≤ 5 MB, `opengraph-image` ≤ 8 MB — over the limit the build
  fails.**
- Alt text for a static image file comes from a sibling `opengraph-image.alt.txt`.
- Code-generated images: `alt`, `size`, `contentType` are **module exports**, not return
  values. `params` is a **Promise since 16.0**. Same for `icon`/`apple-icon`.
- Generated images are **statically optimized by default** unless they use request-time APIs
  or uncached data; they are special Route Handlers and accept route segment config.
- `generateImageMetadata` returns an array where each item **must** have an `id`; the id
  arrives at the image function as a **promise**.
- Icons: `favicon.ico` **only at the root of `app/`**; `icon` accepts `.ico .jpg .jpeg .png
  .svg` at `app/**/*`; `apple-icon` accepts `.jpg .jpeg .png`. Numbered suffixes
  (`icon1.png`, `icon2.png`) sort **lexically**. `sizes="any"` is emitted for `.svg` or when
  the size cannot be determined. `msapplication-*` tags are no longer needed.

### `ImageResponse` limits (all from the API reference)

- Backed by `@vercel/og`, **Satori** and **Resvg**; HTML+CSS → PNG.
- *"Only flexbox and a subset of CSS properties are supported. Advanced layouts (e.g.
  `display: grid`) will not work."*
- **Maximum bundle size 500 KB**, counting JSX, CSS, fonts, images and every other asset.
- Fonts: **only `ttf`, `otf`, `woff`**; `ttf`/`otf` preferred for parse speed.
- Defaults `width: 1200`, `height: 630`, `emoji: 'twemoji'`. Also accepts `debug`, `status`,
  `statusText`, `headers`.
- Local assets: read at **module scope** (`readFile` + `process.cwd()`), path relative to the
  **project root**, not the source file. Passing an `ArrayBuffer` to `<img src>` works at
  runtime but is not in the HTML spec, so it needs `@ts-expect-error`.

## 5 · JSON-LD

- Recommendation is a plain `<script type="application/ld+json">` in `layout.js`/`page.js`.
- `JSON.stringify` **does not sanitise XSS**; the documented mitigation is
  `.replace(/</g, '\\u003c')`, or a hardened serializer such as `serialize-javascript`.
- Type it with `schema-dts` (`WithContext<Product>`).
- *"Since JSON-LD is structured data, not executable code, a native `<script>` tag is the right
  choice here"* — i.e. **not** `next/script`.
- Validate with Google's Rich Results Test or `validator.schema.org`.

## 6 · `sitemap.ts` / `robots.ts`

- Both are **special Route Handlers, cached by default** unless they use a request-time API or
  a dynamic config option.
- `Sitemap` entry: `url`, `lastModified`, `changeFrequency`, `priority`, `alternates.languages`,
  `images: string[]`, `videos: Videos[]`.
- Localized sitemap `alternates.languages` emits `xhtml:link rel="alternate" hreflang=…`.
- Multiple sitemaps: nest `sitemap.ts` in route segments, or `generateSitemaps`.
  Output URLs are **`/product/sitemap/1.xml`** (15.0 made dev and prod agree; 13.3.2 used
  `/product/sitemap.xml/1`).
- 🔴 **16.0: the `id` from `generateSitemaps` is now a Promise resolving to a `string`.** The
  docs' own example then writes `const start = id * 50000`, which does not typecheck against a
  `string` — coerce with `Number(id)`.
- Google's limit is **50,000 URLs per sitemap** (stated in the docs' example comment).
- `Robots` object: `rules` (one object or an array), each with `userAgent`, `allow`,
  `disallow`, `crawlDelay`, `other`; plus top-level `sitemap` (string or array) and `host`.
- 🔴 **`other` is new in 16.3.0** — non-standard per-agent directives such as Seznam's
  `Request-Rate` or Yandex's `Clean-param`. *"Values in `other` are passed through verbatim.
  Next.js does not validate directive names or values."* Keys keep their casing; array values
  emit one line each, scoped to that rule's `User-Agent` block.

## 7 · i18n and root params

- Recommended shape: everything under `app/[lang]`, locale chosen in `proxy.ts` from
  `Accept-Language` (`@formatjs/intl-localematcher` + `negotiator`), redirect to the prefixed
  path. `generateStaticParams` on the root layout to prerender locales.
- `hasLocale()` narrowing + `notFound()` so a missing dictionary 404s instead of throwing.
- `next/root-params` exports one async getter per dynamic segment **above the root layout**.
  🔴 *"It cannot be used in Client Components, Server Actions, or Route Handlers. Support for
  Route Handlers is planned for a future release."* — **so `sitemap.ts`, `robots.ts`,
  `opengraph-image.ts` and `icon.ts` cannot read root params**, since all four are Route
  Handlers. (The Route-Handler status of the metadata files is stated on their own reference
  pages; the exclusion is stated on the root-params page. The *combination* is an inference,
  not a documented sentence — flagged as such in the pages.)
- Root param names must be valid JS identifiers; `[post-slug]` errors.
- Only the root params a cached function actually calls become part of its cache key.
- With multiple root layouts, a param missing from one is typed `string | undefined`.
- `alternates.languages` in `metadata` emits `<link rel="alternate" hreflang=…>`;
  `alternates.canonical` emits `<link rel="canonical">`; both compose with `metadataBase`.

## 8 · Accessibility — what Next.js actually provides

Only two things, both on `/docs/architecture/accessibility`, **lastUpdated 2024-11-06**:

1. **Route announcer.** Server navigations are announced by the browser; client transitions
   are not, so Next ships an announcer. 🔴 It picks the name to announce by looking at
   **`document.title` first, then the `<h1>`, then the URL pathname.**
2. **Linting** — and this is the stale half. That page says Next *"includes
   `eslint-plugin-jsx-a11y`"* by default and links the **Pages Router** ESLint page. The
   current ESLint reference (2026-08-25) describes `eslint-config-next` as
   `@next/eslint-plugin-next` **plus recommended rule-sets from `eslint-plugin-react` and
   `eslint-plugin-react-hooks`** — jsx-a11y is **not** in that list, though jsx-a11y *is*
   named later in the same page as a plugin that can conflict if you already configure it.
   🔴 **Unresolved in the docs; cannot be probed here because `next` is not installed.** The
   pages say so and tell the reader to add `eslint-plugin-jsx-a11y` explicitly.
3. **`next lint` was removed in 16.0** along with the `eslint` key in `next.config`;
   `next build` no longer lints. Codemod: `migrate-from-next-lint-to-eslint-cli`. So whatever
   jsx-a11y coverage existed, **nothing runs it during a build any more.**

The production checklist (2026-03-10) still says *"Use the built-in `eslint-plugin-jsx-a11y`
plugin"*, still calls Partial Prerendering experimental, and still points at
`@next/bundle-analyzer` "for webpack" — three separate staleness tells on one page.

Doc-recommended a11y resources on that page: WebAIM WCAG checklist, WCAG 2.2, The A11y
Project, MDN colour-contrast, `prefers-reduced-motion`.

## 9 · React and platform sources for the a11y chunks

**`useId`** (react.dev, React 19.2):
- Exists to generate IDs for accessibility attributes (`aria-describedby`, `aria-labelledby`).
- *"With server rendering, `useId` requires an identical component tree on the server and the
  client."*
- Caveats: not for list keys, not for `use()` cache keys, **cannot currently be used in async
  Server Components**, ID is stable while mounted but may change during rendering.
- `hydrateRoot`'s `identifierPrefix` must match the server's prefix — matters for multi-root
  pages.

**`hydrateRoot`** (react.dev):
- *"hydrateRoot() expects the rendered content to be identical with the server-rendered
  content. You should treat mismatches as bugs and fix them."*
- 🔴 *"There are no guarantees that attribute differences will be patched up in case of
  mismatches."* — this is why an `aria-*` attribute that differs across the boundary can stay
  wrong in the DOM with only a dev-mode warning.
- `suppressHydrationWarning`: *"This only works one level deep, and is intended to be an
  escape hatch."* React will not patch mismatched **text** content.
- Two-pass rendering (`isClient` in an Effect) is the documented way to render deliberately
  different client content; it makes hydration slower and can feel jarring.

**WAI-ARIA APG, Read Me First** (`w3.org/WAI/ARIA/apg/practices/read-me-first/`):
- Section title: **"No ARIA is better than Bad ARIA."**
- **"Principle 1: A role is a promise."** `<div role="button">` promises the keyboard
  behaviour of a button; ARIA roles do **not** make browsers supply keyboard behaviour or
  styling.
- Principle 2: ARIA both cloaks and enhances. `<a role="menuitem">` is perceived as a menu
  item, not a link; `aria-label` replaces the perceivable content entirely;
  `<ul role="navigation">` destroys the list semantics of its own `<li>` children.

**APG modal dialog pattern** (`w3.org/WAI/ARIA/apg/patterns/dialog-modal/`):
- On open, focus moves inside the dialog — generally the first focusable element, but a
  `tabindex="-1"` static element at the top when the content is long or structured, and the
  **least destructive action** when the dialog completes an irreversible step.
- `Tab`/`Shift+Tab` wrap within the dialog. `Escape` closes it.
- On close, **focus returns to the invoking element**, unless that element is gone or the
  workflow logically continues elsewhere.
- *"It is strongly recommended that the tab sequence of all dialogs include a visible element
  with role button that closes the dialog."*
- Tabbable = `tabindex >= 0`; values greater than 0 are strongly discouraged.

**MDN `inert`** (Baseline widely available since April 2023):
- Inert elements and their flat-tree descendants: no click events, cannot be focused, excluded
  from find-in-page, text not selectable, not editable, **removed from the tab order and the
  accessibility tree**.
- Modal `<dialog>` opened with `showModal()` **escapes** ancestor inertness; nothing else does.
- For individual controls prefer `disabled`; `inert` is for regions.

**Playwright accessibility testing** (`playwright.dev/docs/accessibility-testing`):
- Uses `@axe-core/playwright`; `new AxeBuilder({ page }).analyze()` then assert
  `violations` is empty.
- *"Automated accessibility tests can detect some common accessibility problems such as
  missing or invalid properties. But many accessibility problems can only be discovered
  through manual testing."*

**Lighthouse accessibility scoring**
(`developer.chrome.com/docs/lighthouse/accessibility/scoring`):
- Weighted average of the audits; **weighting comes from axe user-impact assessments**.
- **Each audit is pass/fail — no partial credit.** If some buttons have accessible names and
  others do not, the page scores 0 for that audit.
- **Manual checks are excluded from the score entirely.** The manual list includes: custom
  controls have ARIA roles; custom controls have associated labels; trapped user focus;
  interactive controls are keyboard-focusable; interactive elements indicate purpose and
  state; the page has a logical tab order; the user's focus is directed to new content added
  to the page; offscreen content is hidden from assistive technology.

## 10 · Facts to reuse, do not re-derive

- **Crawlers get a full dynamic render** (banked in ch5 `03b`, quoted there) — this retires
  almost every "you need SSR for SEO" argument and is the spine of page 5.
- `priority` deprecated in 16 for `preload` (ch9 `04b`).
- `next lint` removed in 16.0 (ch13 `13-linting-after-next-lint.md` covers the wiring in
  full — cross-link, do not restate).
- ch2 has `11-root-params.md` and `11b-root-params-restrictions-and-typing.md`.

## 11 · What I could NOT settle

1. **Whether `eslint-config-next@16.3` still bundles `eslint-plugin-jsx-a11y`.** The two doc
   pages disagree and there is no installed package to inspect. Written as an open question
   with the safe action (wire it explicitly).
2. **Whether `next/root-params` getters throw or return `undefined` inside `sitemap.ts`.** The
   docs say Route Handlers are unsupported and metadata files are Route Handlers, but no page
   states the combination or the failure mode. Written as "do not rely on it", not as a
   documented error.
3. **Whether metadata streamed into `<body>` is valid HTML per the parser spec.** The docs say
   it happens and that Googlebot handles it; they do not discuss validity. Not asserted.
4. **The exact default `htmlLimitedBots` list.** The doc gives four examples and links a source
   file on `canary`; the file was not fetched, so only the four named agents are stated.

---

# Addendum — fetched 2026-09-04 by ch12 Fork A (pages 02–06 + 01g)

Second research pass, for the OG/JSON-LD/sitemap/robots/a11y/pitfalls/milestone chunks. Same
method: `curl` + `.md` on `nextjs.org/docs`, HTML stripped for non-Next sources. Still **no T1
probe** (`next` not installed). Pages re-fetched carried the same `lastUpdated` as the table
above, plus these new ones: `loading.js` **2026-06-08**, `not-found.js` **2026-07-10**,
`manifest.json` **2026-03-03**.

## A · The `htmlLimitedBots` default list — SETTLED (open question 4 above is now closed)

Fetched `packages/next/src/shared/lib/router/utils/html-bots.ts` at **tag `v16.3.4`** and at
`canary`; **identical at both**. This is framework source, not documentation:

```
/[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|
bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|
facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|
SkypeUriPreview|Yeti|googleweblight/i
```

Its own comment: *"This regex contains the bots that we need to do a blocking render for and
can't safely stream the response due to how they parse the DOM."* 🔴 **`facebookexternalhit`,
`Twitterbot`, `Slackbot`, `Discordbot`, `LinkedInBot` and `WhatsApp` are all in it** — every
unfurler that matters gets blocking metadata in `<head>`. `Chrome-Lighthouse` is in it too, so
a Lighthouse run does **not** exercise the streaming path.

## B · Streaming, status codes and soft 404s — `loading.js`, `lastUpdated: 2026-06-08`

`https://nextjs.org/docs/app/api-reference/file-conventions/loading`

- *"When streaming, a `200` status code will be returned to signal that the request was
  successful."*
- *"Because the response headers have already been sent to the client, the status code of the
  response cannot be updated."*
- *"For example, when a 404 page is streamed to the client, Next.js includes a
  `<meta name="robots" content="noindex">` tag in the streamed HTML."*
- *"Some crawlers may label these responses as "soft 404s". In the streaming case, this does not
  lead to indexation because the page is explicitly marked `noindex` in the HTML."*
- *"If you need a 404 status, for compliance or analytics, ensure the resource exists before the
  response body is streamed, so that the server can set the HTTP status code."*
- *"The response body starts streaming when a Suspense fallback renders (for example, a
  `loading.tsx`) or when a Server Component suspends under a `Suspense` boundary. Place
  `notFound()` before those boundaries and before any `await` that may suspend."*
- *"Some browsers buffer a streaming response. You may not see the streamed response until the
  response exceeds 1024 bytes."*
- Static export does **not** support streaming (platform-support table).

`not-found.js` (`2026-07-10`): *"Next.js will return a `200` HTTP status code for streamed
responses, and `404` for non-streamed responses"*. `global-not-found.js` is **experimental**
(`experimental.globalNotFound: true`), bypasses the root layout, and *"must return a full HTML
document, including `<html>` and `<body>` tags"*.

## C · `opengraph-image` / `twitter-image` — `lastUpdated: 2026-07-09`

- Static file types: `.jpg .jpeg .png .gif`. Alt companion is `opengraph-image.alt.txt`.
- *"The `twitter-image` file size must not exceed 5MB, and the `opengraph-image` file size must
  not exceed 8MB. If the image file size exceeds these limits, the build will fail."*
- A static `opengraph-image` file emits **four** tags: `og:image`, `og:image:type`,
  `og:image:width`, `og:image:height`. `twitter-image` emits the `name="twitter:image*"` four.
- Code-generated: `.js .ts .tsx`, default-export a function returning a `Response`.
  *"`opengraph-image.js` and `twitter-image.js` are special Route Handlers that are cached by
  default unless it uses a Request-time API or dynamic config option."*
- *"By default, generated images are statically optimized (generated at build time and cached)
  unless they use Request-time APIs or uncached data."*
- Module exports `alt`, `size`, `contentType` map 1:1 to `og:image:alt`, `og:image:width` +
  `og:image:height`, `og:image:type`.
- `params` is `Promise<…>` **since v16.0.0** (version history table); it covers root segment down
  to the colocated segment; `undefined` for a static segment.
- *"`opengraph-image` and `twitter-image` are specialized Route Handlers that can use the same
  route segment configuration options as Pages and Layouts."*
- Local assets: *"Place the local asset relative to the project root, not the example source
  file."* and *"The asset doesn't depend on request data, so read it once at module scope."*
- ArrayBuffer `<img src>`: *"Passing an `ArrayBuffer` to the `src` attribute of an `<img>`
  element is not part of the HTML spec. The rendering engine used by `next/og` supports it, but
  because TypeScript definitions follow the spec, you need a `@ts-expect-error` directive."*

## D · `ImageResponse` — `lastUpdated: 2026-08-25`

- Signature defaults: `width = 1200`, `height = 630`, `emoji = 'twemoji'`, `debug = false`,
  `status = 200`; plus `statusText` and `headers`. `fonts[]` items are
  `{ name, data: ArrayBuffer, weight, style: 'normal' | 'italic' }`.
- *"`ImageResponse` uses @vercel/og, Satori, and Resvg to convert HTML and CSS into PNG."*
- *"Only flexbox and a subset of CSS properties are supported. Advanced layouts (e.g.
  `display: grid`) will not work."*
- *"Maximum bundle size of `500KB`. The bundle size includes your JSX, CSS, fonts, images, and
  any other assets."*
- *"Only `ttf`, `otf`, and `woff` font formats are supported. To maximize the font parsing speed,
  `ttf` or `otf` are preferred over `woff`."*
- Moved `next/server` → `next/og` in **v14.0.0**.

## E · Icons — `app-icons`, `lastUpdated: 2026-03-03`

- *"The `favicon` image can only be located in the top level of `app/`."* `.ico` only.
  `icon`: `.ico .jpg .jpeg .png .svg` at `app/**/*`. `apple-icon`: `.jpg .jpeg .png`.
- `favicon.ico` emits `<link rel="icon" href="/favicon.ico" sizes="any" />`; `icon` emits
  `href="/icon?<generated>"` with generated `type` and `sizes`; `apple-icon` emits
  `rel="apple-touch-icon"`.
- *"You can set multiple icons by adding a number suffix to the file name. For example,
  `icon1.png`, `icon2.png`, etc. Numbered files will sort lexically."*
- *"`sizes="any"` is added to icons when the extension is `.svg` or the image size of the file is
  not determined."*
- 🔴 *"You cannot generate a `favicon` icon. Use `icon` or a `favicon.ico` file instead."*
- Code-generated icons return `Blob | ArrayBuffer | TypedArray | DataView | ReadableStream |
  Response`; config exports are `size` and `contentType` **only** (no `alt` — icons take no alt).

## F · `generateImageMetadata` — `lastUpdated: 2025-10-08`

- Returns an array; *"each item **must** include an `id` value which will be passed as a promise
  to the props of the image generating function."* Fields: `id` (required `string`), `alt`,
  `size`, `contentType`.
- Its own `params` argument is a **plain object**, not a promise (`{ params }: { params: { slug:
  string } }` in the doc's signature) — unlike the image function's `params`, which is a promise.
  🔴 Asymmetry worth flagging; it is what the reference shows.

## G · `manifest` — `lastUpdated: 2026-03-03`

- `manifest.(json|webmanifest)` in the **root** of `app`; or `manifest.(js|ts)` returning
  `MetadataRoute.Manifest`. *"`manifest.js` is a special Route Handlers that is cached by default
  unless it uses a Request-time API or dynamic config option."* (sic — the doc's own typo)
- The reference deliberately does not enumerate fields: *"The manifest object contains an
  extensive list of options that may be updated due to new web standards."* Points at MDN.

## H · Sitemaps — `sitemap`, `lastUpdated: 2026-08-25` · `generateSitemaps`, `2025-12-09`

- *"`sitemap.js` is a special Route Handler that is cached by default unless it uses a
  Request-time API or dynamic config option."*
- Return type verbatim: `url` (required), `lastModified?: string | Date`,
  `changeFrequency?: 'always'|'hourly'|'daily'|'weekly'|'monthly'|'yearly'|'never'`,
  `priority?: number`, `alternates?: { languages?: Languages<string> }`, `images?: string[]`,
  `videos?: Videos[]`.
- Localized output is `xhtml:link rel="alternate" hreflang="…"` **inside each `<url>`**, with the
  `xmlns:xhtml` namespace added to `<urlset>`.
- Image sitemaps add `xmlns:image` + `image:image/image:loc`; video sitemaps add `xmlns:video`
  + `video:title / video:thumbnail_loc / video:description`.
- Multiple sitemaps: nest `sitemap.(xml|js|ts)` in route segments, **or** `generateSitemaps`.
- *"Your generated sitemaps will be available at `/.../sitemap/[id].xml`. For example,
  `/product/sitemap/1.xml`."* (13.3.2 used `/product/sitemap.xml/1`; **15.0.0** made dev and prod
  agree.)
- 🔴 **v16.0.0: *"`id` is now a promise that resolves to a `string`."*** The reference's own
  example then writes `const start = id * 50000` after `const id = await props.id` — arithmetic
  on a `string`. **The documented example does not typecheck.** Coerce with `Number(id)`.
- The 50,000 figure appears only as a code comment in the example: `// Google's limit is 50,000
  URLs per sitemap`. Version history: `changeFrequency`/`priority` added 13.4.14; localizations
  14.2.0; `sitemap` 13.3.0.

## I · `robots` — `lastUpdated: 2026-05-01`

- Type verbatim: `rules` is one object **or** an array; each rule has `userAgent?`, `allow?`,
  `disallow?`, `crawlDelay?`, `other?`; top level takes `sitemap?: string | string[]` and
  `host?: string`. 🔴 In the **array** form `userAgent` is **required**; in the single-object
  form it is optional.
- `userAgent` accepts an array and **fans out into one `User-Agent:` block per agent** — the
  doc's own output shows `Applebot` and `Bingbot` each getting their own block.
- `other` is **v16.3.0**: *"Values in `other` are passed through verbatim. Next.js does not
  validate directive names or values, so refer to the target search engine's documentation for
  the exact syntax."* Also: *"Keys preserve their casing and array values emit one line per
  entry, scoped to the rule's `User-Agent` block."*

## J · JSON-LD — `lastUpdated: 2026-03-02`

- *"Our current recommendation for JSON-LD is to render structured data as a `<script>` tag in
  your `layout.js` or `page.js` components."*
- 🔴 *"The following snippet uses `JSON.stringify`, which does not sanitize malicious strings
  used in XSS injection. To prevent this type of vulnerability, you can scrub `HTML` tags from
  the `JSON-LD` payload, for example, by replacing the character, `<`, with its unicode
  equivalent, `\u003c`."* The documented call is
  `JSON.stringify(jsonLd).replace(/</g, '\\u003c')` inside `dangerouslySetInnerHTML`.
- *"Review your organization's recommended approach to sanitize potentially dangerous strings,
  or use community maintained alternatives for `JSON.stringify` such as, serialize-javascript."*
- *"The `next/script` component is optimized for loading and executing JavaScript. Since JSON-LD
  is structured data, not executable code, a native `<script>` tag is the right choice here."*
- Validation: Rich Results Test (Google) or `validator.schema.org`. Typing: `schema-dts`,
  `WithContext<Product>`.

## K · Open Graph protocol — `ogp.me` (no version/date on the page)

- *"The four required properties for every page are:"* `og:title`, `og:type`, `og:image`,
  `og:url`.
- *"og:image:alt - A description of what is in the image (not a caption). If the page specifies
  an og:image it should specify og:image:alt."*
- `og:locale` (default `en_US`) and repeatable `og:locale:alternate`.

## L · The unfurlers — Meta's own webmaster docs

`https://developers.facebook.com/docs/sharing/webmasters/` (page says *Updated: Jun 30, 2026*):

- 🔴 *"Images are cached based on the URL and won't be updated unless the URL changes."*
  **This is the whole stale-preview mechanism, stated by the platform.** Alongside: *"To update
  an image after it's been published, use a new URL for the new image."*
- *"og:url — The canonical URL for your page. This should be the undecorated URL, without session
  variables, user identifying parameters, or counters."*
- *"For your website to be shared correctly by our crawler, your server must also use the gzip
  and deflate encodings."*
- *"The debugger also triggers a scrape of your page"* — the Sharing Debugger is both a read and
  a cache-bust.
- Test UA given by the docs:
  `facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)`.

`https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/` (*Updated: May 21, 2026*):

- 🔴 *"Any Open Graph properties need to be listed before the first 1 MB of your website or app,
  or it will be cutoff."*
- *"Ensure that the content can be crawled by the crawler within a few seconds or Facebook will
  be unable to display the content."*
- *"Note that the FacebookExternalHit crawler might bypass robots.txt when performing security or
  integrity checks."*
- *"crawlers may cache the contents of robots.txt for up to 24 hours."*
- The docs' own simulation command sends `Range: bytes=0-524288` and `--compressed`.

⚠️ `docs.x.com` returned **404** for the Cards overview path; **X/Twitter card behaviour is
therefore NOT primary-sourced here.** Twitter card *fields* are documented on the Next.js
`generateMetadata` reference and that is the only citation used. Card rendering, X's own cache
duration and the Card Validator's status are **not asserted anywhere**.

## M · Google Search Central

`/search/docs/crawling-indexing/sitemaps/build-sitemap` (*Last updated 2026-07-08 UTC*):

- *"All formats limit a single sitemap to 50MB (uncompressed) or 50,000 URLs."*
- 🔴 *"Google ignores `<priority>` and `<changefreq>` values."*
- *"Google uses the `<lastmod>` value if it's consistently and verifiably (for example by
  comparing to the last modification of the page) accurate."*
- *"The `<lastmod>` value should reflect the date and time of the last significant update to the
  page. … an update to the copyright date is not."*

`/search/docs/crawling-indexing/robots/intro` (*Last updated 2025-12-10 UTC*):

- 🔴 *"This is used mainly to avoid overloading your site with requests; it is not a mechanism
  for keeping a web page out of Google."*

`/search/docs/crawling-indexing/block-indexing`:

- 🔴 *"For the `noindex` rule to be effective, the page or resource must not be blocked by a
  robots.txt file, and it has to be otherwise accessible to the crawler."*
- *"Specifying the `noindex` rule in the robots.txt file is not supported by Google."*

## N · WCAG 2.2 — verbatim success criteria (`w3.org/TR/WCAG22/`, W3C Recommendation)

- **1.1.1 Non-text Content (A)** — *"If non-text content is a control or accepts user input,
  then it has a name that describes its purpose."*
- **1.3.1 Info and Relationships (A)** — *"Information, structure, and relationships conveyed
  through presentation can be programmatically determined or are available in text."*
- **1.4.3 Contrast (Minimum) (AA)** — *"The visual presentation of text and images of text has a
  contrast ratio of at least 4.5:1"*, large text 3:1.
- **2.1.1 Keyboard (A)** — *"All functionality of the content is operable through a keyboard
  interface without requiring specific timings for individual keystrokes"*, path-dependent
  exception only.
- **2.1.2 No Keyboard Trap (A)** — *"If keyboard focus can be moved to a component of the page
  using a keyboard interface, then focus can be moved away from that component using only a
  keyboard interface"*, and the user must be told the exit method if it is non-standard.
- **2.4.1 Bypass Blocks (A)** — *"A mechanism is available to bypass blocks of content that are
  repeated on multiple web pages."*
- **2.4.2 Page Titled (A)** — *"Web pages have titles that describe topic or purpose."*
- **2.4.3 Focus Order (A)** — *"focusable components receive focus in an order that preserves
  meaning and operability."*
- **2.4.6 Headings and Labels (AA)** — *"Headings and labels describe topic or purpose."*
- **2.4.7 Focus Visible (AA)** — *"Any keyboard operable user interface has a mode of operation
  where the keyboard focus indicator is visible."*
- **2.4.11 Focus Not Obscured (Minimum) (AA) — NEW in 2.2** — *"When a user interface component
  receives keyboard focus, the component is not entirely hidden due to author-created content."*
- **2.5.3 Label in Name (A)** — *"For user interface components with labels that include text or
  images of text, the name contains the text that is presented visually."*
- **2.5.8 Target Size (Minimum) (AA) — NEW in 2.2** — *"The size of the target for pointer inputs
  is at least 24 by 24 CSS pixels"*, with spacing/equivalent/inline/user-agent exceptions.
- **3.1.1 Language of Page (A)** — *"The default human language of each web page can be
  programmatically determined."*
- **3.3.2 Labels or Instructions (A)** — *"Labels or instructions are provided when content
  requires user input."*
- **4.1.2 Name, Role, Value (A)** — *"For all user interface components … the name and role can
  be programmatically determined; states, properties, and values that can be set by the user can
  be programmatically set; and notification of changes to these items is available to user
  agents, including assistive technologies."* Note: *"standard HTML controls already meet this
  success criterion when used according to specification."*
- **4.1.3 Status Messages (AA)** — *"status messages can be programmatically determined through
  role or properties such that they can be presented to the user by assistive technologies
  without receiving focus."*
- **4.1.1 Parsing** is *"(Obsolete and removed)"* in 2.2 — duplicate `id`s no longer fail a
  criterion on their own, though they still break `aria-labelledby`.

## O · `w3.org/TR/using-aria/` — the four rules, verbatim

1. *"If you can use a native HTML element or attribute with the semantics and behavior you
   require already built in, instead of re-purposing an element and adding an ARIA role, state or
   property to make it accessible, then do so."*
2. *"Do not change native semantics, unless you really have to."* Its example: not
   `<h2 role=tab>`, but `<div role=tab><h2>heading tab</h2></div>`.
3. *"All interactive ARIA controls must be usable with the keyboard."* — *"if using role=button
   the element must be able to receive focus and a user must be able to activate the action
   associated with the element using both the enter … and the space key."*
4. *"Do not use role="presentation" or aria-hidden="true" on a focusable element."* — *"Using
   either of these on a focusable element will result in some users focusing on 'nothing'."*

## P · APG *Developing a Keyboard Interface*

`https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/`

- *"In HTML, only form controls and anchors with an HREF attribute are included in the tab
  sequence."*
- `tabindex="0"` — *"included in the tab sequence based on its position in the DOM."*
  `tabindex="-1"` — *"not included in the tab sequence but is focusable with element.focus()."*
  `tabindex="X"` where X ≥ 1 — *"Authors are strongly advised NOT to use these values."*
- *"The DOM order also determines screen reader reading order."* and *"The most robust method of
  manipulating the order of the tab sequence … is rearranging elements in the DOM."*
- *"the tab sequence should include only one focusable element of a composite UI component."*
- Roving tabindex algorithm, verbatim: *"the element that is to be included in the tab sequence
  has `tabindex="0"` and all other focusable elements contained in the composite have
  `tabindex="-1"`."* On an arrow key: set `-1` on the old, `0` on the new, then `element.focus()`.
- *"One benefit of using roving tabindex rather than aria-activedescendant to manage focus is
  that the user agent will scroll the newly focused element into view."*
- `aria-activedescendant`: only the container is in the tab sequence; *"Assistive technologies
  will consider the element referred to as active to be the focused element even though DOM focus
  is on the element that has the aria-activedescendant property."*
- Where focus lands on entry, by widget class: last-focused (grid, treegrid) · the selected
  element (radio group, tabs, listbox, tree) · the first element (menubar, toolbar).

## Q · What this pass could NOT settle (added to §11 above)

5. **X/Twitter's own card cache behaviour and the current Card Validator URL.** `docs.x.com`
   404s on the documented path. Written as "not sourced"; the pages state only what the Next.js
   reference says about `twitter:*` fields.
6. **Whether the Next.js route announcer moves focus** as well as announcing. The architecture
   page (2024-11-06) describes announcement only. The pages say announcement is not focus
   management and that focus must be handled by the application, flagged as the docs being
   silent rather than as a documented behaviour.
7. **Whether `eslint-config-next@16.3` bundles `eslint-plugin-jsx-a11y`** — unchanged from §11.1
   above; the architecture page (2024-11-06) says it does, the current ESLint reference does not
   list it. Still unresolvable without an install.
8. **What Google's renderer does with metadata appended to `<body>`.** Vercel state they
   verified it; Google's own documentation was not found to address tag position. Not asserted.
