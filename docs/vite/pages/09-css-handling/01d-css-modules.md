---
title: "CSS Modules are switched on by a substring in the filename, not by configuration — `.module.` anywhere before the extension turns a stylesheet into a scoped module whose exported names depend on a `localsConvention` that defaults to leaving them alone"
sidebar_label: "CSS Modules"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Features › CSS Modules](https://vite.dev/guide/features.md), [Shared Options › `css.modules`](https://vite.dev/config/shared-options.md) — plus `packages/vite/src/node/plugins/css.ts` at tag `v8.2.2` (`cssModuleRE`, `CSSOptions.modules`, the `postcss-modules` invocation) and the [css-modules specification](https://github.com/css-modules/css-modules) that Vite's documentation links as the definition. Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ CSS Modules

**There is no `enable: true`. A stylesheet becomes a CSS module because its filename contains `.module.` before a recognised CSS extension, and that decision is made by one regular expression with no configuration input.** The consequence is that scoping is a rename away in either direction — and that a plain `.css` file sitting next to a `.module.css` file is global, with class names exactly as written, colliding with anything in the application that shares a name.

## 1. Under-The-Hood Mechanics

The detection rule, from `css.ts` at `v8.2.2`:

```js
const cssModuleRE = new RegExp(`\\.module${CSS_LANGS_RE.source}`)
// CSS_LANGS_RE = /\.(css|less|sass|scss|styl|stylus|pcss|postcss|sss)(?:$|\?)/
```

So `Button.module.css`, `Button.module.scss`, `theme.module.pcss` — all modules. `Button.modules.css` and `Button-module.css` — not modules, and silently global.

> *"Any CSS file ending with `.module.css` is considered a [CSS modules file](https://github.com/css-modules/css-modules). Importing such a file will return the corresponding module object"*
> — [Features › CSS Modules](https://vite.dev/guide/features.md)

> *"You can also use CSS modules combined with pre-processors by prepending `.module` to the file extension, for example `style.module.scss`."* — same page

### What the import evaluates to

The documented example, verbatim:

```css
/* example.module.css */
.red {
  color: red;
}
```

```js
import classes from './example.module.css'
document.getElementById('foo').className = classes.red
```

`classes` is an object whose **keys are the class names you wrote** and whose **values are the generated scoped names**. 🔴 The shape of a generated name is not specified anywhere in the documentation, and `css.ts` sets no `generateScopedName` of its own — the options object is forwarded to `postcss-modules`, so the default is that package's. **Do not write code, snapshot tests or CSS selectors that depend on the generated string.** If you need a stable, predictable name, set `generateScopedName` yourself and own the format.

### Named imports, and the option that enables them

> *"If `css.modules.localsConvention` is set to enable camelCase locals (e.g. `localsConvention: 'camelCaseOnly'`), you can also use named imports"* — [Features › CSS Modules](https://vite.dev/guide/features.md)

```js
// .apply-color -> applyColor
import { applyColor } from './example.module.css'
document.getElementById('foo').className = applyColor
```

The default is documented in the type as `default: undefined` — i.e. **no conversion at all**, keys are exactly the authored class names. A kebab-case class then needs bracket access: `styles['apply-color']`.

| `localsConvention` | `.apply-color` is exported as |
|---|---|
| `undefined` (default) | `'apply-color'` only |
| `'camelCase'` | `'apply-color'` **and** `applyColor` |
| `'camelCaseOnly'` | `applyColor` only |
| `'dashes'` | dashes-in-names converted, originals kept |
| `'dashesOnly'` | converted only |
| `(original, generated, inputFile) => string` | whatever you return |

### The whole option surface

`css.modules` is *"passed on to [postcss-modules](https://github.com/css-modules/postcss-modules)"*, and the documented interface is:

| Option | Type | What it is for |
|---|---|---|
| `getJSON` | `(cssFileName, json, outputFileName) => void` | a callback receiving the class-name map — how you emit a manifest for a non-JS consumer |
| `scopeBehaviour` | `'global' \| 'local'` | treat unprefixed selectors as global or local |
| `globalModulePaths` | `RegExp[]` | paths whose classes are never scoped |
| `exportGlobals` | `boolean` | also export `:global` names in the module object |
| `generateScopedName` | `string \| (name, filename, css) => string` | the naming pattern — set this if you need stability |
| `hashPrefix` | `string` | salt for the generated hash |
| `localsConvention` | see table above | key naming in the exported object |

Vite wraps `getJSON` rather than replacing it: it stores the map internally for its own use and then calls yours if you supplied one, so providing `getJSON` does not break the import.

### Turning it off entirely

The config type in `css.ts` is `modules?: CSSModulesOptions | false`, and `compileCSS()` gates on `modulesOptions !== false && cssModuleRE.test(id)`. Setting `css.modules: false` therefore makes `.module.css` behave like any other stylesheet — global, no scoping, no exported object. That value is in the source type but is **not** shown in the documentation's type block; treat it as real but under-documented.

### It is a PostCSS-path feature

> *"This option doesn't have any effect when using [Lightning CSS](https://vite.dev/guide/features#lightning-css). If enabled, [`css.lightningcss.cssModules`](https://lightningcss.dev/css-modules.html) should be used instead."*
> — [Shared Options › `css.modules`](https://vite.dev/config/shared-options.md)

Detection still happens under Lightning CSS — the same `.module.` filename test drives it — but the configuration object is a different one. See [CSS Modules edge cases](01da-css-modules-edge-cases.md) and [Lightning CSS](01e-lightning-css.md).

## 2. Real-World Engineering Scenario

**A component library built by a dozen contributors, where two people independently write `.button`.** With global CSS this is a collision resolved by import order — meaning it is resolved differently in dev (module evaluation order) and in production (chunk order), and differently again after someone adds a dynamic import. Renaming every file to `*.module.css` makes the collision structurally impossible rather than merely discouraged: each `.button` compiles to its own generated name and the JS can only reach it through that file's exported object. The convention that replaces BEM discipline is a filename, which is reviewable in a diff and enforceable with a lint rule.

## 3. Production-Grade Code Example

```css
/* Button.module.css */
.button {
  padding: 8px 16px;
  border-radius: 4px;
}
.button-primary {
  background: #0ea5e9;
}
/* :global escapes scoping — css-modules syntax, not a Vite feature */
:global(.no-js) .button {
  transition: none;
}
```

```tsx
// Button.tsx — with localsConvention: 'camelCaseOnly', keys are camelCased
import styles from './Button.module.css';

type Props = { variant: 'primary' | 'secondary'; label: string };

export function Button({ variant, label }: Props) {
  const className =
    variant === 'primary' ? `${styles.button} ${styles.buttonPrimary}` : styles.button;
  return <button className={className}>{label}</button>;
}
```

```typescript
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  css: {
    modules: {
      // 🔴 the valid values are camelCase | camelCaseOnly | dashes | dashesOnly
      localsConvention: 'camelCaseOnly',
      // own the generated name instead of depending on an unspecified default
      generateScopedName: '[name]__[local]___[hash:base64:5]',
    },
  },
});
```

## 4. Senior Engineer Edge Cases & Pitfalls

**Detection is a substring test, not a suffix test.** `cssModuleRE` matches `.module` immediately followed by a CSS extension, so `a.module.css?used` and `a.module.scss` match. Anything else — `styles.modules.css`, `module.css` with no dot before it — does not.

**Scoping is per file, so the same class name in two modules is two different names.** That is the point, but it also means `composes` across files is the only supported way to share a rule without duplicating it, and `composes: x from './other.module.css'` pulls the *other* file's class into your element's class list rather than copying the declarations.

**`scopeBehaviour: 'global'` inverts the file.** Every selector stays global unless explicitly marked `:local`. It exists for wrapping third-party CSS you must not rewrite, and it makes the file's exports nearly empty — which surprises the JS side.

**A `.module.css` file with no class selectors exports an empty object.** Element and id selectors are not scoped and not exported. A module that styles only `a`, `body` or `#root` is a global stylesheet wearing a module's filename.

**TypeScript needs a declaration for the import.** `vite/client` types cover `*.module.css` as an untyped record; a per-file typed shape requires generating `.d.ts` files (for example from `getJSON`), which is exactly what that callback is for.

## Gotchas

**★ Symptom: `localsConvention: 'camCaseOnly'` has no effect, or the config errors.** Cause: that is not a valid value — the documented set is `'camelCase' | 'camelCaseOnly' | 'dashes' | 'dashesOnly'` or a function. A typo here is not a build error in every setup, so it can sit in a config for months. Fix:

```typescript
css: { modules: { localsConvention: 'camelCaseOnly' } }
```

**★ Symptom: `styles.applyColor` is `undefined` although `.apply-color` exists in the file.** Cause: `localsConvention` defaults to `undefined`, meaning no camelCase conversion — the key is the authored name. Fix: bracket-access it, or opt in.

```javascript
styles['apply-color']                 // works with the default
// or set css.modules.localsConvention = 'camelCase' (keeps both) / 'camelCaseOnly'
```

**★ Symptom: a class defined in `Button.css` leaks into another component.** Cause: only `.module.` filenames are scoped; a plain `.css` import is applied globally with the names exactly as written. Fix: rename the file and switch to the exported object.

```javascript
// ❌ global — .button here collides with every other .button in the app
import './Button.css';
// ✅ scoped
import styles from './Button.module.css';
```

**★ Symptom: a test snapshot breaks on every dependency bump because class names changed.** Cause: the generated name format is not part of Vite's documented contract, so it can change with the `postcss-modules` version. Fix: set `generateScopedName` explicitly so the format is yours, or assert on `data-testid` rather than on class names.

**★ Symptom: `composes: card from './shared.module.css'` throws or composes nothing.** Cause: `composes` may only reference another **CSS module**; a plain `.css` file has no local names to compose from. Fix: make the source file a module too, and remember the result is two class names on the element, not one merged rule.

**★ Symptom: adding `getJSON` to `css.modules` stopped the default import from working.** Cause: it should not — Vite wraps your callback and keeps its own copy of the map. If the import broke, the callback threw. Fix: make `getJSON` total and side-effect-safe; it runs during the build for every module file.

```typescript
css: {
  modules: {
    getJSON(cssFileName, json, outputFileName) {
      // write a manifest for a non-JS consumer; never throw here
      manifest[cssFileName] = json;
    },
  },
}
```

**★ Symptom: `css.modules` options appear to be ignored, and you recently changed `css.transformer`.** Cause: documented — *"This option doesn't have any effect when using Lightning CSS."* Fix: move the configuration to `css.lightningcss.cssModules`, whose option shape is Lightning CSS's, not `postcss-modules`'.

**★ Symptom: an element renders with the literal string `undefined` in its class attribute.** Cause: a mistyped key on the module object returns `undefined`, and template-literal concatenation stringifies it. Fix: build the class list from an array and filter, so a missing key drops out instead of being rendered.

```javascript
const className = [styles.button, isPrimary && styles.buttonPrimary]
  .filter(Boolean)
  .join(' ');
```

## Interview questions

**★ Why does Vite key CSS Modules off the filename instead of a config option?**
Because the decision has to be made per file, and the alternative — a glob list in `vite.config.ts` — puts the fact that a stylesheet is scoped somewhere the reader of the stylesheet cannot see. A filename travels with the file, appears in every import statement, is visible in a code review diff and is enforceable by a lint rule. The cost is that a typo (`.modules.css`) fails open: you get a global stylesheet and no error.

**★ What does `import styles from './x.module.css'` actually give you, and what is safe to assume about its values?**
An object mapping the class names you authored to the generated scoped names. Safe assumptions: the keys are your class names (subject to `localsConvention`), a missing key is `undefined`, and the values are unique per file. **Not** safe: the format of the values. The documentation never specifies it and Vite sets no default `generateScopedName`, so it comes from `postcss-modules` and can change. Anything that needs a stable name should set `generateScopedName`.

**★ When would you set `scopeBehaviour: 'global'` or `globalModulePaths`?**
When you are importing CSS you do not control — a third-party widget's stylesheet, or a legacy global theme — through the module pipeline for the sake of a uniform import style, but must not have its class names rewritten, because HTML you do not own refers to them by literal name. `globalModulePaths` targets specific files by regex; `scopeBehaviour: 'global'` inverts the default for everything and requires `:local` to opt back in.

**★ A colleague proposes deleting all `.module.` suffixes and relying on BEM. What is the technical argument against it?**
Collision safety stops being structural and becomes a matter of discipline, and the failure mode is order-dependent: which of two identically-named rules wins depends on stylesheet order, which differs between the dev server (module evaluation order) and the production build (chunk order and the code-splitting graph). That is a class of bug that reproduces only in production. CSS Modules make the collision impossible to express, and the JS-side reference means a deleted class becomes `undefined` at the call site rather than a silently missing style.

**★ Does switching to Lightning CSS keep your CSS Modules working?**
Detection does — the `.module.` filename test is the same. Configuration does not: `css.modules` is documented as having no effect under Lightning CSS, and the replacement is `css.lightningcss.cssModules`, which is Lightning CSS's own option shape rather than `postcss-modules`'. So a project with a non-trivial `css.modules` block, especially a custom `generateScopedName` or `localsConvention`, has to port it, and generated names can change in the process.

---

← [Preprocessors](01c-preprocessors.md) · [Vite overview](../../README.md) · Next → [CSS Modules Edge Cases](01da-css-modules-edge-cases.md)
