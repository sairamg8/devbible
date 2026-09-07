---
title: "Lightning CSS is already minifying your CSS in Vite 8; `css.transformer: 'lightningcss'` is the separate, experimental decision to let it replace PostCSS for everything else — and that swap deletes your plugin chain rather than adapting it"
sidebar_label: "Lightning CSS"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07 against the Vite documentation — [Features › Lightning CSS](https://vite.dev/guide/features.md), [Shared Options › `css.transformer`](https://vite.dev/config/shared-options.md), [Shared Options › `css.lightningcss`](https://vite.dev/config/shared-options.md), [Migration from v7 › CSS Minification by Lightning CSS](https://vite.dev/guide/migration.md), [Performance › Use Lesser or Native Tooling](https://vite.dev/guide/performance.md) — plus the `vite@8.2.2` npm manifest and `packages/vite/src/node/plugins/css.ts` at tag `v8.2.2` (`resolveCSSOptions`, `compileLightningCSS`, `getLightningCssErrorMessageForIeSyntaxes`). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ Lightning CSS as the Transformer

**Two different things wear the name "Lightning CSS" in Vite 8, and confusing them is the reason people think they have already migrated when they have not.** Lightning CSS is the **default minifier** — it runs in every production build unless you say otherwise, and needs no configuration. Lightning CSS as the **transformer** is an experimental opt-in that replaces the entire PostCSS stage: `postcss-import`, your `postcss.config.js` plugins and `postcss-modules` all stop running. The first is a fact about your current build. The second is a migration.

## 1. Under-The-Hood Mechanics

The documentation separates the two in consecutive sentences:

> *"Vite uses [Lightning CSS](https://lightningcss.dev/) to minify CSS in production builds by default. However, PostCSS is still used for other CSS processing."*
> — [Features › Lightning CSS](https://vite.dev/guide/features.md)

> *"There is experimental support for using Lightning CSS for CSS processing entirely. You can opt into it by adding [`css.transformer: 'lightningcss'`](https://vite.dev/config/shared-options#css-transformer)."* — same page

> *"To configure it, you can pass Lightning CSS options to the [`css.lightningcss`](https://vite.dev/config/shared-options#css-lightningcss) config option. To configure CSS Modules, you should use [`css.lightningcss.cssModules`](https://lightningcss.dev/css-modules.html) instead of [`css.modules`](https://vite.dev/config/shared-options#css-modules) (which configures the way PostCSS handles CSS modules)."* — same page

And the option itself:

> *"Selects the engine used for CSS processing."* — [`css.transformer`](https://vite.dev/config/shared-options.md), **Type** `'postcss' | 'lightningcss'`, **Default** `'postcss'`, flagged **Experimental**.

### It is installed already

`lightningcss` `^1.33.0` is a hard `dependency` of `vite@8.2.2` — not a peer, not optional. Nothing to install, on either path.

⚠️ The JSDoc in `css.ts` still says *"It requires to install it as a peer dependency."* That comment predates the dependency change; the manifest is authoritative.

### What the switch actually replaces

`compileCSS()` chooses one branch:

```
transformer: 'postcss'      →  compilePostCSS()
                               [postcss-modules, postcss-import, …your plugins…, UrlRewritePostcssPlugin]

transformer: 'lightningcss' →  compileLightningCSS()
                               Lightning CSS parses, bundles @import via a Vite resolver,
                               rewrites url()/dependencies via analyzeDependencies,
                               and handles CSS modules with its own implementation
```

Preprocessors are **upstream of the branch**, so Sass, Less and Stylus keep working either way. Everything downstream of them that PostCSS was doing is gone — there is no adapter and no warning. That is the entire migration risk in one sentence.

### Switching silently sets a browser target

`resolveCSSOptions()` does this at config-resolution time:

```js
if (resolved.transformer === 'lightningcss') {
  resolved.lightningcss ??= {}
  resolved.lightningcss.targets ??= convertTargets(ESBUILD_BASELINE_WIDELY_AVAILABLE_TARGET)
}
```

So opting in also opts you into **syntax lowering against the baseline-widely-available target set** unless you set `css.lightningcss.targets` yourself. Lightning CSS will happily rewrite nesting, `color-mix()`, logical properties and custom media down to that baseline — output your PostCSS setup may never have produced. Bigger, more compatible CSS is the expected result, and the migration note says so for the minifier case too: *"Lightning CSS supports better syntax lowering and your CSS bundle size might increase slightly."*

### The option surface

`css.lightningcss` is Lightning CSS's own transform options, documented as *"Full transform options can be found in [the Lightning CSS repo](https://github.com/parcel-bundler/lightningcss/blob/master/node/index.d.ts)"*:

| Option | Use |
|---|---|
| `targets` | browsers to lower syntax for — **auto-set on opt-in**, see above |
| `include` / `exclude` | force specific `Features` on or off regardless of `targets` |
| `drafts` | enable draft specs (e.g. custom media) |
| `nonStandard` | opt into non-standard syntax support |
| `pseudoClasses` | remap `:hover`/`:focus`-style pseudo-classes to real classes for testing |
| `unusedSymbols` | names Lightning CSS may treat as dead and strip |
| `cssModules` | CSS Modules configuration on this path — replaces `css.modules` |
| `errorRecovery` | tolerate and strip invalid legacy syntax instead of erroring |

### Diagnostics look different

Errors are re-thrown with a `[lightningcss]` prefix and a code frame; warnings are logged as `[vite:css][lightningcss] …`. Vite adds one bespoke hint: if a parse error occurs in a file containing a **star property hack** (`*zoom: 1`) or the **`@media (min-width: 0\0)` hack**, it appends an explanation ending with the actionable line — *"While this is not supported by LightningCSS, you can set `css.lightningcss.errorRecovery: true` to strip these codes."* Legacy IE hacks are the most common reason a codebase cannot flip this switch on the first try.

### Vite's own positioning

> *"Try out the experimental support for [LightningCSS](https://github.com/vitejs/vite/discussions/13835)"* — [Performance › Use Lesser or Native Tooling](https://vite.dev/guide/performance.md), under the heading *"While Vite core is based on native tooling, some features still use non-native tooling by default to provide better compatibility and feature set. But it may be worth the cost for larger applications."*

"May be worth the cost for larger applications" is the documentation's own framing, and it is the right one: this is a performance trade, not an upgrade.

## 2. Real-World Engineering Scenario

**A design-system build with a `postcss.config.js` containing autoprefixer, `postcss-preset-env` and two in-house plugins that inject theme custom properties.** Someone sets `css.transformer: 'lightningcss'` after reading that it is faster. The build succeeds. Nothing warns. The output has lost the injected theme properties, and the vendor prefixes are now whatever Lightning CSS decided from the auto-injected baseline `targets` rather than what `browserslist` said. Nothing failed loudly because the PostCSS branch is simply not taken — Vite does not even resolve the config file. The correct order of work is: enumerate every PostCSS plugin, map each to a Lightning CSS feature (`drafts`, `include`, `targets`) or accept its loss, port the in-house plugins to something that runs at stage ① or as a Vite plugin, and only then flip the switch.

## 3. Production-Grade Code Example

```typescript
// vite.config.ts — a considered Lightning CSS opt-in
import { defineConfig } from 'vite';
import { browserslistToTargets } from 'lightningcss';
import browserslist from 'browserslist';

export default defineConfig({
  css: {
    transformer: 'lightningcss',
    lightningcss: {
      // 🔴 set this explicitly. If you omit it, Vite injects the baseline-widely-available
      //    target set and lowers syntax against it, which is probably not your browserslist.
      targets: browserslistToTargets(browserslist('>= 0.25%, not dead')),

      // draft specs you actually rely on
      drafts: { customMedia: true },

      // CSS Modules live HERE now — css.modules has no effect on this path
      cssModules: { pattern: '[name]__[local]___[hash]' },

      // only if the codebase still contains IE-era hacks you cannot delete yet
      errorRecovery: true,
    },
  },
  build: {
    // independent of the above: this is the MINIFIER, and it already defaults to lightningcss
    cssMinify: 'lightningcss',
  },
});
```

```jsonc
// A migration checklist expressed as the thing it replaces
// postcss.config.js (before)          →  where it goes after
// autoprefixer                        →  css.lightningcss.targets (prefixing is built in)
// postcss-preset-env (nesting, etc.)  →  built-in lowering + css.lightningcss.drafts
// postcss-custom-media                →  css.lightningcss.drafts.customMedia
// postcss-modules (via css.modules)   →  css.lightningcss.cssModules
// an in-house plugin injecting values →  ❌ no equivalent — port it or keep PostCSS
```

## 4. Senior Engineer Edge Cases & Pitfalls

**Absolute and protocol-relative URLs are handled differently.** The source notes *"contrary to lightningcss, postcss-import does this internally"* before explicitly marking `//example.com/x.css` and `https://…` imports as external on the Lightning CSS path. The end result matches, but only because Vite adds the behaviour back.

**`@import` deduplication may differ.** The documentation's note about `postcss-import` having *"a different behavior with duplicated `@import` from browsers"* is attached to the `css.transformer` option precisely because the two engines diverge here.

**`css.modules` does not warn when ignored.** It is documented as having no effect; there is no runtime message telling you the block is dead.

**`errorRecovery: true` is not a general safety net.** It strips syntax Lightning CSS cannot parse. That is right for IE hacks and wrong as a default, because it also removes genuinely malformed CSS you would rather have found.

**`.sss` gets special handling.** SugarSS is a PostCSS syntax, so on the Lightning CSS path Vite pre-converts it (`transformSugarSS`) before handing the result to Lightning CSS. The `sugarss` peer dependency is still required.

**Experimental means the option shape can move in a minor.** Both `css.transformer` and `css.lightningcss` carry the "Give Feedback" discussion marker. Pin Vite if you build tooling on top of them.

## Gotchas

**★ Symptom: you set `css.transformer: 'lightningcss'` and vendor prefixes, custom media or injected variables silently disappeared.** Cause: the PostCSS branch is not taken at all — `postcss.config.js` is not merged and not warned about. Fix: port each plugin's job onto the Lightning CSS surface, or revert.

```typescript
css: {
  transformer: 'lightningcss',
  lightningcss: { targets: /* … */, drafts: { customMedia: true } },
}
```

**★ Symptom: the CSS bundle grew and output looks "de-modernised" after the switch.** Cause: opting in auto-populates `css.lightningcss.targets` with the baseline-widely-available set, so modern syntax gets lowered. Fix: set `targets` from your real browserslist.

```typescript
import { browserslistToTargets } from 'lightningcss';
import browserslist from 'browserslist';
// …
lightningcss: { targets: browserslistToTargets(browserslist('>= 0.25%, not dead')) }
```

**★ Symptom: the build fails with a `[lightningcss]` parse error pointing at `*zoom: 1` or `@media (min-width: 0\0)`.** Cause: IE-era hacks are not valid CSS and Lightning CSS refuses them; Vite recognises both shapes and appends a hint. Fix: delete the hacks, or set the documented escape hatch.

```typescript
css: { transformer: 'lightningcss', lightningcss: { errorRecovery: true } }
```

**★ Symptom: someone claims the project "already uses Lightning CSS" because the build is fast.** Cause: half true — it is the default *minifier* in Vite 8, which is not the same as `css.transformer`. Fix: check the config; `build.cssMinify` and `css.transformer` are independent options with different defaults.

**★ Symptom: CSS Modules class names changed after the migration and end-to-end tests fail.** Cause: naming moved from `css.modules.generateScopedName` (`postcss-modules`) to `css.lightningcss.cssModules` (Lightning CSS's own scheme, enabled by default for `.module.` files). Fix: set `pattern` explicitly, and stop selecting on generated names in tests.

**★ Symptom: `npm ls lightningcss` shows it installed even though you never added it.** Cause: it is a hard dependency of `vite@8.2.2`, along with `postcss`. Fix: nothing — but do not add it to your own `dependencies` "to be safe"; that pins a second copy you now have to keep in step.

**★ Symptom: a Vite plugin that ran a PostCSS pass on CSS still works, while `postcss.config.js` does not.** Cause: a plugin running its own PostCSS instance is independent of `css.transformer`; only Vite's internal PostCSS stage is replaced. Fix: none needed — but be aware you now have two CSS engines in one build, which is a maintenance cost rather than a bug.

## Interview questions

**★ In a default Vite 8 project, is Lightning CSS running? Name both answers.**
Yes as the **minifier** — `build.cssMinify` defaults to `'lightningcss'` since Vite 8, and `lightningcss` is a hard dependency, so every production build already goes through it. No as the **transformer** — `css.transformer` defaults to `'postcss'`, so `@import` inlining, your PostCSS plugins and CSS Modules are all still PostCSS. The two options are independent and only the second one changes the shape of your pipeline.

**★ What is lost by setting `css.transformer: 'lightningcss'`, and what warns you?**
Everything the PostCSS branch does: `postcss-import`'s inlining semantics, every plugin in `postcss.config.js`, and `css.modules` configuration. Nothing warns. `compileCSS()` simply dispatches to the other branch, and Vite does not even attempt to resolve the PostCSS config when the transformer is Lightning CSS. That silence is why the migration has to start with an inventory of what PostCSS was doing rather than with the config change.

**★ Why might the CSS bundle get *bigger* after moving to Lightning CSS?**
Because Lightning CSS does syntax lowering that esbuild's minifier and a minimal PostCSS setup did not. The migration guide states it directly for the minifier change: *"Lightning CSS supports better syntax lowering and your CSS bundle size might increase slightly."* On the transformer path the effect is stronger, because Vite auto-populates `targets` with the baseline-widely-available set if you do not, so nesting and modern colour syntax get expanded into older equivalents.

**★ How would you sequence a migration from PostCSS to Lightning CSS on a large codebase?**
Inventory first: list every plugin in `postcss.config.js` and classify each as (a) natively covered — prefixing, nesting, modern-syntax lowering; (b) covered by an option — `drafts`, `include`/`exclude`, `cssModules`; or (c) no equivalent, which means porting it to a Vite plugin or a preprocessor step, or dropping it. Then remove external dependencies on generated CSS Modules names. Then set `targets` explicitly from browserslist so the auto-injected baseline does not surprise you. Flip the switch on a branch, diff the emitted CSS, and expect IE-hack parse errors as the first failure — for which `errorRecovery: true` is the documented, temporary answer.

**★ The performance guide recommends trying Lightning CSS. When is that advice wrong?**
When the PostCSS chain is doing work Lightning CSS has no equivalent for — in-house plugins that inject design tokens, plugins that read or write files, anything that depends on the PostCSS AST — and when the CSS volume is small enough that stage ② is not on the critical path anyway. Vite's own wording is *"may be worth the cost for larger applications"*: it is a trade between compile speed and an ecosystem, and on a small app you are paying the ecosystem cost for a saving you cannot measure.

---

← [CSS Modules Edge Cases](01da-css-modules-edge-cases.md) · [Vite overview](../../README.md) · Next → [?inline, ?raw and ?url](01f-inline-raw-and-url-suffixes.md)
