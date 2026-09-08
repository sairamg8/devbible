---
title: "JSX in a .js file is not a Babel-era convention Vite happens to disagree with — it is a hard parse error, because Oxc decides whether to enable JSX syntax from the file extension alone, before it has looked at the file's contents"
sidebar_label: "01b · File extensions"
sidebar_position: 3
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08 against the Vite documentation — [Shared Options: `oxc`](https://vite.dev/config/shared-options), [Migration from v7](https://vite.dev/guide/migration.md), and the exact error string as reported verbatim in the Vite issue tracker — [vitejs/vite#13715](https://github.com/vitejs/vite/issues/13715), [vitejs/vite#9944](https://github.com/vitejs/vite/issues/9944) (the string itself is not printed on a vite.dev documentation page; it is the tool's own runtime output, quoted here from the issue reports since there is no sandbox to reproduce it). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ JSX in a `.js` file: CRA allowed it, Vite's transform refuses it by extension alone

**CRA never asked which extension a file used before deciding whether to parse JSX in it.** `babel-preset-react-app` ran the same JSX-aware transform over every `.js` file in `src/`, unconditionally, because Babel decides what syntax to accept from configuration, not from the file's own name. Vite's default transform decides differently, and it decides *before* looking at the file's contents at all — by extension. A CRA codebase with components in `.js` files (extremely common; CRA's own generated project historically used `.js`, not `.jsx`, for React components) hits this on the very first file that gets served.

## The mechanism: extension-gated syntax, not content-sniffed syntax

Vite 8's default transform is Oxc, and its scope is stated as an extension list, not a content heuristic:

> *"By default, transformation by Oxc is applied to `ts`, `jsx` and `tsx` files. You can customize this with `oxc.include` and `oxc.exclude`, which can be a regex, a [picomatch](https://github.com/micromatch/picomatch#globbing-features) pattern, or an array of either."* — [Shared Options](https://vite.dev/config/shared-options)

`.js` is not on that list. A file ending in `.js` that contains JSX syntax — `<div>{children}</div>` inside a `return` statement — is handed to Vite's plain JS/import-analysis pipeline, which does not know JSX syntax at all, and the parse fails. This is the exact wording reported verbatim across multiple Vite issues (not printed on a vite.dev doc page — quoted here from the tool's own error output as reported in the tracker, since reproducing it requires a sandbox this page does not have):

> `Failed to parse source for import analysis because the content contains invalid JS syntax. If you are using JSX, make sure to name the file with the .jsx or .tsx extension.`

The maintainers' position, from the same discussion thread ([vitejs/vite#13715](https://github.com/vitejs/vite/issues/13715)), is that this is deliberate: the underlying transformer (Oxc now, esbuild before Vite 8) enables JSX parsing per file based on its extension, not by scanning the source for angle brackets first — a `.js` file could contain a generic type parameter or a comparison operator that looks structurally similar to JSX in isolation, and gating by extension avoids ambiguity that content-sniffing would have to guess at.

This is a **hard parse error**, not a warning and not a runtime failure deep in your component tree — it surfaces immediately, on the file that Vite's import graph reaches first, which for most apps is `src/App.js` or an early-imported component.

## Fix one — rename to `.jsx` (or `.tsx`)

The straightforward fix, and the one that matches how new Vite + React projects are scaffolded from the start:

```bash
# Rename every source file containing JSX from .js to .jsx (TypeScript: .ts -> .tsx)
# Review this list before running — files with NO JSX (utils, constants, hooks with
# no return of markup) should stay .js/.ts; renaming them is unnecessary churn.
git mv src/App.js src/App.jsx
git mv src/components/Header.js src/components/Header.jsx
git mv src/components/Footer.js src/components/Footer.jsx
```

Every internal `import` of a renamed file still works without editing the import path itself — `import App from './App'` resolves against `resolve.extensions`' default order, which tries `.tsx`/`.jsx` alongside `.js`/`.ts`. The one place imports *do* need editing is anywhere the extension was written explicitly (`import App from './App.js'`), which will now point at a file that no longer exists.

```typescript
// src/index.jsx — the entry file itself, after rename
import { createRoot } from 'react-dom/client';
import App from './App'; // unaffected — extension is inferred, not hardcoded here

createRoot(document.getElementById('root')!).render(<App />);
```

**Trade-off:** this touches every affected file's name, which touches every import path that named it explicitly, git blame history (mitigated by `git mv`, which preserves history through the rename), and any tooling that hardcodes `.js` globs (ESLint overrides, Storybook config, path-based test matchers). On a large codebase this is a mechanical but real amount of diff.

## Fix two — widen `oxc.include` to cover `.js`

The alternative is telling Oxc to treat `.js` files as JSX-capable too, without renaming anything:

```typescript
// vite.config.ts — keep .js extensions, widen the transform's scope instead
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  oxc: {
    // Adds .js to the set of files Oxc will parse as JSX-capable, alongside
    // the default ts/jsx/tsx. Regex or picomatch pattern, per the docs.
    include: /\.[jt]sx?$/,
  },
});
```

`optimizeDeps.esbuildOptions`'s deprecated equivalent for this same knob was `esbuild.include` — the migration guide's rename table maps it straight across: *`esbuild.include/exclude` → `oxc.include/exclude`*. If you are working from an older blog post or an existing esbuild-era config snippet, that is the substitution to make.

