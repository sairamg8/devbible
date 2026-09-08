---
title: "resolve.extensions is a literal list of filesystem checks run in order for every extensionless import, so every entry you add is a stat call charged to every import that doesn't need it"
sidebar_label: "01c · resolve.extensions"
sidebar_position: 4
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08 against the Vite documentation — [Shared Options](https://vite.dev/config/shared-options), [Performance](https://vite.dev/guide/performance). Documentation-validated; **no sandbox run, no timings, no benchmarks**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ resolve.extensions

**`resolve.extensions` is not a hint or a preference table — it is the literal, ordered sequence of filesystem checks Vite runs for every extensionless import.** Each entry the list contains is one more `stat` call charged against a specifier that failed to resolve on the entries before it, and the documentation's own worked example counts exactly that cost. The list exists as a convenience for a small, closed set of JS/TS extensions; it is explicitly not meant to grow to accommodate framework-specific formats.

## The documented default, and what each check costs

> *"List of file extensions to try for imports that omit extensions."* — [Shared Options](https://vite.dev/config/shared-options)

Default value: `['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json']`.

The performance guide turns that list into a concrete cost model rather than leaving it abstract. Importing `./Component` when the real file is `./Component.jsx`:

> *"Resolving import paths can be an expensive operation when hitting its worst case often."*

> 1. *"Check if `./Component` exists, no."*
> 2. *"Check if `./Component.mjs` exists, no."*
> 3. *"Check if `./Component.js` exists, no."*
> 4. *"Check if `./Component.mts` exists, no."*
> 5. *"Check if `./Component.ts` exists, no."*
> 6. *"Check if `./Component.jsx` exists, yes!"*
> — [Performance](https://vite.dev/guide/performance)

Six filesystem checks for one import, and five of them are pure waste — every extension in the list *before* the one that actually matches is a failed `stat`. The default list is ordered `.mjs`, `.js`, `.mts`, `.ts`, `.jsx`, `.tsx`, `.json`, so a `.jsx` file specifically pays for four wasted checks (`.mjs`, `.js`, `.mts`, `.ts`) on every extensionless import, every time that module is resolved cold.

```typescript
// ❌ costs up to 6 filesystem checks per resolution, per the documented example
import Component from './Component';

// ✅ costs exactly 1 — the extension is given, no list is walked
import Component from './Component.jsx';
```

> *"The more implicit imports you have, the more time it adds up to resolve the paths. Hence, it's usually better to be explicit with your import paths, e.g. `import './Component.jsx'`."* — [Performance](https://vite.dev/guide/performance)

## Narrowing the list is a real, documented lever — with a real, documented catch

> *"You can also narrow down the list for `resolve.extensions` to reduce the general filesystem checks, but you have to make sure it works for files in `node_modules` too."* — [Performance](https://vite.dev/guide/performance)

The catch is the entire risk of this lever: `resolve.extensions` is not scoped to your own source tree. It is the list Vite uses for *every* extensionless resolution, including bare imports that land inside `node_modules`. Trim it to only what your own source uses, and a dependency shipping a `.json` companion file resolved via an extensionless internal import — or any extension you didn't anticipate — starts failing to resolve, with no warning that the cause was your own config rather than a broken package.

```typescript
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    // ⚠️ RISKY narrowing — fine if this project is 100% .ts/.tsx with no .jsx and
    // no dependency relying on an extensionless .mjs/.json internal import.
    // Verify against the actual dependency tree before shipping this, not just
    // your own source files.
    extensions: ['.mts', '.ts', '.tsx', '.json'],
  },
});
```

## Why adding `.vue` / `.svelte` to the list is discouraged, not merely unnecessary

`resolve.extensions` is documented as being for plain JS/TS resolution specifically, and the warning against extending it to framework single-file-component formats is explicit and separate from the performance argument:

> *"Note it is **NOT** recommended to omit extensions for custom import types (e.g. `.vue`) since it can interfere with IDE and type support."* — [Shared Options](https://vite.dev/config/shared-options)

That is an IDE/type-support argument, not a resolution-correctness one — TypeScript's own module resolution and editor tooling reason about `.vue`/`.svelte` files through dedicated language-service plugins (`vue-tsc`, the Svelte language server) that expect to see the real extension in the specifier. An extensionless `import Header from './Header'` where `Header.vue` is the real file works at the Vite-resolver level once `.vue` is added to `resolve.extensions`, but the editor's "go to definition," inline type errors, and template type-checking are not guaranteed to follow along, because those tools are not reading `vite.config.ts`.

```typescript
// ❌ DISCOURAGED — works for Vite's own resolver, degrades IDE/type support for
// every .vue import in the project, and adds another filesystem check to every
// unresolved extensionless import project-wide, not just .vue ones
resolve: { extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json', '.vue'] },

// ✅ CORRECT — keep the extension explicit at the import site; the framework's own
// tooling (vue-tsc, the Vue/Svelte language service) is built around this
import Header from './Header.vue';
```

## Gotchas

**★ Symptom: a cold dev-server start feels sluggish on a large codebase full of extensionless imports, and nothing in the config looks obviously wrong.** Cause: every extensionless import runs the full `resolve.extensions` list in order until a file matches — the documentation's own example counts 6 filesystem checks for one import that resolves on the last entry tried. At scale, this is real, additive, per-import cost. Fix: prefer explicit extensions at the import site where the codebase controls the style; where it doesn't, narrow `resolve.extensions` to only the extensions actually used, verified against `node_modules` as well as your own source.

**★ Symptom: narrowing `resolve.extensions` broke resolution somewhere deep inside a third-party dependency, not in the app's own source.** Cause: the documentation's own warning — the list "has to make sure it works for files in `node_modules` too," because it is not scoped to your source tree; a dependency's own extensionless internal import relies on the same list your app configured. Fix: restore the removed extension, or audit the specific dependency's own module resolution needs before narrowing further; a narrowed list is a project-wide claim, not a your-code-only one.

**★ Symptom: adding `.vue` to `resolve.extensions` lets `import Header from './Header'` build and run, but the editor now shows no type information and "go to definition" stops working for that import.** Cause: the extension list only changes what Vite's own resolver tries — it is not read by the TypeScript language service or the Vue/Svelte tooling that provides IDE support, and the documentation names this exact trade-off ("can interfere with IDE and type support"). Fix: write the extension explicitly at the import site (`./Header.vue`) instead of relying on `resolve.extensions` to supply it.

## Interview questions

**★ Why does an extensionless import cost more than an explicit one, mechanically — what is Vite actually doing during that cost?**
It runs the `resolve.extensions` list in declared order, issuing one filesystem existence check per candidate extension, stopping at the first one that exists. The documentation's own example needs six checks to resolve `./Component` to `./Component.jsx`, because `.jsx` sits last in the default list and five earlier candidates (the bare path plus `.mjs`, `.js`, `.mts`, `.ts`) all fail first. An explicit `./Component.jsx` import skips the list entirely and resolves in one check.

**★ A teammate proposes narrowing `resolve.extensions` to just `['.ts', '.tsx']` on a large app to speed up cold start. What do you check before agreeing?**
Whether every dependency in `node_modules` that the app actually imports relies on an extensionless resolution to something outside that narrowed set — a `.mjs` entry point, a `.json` companion file, a `.js` fallback build. The documentation is explicit that the list "has to make sure it works for files in `node_modules` too," because it is one shared list, not one scoped to first-party source. The safe version of this change audits the dependency tree first, not just the app's own file extensions.

**★ Why does the documentation warn against adding `.vue` to `resolve.extensions` instead of just saying it's slower?**
Because the cost it names isn't resolution speed at all — it's IDE and type-support fidelity. Vite's resolver and the TypeScript language service (plus framework-specific tooling like `vue-tsc`) are separate programs; adding `.vue` to `resolve.extensions` only changes what Vite's own resolver will try, and does nothing for tools that expect to see the real extension written at the import site to know which language service to hand the file to. The performance cost of a longer list is real too, but it's the secondary reason, not the one the documentation leads with.

---

← [01b · Aliases in CSS, HTML & assets](01b-aliases-in-css-html-and-assets.md) · [Vite overview](../../README.md) · Next → [01d · resolve.dedupe](01d-resolve-dedupe.md)
