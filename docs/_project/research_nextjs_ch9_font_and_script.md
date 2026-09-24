---
name: research-nextjs-ch9-font-and-script
metadata:
  type: reference
---

# Research bank — Next.js ch9: `next/font` and `next/script`

**Banked 2026-09-04. Do not re-derive.** Version spine: **Next.js 16.3.4 · React 19.2.8 ·
Node 20.9 floor**. `next` is NOT installed in the devbible checkout
(`require('next/package.json')` → `MODULE_NOT_FOUND`), so **no T1 probe of the package is
possible**. `react` probes at 19.2.8. Everything below is T2 (fetched primary doc) or T0
(verbatim quote).

Five fetches, all resolved (HTTP 200, content returned):

| # | URL | Doc `version` | Doc `lastUpdated` |
|---|---|---|---|
| 1 | https://nextjs.org/docs/app/api-reference/components/font | 16.3.4 | 2025-08-06 |
| 2 | https://nextjs.org/docs/app/getting-started/fonts | 16.3.4 | 2026-05-27 |
| 3 | https://nextjs.org/docs/app/api-reference/components/script | 16.3.4 | 2026-08-25 |
| 4 | https://nextjs.org/docs/app/guides/scripts | 16.3.4 | 2026-06-01 |
| 5 | https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/size-adjust | n/a | n/a |

---

## `next/font` — verbatim

