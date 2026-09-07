---
title: "A CSS module is a JavaScript module that exports strings, and every strange thing about it — no self-accepting HMR, `?inline` returning text instead of a map, `?url` throwing outright, surviving SSR when plain CSS does not — follows from that one fact"
sidebar_label: "CSS Modules Edge Cases"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against `packages/vite/src/node/plugins/css.ts` at tag `v8.2.2` — the dev-transform branch (`__vite__updateStyle`, `import.meta.hot.accept`), the `?inline` branch (`#6984, #7552`), the `?url` guard, the `consumer === 'server'` branch, `compileLightningCSS`'s `cssModules` argument and its `composes` resolver note — cross-checked against [Features › CSS](https://vite.dev/guide/features.md) and [Shared Options › `css.modules`](https://vite.dev/config/shared-options.md). Source-read, **not executed**; no sandbox run, no timings. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ CSS Modules Edge Cases

**Plain CSS is a side effect: import it and a stylesheet appears. A CSS module is a value: import it and you get an object other code reads.** Vite's pipeline treats the two differently at four places — hot updates, the `?inline` suffix, the `?url` suffix, and server-side rendering — and in every case the difference is a consequence of a module having exports that can change. If you only remember one sentence: **a `.module.css` file cannot self-accept an update, because its exports change when you edit it.**

## 1. Under-The-Hood Mechanics

### Dev: what the browser actually receives

For a plain stylesheet, Vite's dev transform emits roughly this JavaScript (structure from `css.ts` at `v8.2.2`):

```javascript
import { updateStyle as __vite__updateStyle, removeStyle as __vite__removeStyle } from '/@vite/client'
const __vite__id = '/src/app.css'
const __vite__css = '.hero{color:red}'
__vite__updateStyle(__vite__id, __vite__css)
import.meta.hot.accept()                                   // ← plain CSS only
import.meta.hot.prune(() => __vite__removeStyle(__vite__id))
```

For a `.module.css`, the line marked above is replaced by the exported class map. The source says why, in one comment:

```js
// css modules exports change on edit so it can't self accept
```

That single substitution is the whole behavioural difference in dev:

| | plain `.css` | `.module.css` |
|---|---|---|
| Emits `import.meta.hot.accept()` | yes — the module is self-accepting | **no** |
| Editing it | swaps the `<style>` text in place; **no importer re-runs** | the update propagates to importers |
| Effect on component state | none | depends on whether an importer accepts; otherwise a full reload |

The `hotUpdate` path agrees: a module is treated as self-accepting only when it is *not* in the CSS-modules cache, *not* an `?inline` request and *not* an HTML proxy.

### `?inline` changes what the default export **is**

```js
// #6984, #7552
// `foo.module.css` => modulesCode
// `foo.module.css?inline` => cssContent
```

`import styles from './x.module.css?inline'` gives you the **compiled CSS text**, not the class-name map. That is not a bug and not a fallback — the suffix means "give me the processed string and do not inject it", and it wins over the module semantics. There is no query that returns both.

### `?url` on a CSS module is a hard error

The plugin throws before anything else happens, with this message:

```
?url is not supported with CSS modules. (tried to import "/src/x.module.css?url")
```

Reason: a URL is a pointer to a stylesheet the browser will apply globally; the class map — the only thing that makes the file usable — cannot travel through a URL.

### SSR: modules survive, plain CSS evaporates

In an environment whose `consumer` is `'server'`, the CSS transform returns:

- for a CSS module → **the class-name map only**, no style injection;
- for plain CSS → `export {}`, an empty module.

So `styles.button` resolves during server rendering and the markup carries the same generated names the client will use, while the stylesheet itself is not injected server-side — that is the client build's job (or the framework's, via `build.ssrEmitAssets`). This is why CSS Modules and SSR compose so cleanly and why importing a plain global stylesheet in a server-only module is a silent no-op rather than an error. See **SSR and library mode** *(not written yet)*.

### Under Lightning CSS, modules are on by default and configured elsewhere

`compileLightningCSS()` passes:

```js
cssModules: cssModuleRE.test(id)
  ? (config.css.lightningcss?.cssModules ?? true)
  : undefined,
```

So the `.module.` filename test still drives detection, `css.lightningcss.cssModules` supplies the options, and if you set nothing the value is `true` — Lightning CSS's defaults, not `postcss-modules`'. Generated names can therefore differ from the PostCSS path.

