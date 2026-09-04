---
title: "Tailwind's setup in a current Next.js app is a PostCSS plugin and one line of CSS — there is no `tailwind.config.js` on the documented path any more, and getting that wrong is how a project ends up with two competing styling systems"
sidebar_label: "01c · Tailwind v4 and coexistence"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against **Next.js 16.3.4** — [Getting Started: CSS § Tailwind CSS](https://nextjs.org/docs/app/getting-started/css) (page self-reports `version: 16.3.4`, `lastUpdated: 2026-08-25`) — **cross-checked against Tailwind's own primary source**, [Tailwind CSS — Framework guide: Next.js](https://tailwindcss.com/docs/installation/framework-guides/nextjs), which reports **Tailwind CSS v4.3**. React **19.2.8** probed on the installed package. 🔴 `next` and `tailwindcss` are **not installed in this checkout** — `require('next/package.json')` throws `MODULE_NOT_FOUND` — so nothing here is probed from a package; both setups are quoted from documentation. Node floor **20.9**. **No sandbox run**, no build output, no byte counts.

**🔴 I checked this rather than writing it from habit, because it changed and it is exactly the sort of thing a reference gets wrong for two years. Two independent primary sources — the Next.js CSS page and Tailwind's own Next.js framework guide — show the same setup, and it is the v4 CSS-first one: install `tailwindcss` and `@tailwindcss/postcss`, register the PostCSS plugin, put `@import 'tailwindcss'` in your global stylesheet, import that stylesheet in the root layout. Neither page contains a `tailwind.config.js`, a `content` glob array, or the `@tailwind base/components/utilities` triple. The v3 flavour still exists and Next.js documents it, but as a separate page for one named reason: broader browser support for very old browsers.**

## The setup, from both primary sources

Install — Next.js documents it as a dev dependency, Tailwind's own guide as a regular one; the packages are the same:

```bash
npm install -D tailwindcss @tailwindcss/postcss
```

Register the PostCSS plugin. This is the entire build integration:

```js
// postcss.config.mjs
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
```

Import Tailwind in the global stylesheet:

```css
/* app/globals.css */
@import 'tailwindcss';
```

Import that stylesheet in the root layout — one import site, per the ordering recommendation in [01b](01b-css-import-order-chunking-and-what-css-costs.md):

```tsx
// app/layout.tsx
import './globals.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

And then utilities in `className`, which is the only thing about Tailwind that has not changed:

```tsx
// app/page.tsx
export default function Page() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <h1 className="text-4xl font-bold">Welcome to Next.js!</h1>
    </main>
  )
}
```

Tailwind's own guide gives the byte-for-byte equivalent, differing only in file style:

```js
// postcss.config.mjs — from tailwindcss.com's Next.js framework guide (v4.3)
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
export default config;
```

```css
/* ./app/globals.css — from tailwindcss.com's Next.js framework guide (v4.3) */
@import "tailwindcss";
```

## The v3 path still exists, and the documentation says exactly when to take it

> *"**Good to know:** If you need broader browser support for very old browsers, see the [Tailwind CSS v3 setup instructions](/docs/app/guides/tailwind-v3-css)."*
> — [Getting Started: CSS](https://nextjs.org/docs/app/getting-started/css)

That is the whole documented criterion: **very old browsers.** Not "if you prefer JavaScript config", not "if you have plugins". ⚠️ **Neither page I fetched enumerates the browser versions v4 requires**, and I did not fetch Tailwind's compatibility page, so I am not going to name a floor. If your product has a hard browser-support contract, read Tailwind's own compatibility documentation before choosing — do not take a version number from a reference page, including this one.

⚠️ **What I did not verify, stated plainly:**

- **How v4 discovers which utility class names your source uses.** Neither primary source I fetched shows a `content` array or describes a scanning mechanism. The absence of the array is solid evidence that you no longer configure it; the mechanism that replaced it is **not** something I confirmed, so this page does not describe it.
- **The `@theme` directive's exact semantics.** v4 customisation happens in the CSS file rather than a JS object, but I did not fetch Tailwind's theme reference in this pass. Check it before writing custom tokens; do not infer the syntax from this page.
- **What an app upgraded from v3 keeps.** Whether a legacy `tailwind.config.js` is still honoured under the v4 plugin, and by what mechanism, is not covered by either page I read.

## Why the configuration moved into CSS, and why that matters here specifically

The mechanical consequence for a Next.js app is small and pleasant: **the only build-system surface Tailwind touches is `postcss.config.mjs`.** There is no bundler plugin to register, no loader to insert, no `next.config` entry at all.

🔴 **That matters more than it used to, because Turbopack is the default bundler from Next.js 16.0 onward.** A `webpack()` function in `next.config.js` is **silently not read** under Turbopack, and Turbopack does not support webpack plugins — so any styling advice of the form "add a webpack rule for your CSS pipeline" is dead code in a default 16.3.4 app, and it will fail *quietly*, which is the worst way. See [ch11 · Turbopack in dev and production](../11-performance-optimization-turbopack/01-turbopack-in-dev-and-production-fast-refresh.md). Tailwind's PostCSS-only integration sidesteps this entirely; a styling toolchain that needs a webpack loader does not.

## Coexisting with CSS Modules without building two competing systems

The documentation states the division of labour, and it is not "pick one":

> *"We recommend using global styles for *truly* global CSS (like Tailwind's base styles), Tailwind CSS for component styling, and CSS Modules for custom scoped CSS when needed."*
> — [Getting Started: CSS](https://nextjs.org/docs/app/getting-started/css)

> *"**Use Tailwind CSS** for most styling needs as it covers common design patterns with utility classes. · Use CSS Modules for component-specific styles when Tailwind utilities aren't sufficient."*
> — [Getting Started: CSS](https://nextjs.org/docs/app/getting-started/css)

**The failure mode is not "using both" — it is using both for the same thing.** A codebase becomes two competing systems the moment a module starts re-implementing utilities:

```css
/* 🔴 BAD — app/card/card.module.css: a second, worse utility system */
.card {
  display: flex;
  padding: 1rem;
  margin-top: 1rem;
  border-radius: 0.5rem;
}
```

Every one of those declarations has a utility. Reviewers now have to know two vocabularies, the two disagree about spacing scale the first time someone writes `padding: 14px`, and the module's rules and the utilities fight over specificity ties whose winner depends on import order.

The usable boundary is mechanical: **reach for a module when the thing you need is not expressible as a class on an element you control.**

```css
/* GOOD — app/editor/editor.module.css: things utilities are the wrong shape for */

