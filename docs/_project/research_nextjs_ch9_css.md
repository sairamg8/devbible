---
name: research-nextjs-ch9-css
type: reference
keywords: nextjs, css, css modules, global css, tailwind, tailwind v4, css-in-js, styled-components, styled-jsx, useServerInsertedHTML, cssChunking, server components, chapter 9, styling
---

# Research bank — Next.js chapter 9, styling (CSS Modules / global CSS / Tailwind / CSS-in-JS)

**Banked 2026-09-04. Do not re-derive — write chapter 9 styling chunks from this file.**

Version spine: **Next.js 16.3.4 · React 19.2.8 · Node 20.9 floor**.

Probes run in the devbible checkout on 2026-09-04:

- `node -p "require('./node_modules/react/package.json').version"` → `19.2.8` ✅
- `node -p "require('next/package.json').version"` → `MODULE_NOT_FOUND`. **`next` is not
  installed in this checkout; no T1 probe of the Next.js package is possible.** Everything
  Next-specific below is T2 (doc fetch).
- `node -v` → `v24.20.0` (the track's floor is Node 20.9; the checkout runs newer).

Four fetches, all resolved 200. Each Next.js doc page self-reports `version: 16.3.4` in its
front matter, which is the strongest available pin given no installed package.

---

## 1 · `https://nextjs.org/docs/app/getting-started/css` (lastUpdated 2026-08-25, version 16.3.4)

### Tailwind — the doc's own setup is v4 CSS-first, NOT `tailwind.config.js`

Install:

```bash
npm install -D tailwindcss @tailwindcss/postcss
```

`postcss.config.mjs`:

```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
```

`app/globals.css`:

```css
@import 'tailwindcss';
```

Then `import './globals.css'` in `app/layout.tsx`.

🔴 **There is no `tailwind.config.js`, no `content` array and no `@tailwind base/components/
utilities` triple anywhere on this page.** The v3 flavour is a separate escape-hatch guide:

> *"**Good to know:** If you need broader browser support for very old browsers, see the
> [Tailwind CSS v3 setup instructions](/docs/app/guides/tailwind-v3-css)."*

### CSS Modules

> *"CSS Modules locally scope CSS by generating unique class names. This allows you to use
> the same class in different files without worrying about naming collisions."*

> *"To start using CSS Modules, create a new file with the extension `.module.css` and
> import it into any component inside the `app` directory"*

### Global CSS — where it may be imported, and the constraint

> *"Create a `app/global.css` file and import it in the root layout to apply the styles to
> **every route** in your application"*

🔴 The load-bearing caveat, verbatim:

> *"**Good to know:** Global styles can be imported into any layout, page, or component
> inside the `app` directory. However, since Next.js uses React's built-in support for
> stylesheets to integrate with Suspense, this currently does not remove stylesheets as you
> navigate between routes which can lead to conflicts. We recommend using global styles for
> *truly* global CSS (like Tailwind's base styles), Tailwind CSS for component styling, and
> CSS Modules for custom scoped CSS when needed."*

### External stylesheets

> *"Stylesheets published by external packages can be imported anywhere in the `app`
> directory, including colocated components"* — example `import 'bootstrap/dist/css/bootstrap.css'`.

> *"**Good to know:** In React 19, `<link rel="stylesheet" href="..." />` can also be used.
> See the React `link` documentation for more information."*

### Ordering and Merging

> *"Next.js optimizes CSS during production builds by automatically chunking (merging)
> stylesheets. The **order of your CSS** depends on the **order you import styles in your
> code**."*

> *"For example, `base-button.module.css` will be ordered before `page.module.css` since
> `<BaseButton>` is imported before `page.module.css`"*

Recommendations, verbatim list:

> *"* Try to contain CSS imports to a single JavaScript or TypeScript entry file
> * Import global styles and Tailwind stylesheets in the root of your application.
> * **Use Tailwind CSS** for most styling needs as it covers common design patterns with utility classes.
> * Use CSS Modules for component-specific styles when Tailwind utilities aren't sufficient.
> * Use a consistent naming convention for your CSS modules. For example, using `<name>.module.css` over `<name>.tsx`.
> * Extract shared styles into shared components to avoid duplicate imports.
> * Turn off linters or formatters that auto-sort imports like ESLint's `sort-imports`.
> * You can use the `cssChunking` option in `next.config.js` to control how CSS is chunked."*

### Development vs Production

> *"* In development (`next dev`), CSS updates apply instantly with Fast Refresh.
> * In production (`next build`), all CSS files are automatically concatenated into **many minified and code-split** `.css` files, ensuring the minimal amount of CSS is loaded for a route.
> * CSS still loads with JavaScript disabled in production, but JavaScript is required in development for Fast Refresh.
> * CSS ordering can behave differently in development, always ensure to check the build (`next build`) to verify the final CSS order."*

---

## 2 · `https://nextjs.org/docs/app/guides/css-in-js` (lastUpdated 2026-03-24, version 16.3.4)

Opening warning, verbatim:

> *"**Warning:** Using CSS-in-JS with newer React features like Server Components and
> Streaming requires library authors to support the latest version of React, including
> concurrent rendering."*

🔴 **The framing sentence:**

> *"The following libraries are supported in Client Components in the `app` directory
> (alphabetical)"*

List: `ant-design`, `chakra-ui`, `@fluentui/react-components`, `kuma-ui`, `@mui/material`,
`@mui/joy`, `pandacss`, `styled-jsx`, `styled-components`, `stylex`, `tamagui`, `tss-react`,
`vanilla-extract`.

> *"The following are currently working on support:"* — `emotion`
> (github.com/emotion-js/emotion/issues/2928).

⚠️ **What this page does NOT say.** It does not contain a sentence of the form "CSS-in-JS is
not supported in Server Components", and it does not name an error message or describe the
visual failure. It scopes support to Client Components and stops. Any page claiming a
specific runtime symptom must derive it from the React error mechanism, not from this page.

### The three-step opt-in, verbatim

> *"Configuring CSS-in-JS is a three-step opt-in process that involves:
> 1. A **style registry** to collect all CSS rules in a render.
> 2. The new `useServerInsertedHTML` hook to inject rules before any content that might use them.
> 3. A Client Component that wraps your app with the style registry during initial server-side rendering."*

`styled-jsx` needs `v5.1.0`+. Registry (`app/registry.tsx`, `'use client'`) uses
`createStyleRegistry()` in lazy `useState`, `useServerInsertedHTML` from `next/navigation`
returning `jsxStyleRegistry.styles()` after `flush()`, wrapped in `<StyleRegistry>`.

`styled-components@6`+ needs the compiler flag:

```js
module.exports = {
  compiler: {
    styledComponents: true,
  },
}
```

Registry uses `ServerStyleSheet` + `StyleSheetManager`, `getStyleElement()`,
`instance.clearTag()`, and short-circuits on the client:
`if (typeof window !== 'undefined') return <>{children}</>`.

### The four "Good to know" bullets — all load-bearing

> *"During server rendering, styles will be extracted to a global registry and flushed to
> the `<head>` of your HTML. This ensures the style rules are placed before any content that
> might use them. In the future, we may use an upcoming React feature to determine where to
> inject the styles."*

> *"During streaming, styles from each chunk will be collected and appended to existing
> styles. After client-side hydration is complete, `styled-components` will take over as
> usual and inject any further dynamic styles."*

> *"We specifically use a Client Component at the top level of the tree for the style
> registry because it's more efficient to extract CSS rules this way. It avoids
> re-generating styles on subsequent server renders, and prevents them from being sent in
> the Server Component payload."*

> *"For advanced use cases where you need to configure individual properties of
> styled-components compilation, you can read our Next.js styled-components API reference."*

---

## 3 · `https://tailwindcss.com/docs/installation/framework-guides/nextjs` (Tailwind's own docs)

**Tailwind CSS version reported by the site: v4.3.** Install for Next.js:

```bash
npm install tailwindcss @tailwindcss/postcss postcss
```

`postcss.config.mjs`:

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
export default config;
```

`./app/globals.css`:

```css
@import "tailwindcss";
```

🔴 **CSS-first configuration confirmed from two independent primary sources (Next.js docs
and Tailwind's own docs). Neither mentions `tailwind.config.js` on the current install
path.** ⚠️ I did **not** separately fetch the Tailwind `@theme` reference page, so the exact
`@theme` directive semantics are *not* verbatim-sourced here — any chunk using `@theme` must
mark it as unverified or fetch that page.

---

## 4 · `https://nextjs.org/docs/app/api-reference/config/next-config-js/cssChunking` (lastUpdated 2026-07-15, version 16.3.4)

> *"This feature is currently experimental and subject to change, it's not recommended for
> production."*

> *"CSS Chunking is a strategy used to improve the performance of your web application by
> splitting and re-ordering CSS files into chunks. This lets a route load close to only the
> CSS it needs, instead of loading all the application's CSS at once."*

Options, verbatim:

> *"* **`true` (default)** (**webpack and Turbopack**): Next.js will try to merge CSS files whenever possible, determining explicit and implicit dependencies between files from import order to reduce the number of chunks and therefore the number of requests.
> * **`false`** (**webpack only**): Next.js will not attempt to merge or re-order your CSS files.
> * **`'strict'`** (**webpack only**): Next.js will load CSS files in the correct order they are imported into your files, which can lead to more chunks and requests.
> * **`'graph'`** (**Turbopack only**): Next.js uses a cost-based graph algorithm to group CSS across your routes, balancing the bytes each route downloads and the requests it makes."*

🔴 Note the bundler split: `false` and `'strict'` are **webpack only**, `'graph'` is
**Turbopack only**. Turbopack is the default bundler since 16.0, so the "correctness"
escape hatch is not available under the default bundler.

The correctness scenario, verbatim:

> *"In webpack, that reason is usually correctness. Switch to `'strict'` if you run into
> unexpected CSS behavior. For example, if you import `a.css` and `b.css` in different files
> using a different `import` order (`a` before `b`, or `b` before `a`), `true` merges them
> in any order and assumes there are no dependencies between them; if `b.css` depends on
> `a.css`, `'strict'` prevents the merge and loads them in import order, at the cost of more
> chunks and requests. Use `false` to disable merging entirely."*

Unused-CSS debugging:

> *"Lighthouse flags this as a **Reduce unused CSS** opportunity with an estimated saving,
> and Chrome DevTools shows it per stylesheet in its Coverage panel, where a usage bar shows
> each stylesheet's applied CSS in green and unused CSS in gray."*

> *"When reading the report, watch out for styles that only apply on interaction, such as
> `:hover`, `:focus`, or classes toggled by JavaScript for menus and modals, since Coverage
> counts them as unused until you trigger them."*

> *"Either it is dead CSS in a stylesheet your route imports, which you fix in your source
> by removing the unused rules or moving them into a stylesheet only the routes that use
> them import (CSS Modules make this natural by scoping styles to the component that imports
> them)."*

`graph` tuning object: `{ type: 'graph', requestCost: 100000, weightDistribution: 0.1 }`.

> *"**`requestCost`** (default `20000`): the estimated cost, in bytes, of each additional CSS
> request. Larger values bias toward fewer, larger shared chunks, and fewer requests
> overall."*

> *"**`weightDistribution`** (default `0.1`): controls how a shared chunk's cost is
> distributed across the routes that load it, weighted by how much CSS each route imports.
> `0` weights every route equally; higher values give more weight to routes that import less
> CSS…"*

> *"What drives the decision is the size of the un-imported CSS a merge would push onto a
> route, much more than the size of the shared chunk it joins. With the default
> `requestCost` of about 20 KB, `only-a.css` would have to exceed roughly that size before
> it earns its own chunk, so small stylesheets stay merged."*

Graph algorithm: builds a weighted graph where two CSS files get a heavier edge the more
routes import them together **in the same order**, flattens it to a line, and places cuts:

```txt
reset theme layout │ dashboard │ settings │ login
└──── chunk 1 ────┘   chunk 2     chunk 3    chunk 4
```

> *"The algorithm chooses where to split chunks to minimize the total download cost across
> all routes, balancing bytes and requests. It optimizes that total, not each route on its
> own, so a route can end up carrying some CSS it never imported when that keeps the overall
> cost down."*

---

## 5 · `https://nextjs.org/docs/messages/react-client-hook-in-server-component`

The whole page, verbatim:

> *"## Why This Error Occurred
> You are using a React client hook in a Server Component.
> ## Possible Ways to Fix It
> Mark the component using the hook as a Client Component by adding `'use client'` at the
> top of the file."*

⚠️ **This page does NOT print the full runtime error string.** The commonly-quoted
`You're importing a component that needs useState…` wording is **not** on this page and must
not be quoted as if it were. What is quotable is the error's title —
*"React client hook in Server Component"* — and the one-line cause above.

---

## Open questions this bank does NOT settle

1. **The exact visible symptom of using a runtime CSS-in-JS component in a Server
   Component.** The docs scope support to Client Components and name the class of error
   (client hook in a Server Component) but never describe "renders unstyled" vs "build
   error" vs "hydration mismatch". Pages must state this as a mechanism-derived expectation,
   explicitly flagged as not settled by the docs.
2. **Tailwind `@theme` semantics** — not fetched.
3. **Whether `transpilePackages` affects CSS emitted by a workspace package** — not fetched;
   the corpus fact is that it exists for workspace packages containing JSX or `'use client'`.
