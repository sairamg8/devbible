---
title: "CSS Modules are not a convention for safer class names — they are a build-time rename, and that single mechanical fact is the whole difference between a scoped stylesheet and a global one"
sidebar_label: "01 · CSS Modules vs global CSS"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against **Next.js 16.3.4** — [Getting Started: CSS](https://nextjs.org/docs/app/getting-started/css) (the page self-reports `version: 16.3.4`, `lastUpdated: 2026-08-25`). React version **probed** on the installed package: `react` **19.2.8**. 🔴 `next` is **not installed in this checkout** — `require('next/package.json')` throws `MODULE_NOT_FOUND`, so every Next-specific claim here is documentation-quoted, not probed. Node floor **20.9**. **No sandbox run** — no build output, no byte counts.

**A global stylesheet and a CSS Module compile to the same thing: a `.css` file the browser loads and applies by the cascade. The only difference is that for a module, the bundler rewrote your class name into a unique one and handed you a JavaScript object mapping the name you wrote to the name it emitted. Everything people credit CSS Modules with — "encapsulation", "no leaks", "safe deletion" — falls out of that one rename and nothing else. It does not raise specificity, it does not sandbox the cascade, and it does not stop a global `button { }` rule from beating your module. Knowing that the guarantee is a rename and not a scope is the difference between debugging a styling bug in ten seconds and rewriting a component that was never broken.**

## The mechanism: a rename, plus a JavaScript object

You create a file whose name ends `.module.css` and import it. The bundler does two things:

1. Rewrites every class selector in the file to a name unique across the build.
2. Emits a default export — a plain object whose keys are the names you wrote and whose values are the names it emitted.

```css
/* app/blog/blog.module.css */
.blog {
  padding: 24px;
}

.title {
  font-size: 2rem;
  font-weight: 700;
}
```

```tsx
// app/blog/page.tsx
import styles from './blog.module.css'

export default function Page() {
  return (
    <main className={styles.blog}>
      <h1 className={styles.title}>Blog</h1>
    </main>
  )
}
```

The documentation states the guarantee and its scope precisely:

> *"CSS Modules locally scope CSS by generating unique class names. This allows you to use the same class in different files without worrying about naming collisions."*
> — [Getting Started: CSS](https://nextjs.org/docs/app/getting-started/css)

Read that carefully. The promise is **no naming collisions**. It is not *no cascade*, and it is not *no inheritance*. Three consequences follow immediately, and all three surprise people:

- **`styles.foo` for a class that does not exist is `undefined`**, and `className={undefined}` renders no class at all. A typo is not a build error — it is a silently unstyled element. This is the single most common CSS Modules bug and TypeScript will not catch it unless you have generated types for the module.
- **A module cannot protect you from a global rule.** If `app/global.css` contains `button { border: none }` and your module contains `.submit { border: 1px solid }`, the module wins on specificity (class beats element), but if the global rule were `.btn.primary { }` on the same element it would win. The cascade is untouched.
- **Element selectors inside a module are still global-ish.** `.module.css` rewrites *class* selectors. A bare `a { color: red }` inside a module file has no class to rename, so it applies wherever that stylesheet is loaded — and stylesheets are not unloaded on navigation (see below). Always anchor to a class: `.prose a { }`.

## What a global stylesheet gives you that a module cannot

A module can only style elements whose `className` you control. That excludes the three things every real app needs:

1. **Resets and element defaults** — `*`, `html`, `body`, `::selection`. You cannot put a class on `body` from a component.
2. **Custom properties on `:root`** — the design-token layer. Every module and every utility reads them; they must be defined once, globally.
3. **Markup you did not author** — a third-party widget's DOM, `dangerouslySetInnerHTML` content from a CMS, a portal that mounts outside your tree.

```css
/* app/global.css */
:root {
  --color-surface: #ffffff;
  --color-ink: #111827;
  --space-gutter: 1.25rem;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  color: var(--color-ink);
  background: var(--color-surface);
  font-family: system-ui, sans-serif;
}
```

```tsx
// app/layout.tsx
import './global.css'

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

## Where a global stylesheet may be imported — and why the constraint is phrased as a warning, not a ban

This is the part codebases get wrong in both directions. The rule is **not** "global CSS may only be imported in the root layout". The documentation permits it anywhere and then tells you why you probably should not:

> *"Global styles can be imported into any layout, page, or component inside the `app` directory. However, since Next.js uses React's built-in support for stylesheets to integrate with Suspense, this currently does not remove stylesheets as you navigate between routes which can lead to conflicts. We recommend using global styles for *truly* global CSS (like Tailwind's base styles), Tailwind CSS for component styling, and CSS Modules for custom scoped CSS when needed."*
> — [Getting Started: CSS](https://nextjs.org/docs/app/getting-started/css)

**The mechanism behind the warning.** React 19 has built-in support for stylesheets as a resource — a `<link rel="stylesheet">` React hoists and can suspend on, so content does not paint before its CSS. Next.js uses that. The consequence is that a stylesheet, once loaded for a route, **stays loaded**. Client-side navigation away from the route that imported it does not remove it.

So a global stylesheet imported inside `app/dashboard/page.tsx` behaves like this:

- **On a fresh load of `/marketing`** — never loaded. Your marketing page looks right.
- **After the user navigates `/dashboard` → `/marketing`** — still loaded, still applying. Your marketing page now inherits dashboard body styles.

That asymmetry is the entire bug class. It reproduces only through in-app navigation, never on a hard refresh, which is why it survives review, survives local testing, and shows up as "the page looks different if you get to it from the nav". If you are staring at that symptom, check for a global (non-`.module`) CSS import outside the root layout before you check anything else.

**The rule that follows:** a `.css` file that is *not* a module belongs in exactly one import site — the root layout — unless you have consciously accepted that it will leak forward across navigations. Everything route-specific goes in a module, where the rename makes leakage harmless.

## External package stylesheets are global CSS wearing a package name

> *"Stylesheets published by external packages can be imported anywhere in the `app` directory, including colocated components"*
> — [Getting Started: CSS](https://nextjs.org/docs/app/getting-started/css)

```tsx
// app/layout.tsx
import 'bootstrap/dist/css/bootstrap.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="container">{children}</body>
    </html>
  )
}
```

"Anywhere" is permission, not advice. `bootstrap.css` imported inside a modal component is a global stylesheet with the same never-unloads behaviour and a much bigger surface — it restyles `button`, `input` and `table` for every route the user visits afterwards. Import third-party CSS at the root, where its scope is honest, or not at all.

The documentation also notes the React 19 escape hatch:

> *"In React 19, `<link rel="stylesheet" href="..." />` can also be used."*
> — [Getting Started: CSS](https://nextjs.org/docs/app/getting-started/css), citing the [React `link` reference](https://react.dev/reference/react-dom/components/link)

That matters when the stylesheet URL is only known at runtime — a tenant theme, a CMS-supplied skin. An `import` is static; a rendered `<link>` is not.

## Where the rest of this argument lives

The import-order problem, CSS chunking and the dev-versus-production ordering difference are the other half of the CSS Modules story and have their own chunk: [01b · CSS import order and chunking](01b-css-import-order-chunking-and-what-css-costs.md). Tailwind's actual configuration at this version, and how utilities and modules coexist without becoming two competing systems, is [01c · Tailwind v4 and coexistence](01c-tailwind-v4-css-first-config-and-coexisting-with-css-modules.md).

## Gotchas

**★ Symptom: one element is completely unstyled while its siblings are fine.** Cause: `styles.cardTitle` where the CSS file defines `.card-title`. The lookup returns `undefined`, `className={undefined}` emits nothing, and nothing errors. Fix: use a single naming convention (camelCase in CSS, camelCase in JS) and make the lookup fail loudly during development.

```tsx
// app/lib/styles.ts
export function cx(...names: (string | undefined)[]): string {
  if (process.env.NODE_ENV !== 'production') {
    for (const n of names) {
      if (n === undefined) {
        throw new Error('cx(): received undefined — a CSS Module key does not exist')
      }
    }
  }
  return names.filter(Boolean).join(' ')
}
```

```tsx
// app/blog/page.tsx
import styles from './blog.module.css'
import { cx } from '../lib/styles'