`composes` resolution also narrows. The source records the divergence:

```js
// NOTE: with `transformer: 'postcss'`, CSS modules `composes` tried to resolve with
//       all resolvers, but in `transformer: 'lightningcss'`, only the one for the
//       current file type is used.
```

Under PostCSS, a `composes: … from './x'` specifier is tried against every language resolver; under Lightning CSS only the resolver for the current file's language is used. A `.module.css` composing from a `.scss` file is the case that stops resolving.

## 2. Real-World Engineering Scenario

**A React team migrates one component from `Card.css` to `Card.module.css` and reports that "HMR got worse" — editing colours now resets the component's local state.** Nothing regressed. Before the rename, the stylesheet was self-accepting: Vite replaced the `<style>` content and no JS re-executed, so state was untouched. After the rename, the file exports a class map, cannot self-accept, and the update propagates to `Card.tsx`; with React Fast Refresh installed that boundary usually preserves state, and without it the propagation walks up until something accepts — or triggers a full reload. The fix is not to revert the rename; it is to make sure a Fast Refresh (or equivalent) boundary exists, which is a JS-side concern the CSS rename merely exposed.

## 3. Production-Grade Code Example

```typescript
// vite.config.ts — the same project under each transformer
import { defineConfig } from 'vite';

export default defineConfig({
  css: {
    // PostCSS path (default): css.modules is the option that applies
    modules: {
      localsConvention: 'camelCaseOnly',
      generateScopedName: '[name]__[local]___[hash:base64:5]',
    },
    // If you switch to Lightning CSS, the block ABOVE stops applying and this one starts:
    // transformer: 'lightningcss',
    // lightningcss: {
    //   cssModules: { pattern: '[name]__[local]___[hash]' },
    // },
  },
});
```

```javascript
// The four import shapes, and what each evaluates to
import styles from './Card.module.css';          // { card: 'Card__card___a1b2c' } — scoped map
import text from './Card.module.css?inline';     // the compiled CSS TEXT, not injected, not a map
import './Card.css';                             // side effect: styles applied globally
// import url from './Card.module.css?url';      // ❌ throws: "?url is not supported with CSS modules"
```

```typescript
// server-entry.tsx — a CSS module is safe to import on the server
import styles from './Card.module.css';   // the map resolves; nothing is injected
import './global.css';                    // becomes `export {}` on the server — a deliberate no-op

export function renderCard(): string {
  return `<div class="${styles.card}">…</div>`;
}
```

## 4. Senior Engineer Edge Cases & Pitfalls

**A chunk containing a CSS module is never a "pure CSS chunk".** The build marks a chunk impure the moment it sees a module id matching `.module.`, with the comment *"a css module contains JS, so it makes this not a pure css chunk"* — because the class map is real JavaScript that other chunks import. This is why lazily importing a `.module.css` behaves differently from lazily importing a plain one; see [code splitting](01g-code-splitting-and-fouc.md).

**The class map is cached per build.** `cssModulesCache` is keyed by the resolved config and reset in `buildStart`, so a watch-mode rebuild starts from an empty map. Nothing persists across builds — do not expect stable names across two separate `vite build` runs unless you set `generateScopedName`.

**`?inline` also disables self-accepting HMR** for plain CSS, not just modules: the `isSelfAccepting` test excludes any id carrying `?inline`. That follows — an inlined string is a value someone else uses, so replacing a `<style>` element would achieve nothing.

**Generated names can differ between the two transformers**, which matters if anything outside the build (a Playwright selector, a CSS-in-HTML template, a snapshot) refers to them. Migrating transformer is a rename of every generated class.

## Gotchas

**★ Symptom: editing a `.module.css` reloads the page or resets component state, while editing a plain `.css` does not.** Cause: a CSS module cannot self-accept, because its exports change when you edit it, so the update propagates to importers. Fix: nothing in CSS — ensure the importing component is a Fast Refresh boundary, or accept the update explicitly.

```javascript
if (import.meta.hot) {
  import.meta.hot.accept(['./Card.module.css'], () => { /* re-render */ });
}
```

**★ Symptom: `import styles from './x.module.css?inline'` gives a string, and `styles.card` is `undefined`.** Cause: `?inline` returns the processed CSS text; the class map is not produced for an inline request. Fix: import the file twice if you truly need both, once with the suffix and once without.

```javascript
import styles from './x.module.css';          // the map
import css from './x.module.css?inline';      // the text
```