/* 1 · An animation with named keyframes */
@keyframes editorPulse {
  from { opacity: 0.4; }
  to   { opacity: 1; }
}

.saving {
  animation: editorPulse 1.2s ease-in-out infinite alternate;
}

/* 2 · Markup you do not author — a third-party editor's DOM */
.editor :global(.ProseMirror blockquote) {
  border-inline-start: 3px solid var(--color-ink);
  padding-inline-start: 1rem;
}

/* 3 · Print rules, which no element's className is going to carry sensibly */
@media print {
  .toolbar {
    display: none;
  }
}
```

```tsx
// app/editor/editor.tsx — utilities for layout, the module for the rest
import styles from './editor.module.css'

export function Editor({ saving }: { saving: boolean }) {
  return (
    <section className={`flex flex-col gap-4 p-6 ${styles.editor}`}>
      <div className={`flex items-center gap-2 ${styles.toolbar}`}>
        <button className="rounded px-3 py-1 text-sm font-medium">Bold</button>
        <button className="rounded px-3 py-1 text-sm font-medium">Italic</button>
      </div>
      <div className={saving ? styles.saving : undefined}>Editing…</div>
    </section>
  )
}
```

**The arbitration rule you need to write down for your team:** when a utility and a module class target the same property on the same element, they are two class selectors of equal specificity, so **the one that appears later in the final stylesheet wins** — and that is import order, not the order you wrote them in `className`. Putting `styles.card` after `"p-4"` in the string changes nothing. If you need a module to beat a utility, make it win on the cascade, not on the attribute: raise its specificity, or place the two in cascade layers as shown in [01b](01b-css-import-order-chunking-and-what-css-costs.md).

## What each approach costs, in mechanism rather than kilobytes

⚠️ **Neither primary source frames this in bundle terms; the following follows from what a utility class *is*, and no measurement backs it.** Stated as reasoning, not as a documented fact.

- **Tailwind's output scales with the number of *distinct utilities used across the app*, not with the number of components.** The hundredth component that needs `flex items-center` adds nothing to the stylesheet, because `.flex` and `.items-center` are already emitted. That is the whole economic argument for utility-first: marginal cost per component approaches zero.
- **That output is one stylesheet imported at the root**, so every route loads it. It is not route-splittable in the way a per-component module is — see the chunking model in [01b](01b-css-import-order-chunking-and-what-css-costs.md). You are trading a flat, shared, highly cacheable cost for near-zero growth.
- **CSS Modules scale with the number of components**, but each module is tied to an import edge, so the bundler can keep it off routes that never import it. The documentation makes this point when discussing unused CSS: modules *"make this natural by scoping styles to the component that imports them."*
- **The utility duplication people fear is in the HTML, not the CSS.** Repeating `flex items-center gap-2` across fifty components repeats the *bytes of the markup*, which is compressible and paid per-response, not per-stylesheet. Whether that matters for your app is a measurement question — [ch11 · bundle analysis](../11-performance-optimization-turbopack/03-bundle-analysis-dynamic-imports-lazy-loading.md) — and not one this page will answer with an invented number.

## Gotchas

**★ Symptom: you follow a tutorial, create `tailwind.config.js`, and nothing in it takes effect.** Cause: the documented setup at this version has no JS config file on the path — configuration is CSS-first, and the only build surface is the `@tailwindcss/postcss` plugin. Fix: delete the file and configure in the stylesheet, or deliberately follow the v3 guide, which Next.js keeps for *"broader browser support for very old browsers"*. Do not run half of each.

**★ Symptom: `@tailwind base; @tailwind components; @tailwind utilities;` produces nothing.** Cause: that triple belongs to the v3 setup; the current path is a single `@import 'tailwindcss'`. Fix:

```css
/* app/globals.css */
@import 'tailwindcss';
```

**★ Symptom: a CSS Module rule and a Tailwind utility both target `padding` and the wrong one wins.** Cause: two class selectors, equal specificity, decided by position in the emitted stylesheet — i.e. import order — not by the order of names in the `className` string. Fix: do not create the tie. Move the module rule into a later cascade layer, or drop the module rule and use the utility.

**★ Symptom: you added a webpack rule for your CSS pipeline and it is ignored, with no error.** Cause: Turbopack is the default bundler from 16.0; a `webpack()` function in `next.config.js` is silently not read and webpack plugins are not supported. Fix: express the step as a PostCSS plugin in `postcss.config.mjs`, which is what Tailwind itself does, or accept that the step cannot run under the default bundler.

**Symptom: Tailwind's base styles override a third-party stylesheet, or vice versa, depending on the route.** Cause: `@import 'tailwindcss'` and the third-party CSS are both global stylesheets, so their relative order is import order — and a third-party stylesheet imported inside a component (which the docs permit) is loaded at an unpredictable point and never unloaded. Fix: import every global stylesheet, Tailwind included, at the root layout only.

**Symptom: the design system has two spacing scales.** Cause: a CSS Module wrote `padding: 14px` while utilities used the Tailwind scale. Fix: make tokens the single source — define custom properties once globally and consume them with `var()` in modules, so a module cannot invent a value the utility vocabulary does not have.

**Symptom: a conditional `className` renders as `"undefined"` in the DOM.** Cause: string interpolation of an absent module key — `` `p-4 ${styles.missing}` `` produces the literal text `undefined` inside the class attribute, unlike `className={styles.missing}` which produces nothing. Fix: never interpolate module keys into a template string; join through a helper that filters falsy values.

```tsx
function cx(...names: (string | false | undefined)[]) {
  return names.filter(Boolean).join(' ')
}