export default function Page() {
  return <main className={cx(styles.blog)}>Posts</main>
}
```

**★ Symptom: a page looks correct on refresh but wrong when you navigate to it from another page.** Cause: a non-module `.css` file imported outside the root layout; React's stylesheet integration does not remove stylesheets on navigation. Fix: move the file into the root layout if the styles are truly global, or convert it to a module.

```tsx
// BEFORE — app/dashboard/page.tsx
import './dashboard.css'          // 🔴 leaks forward into every later route

// AFTER — app/dashboard/page.tsx
import styles from './dashboard.module.css'

export default function Page() {
  return <section className={styles.dashboard}>…</section>
}
```

**★ Symptom: a rule inside a `.module.css` file affects other routes.** Cause: the rule has no class selector to rename — `a { }`, `h1 { }`, `:root { }` — so the rename mechanism has nothing to do and the rule ships global. Fix: anchor every selector to a module class.

```css
/* BAD — app/blog/blog.module.css */
a {
  text-decoration: underline;
}

/* GOOD */
.blog a {
  text-decoration: underline;
}
```

**Symptom: `:global()` in a module and now nothing is scoped.** Cause: `:global()` is the module system's explicit opt-out; everything inside it is emitted verbatim. It is legitimate for targeting third-party markup, but it re-introduces exactly the collision risk you adopted modules to avoid. Fix: keep the global part as narrow as possible by nesting it under a scoped ancestor.

```css
/* app/editor/editor.module.css */
.editor :global(.ProseMirror p) {
  margin-block: 0.75em;
}
```

**Symptom: you deleted a component and its CSS is still shipping.** Cause: modules are only removed from the build when *the import* disappears. Deleting the `.module.css` file but leaving a stale import breaks the build; deleting the component but leaving the file orphaned ships nothing (unimported files are never bundled) — but a file still imported by a dead code path does ship. Fix: colocate the module beside its only importer so the two are deleted together, which is what the docs' naming recommendation is really about.

**Symptom: a design token defined in a CSS Module is `undefined` elsewhere.** Cause: custom properties inherit through the DOM, not through the module system. `--brand` declared on `.card` in a module is visible to `.card`'s descendants only. Fix: declare tokens on `:root` in the global stylesheet; modules consume them with `var()`.

**Symptom: TypeScript reports `Cannot find module './x.module.css'`.** Cause: TypeScript has no built-in knowledge of CSS imports. Next.js generates the ambient declaration during `next dev`/`next build`, so an editor opened on a checkout that has never been built sees nothing. Fix: run the dev server or build once so the generated types exist, and commit whatever the project's generated-types policy is. ⚠️ The exact filename Next.js writes these declarations to is a build-output detail I did not verify against the documentation for 16.3.4; do not hard-code a path on my say-so.

**Symptom: a global reset is beaten by a module in one component and beats it in another.** Cause: identical specificity, so source order decides — and source order is import order, which is the subject of [01b](01b-css-import-order-chunking-and-what-css-costs.md). Fix: never rely on a specificity tie; make the intended winner more specific, or use a cascade layer.

## Interview questions

**★ CSS Modules "scope" your CSS. Scope it from what, exactly?**
From **name collisions only**. The bundler rewrites `.title` in `blog.module.css` to a build-unique class and gives you an object mapping `title` to that emitted name. Nothing else changes: the rule is still in a plain stylesheet, still participates in the same cascade, still inherits, and still loses to a more specific selector from anywhere else in the app. Calling it "encapsulation" invites people to expect Shadow-DOM semantics, and then they are baffled when a global `button { }` restyles their scoped button. The accurate sentence is "unique class names, generated at build time".

**★ Why does `styles.someClass` fail silently instead of throwing?**
Because the default export is an ordinary JavaScript object and a missing key on an object is `undefined`, not an error. React then treats `className={undefined}` as "no class attribute". There is no layer in that chain that has any reason to complain. The practical mitigations are generated TypeScript types for the module (so the key is checked at compile time) and a development-only assertion in the class-name helper — both shown in the Gotchas above.

**★ The documentation says global styles can be imported into any layout, page, or component. Why is doing that still a bug?**
Because Next.js relies on React's built-in stylesheet support to integrate with Suspense, and, quoting the docs, *"this currently does not remove stylesheets as you navigate between routes which can lead to conflicts"*. A global stylesheet imported at `/dashboard` is loaded when the user visits `/dashboard` and is **still applying** after they navigate to `/marketing`. That produces a defect that only reproduces via in-app navigation and never on a hard reload — the hardest possible shape for a styling bug, because the first thing anyone does when investigating is refresh.

**What is the practical difference between a `.module.css` file and a `.css` file with a long, deliberately unique class prefix?**
Almost none at runtime, and everything at maintenance time. A BEM-ish prefix is a convention that any developer can break, that no tool enforces, and that survives a copy-paste into another component. A module makes the guarantee mechanical — the collision is impossible because the bundler, not the developer, chooses the emitted name — and it ties the CSS's lifetime to an import edge, which lets the bundler decide the file is not needed for a route.

**When is a global stylesheet the right answer rather than a smell?**
Three cases, all of which a module structurally cannot serve: element-level resets and `body`/`html` defaults; `:root` custom properties, because the token layer must be one declaration everyone inherits from; and markup you do not author — third-party widgets, CMS HTML rendered via `dangerouslySetInnerHTML`, portal content. Anything else that you are tempted to put in a global file is a component style that has not found its component yet.

**Why does putting `a { color: blue }` in a `.module.css` file not scope it?**
Because the mechanism is a class rename. A type selector has no class to rename, so the rule is emitted as written and applies to every `<a>` on any route that has loaded that stylesheet — which, given that stylesheets are not unloaded on navigation, is potentially every route the user visits after passing through the component. Anchor it: `.prose a { }`.

**A colleague wants to import `bootstrap.css` inside the one modal component that uses it, to avoid paying for it globally. What do you tell them?**
That the documentation explicitly allows it and that it will not do what they want. The stylesheet is loaded the first time that route renders and is never removed, so the "saving" only exists for users who never open the modal — and the moment anyone does, Bootstrap's element-level rules apply to every subsequent route in that session. Import it at the root where its real scope is visible, or scope it properly by wrapping the third-party markup and using `:global()` inside a module.

**How would you style a tenant-specific theme whose stylesheet URL is only known at request time?**
Not with `import`, which is static and resolved at build time. React 19 supports rendering `<link rel="stylesheet" href={...} />` directly, and Next.js documents this as a supported option, so the layout can render a `link` element with a URL derived from the tenant. The alternative — and usually the better one — is to keep one stylesheet and swap only custom-property values on `:root` via an inline style or a data attribute, which avoids a second render-blocking resource entirely.

---

← [Chapter index](01-explanation.md) · Next → [01b · CSS import order and chunking](01b-css-import-order-chunking-and-what-css-costs.md)
