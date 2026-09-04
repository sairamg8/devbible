---
title: "The webpack gaps that matter are not the missing config hooks — they are the four that change what your application renders"
sidebar_label: "01d · Migrating from webpack"
sidebar_position: 102
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js [Turbopack API reference](https://nextjs.org/docs/app/api-reference/turbopack),
> §"Known gaps with webpack" (docs build `version: 16.3.4`,
> `lastUpdated: 2026-08-03`). Documentation-verified; **no timings, no sandbox run**.
> Target: **Next.js 16.3.4 · Turbopack default since 16.0**.

**A missing config hook announces itself; a changed default does not.** When Turbopack became the default bundler in
16.0, the loud failures — a `webpack()` function, a plugin that no longer loads — were the easy half, because they
stop the build and you fix them before you ship. The dangerous half is the documented list of *behavioural* gaps:
CSS that lands in a different order, numbers rounded to five decimal places instead of ten, modules outside the
project root that stop resolving. These compile cleanly and render differently. The docs are candid about them, and
this page is that list, in the order you are likely to meet it. What Turbopack simply does not support — the legacy
CSS Modules rules, Yarn PnP, `sassOptions.functions` — is
[the next page](01e-what-turbopack-does-not-support-and-how-to-read-the-list.md).

> *"There are a number of non-trivial behavior differences between webpack and Turbopack that are important to be aware of when migrating an application. Generally, these are less of a concern for new applications."*

That last clause matters: **this page is about migrations.** A new app never had the webpack behaviour to depend on.

## Gap 1 — the filesystem root, and why `npm link` stops working

> *"Turbopack uses the root directory to resolve modules. Files outside of the project root are not resolved."*

> *"For example, when linking dependencies outside the project root (via `npm link`, `yarn link`, `pnpm link`, etc.), those linked files will not be resolved by default. To resolve these files, you must configure the root option to the parent directory of both the project and the linked dependencies."*

This is the one that hits monorepo and library-development workflows hardest, because the symptom is a resolution
failure for a package that is definitely installed — the symlink is there, the file is there, and Turbopack declines
to look outside the root.

```js
// next.config.js
// Layout:
//   /work/design-system   <- linked dependency
//   /work/storefront      <- this project
// The root must be the parent of BOTH.
module.exports = {
  turbopack: {
    root: '/work',
  },
}
```

⚠️ **Widening the root is not free.** It is the boundary of module resolution, so a broader root means a broader
search space. Set it to the nearest common ancestor, not to `/`.

## Gap 2 — CSS Module ordering now follows JS import order

> *"Turbopack will follow JS import order to order CSS modules which are not otherwise ordered."*

```jsx
// components/BlogPost.jsx
import utilStyles from './utils.module.css'
import buttonStyles from './button.module.css'

export default function BlogPost() {
  return (
    <div className={utilStyles.container}>
      <button className={buttonStyles.primary}>Click me</button>
    </div>
  )
}
```

> *"In this example, Turbopack will ensure that `utils.module.css` will appear before `button.module.css` in the produced CSS chunk, following the import order"*

The gap is not that Turbopack has a rule — it is that webpack's rule was less predictable:

> *"Webpack generally does this as well, but there are cases where it will ignore JS inferred ordering, for example if it infers the JS file is side-effect-free."*

> *"This can lead to subtle rendering changes when adopting Turbopack, if applications have come to rely on an arbitrary ordering."*

🔴 **Read that carefully: the applications at risk are the ones that came to depend on an ordering nobody chose.**
Two CSS Modules setting the same property on the same element have always been a coin toss decided by bundler
internals; webpack happened to flip it one way, Turbopack flips it another. Nothing was broken and then fixed — an
unspecified behaviour changed.

The documented fixes, in order of preference:

```css
/* button.module.css — force the ordering explicitly */
@import './utils.module.css';
```

> *"Generally, the solution is easy, e.g. have `button.module.css` `@import utils.module.css` to force the ordering, or identify the conflicting rules and change them to not target the same properties."*

**The second option is the better engineering.** If two modules fight over the same property on the same element,
the ordering is a symptom; the real fix is that they should not both be setting it.

## Gap 3 — Lightning CSS rounds to five decimal places

This one is genuinely invisible until it is not.

> *"Turbopack uses Lightning CSS to compile CSS. Lightning CSS uses 5 digits of decimal precision for numeric CSS values, while webpack uses 10 digits. This applies to both plain CSS and Sass/SCSS output."*

For a value that evaluates to `25/17`:

| Bundler | Output |
|---|---|
| **Webpack** | `line-height: 1.4705882353` (10 digits) |
| **Turbopack** | `line-height: 1.47059` (5 digits) |

> *"This can lead to subtle rendering differences when migrating from webpack to Turbopack, especially for properties like `line-height`, `letter-spacing`, or other calculated values where high precision matters."*

**Where this actually bites:** a Sass function computing a modular type scale, a `letter-spacing` derived from a
font-size ratio, or any layout whose total depends on many rounded values accumulating. One row of a table shifting
by a fraction of a pixel is invisible; forty rows compounding it is a visible difference in total height, and it
will show up as a failed visual-regression snapshot with no obvious cause in the diff.

There is **no documented option to change the precision.** Treat it as a fixed property of the toolchain:

```scss
// ❌ Precision-dependent: the result differs between bundlers
.card { line-height: math.div(25, 17); }

// ✅ Pin the value you actually want
.card { line-height: 1.47; }
```

## Gap 4 — Sass `node_modules` imports lost the tilde

> *"Turbopack supports importing `node_modules` Sass files out of the box. Webpack supports a legacy tilde `~` syntax for this, which is not supported by Turbopack."*

```scss
/* styles/globals.scss */
/* ❌ webpack's legacy syntax */
@import '~bootstrap/dist/css/bootstrap.min.css';

/* ✅ Turbopack resolves node_modules directly */
@import 'bootstrap/dist/css/bootstrap.min.css';
```

If the imports are in a vendored file or a dependency you cannot edit:

```js
// next.config.js
module.exports = {
  turbopack: {
    resolveAlias: {
      '~*': '*',
    },
  },
}
```

> *"If you can't update the imports, you can add a `turbopack.resolveAlias` configuration to map the `~` syntax to the actual path"*

**Prefer the edit.** The alias is a compatibility shim for code you do not control, and it makes `~` mean something
project-wide.

## Gap 5 — webpack plugins have no path forward

> *"Turbopack does not support webpack plugins. This affects third-party tools that rely on webpack's plugin system for integration. We do support webpack loaders. If you depend on webpack plugins, you'll need to find Turbopack-compatible alternatives or continue using webpack until equivalent functionality is available."*

The loader/plugin distinction and why it is architectural rather than unfinished work is covered on
[01b · Configuring the compile pipeline](01b-configuring-the-turbopack-compile-pipeline.md). What belongs here is
the migration consequence: **this is the gap most likely to decide that a given application cannot move yet**, and
the docs offer only two outcomes — find an alternative, or stay on webpack.

## Gotchas

**★ Symptom: a linked local package cannot be resolved, though the symlink and files are present.** Cause:
*"Turbopack uses the root directory to resolve modules. Files outside of the project root are not resolved."* Fix:
set `turbopack.root` to the nearest common ancestor of the project and its link targets.

```js
module.exports = {
  turbopack: { root: '/work' },
}
```

**★ Symptom: styles are subtly wrong after the upgrade — a colour or spacing from the wrong CSS Module wins.** Cause:
CSS Module ordering now follows JS import order, whereas webpack *"will ignore JS inferred ordering"* in some cases,
such as when it infers a file is side-effect-free. The application had come to rely on an arbitrary order. Fix:
force it explicitly, or better, stop two modules from setting the same property.

```css
/* button.module.css */
@import './utils.module.css';
```

**★ Symptom: visual-regression snapshots fail everywhere by fractions of a pixel, with no meaningful diff.** Cause:
Lightning CSS emits 5 digits of decimal precision where webpack emitted 10, for both CSS and Sass output. Computed
`line-height` and `letter-spacing` values shift slightly and accumulate down a long page. Fix: there is no precision
option — pin the computed values you actually care about, and re-baseline the snapshots as part of the migration
rather than treating each one as a regression.

**★ Symptom: `@import '~bootstrap/…'` fails to resolve in a `.scss` file.** Cause: the tilde is *"a legacy tilde `~`
syntax"* webpack supported and Turbopack does not; `node_modules` Sass imports work without it. Fix: drop the tilde.
Where the file cannot be edited, alias it.

```js
module.exports = {
  turbopack: { resolveAlias: { '~*': '*' } },
}
```

## Interview questions

**★ Which webpack-to-Turbopack differences can change what users see, as opposed to breaking the build?**
Four, and they are the reason a migration needs visual testing rather than just a green build. CSS Module ordering
now follows JS import order, where webpack sometimes ignored it — so a rule that used to win may now lose. Lightning
CSS emits five decimal digits where webpack emitted ten, shifting computed `line-height` and `letter-spacing`
slightly. `composes` and `@import` in CSS Modules no longer treat a plain `.css` file as a module, since it is
always global. And a `.css` file's globality itself changes what a selector matches. All four compile without error.

**★ Why did CSS Module ordering change, and whose bug was it?**
Neither bundler's, strictly. The ordering of two CSS Modules that do not otherwise constrain each other was never
specified — webpack *"generally"* followed JS import order but would ignore it in cases such as inferring a file to
be side-effect-free. Turbopack always follows import order. An application that renders differently was relying on
an unspecified behaviour, which is why the docs frame it as applications having *"come to rely on an arbitrary
ordering"*. The durable fix is not to force the order but to stop two modules from targeting the same property on
the same element.

**★ Your visual regression suite fails across the whole site by tiny amounts after adopting Turbopack. Diagnose it.**
Almost certainly the decimal-precision gap: Lightning CSS uses 5 digits where webpack used 10, for plain CSS and
Sass alike, so any computed value — a modular type scale, a ratio-derived `letter-spacing` — lands slightly
differently and the error accumulates down long pages. It is not configurable, so the response is to pin the values
that matter to explicit numbers and re-baseline the snapshots as a deliberate step of the migration, rather than
chasing each failure as a regression.

**★ A dependency is developed locally with `pnpm link` and suddenly will not resolve. What changed, and what is the
correct fix?** Turbopack scopes module resolution to the project root and does not resolve files outside it, so a
symlink pointing somewhere else is not followed. The documented fix is `turbopack.root`, set to the parent directory
of both the project and the linked dependency. The thing to avoid is over-widening it — the root defines the
resolution search space, so it should be the nearest common ancestor rather than something convenient like the
filesystem root.

---

← [01c · Build-time constants and profiling](01c-import-meta-env-and-profiling-the-dev-server.md) · [Chapter index](01-explanation.md) · Next → [01e · What Turbopack does not support](01e-what-turbopack-does-not-support-and-how-to-read-the-list.md)