**★ Symptom: build fails with `?url is not supported with CSS modules`.** Cause: exactly what it says — the guard runs on any id matching both `?url` and `.module.`. Fix: drop `.module.` from the filename if you genuinely want a URL to a stylesheet, or drop `?url` if you want scoped classes.

**★ Symptom: importing a global stylesheet in an SSR entry does nothing, with no error.** Cause: on a server consumer, plain CSS transforms to `export {}`. Fix: import global CSS from the **client** entry, and let the framework link the emitted stylesheet during SSR (`build.ssrManifest`, or `build.ssrEmitAssets` if the framework merges assets itself).

**★ Symptom: after switching to `css.transformer: 'lightningcss'`, `composes: … from './theme.scss'` no longer resolves.** Cause: under Lightning CSS only the resolver for the current file's language is used, per the source note. Fix: compose from a file of the same language, or move the shared rule into a mixin handled at stage ①.

**★ Symptom: class names changed shape after switching transformer, breaking end-to-end selectors.** Cause: under Lightning CSS the naming comes from `css.lightningcss.cssModules` (defaulting to `true`, i.e. Lightning CSS's own scheme), not from `css.modules.generateScopedName`. Fix: set the pattern explicitly on the new path, or stop selecting on generated class names.

**★ Symptom: a `.module.css` in an SSR build produces markup whose classes do not match the client stylesheet.** Cause: server and client must run the same transformer with the same module options; a config that sets `css.modules` for one environment only will generate two different naming schemes. Fix: keep CSS options at the top level of the config so every environment shares them.

**★ Symptom: HMR for a `.module.css` triggers a full reload in a plain-TS (no framework plugin) app.** Cause: the propagation finds no accepting importer and walks to the root. Fix: this is expected without a framework HMR boundary — add `import.meta.hot.accept` in the importing module, or accept the reload.

## Interview questions

**★ Why can a plain CSS file self-accept a hot update but a CSS module cannot?**
Because self-accepting means "I can absorb my own change and nobody upstream needs to re-run". A plain stylesheet can: Vite replaces the text inside the `<style>` element it created and the DOM re-renders with no JavaScript re-executed. A CSS module also **exports values** — the class-name map — and editing the file can add, remove or rename those keys, so consumers holding the old object would be stale. Vite therefore emits the class map instead of `import.meta.hot.accept()`, and the update propagates to whoever imported it. The source comment is literally *"css modules exports change on edit so it can't self accept"*.

**★ What does `import x from './a.module.css?inline'` evaluate to, and why is that not a bug?**
The compiled CSS text. `?inline` is documented as "return the processed CSS string as the default export and do not inject it", and Vite's implementation has an explicit branch preferring the CSS content over the modules code for inline requests. It is coherent: the query asks for the file's *text*, and a class map is not the file's text. If you need both you import the same file twice with different queries.

**★ Why does importing a `.module.css` work in an SSR bundle when importing `global.css` is a no-op?**
Because on a server consumer Vite returns the class map for a module and `export {}` for plain CSS. The map is data the server needs to emit correct `class` attributes; the stylesheet is not, since the server sends HTML and the browser fetches CSS through a `<link>` emitted by the client build. Making global CSS an empty module rather than an error means a shared component can import its own stylesheet and still be rendered on the server.

**★ You are asked to move a large app from PostCSS to Lightning CSS. What breaks in CSS Modules specifically, and how would you de-risk it?**
Three things. `css.modules` stops applying and has to be re-expressed as `css.lightningcss.cssModules`, with a different option shape. Generated class names change, so anything selecting on them outside the build breaks. And `composes` cross-language resolution narrows to the current file's language only. De-risking means removing external dependencies on generated names first (switch tests to `data-testid`), pinning an explicit naming pattern on both paths, and grepping for `composes … from` across file-type boundaries before flipping the switch.

**★ Why is a chunk containing a CSS module never eligible for pure-CSS-chunk removal?**
Because pure-CSS-chunk removal exists for chunks whose *entire* JavaScript content was CSS side effects — once the CSS is extracted, the JS is empty and the chunk can be deleted. A CSS module leaves real JavaScript behind: the exported class map, which importing chunks read. Vite marks the chunk impure as soon as it encounters a `.module.` id, exactly so the map is not deleted along with the empty shell.

---

← [CSS Modules](01d-css-modules.md) · [Vite overview](../../README.md) · Next → [Lightning CSS](01e-lightning-css.md)