**Trade-off:** this is the smaller diff, but it is a standing, silent scope change — every `.js` file in the matched pattern is now parsed as potentially containing JSX, forever, for every future file added to the codebase, rather than the choice being visible in the filename itself. A plain `.js` utility file that happens to contain a stray `<` in an unrelated context (a comparison inside a generic-looking expression) is now parsed by a JSX-aware grammar instead of a plain one, which is a smaller risk than it sounds but not zero. Most new Vite projects choose the rename specifically to avoid carrying this scope decision forward indefinitely.

## Which fix to choose

Rename for anything actively maintained — it matches upstream convention, needs no standing config, and the diff cost is paid once. Widen `oxc.include` only as a deliberate, temporary bridge during a large or actively-shipping migration where renaming every file in the same change as everything else in this topic is too much surface area for one pull request — and track the rename as follow-up work rather than letting the widened `include` become permanent by default.

## Gotchas

**★ Symptom: `Failed to parse source for import analysis because the content contains invalid JS syntax` on the very first component the dev server tries to serve.** Cause: the file contains JSX and ends in `.js`, and Oxc's default scope for JSX-aware parsing is `ts`, `jsx`, `tsx` only — `.js` is not included by default. Fix: rename to `.jsx`, or widen `oxc.include`.
```bash
git mv src/App.js src/App.jsx
```

**★ Symptom: renaming a file to `.jsx` breaks an import elsewhere that wrote the extension explicitly.** Cause: `import Foo from './Foo.js'` names a file that no longer exists after the rename; Vite's `resolve.extensions` inference only helps imports that omit the extension in the first place. Fix: drop the explicit `.js` from the import, or update it to `.jsx` — dropping it is preferred, since it survives a future extension change again.

**★ Symptom: after widening `oxc.include` to match `.js`, an unrelated `.js` utility file that has nothing to do with JSX starts failing to parse.** Cause: the file happens to contain a syntax construct that is ambiguous between plain JS and JSX once JSX parsing is turned on for that file — most commonly a generic-looking type assertion or a comparison chain that a JSX-aware grammar reads differently. Fix: narrow the `include` pattern to only the directories that actually contain components, rather than a blanket `\.js$/`, or finish the extension rename for that file specifically.

**★ Symptom: a `.ts` file (not `.tsx`) that returns JSX from a custom hook fails the same way.** Cause: identical mechanism, TypeScript side — Oxc's default scope includes `jsx` and `tsx` but plain `ts` files are not parsed as JSX-capable either, for the same content-agnostic-by-design reason. Fix: rename to `.tsx`; a `.ts` file that returns markup was already violating the convention TypeScript itself expects, independent of Vite.

**★ Symptom: `.jsx`/`.tsx` renames are complete, but a Storybook config, an ESLint `overrides` block, or a Jest `testMatch` pattern still globs on `.js` only and silently stops matching the renamed files.** Cause: these are independent tools with their own file-pattern config, none of which Vite's rename touches for you. Fix: grep every config file in the repo for a `.js`-specific glob and update it alongside the source rename, in the same change — this is exactly the kind of drift that passes CI quietly if the tool in question fails open (matches nothing, reports nothing) rather than erroring on zero matches.

## Interview questions

**★ Why does Vite reject JSX in a `.js` file instead of just detecting JSX syntax and transforming it regardless of extension?**
Because the transformer decides whether to *enable JSX grammar at all* before parsing, based on the file's extension, and that decision has to be made before the parser has looked at the content — you cannot detect "this file contains JSX" without first parsing it with a JSX-aware grammar, which is exactly the chicken-and-egg problem extension-gating avoids. A plain JS parser fed JSX syntax fails immediately and unambiguously; a parser that tried to guess whether to enable JSX support from partial content would have to handle genuinely ambiguous cases — a `<` that could be a comparison operator or the start of a JSX element — with a heuristic that inevitably guesses wrong sometimes. Gating by extension makes the decision deterministic and visible in the filename, at the cost of requiring the rename this chunk describes.

**★ A CRA app generated years ago has every component in `.js`, not `.jsx`. Is that unusual, and does it change the fix?**
It is not unusual — CRA's own project generator historically produced `.js` files for components, because Babel's transform (unlike Oxc's or esbuild's) never gated JSX parsing by extension in the first place, so there was no forcing function pushing CRA's convention toward `.jsx`. It does not change which fix is available, but it does change the *scale* of the rename: a CRA app that followed this convention consistently may have dozens or hundreds of files to rename, which is exactly the case where `oxc.include` as a temporary bridge, rather than a full rename in the same pull request as everything else in this migration, becomes a reasonable sequencing choice — rename incrementally, with the widened `include` covering whatever has not been renamed yet.

**★ What's the trade-off between renaming every file versus widening `oxc.include`, stated precisely?**
Renaming pays a one-time diff cost (file moves, explicit-extension imports, any tooling globbed on `.js`) in exchange for the extension itself documenting, permanently and per-file, whether JSX parsing is expected there — which is also what every fresh Vite + React scaffold does, so it is the path with no ongoing divergence from convention. Widening `oxc.include` pays no rename cost but leaves a standing config decision that silently affects every future `.js` file added to the matched paths, including ones a future contributor writes with no JSX in them at all, and it is a decision a new team member has to discover in `vite.config.ts` rather than read directly off a filename.

---

← [01a · Environment variables](01a-environment-variables.md) · [Vite overview](../../README.md) · Next → [01c · Absolute imports and aliases](01c-absolute-imports-and-path-aliases.md)
