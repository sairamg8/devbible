---
title: "The order of your CSS is the order of your imports, the production build merges stylesheets on that order, and development is not obliged to agree — which makes 'it works locally' a CSS bug class in its own right"
sidebar_label: "01b · CSS order and chunking"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against **Next.js 16.3.4** — [Getting Started: CSS § Ordering and Merging](https://nextjs.org/docs/app/getting-started/css) and [`cssChunking`](https://nextjs.org/docs/app/api-reference/config/next-config-js/cssChunking) (both pages self-report `version: 16.3.4`; `lastUpdated` 2026-08-25 and 2026-07-15). React **19.2.8** probed on the installed package. 🔴 `next` is **not installed in this checkout** (`MODULE_NOT_FOUND`), so nothing here is probed from the package. Node floor **20.9**. **No sandbox run** — no build output, no measured byte counts; the only sizes named are defaults quoted from the documentation.

**Two CSS rules with the same specificity are decided by which one appears later in the stylesheet. In a bundled application, "later" is decided by module import order, and module import order is a depth-first walk of a graph nobody on the team is looking at. Then the production build merges your stylesheets into shared chunks using that same order as its evidence for what depends on what — and the documentation says, in as many words, that ordering can behave differently in development. That combination is why a component can look right for a month and break when someone adds a barrel file, alphabetises the imports, or extracts a shared button.**

## The rule, stated exactly

> *"Next.js optimizes CSS during production builds by automatically chunking (merging) stylesheets. The **order of your CSS** depends on the **order you import styles in your code**."*
> — [Getting Started: CSS](https://nextjs.org/docs/app/getting-started/css)

The documentation's own example, reproduced in full because the ordering is the point:

```tsx
// page.tsx
import { BaseButton } from './base-button'
import styles from './page.module.css'

export default function Page() {
  return <BaseButton className={styles.primary} />
}
```

```tsx
// base-button.tsx
import styles from './base-button.module.css'

export function BaseButton() {
  return <button className={styles.primary} />
}
```

> *"For example, `base-button.module.css` will be ordered before `page.module.css` since `BaseButton` is imported before `page.module.css`."*
> — [Getting Started: CSS](https://nextjs.org/docs/app/getting-started/css)

**Trace why.** The bundler processes `page.tsx` top to bottom. The first import is `./base-button`, so it descends into that module, and *that* module's first import is `base-button.module.css` — so the button's stylesheet is emitted first. Only when the subtree is exhausted does the bundler return to `page.tsx` and reach `./page.module.css`. The stylesheet of a **deeper** component lands **earlier**, and therefore **loses** ties to its parent.

That happens to be the behaviour you want: a page should be able to override a shared button. But it is an accident of the import happening to sit on line 1. Swap the two lines in `page.tsx` and the page's own stylesheet is emitted first, quietly losing every specificity tie to the button it is trying to restyle. Nothing in the source of either file tells you this. **Import order is a load-bearing part of your styling and it looks like formatting.**

## The three edits that silently reorder a whole app

**1 · An auto-sorting linter or formatter.** Alphabetising imports rewrites the emission order of every stylesheet in the file. The documentation makes this an explicit recommendation:

> *"Turn off linters or formatters that auto-sort imports like ESLint's `sort-imports`."*
> — [Getting Started: CSS](https://nextjs.org/docs/app/getting-started/css)

This is the "it works locally" bug in its purest form: a developer with format-on-save and a different plugin config commits a reordered import block, CI is green, and one page's button loses its border in production.

**2 · A barrel file.** Replacing three direct imports with `import { Card, Button, Badge } from '@/components'` collapses them into one edge, and the emission order becomes the order of the re-exports inside `components/index.ts` — a file whose ordering nobody treats as meaningful.

```ts
// components/index.ts — this file now decides CSS precedence
export { Button } from './button'   // button.module.css emitted first
export { Card } from './card'
export { Badge } from './badge'
```

**3 · Extracting a shared component.** Moving a style from `page.module.css` into a new `shared-header.module.css` moves it from "emitted late, wins ties" to "emitted early, loses ties". The CSS text is identical; the outcome is not.

The documentation's recommendation list is the countermeasure — six of its eight items verbatim below, the other two being the auto-sort warning quoted above and the `cssChunking` option that gets its own section further down:

> *"Try to contain CSS imports to a single JavaScript or TypeScript entry file · Import global styles and Tailwind stylesheets in the root of your application. · **Use Tailwind CSS** for most styling needs as it covers common design patterns with utility classes. · Use CSS Modules for component-specific styles when Tailwind utilities aren't sufficient. · Use a consistent naming convention for your CSS modules. For example, using `<name>.module.css` over `<name>.tsx`. · Extract shared styles into shared components to avoid duplicate imports."*
> — [Getting Started: CSS](https://nextjs.org/docs/app/getting-started/css)

## The real fix: stop letting source order decide

Every recommendation above is a discipline. The mechanical fix is a cascade layer, because layer precedence is fixed by **where the layer is declared**, not by where a rule appears. Declare the order once in the global stylesheet and import order stops mattering for cross-layer conflicts:

```css
/* app/global.css — the only place layer order is decided */
@layer reset, base, components, utilities;

@layer reset {
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }
}

@layer base {
  body {
    margin: 0;
    font-family: system-ui, sans-serif;
  }
}
```

```css
/* app/components/base-button.module.css */
@layer components {
  .primary {
    border: 1px solid var(--color-ink);
    padding: 0.5rem 1rem;
  }
}
```

```css
/* app/blog/page.module.css */
@layer utilities {
  .primary {
    border-color: transparent;
  }
}
```

`utilities` now beats `components` no matter which file the bundler emitted first, because the layer statement in `global.css` fixed the order. ⚠️ **Cascade layers are plain CSS, not a Next.js feature — the Next.js documentation does not mention them anywhere on the CSS page, so treat this as a CSS-level technique this page recommends, not a documented framework behaviour.** The one thing to watch is that the `@layer reset, base, components, utilities;` statement must itself be reached first, which is why it belongs in the root-layout global stylesheet.

## Merging: what the production build does with that order

Chunking is controlled by `experimental.cssChunking`, and the documentation is blunt about what the default assumes:

> *"**`true` (default)** (**webpack and Turbopack**): Next.js will try to merge CSS files whenever possible, determining explicit and implicit dependencies between files from import order to reduce the number of chunks and therefore the number of requests."*
> — [`cssChunking`](https://nextjs.org/docs/app/api-reference/config/next-config-js/cssChunking)

**"Determining implicit dependencies from import order" is the sentence to internalise.** The bundler has no way to know that `theme.css` must precede `components.css`; it infers it from the fact that you always import them in that order. When you do not always import them in that order, it infers there is no dependency, and merges them however it likes:

> *"if you import `a.css` and `b.css` in different files using a different `import` order (`a` before `b`, or `b` before `a`), `true` merges them in any order and assumes there are no dependencies between them; if `b.css` depends on `a.css`, `'strict'` prevents the merge and loads them in import order, at the cost of more chunks and requests."*
> — [`cssChunking`](https://nextjs.org/docs/app/api-reference/config/next-config-js/cssChunking)

🔴 **The escape hatch is not available under the default bundler.** Read the option list by bundler:

| Value | Bundlers | Behaviour |
|---|---|---|
| `true` | webpack **and Turbopack** | default; merges aggressively, infers dependencies from import order |
| `false` | **webpack only** | *"Next.js will not attempt to merge or re-order your CSS files."* |
| `'strict'` | **webpack only** | *"load CSS files in the correct order they are imported into your files, which can lead to more chunks and requests"* |
| `'graph'` | **Turbopack only** | *"a cost-based graph algorithm to group CSS across your routes, balancing the bytes each route downloads and the requests it makes"* |

Turbopack has been the default bundler since Next.js 16.0 — see [ch11 · Turbopack in dev and production](../11-performance-optimization-turbopack/01-turbopack-in-dev-and-production-fast-refresh.md). So on a default 16.3.4 app, **`'strict'` is not an option you have.** The correctness knob the documentation describes is a webpack knob. Under Turbopack the only cure for an order-dependent merge is to remove the order dependency in your source — one consistent import order, or cascade layers.

The same section is explicit that `'graph'` is a *performance* dial, not a correctness one:

> *"For most applications, the default (`true`) is the right choice in either bundler: it merges CSS to make fewer requests. Reach for another strategy only for a specific reason. In Turbopack, that reason is usually performance."*
> — [`cssChunking` § Choosing a strategy](https://nextjs.org/docs/app/api-reference/config/next-config-js/cssChunking)

And the whole option is flagged:

> *"This feature is currently experimental and subject to change, it's not recommended for production."*
> — [`cssChunking`](https://nextjs.org/docs/app/api-reference/config/next-config-js/cssChunking)

Which leaves you in an honest place: **the default is the setting, and your source is where you fix ordering.**

## Development and production are allowed to disagree

> *"* In development (`next dev`), CSS updates apply instantly with Fast Refresh. * In production (`next build`), all CSS files are automatically concatenated into **many minified and code-split** `.css` files, ensuring the minimal amount of CSS is loaded for a route. * CSS still loads with JavaScript disabled in production, but JavaScript is required in development for Fast Refresh. * CSS ordering can behave differently in development, always ensure to check the build (`next build`) to verify the final CSS order."*
> — [Getting Started: CSS](https://nextjs.org/docs/app/getting-started/css)

Three separate facts worth pulling apart:

- **Ordering may differ between `next dev` and `next build`.** The documentation states it flatly and tells you to verify against a build. A styling bug that only appears in production is therefore *expected behaviour*, not a mystery — and the reverse is equally possible.
- **Development injects CSS through JavaScript** so Fast Refresh can replace it. Production emits real, code-split `.css` files that load without JavaScript. So "styles are missing with JS disabled" is a dev-only observation and proves nothing about production.
- **Production concatenates into "many" files, not one.** Per-route CSS is the goal, which is why the merge exists at all.

**The operational rule:** any CSS change whose correctness depends on precedence gets checked against a production build before it is believed. Not a dev server, not a hot reload.

## What CSS actually costs, and what drives the number

🔴 **No numbers are invented here.** The only sizes named are documented defaults.

CSS is **render-blocking**: the browser will not paint content that a pending stylesheet applies to. So the cost of CSS is not primarily bytes downloaded, it is bytes on the critical path of the first paint. Two forces pull against each other, and `cssChunking` is where they are priced:

- **Fewer, larger chunks** — fewer requests, but a route downloads rules it never uses.
- **More, smaller chunks** — each route downloads closer to only what it imports, at the cost of more requests.

> *"**`requestCost`** (default `20000`): the estimated cost, in bytes, of each additional CSS request. Larger values bias toward fewer, larger shared chunks, and fewer requests overall."*
> — [`cssChunking`](https://nextjs.org/docs/app/api-reference/config/next-config-js/cssChunking)

> *"What drives the decision is the size of the un-imported CSS a merge would push onto a route, much more than the size of the shared chunk it joins. With the default `requestCost` of about 20 KB, `only-a.css` would have to exceed roughly that size before it earns its own chunk, so small stylesheets stay merged."*
> — [`cssChunking`](https://nextjs.org/docs/app/api-reference/config/next-config-js/cssChunking)

So the practical model is: **a stylesheet under roughly 20 KB will be merged into a shared chunk and pushed onto routes that never imported it.** That is fine and deliberate. It also means "my login page downloads the dashboard's CSS" is the design working, not a bug — and it is why the fix is structural rather than a config flag.

The graph strategy, if you need to tune it:

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig = {
  experimental: {
    cssChunking: {
      type: 'graph',
      requestCost: 100000,
      weightDistribution: 0.1,
    },
  },
} satisfies NextConfig

export default nextConfig
```

> *"**`weightDistribution`** (default `0.1`): controls how a shared chunk's cost is distributed across the routes that load it, weighted by how much CSS each route imports. `0` weights every route equally; higher values give more weight to routes that import less CSS, so the algorithm prioritizes routes with less CSS…"*
> — [`cssChunking`](https://nextjs.org/docs/app/api-reference/config/next-config-js/cssChunking)

And the diagnosis path, which is a browser tool rather than a build flag:

> *"Lighthouse flags this as a **Reduce unused CSS** opportunity with an estimated saving, and Chrome DevTools shows it per stylesheet in its Coverage panel, where a usage bar shows each stylesheet's applied CSS in green and unused CSS in gray."*
> — [`cssChunking`](https://nextjs.org/docs/app/api-reference/config/next-config-js/cssChunking)

> *"When reading the report, watch out for styles that only apply on interaction, such as `:hover`, `:focus`, or classes toggled by JavaScript for menus and modals, since Coverage counts them as unused until you trigger them."*
> — [`cssChunking`](https://nextjs.org/docs/app/api-reference/config/next-config-js/cssChunking)

And the documented source-level fix, which is the argument for CSS Modules restated as a bundling argument:

> *"Either it is dead CSS in a stylesheet your route imports, which you fix in your source by removing the unused rules or moving them into a stylesheet only the routes that use them import (CSS Modules make this natural by scoping styles to the component that imports them)."*
> — [`cssChunking`](https://nextjs.org/docs/app/api-reference/config/next-config-js/cssChunking)

For the general bundle-measurement workflow, see [ch11 · bundle analysis and lazy loading](../11-performance-optimization-turbopack/03-bundle-analysis-dynamic-imports-lazy-loading.md).

## Gotchas

**★ Symptom: a style is correct in `next dev` and wrong in the deployed build.** Cause: the two pipelines are allowed to order CSS differently — *"CSS ordering can behave differently in development"* — and only the build concatenates and merges. Fix: verify precedence-sensitive changes against `next build` output, and remove the tie entirely with cascade layers so neither ordering can be wrong.

**★ Symptom: enabling an import-sorting rule breaks styling across the app.** Cause: emission order of stylesheets is import order; alphabetising the imports rewrites it everywhere at once. Fix: disable the rule, as the documentation recommends, or move every conflict into layers so sorting cannot change the outcome.

```json
{
  "rules": {
    "sort-imports": "off",
    "simple-import-sort/imports": "off"
  }
}
```

**★ Symptom: extracting a shared component changed how an unrelated page looks.** Cause: the style moved from a late-emitted page module to an early-emitted shared module, flipping every specificity tie between them. Fix: raise specificity deliberately in the page module, or put the shared component's rules in a lower cascade layer.

**Symptom: adding a barrel `index.ts` reordered CSS.** Cause: the barrel's export order replaced the consumer's import order as the traversal order. Fix: either import components by their real path, or accept that the barrel file is now a style-precedence declaration and comment it as one.

**Symptom: you set `cssChunking: 'strict'` and nothing changed.** Cause: `'strict'` is **webpack only**, and Turbopack has been the default bundler since 16.0, so the value does not apply. Fix: remove the order dependency in source; do not switch bundlers for this.

**Symptom: a route's stylesheet contains rules the route never imported.** Cause: the default chunking merges stylesheets below the `requestCost` threshold — about 20 KB by default — into shared chunks. Fix: nothing, usually. If it is genuinely material, split the rules into a stylesheet only the using routes import, or tune `'graph'` under Turbopack.

**Symptom: Coverage shows 80% of a stylesheet unused and you delete the rules.** Cause: Coverage counts `:hover`, `:focus` and JavaScript-toggled classes as unused until triggered. Fix: exercise the interactions before trusting the report; delete only what you can prove is dead in source.

**Symptom: styles vanish when you disable JavaScript, but only on your machine.** Cause: development injects CSS through JavaScript for Fast Refresh; production emits real `.css` files. Fix: test the no-JS case against a production build — this is explicitly documented behaviour, not a regression.

**Symptom: you set `cssChunking` and CI flags it.** Cause: it lives under `experimental` and the documentation says it is *"not recommended for production"*. Fix: treat it as a diagnostic dial, not a shipped setting, unless you have a specific measured reason and have re-checked the flag's status against the current docs.

## Interview questions

**★ Two CSS Modules define the same class name with the same specificity. Which wins?**
The one emitted later, and emission order is import order — a depth-first walk of the module graph, not the order components appear in JSX. In the documentation's own example, `base-button.module.css` is emitted **before** `page.module.css` because `BaseButton` is imported on the line above the page's own stylesheet, so the page wins ties. Move that import one line down and the answer flips, with no visible change to either stylesheet. That is why the durable answer is "do not let it be a tie" — cascade layers or deliberate specificity.

**★ Why does the default `cssChunking` setting risk changing your CSS order at all?**
Because it infers dependencies rather than knowing them. Quoting the docs, it works by *"determining explicit and implicit dependencies between files from import order"*. If every file imports `a.css` before `b.css`, it concludes `b` may depend on `a` and preserves the order. If two files disagree about the order, it concludes there is no dependency and *"merges them in any order"*. So an inconsistency in your import sites — which is invisible in review — is what licenses the bundler to reorder.

**★ Your app on Next.js 16.3.4 has an order-dependent CSS bug. Why can you not just set `cssChunking: 'strict'`?**
Because `'strict'` and `false` are documented as **webpack only**, and Turbopack is the default bundler from 16.0 onwards. Under the default bundler your options are `true` and `'graph'`, both of which merge. The knob does not exist for you, so the fix has to be in source: a single consistent import order, imports concentrated in one entry file, or cascade layers so precedence is declared rather than inferred.

**★ How do you make CSS precedence independent of import order?**
Cascade layers. `@layer reset, base, components, utilities;` in the root global stylesheet fixes the precedence of the four layers at that point; a rule inside `@layer utilities` then beats a rule inside `@layer components` regardless of which stylesheet the bundler emitted first, because layer order outranks source order in the cascade. It is plain CSS — the Next.js documentation does not mention it — and the one requirement is that the layer statement itself is reached first, which is why it lives in the root-layout import.

**What is the actual cost of CSS, and why is "total kilobytes of CSS" the wrong metric?**
Because CSS is render-blocking: the browser will not paint content styled by a stylesheet it is still fetching. The metric that matters is bytes on the critical path for *this* route, plus the number of round trips it takes to get them. That is exactly the trade `cssChunking` prices — `requestCost` is *"the estimated cost, in bytes, of each additional CSS request"*, default 20000, meaning a stylesheet smaller than roughly 20 KB is worth merging into a shared chunk even though some routes will download it unused.

**A route downloads CSS it never imported. Bug or design?**
Design. The default strategy merges stylesheets to cut requests and optimises the total cost across all routes, not each route individually — the docs say so directly: *"it optimizes that total, not each route on its own, so a route can end up carrying some CSS it never imported when that keeps the overall cost down."* You only intervene when the un-imported CSS pushed onto a light route is large enough to matter, and then you either restructure the imports or tune `'graph'`.

**Where does the CSS Modules argument turn into a bundling argument?**
At the unused-CSS question. The documentation's own remedy for dead CSS in a route's stylesheet is to move rules *"into a stylesheet only the routes that use them import"*, and it observes that CSS Modules *"make this natural by scoping styles to the component that imports them."* A module ties a stylesheet's lifetime to an import edge, so the bundler can tell which routes need it. A global stylesheet gives the bundler no such edge — every route that loads it needs all of it, by definition.

**How would you verify a CSS ordering fix before shipping it?**
Against a production build, because the docs state ordering can differ in development and instruct you to *"check the build (`next build`) to verify the final CSS order"*. Then check the affected route in Chrome DevTools' Coverage panel and Lighthouse's *Reduce unused CSS* audit, remembering that interaction-only rules count as unused until triggered. A hot-reloaded dev page is not evidence about production precedence.

---

← [01 · CSS Modules vs global CSS](01-css-modules-global-stylesheets-utility-first-tailwind-config.md) · [Chapter index](01-explanation.md) · Next → [01c · Tailwind v4 and coexistence](01c-tailwind-v4-css-first-config-and-coexisting-with-css-modules.md)