**Why it exists** (Font Module reference, #1):

> "`next/font` automatically optimizes your fonts (including custom fonts) and removes
> external network requests for improved privacy and performance."

> "It includes **built-in automatic self-hosting** for any font file. This means you can
> optimally load web fonts with no layout shift."

> "You can also conveniently use all Google Fonts. CSS and font files are downloaded at
> build time and self-hosted with the rest of your static assets. **No requests are sent
> to Google by the browser.**"

Getting-started (#2):

> "Fonts are scoped to the component they're used in. To apply a font to your entire
> application, add it to the Root Layout."

> "You can automatically self-host any Google Font. Fonts are included as static assets
> and served from the same domain as your deployment, meaning no requests are sent to
> Google by the browser when the user visits your site."

> "The path is resolved relative to the file where `localFont` is called. Fonts can be
> stored anywhere in the project, including the `public` folder or co-located inside the
> `app` folder."

**Option table** (#1) — ✓ supported / ✗ not:

| Key | `font/google` | `font/local` | Type | Required |
|---|---|---|---|---|
| `src` | ✗ | ✓ | String or Array of Objects | Yes |
| `weight` | ✓ | ✓ | String or Array | Required/Optional |
| `style` | ✓ | ✓ | String or Array | - |
| `subsets` | ✓ | ✗ | Array of Strings | - |
| `axes` | ✓ | ✗ | Array of Strings | - |
| `display` | ✓ | ✓ | String | - |
| `preload` | ✓ | ✓ | Boolean | - |
| `fallback` | ✓ | ✓ | Array of Strings | - |
| `adjustFontFallback` | ✓ | ✓ | Boolean or String | - |
| `variable` | ✓ | ✓ | String | - |
| `declarations` | ✗ | ✓ | Array of Objects | - |

Per-option verbatim:

- `weight` — "Required if the font being used is **not** variable." "for the font `Inter`,
  the possible values are `'100'`, `'200'`, … `'900'` or `'variable'` where `'variable'`
  is the default". `weight: '100 900'` = a range for a variable font. Array form
  "applies to `next/font/google` only".
- `style` — default `'normal'`. Array form google-only. local may take any standard value.
- `subsets` — "The font `subsets` … with the names of each subset you would like to be
  preloaded. Fonts specified via `subsets` will have a link preload tag injected into the
  head when the `preload` option is true, which is the default." google only.
- `axes` — "Some variable fonts have extra `axes` that can be included. By default, only
  the font weight is included to keep the file size down." google only.
- `display` — values `'auto' | 'block' | 'swap' | 'fallback' | 'optional'`,
  **"with default value of `'swap'`"**.
- `preload` — "A boolean value that specifies whether the font should be preloaded or not.
  The default is `true`."
- `fallback` — "The fallback font to use if the font cannot be loaded. An array of strings
  of fallback fonts with no default."
- `adjustFontFallback` — 🔴 the CLS mechanism:
  > "For `next/font/google`: A boolean value that sets whether an automatic fallback font
  > should be used to reduce Cumulative Layout Shift. The default is `true`."
  > "For `next/font/local`: A string or boolean `false` value that sets whether an
  > automatic fallback font should be used to reduce Cumulative Layout Shift. The possible
  > values are `'Arial'`, `'Times New Roman'` or `false`. The default is `'Arial'`."
- `variable` — "A string value to define the CSS variable name to be used if the style is
  applied with the CSS variable method."
- `declarations` — local only. "An array of font face descriptor key-value pairs that
  define the generated `@font-face` further." Example given by the docs:
  `declarations: [{ prop: 'ascent-override', value: '90%' }]`.

**Subsetting** (#1):

> "Google Fonts are automatically subset. This reduces the size of the font file and
> improves performance. You'll need to define which of these subsets you want to preload.
> Failing to specify any subsets while `preload` is `true` will result in a warning."

⚠️ The exact warning *text* is NOT given by the docs. Do not quote a string.

**Preloading scope** (#1) — verbatim:

> "When a font function is called on a page of your site, it is not globally available and
> preloaded on all routes. Rather, the font is only preloaded on the related routes based
> on the type of file where it is used:
> * If it's a unique page, it is preloaded on the unique route for that page.
> * If it's a layout, it is preloaded on all the routes wrapped by the layout.
> * If it's the root layout, it is preloaded on all routes."

**One instance per call** (#1):

> "Every time you call the `localFont` or Google font function, that font will be hosted as
> one instance in your application. Therefore, if you need to use the same font in multiple
> places, you should load it in one place and import the related font object where you need
> it. This is done using a font definitions file."

**Return value** (#1):
- `className` — "Returns a read-only CSS `className` for the loaded font to be passed to
  an HTML element."
- `style` — "Returns a read-only CSS `style` object for the loaded font to be passed to an
  HTML element, including `style.fontFamily` to access the font family name and fallback
  fonts."
- CSS variables — set the `variable` option, then put `font.variable` on a parent
  `className` and reference `var(--name)` in CSS.

**Naming** — "Use an underscore (\_) for font names with multiple words. E.g. `Roboto Mono`
should be imported as `Roboto_Mono`."

**Recommendation** — "Use multiple fonts conservatively since each new font is an
additional resource the client has to download."

**Version changes** — `v13.2.0` `@next/font` renamed to `next/font`, installation no longer
required. `v13.0.0` `@next/font` added.

### 🔴 What the font docs do NOT say (write as uncertain / leave out)

- They never name `size-adjust`, `ascent-override`, `descent-override` or
  `line-gap-override` as the descriptors `adjustFontFallback` emits. The only descriptor
  named anywhere is `ascent-override`, and only as an example of the **`declarations`**
  option for local fonts. **Do not claim the emitted descriptor set.**
- They never state a "call the loader at module scope" rule in so many words. The nearest
  evidence is (a) every example does it, (b) the one-instance-per-call sentence, (c)
  preloading is decided by *the type of file* the call sits in.
- The exact `subsets`-missing warning text is not published.
- No statement about `next/font` in a Client Component vs Server Component.

---

## MDN — `size-adjust` (web-platform fact, #5)

> "The **`size-adjust`** CSS descriptor for the `@font-face` at-rule defines a multiplier
> for glyph outlines and metrics associated with this font. This makes it easier to
> harmonize the designs of various fonts when rendered at the same font size."

> "The `size-adjust` descriptor behaves in a similar fashion to the `font-size-adjust`
> property. It calculates an adjustment per font by matching ex heights."

> "A `<percentage>` value with an initial value of 100%. All metrics associated with this
> font are scaled by the given percentage. This includes glyph advances, baseline tables,
> and overrides provided by `@font-face` descriptors."

> "The `size-adjust` property can help when overriding the metrics of a fallback font to
> better match those of a primary web font."

⚠️ The MDN page fetched does **not** mention `ascent-override` / `descent-override` /
`line-gap-override`.

---

## `next/script` — verbatim

**Props table** (#3) — the complete documented surface:

| Prop | Example | Type | Required |
|---|---|---|---|
| `src` | `src="http://example.com/script"` | String | Required unless inline script is used |
| `strategy` | `strategy="lazyOnload"` | String | - |
| `onLoad` | `onLoad={onLoadFunc}` | Function | - |
| `onReady` | `onReady={onReadyFunc}` | Function | - |
| `onError` | `onError={onErrorFunc}` | Function | - |

**The four strategies** (#3, identical wording in #4):

> "The loading strategy of the script. There are four different strategies that can be
> used:
> * `beforeInteractive`: Load before any Next.js code and before any page hydration occurs.
> * `afterInteractive`: (**default**) Load early but after some hydration on the page occurs.
> * `lazyOnload`: Load during browser idle time.
> * `worker`: (experimental) Load in a web worker."

**`beforeInteractive`** (#3):

> "Scripts that load with the `beforeInteractive` strategy are injected into the initial
> HTML from the server, downloaded before any Next.js module, and executed in the order
> they are placed."

> "Scripts denoted with this strategy are preloaded and fetched before any first-party
> code, but their execution **does not block page hydration from occurring**."

> "Scripts with the `beforeInteractive` strategy must be placed inside a root layout, such
> as `app/layout.tsx` or `app/[locale]/layout.tsx`, and are designed to load scripts that
> are needed by the entire site (i.e. the script will load when any page in the application
> has been loaded server-side)."

> "**This strategy should only be used for critical scripts that need to be fetched as soon
> as possible.**"

> "**Good to know**: Scripts with `beforeInteractive` will always be injected inside the
> `head` of the HTML document regardless of where it's placed in the component."

> "**Good to know**: These scripts run once per document load. A client-side navigation
> does not run them again, including one that only changes a root param, such as `/en` to
> `/fi`, since the root layout stays the same."

Named examples: **Bot detectors**, **Cookie consent managers**.

**`afterInteractive`** (#3):

> "Scripts that use the `afterInteractive` strategy are injected into the HTML client-side
> and will load after some (or all) hydration occurs on the page. **This is the default
> strategy** of the Script component and should be used for any script that needs to load
> as soon as possible but not before any first-party Next.js code."

> "`afterInteractive` scripts can be placed inside of any page or layout and will only load
> and execute when that page (or group of pages) is opened in the browser."

Named examples: **Tag managers**, **Analytics**.

**`lazyOnload`** (#3):

> "Scripts that use the `lazyOnload` strategy are injected into the HTML client-side during
> browser idle time and will load after all resources on the page have been fetched. This
> strategy should be used for any background or low priority scripts that do not need to
> load early."

Named examples: **Chat support plugins**, **Social media widgets**.

**`worker`** (#3 and #4, same warning):

> "**Warning:** The `worker` strategy is not yet stable and does not yet work with the App
> Router. Use with caution."

> "Scripts that use the `worker` strategy are off-loaded to a web worker in order to free up
> the main thread and ensure that only critical, first-party resources are processed on it.
> While this strategy can be used for any script, it is an advanced use case that is not
> guaranteed to support all third-party scripts."

> "`worker` scripts can **only currently be used in the `pages/` directory**"

Config: `experimental: { nextScriptWorkers: true }` in `next.config.js`. Guide (#4) adds:
"Scripts that use the `worker` strategy are offloaded and executed in a web worker with
Partytown." and the dev-server instruction string
`Please install Partytown by running npm install @qwik.dev/partytown`.

**🔴 The Client Component boundary** — three separate warnings (#3):

> "**Warning:** `onLoad` does not yet work with Server Components and can only be used in
> Client Components. Further, `onLoad` can't be used with `beforeInteractive` – consider
> using `onReady` instead."

> "**Warning:** `onReady` does not yet work with Server Components and can only be used in
> Client Components."

> "**Warning:** `onError` does not yet work with Server Components and can only be used in
> Client Components. `onError` cannot be used with the `beforeInteractive` loading
> strategy."

And the guide (#4) states it once for all three:

> "These handlers will only work when `next/script` is imported and used inside of a Client
> Component where `\"use client\"` is defined as the first line of code."

Handler semantics (#4):

> "* `onLoad`: Execute code after the script has finished loading.
> * `onReady`: Execute code after the script has finished loading and every time the
> component is mounted.
> * `onError`: Execute code if the script fails to load."

`onReady` longer form (#3):

> "Some third-party scripts require users to run JavaScript code after the script has
> finished loading and every time the component is mounted (after a route navigation for
> example)."

**Inline scripts** (#4):

> "Inline scripts, or scripts not loaded from an external file, are also supported by the
> Script component. They can be written by placing the JavaScript within curly braces"
> … "Or by using the `dangerouslySetInnerHTML` property"

> "**Warning**: An `id` property must be assigned for inline scripts in order for Next.js
> to track and optimize the script."

**Layout / application scripts and de-duplication** (#4):

> "The third-party script is fetched when the folder route (e.g. `dashboard/page.js`) or any
> nested route (e.g. `dashboard/settings/page.js`) is accessed by the user. Next.js will
> ensure the script will **only load once**, even if a user navigates between multiple
> routes in the same layout."

> "This script will load and execute when *any* route in your application is accessed.
> Next.js will ensure the script will **only load once**, even if a user navigates between
> multiple pages."

> "**Recommendation**: We recommend only including third-party scripts in specific pages or
> layouts in order to minimize any unnecessary impact to performance."

**Additional attributes / nonce** (#4) — 🔴 the CSP hook:

> "There are many DOM attributes that can be assigned to a `<script>` element that are not
> used by the Script component, like `nonce` or custom data attributes. Including any
> additional attributes will automatically forward it to the final, optimized `<script>`
> element that is included in the HTML."

Documented example passes `id`, `nonce="XUENAJFW"` and `data-test="script"`.

**Version history** (#3): `v13.0.0` `beforeInteractive`/`afterInteractive` modified to
support `app`; `v12.2.4` `onReady` added; `v12.2.2` `beforeInteractive` allowed in
`_document`; `v11.0.0` `next/script` introduced. **No entry newer than v13.0.0** — the
component's surface has not changed for the App Router since 13.

### 🔴 What the script docs do NOT say (write as uncertain / leave out)

- Whether a `beforeInteractive` script may carry `onReady` when `beforeInteractive` must
  live in the root layout and `onReady` requires a Client Component. The two rules are
  stated independently and never reconciled.
- Any deprecation of `worker`; it is still documented, still experimental, still
  `pages/`-only at 16.3.4.
- No `strategy` value beyond the four. There is no `"defer"`, no `"idle"`, no `"onDemand"`.
- The `@next/third-parties` package is not covered on either script page. The CSP guide
  (see devbible ch10 page 11) imports `GoogleTagManager` from `@next/third-parties/google`;
  its own API reference was NOT fetched in this pass.
