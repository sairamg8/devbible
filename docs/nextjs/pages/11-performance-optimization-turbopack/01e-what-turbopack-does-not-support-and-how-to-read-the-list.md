---
title: "The unsupported list carries three different promises, and reading them as one list produces either misplaced optimism or an unnecessary rewrite"
sidebar_label: "01e · What Turbopack does not support"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against the Next.js [Turbopack API reference](https://nextjs.org/docs/app/api-reference/turbopack),
> §"Unsupported and unplanned features" (docs build `version: 16.3.4`, `lastUpdated: 2026-08-03`).
> Documentation-verified; **no timings, no sandbox run**.
> Target: **Next.js 16.3.4 · Turbopack default since 16.0**.

**"Unsupported" is doing three different jobs on this list, and the distinction decides your migration plan.** Some
entries are dead ends the docs mark *"Not planned"* — the only move is to stop using the feature. Some say *"We plan
to implement these in the future"*, where waiting is rational. And exactly one names webpack as the answer, making
it a per-build decision rather than a blocker. Flattening all three into "Turbopack doesn't support it" is how teams
either abandon a viable migration or wait indefinitely for something that is never coming. The behavioural gaps that
change what renders are [the previous page](01d-migrating-from-webpack-the-behavioural-gaps.md); this is what simply
is not there.

> *"Some features are not yet implemented or not planned"*

## Legacy CSS Modules features

The whole set, verbatim:

- *"Standalone `:local` and `:global` pseudo-classes (only the function variant `:global(...)` is supported)."*
- *"The `@value` rule (superseded by CSS variables)."*
- *"`:import` and `:export` ICSS rules."*
- *"`composes` in `.module.css` composing a `.css` file."*
- *"`@import` in CSS Modules importing `.css` as a CSS Module."*

For the last two the mechanism is identical, and the docs state it once for each:

> *"In webpack this would treat the `.css` file as a CSS Module, with Turbopack the `.css` file will always be global. This means that if you want to use `composes` in a CSS Module, you need to change the `.css` file to a `.module.css` file."*

🔴 **The fix for both is a rename, not a rewrite.** Under Turbopack a plain `.css` file is *always* global, so
anything that wanted to treat one as a module must become `.module.css`:

```css
/* ❌ composes from a plain .css file — global under Turbopack, so nothing to compose */
.button { composes: base from './shared.css'; }

/* ✅ rename shared.css -> shared.module.css, then compose from it */
.button { composes: base from './shared.module.css'; }
```

The other three are each a small, mechanical port:

```css
/* ❌ standalone pseudo-class form */
:global .theme-dark { color: white; }

/* ✅ function form — the only one supported */
:global(.theme-dark) { color: white; }
```

```css
/* ❌ @value primary: #0070f3;  — superseded, per the docs */
:root { --primary: #0070f3; }
.button { background: var(--primary); }
```

`:import` and `:export` are the ICSS rules that let a CSS Module hand values to JavaScript. They have no Turbopack
equivalent; custom properties plus a shared TypeScript constant cover the realistic uses.

## Everything else, with its status read literally

| Feature | Status, verbatim | How to read it |
|---|---|---|
| `sassOptions.functions` | *"Turbopack's Rust-based architecture cannot directly execute JavaScript functions passed through `sassOptions.functions`, unlike webpack's Node.js-based sass-loader which runs entirely in JavaScript. If you're using custom Sass functions, you'll need to use webpack instead of Turbopack."* | 🔴 **The one entry that names webpack as the answer** |
| `webpack()` in `next.config.js` | *"Turbopack replaces webpack, so `webpack()` configs are not recognized. Use the `turbopack` config instead."* | Port it — there is a replacement |
| **Yarn PnP** | *"Not planned for Turbopack support in Next.js."* | Dead end |
| `experimental.urlImports` | *"Not planned for Turbopack."* | Dead end |
| `experimental.esmExternals` | *"Not planned. Turbopack does not support the legacy `esmExternals` configuration in Next.js."* | Dead end — note *"legacy"* |
| `experimental.nextScriptWorkers` | *"We plan to implement these in the future."* | Waiting is rational |
| `experimental.fallbackNodePolyfills` | *"We plan to implement these in the future."* | Waiting is rational |

⚠️ **The word *"legacy"* attached to `esmExternals` is a signal, not decoration.** Where the docs call something
legacy *and* not planned, the feature is being retired rather than merely unimplemented, and a migration plan built
around it eventually returning is built on nothing.

`sassOptions.functions` deserves its own note because it is the only place in the entire reference where the
recommended resolution is *"use webpack instead"*. That makes it a scoped decision — this build stays on `--webpack`
— rather than a verdict on the application. The alternative is to replace the custom functions with plain Sass or
precomputed values, which is usually possible and removes the exception entirely.

## A migration order that surfaces the silent problems first

The loud failures find themselves. Go looking for the quiet ones deliberately:

1. **Clear the loud ones first** so they stop masking everything else — grep for `webpack:` in `next.config.js`,
   `~` in `.scss` files, and `composes:` / `@value` / `:import` / `:export` in `.module.css`.
2. **Check for linked dependencies.** If anyone develops against this repo with `npm link` or `pnpm link`, set
   `turbopack.root` before they hit the failure.
3. **Then hunt the invisible ones.** A visual-regression run over the pages with the densest CSS is the only
   practical detector for the ordering and precision gaps, because neither produces an error.
4. **Do not split dev and build across bundlers while migrating.** Running Turbopack in dev and webpack in build
   hides exactly the differences you are trying to find.

```bash
# Step 1, as one sweep
grep -rn 'webpack:' next.config.*
grep -rn "@import '~" --include='*.scss' --include='*.sass' .
grep -rn 'composes:\|@value\|:import\|:export' --include='*.module.css' .
```

## Gotchas

**★ Symptom: `composes: base from './shared.css'` no longer picks up the composed class.** Cause: *"with Turbopack
the `.css` file will always be global"*, so there is no module to compose from — webpack would have treated it as a
CSS Module. Fix: rename the source to `.module.css`. The identical rule and fix apply to `@import` in a CSS Module.

```css
/* ✅ after renaming shared.css -> shared.module.css */
.button { composes: base from './shared.module.css'; }
```

**★ Symptom: a Sass build fails on a project using custom Sass functions.** Cause: `sassOptions.functions` is
unsupported because *"Turbopack's Rust-based architecture cannot directly execute JavaScript functions"*. Fix: this
is the one case where the documentation names webpack as the answer — *"you'll need to use webpack instead of
Turbopack"*. Either replace the functions with plain Sass, or keep that one build on `--webpack`.

```json
{
  "scripts": {
    "build": "next build --webpack"
  }
}
```

**★ Symptom: `:global` works but `:local` does not.** Cause: only the *function* variant is supported —
*"Standalone `:local` and `:global` pseudo-classes (only the function variant `:global(...)` is supported)."* Fix:
use the parenthesised form and rewrite standalone-pseudo-class blocks.

```css
/* ❌ */ :global .theme-dark { color: white; }
/* ✅ */ :global(.theme-dark) { color: white; }
```

**Symptom: `@value` definitions in a CSS Module silently produce nothing.** Cause: the `@value` rule is unsupported,
and the docs give the reason — *"superseded by CSS variables"*. Fix: port to custom properties, which also removes a
build-time indirection.

```css
:root { --primary: #0070f3; }
.button { background: var(--primary); }
```

**Symptom: a project using Yarn PnP cannot be migrated and the team is waiting for support.** Cause: *"Not planned
for Turbopack support in Next.js."* Fix: unlike the "planned for the future" entries, waiting is not a strategy
here — move to a supported install strategy, or accept that this project stays on webpack indefinitely. The
distinction is the entire reason to read the status column rather than the feature name.

**Symptom: a build depends on `experimental.esmExternals` and there is no replacement.** Cause: *"Not planned.
Turbopack does not support the legacy `esmExternals` configuration in Next.js."* Fix: treat the word *legacy* as
terminal — the configuration is being retired, not queued. Remove the dependency on it rather than planning around
its return.

**Symptom: a CSS Module exported a value to JavaScript via `:export` and the import is now undefined.** Cause:
`:import` and `:export` are ICSS rules and are unsupported. Fix: define the value once as a custom property and, if
JavaScript genuinely needs it, as a shared constant — rather than routing it through the stylesheet.

```ts
// theme.ts — one source, readable from both sides
export const PRIMARY = '#0070f3'
```

## Interview questions

**★ How should you read the "unsupported and unplanned" list when planning a migration?**
As three distinct signals rather than one list. *"Not planned"* — Yarn PnP, `urlImports`, `esmExternals` — means the
feature is a dead end and the plan must be to stop using it. *"We plan to implement these in the future"* —
`nextScriptWorkers`, `fallbackNodePolyfills` — means deferring is reasonable. And `sassOptions.functions` is the one
case where the docs explicitly instruct you to use webpack instead, which makes it a per-build decision rather than a
blocker for the whole application. Treating all three identically produces either misplaced optimism or an
unnecessary abandonment.

**★ Why does `composes` from a `.css` file stop working, and what is the actual fix?**
Because the two bundlers disagree about what a plain `.css` file *is*. Webpack would treat the composed file as a
CSS Module; under Turbopack *"the `.css` file will always be global"*, so there are no local class names to compose
from. The documented fix is a rename — make the source `.module.css` — not a rewrite of the composition. The same
reasoning and the same fix cover `@import` in a CSS Module, which is why the docs state the rule twice in nearly
identical words.

**★ Is keeping `--webpack` a reasonable long-term position?**
For a specific documented reason — custom Sass functions, or a plugin with no alternative — it is what the docs
themselves recommend, so it is defensible. As a general posture it is not, for two reasons: webpack is no longer the
default, so you are on the less-travelled path for every future release; and the temptation is to opt only the
*build* back while dev stays on Turbopack. That split reintroduces two compilers producing two artefacts, which is
the configuration most likely to yield a bug that reproduces in production and not locally.

**Why are these gaps described as *"less of a concern for new applications"*?**
Because nearly every entry is a difference from a prior behaviour rather than a limitation in absolute terms. A new
application never wrote `~` imports, never used `@value` instead of custom properties, never adopted a webpack
plugin, and never baselined snapshots against webpack's precision. The list is a set of migration costs, paid once
by codebases predating 16.0 — which is also why it is worth reading in full *before* an upgrade rather than
discovering it one failure at a time.

**`@value` is called "superseded by CSS variables". Is that a fair characterisation?**
Largely yes, and the difference is where the substitution happens. `@value` was a build-time constant inlined by the
CSS Modules toolchain, so it could feed things custom properties cannot — a media-query breakpoint, for instance,
which cannot read a custom property. Custom properties are resolved by the browser at runtime, which makes them
themeable and inspectable in ways `@value` never was. For the overwhelmingly common case of a shared colour or
spacing token the replacement is strictly better; for build-time-only substitutions the port needs a real constant
in the build rather than a CSS-level one.

**What would you grep for before starting a Turbopack migration, and why those specific patterns?**
`webpack:` in `next.config.*`, `~` prefixes in Sass imports, and `composes:` / `@value` / `:import` / `:export` in
`.module.css` — because each maps to a documented unsupported feature with a known fix, and each is cheap to find
and mechanical to resolve. Clearing them first matters less for the fixes themselves than for what it reveals:
these are the failures loud enough to mask the silent ones, and until they are gone you cannot tell whether a
styling difference is an unsupported rule or the ordering and precision gaps that produce no error at all.

---

← [01d · Migrating from webpack](01d-migrating-from-webpack-the-behavioural-gaps.md) · [Chapter index](01-explanation.md) · Next → [02 · React Compiler](02-react-compiler-retiring-manual-usememo-usecallback.md)