// className={cx('p-4', styles.card, isActive && styles.active)}
```

**Symptom: a utility class assembled at runtime does not exist in the stylesheet.** Cause: a utility only exists in the output if the class name appears somewhere the toolchain can find it; a name built by string concatenation is not that. Fix: write full class names in the source and select between them, never build them by pasting fragments together.

```tsx
// BAD:  className={`text-${color}-500`}
// GOOD:
const TONE = {
  danger: 'text-red-500',
  success: 'text-green-500',
} as const

export function Tone({ tone }: { tone: keyof typeof TONE }) {
  return <span className={TONE[tone]}>status</span>
}
```

⚠️ The precise scanning behaviour behind this gotcha is the mechanism I said above I could not verify at v4; the *rule* — write literal class names — holds under every version of Tailwind I have seen documented, but I am flagging that I sourced the rule from the constraint, not from a quoted sentence.

## Interview questions

**★ How is Tailwind configured in a current Next.js app — and how sure are you?**
CSS-first, with no JavaScript config file on the documented path: install `tailwindcss` and `@tailwindcss/postcss`, register the plugin in `postcss.config.mjs`, and write `@import 'tailwindcss'` in a global stylesheet imported by the root layout. I checked this against two independent primary sources rather than recalling it — the Next.js 16.3.4 CSS page and Tailwind's own Next.js framework guide at v4.3 — and neither shows a `tailwind.config.js`, a `content` array, or the `@tailwind base/components/utilities` triple. The v3 flavour still has a documented Next.js guide, and the stated reason to use it is broader support for very old browsers.

**★ Why is it significant that Tailwind's only build integration is a PostCSS plugin?**
Because Turbopack has been the default bundler since Next.js 16.0, and it does not support webpack plugins — a `webpack()` function in `next.config.js` is not read at all, silently. Any CSS toolchain that needs a bundler loader is therefore broken-by-default in a new app, and broken in the worst way, with no error. A PostCSS-only integration has no bundler surface to lose, which is why the documented Tailwind setup keeps working across that bundler change without any Next.js configuration.

**★ Where exactly is the line between "use a utility" and "write a CSS Module"?**
Not aesthetic — structural. Use a utility whenever the style can be expressed as a class on an element whose `className` you control, which is most styling. Reach for a module when it cannot be: named `@keyframes`, `@media print` blocks, styles that must target markup you do not author (a rich-text editor's DOM, CMS HTML) and therefore need `:global()`, or a rule set complex enough that the class attribute stops being readable. The failure mode is not mixing the two, it is a module that re-implements utilities — at which point you have two spacing scales and two vocabularies and reviewers must know both.

**★ A utility and a CSS Module class fight over the same property. How is the winner decided, and how do you control it?**
Both are single class selectors, so specificity is equal and the cascade falls back to source order in the final stylesheet — which is import order, and is discussed in [01b](01b-css-import-order-chunking-and-what-css-costs.md). Crucially, the order of names in your `className` string is irrelevant; the class attribute is a set, not a priority list. To control it, do not create the tie: raise the module rule's specificity deliberately, or put utilities and component rules in declared cascade layers so precedence is a decision rather than a side effect of import order.

**Does adopting Tailwind mean deleting your CSS Modules?**
No, and the documentation explicitly recommends both: Tailwind for most component styling, CSS Modules *"for custom scoped CSS when needed"*, and global stylesheets for *"truly global CSS (like Tailwind's base styles)"*. Three tools with three jobs is not fragmentation; three tools doing the same job is. The migration that actually pays is deleting module rules that have a one-for-one utility equivalent, not deleting modules as a category.

**How does Tailwind's bundle cost behave as an app grows, compared to CSS Modules?**
Tailwind's stylesheet grows with the number of *distinct* utilities used anywhere in the app, so the marginal cost of an additional component that reuses existing utilities is essentially nothing — but the whole stylesheet is imported at the root, so every route loads it and it does not split per route. CSS Modules grow with the number of components, but each module is attached to an import edge, so the bundler can keep it out of routes that never import it. One is a flat shared cost that stops growing; the other is a splittable cost that keeps growing. I want to be clear that neither primary source states this in bundle terms — it follows from what a utility class is, and the honest way to settle it for a given app is to measure.

**Someone reports that a route "downloads all of Tailwind". Is that a bug?**
No — that is the design, since the utility stylesheet is a single global import at the root and by construction is shared by every route. It is also the case that the default CSS chunking merges small stylesheets into shared chunks anyway, so a route carrying CSS it did not import is expected behaviour rather than a defect (see [01b](01b-css-import-order-chunking-and-what-css-costs.md)). The question worth asking instead is how much of it is on the render-blocking critical path for the first paint, and that is a measurement, not an inspection.

**What would make you choose the v3 setup for a new project today?**
Only the documented reason: a hard requirement to support very old browsers, which Next.js names as the sole trigger for its separate Tailwind v3 guide. I would not take that decision from a version number in a reference page — including this one — because I did not verify the browser floor; I would read Tailwind's own compatibility documentation and check it against the product's actual support contract before committing, since the choice determines the shape of every stylesheet in the codebase.

---

← [01b · CSS order and chunking](01b-css-import-order-chunking-and-what-css-costs.md) · [Chapter index](01-explanation.md) · Next → [02 · CSS-in-JS at Server Component boundaries](02-css-in-js-caveats-at-server-component-boundaries.md)
