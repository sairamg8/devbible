---
title: "`@babel/preset-react`, `@babel/preset-typescript` and the framework bundles — where each one bites"
sidebar_label: "Babel Presets — react, ts, frameworks"
sidebar_position: 2
---

> Verified: 2026-09-06 against the Babel documentation at babeljs.io for **Babel 8.0.1** — npm
> `latest` for `@babel/core`, read from `npm view @babel/core dist-tags` on 2026-09-06 —
> [@babel/preset-env](https://babeljs.io/docs/babel-preset-env),
> [@babel/preset-react](https://babeljs.io/docs/babel-preset-react),
> [@babel/preset-typescript](https://babeljs.io/docs/babel-preset-typescript),
> [@babel/plugin-transform-typescript](https://babeljs.io/docs/babel-plugin-transform-typescript)
> and [Babel 8 breaking changes](https://babeljs.io/docs/v8-migration). Babel 7 defaults marked
> *probed* were read out of the packages installed in this checkout (all 7.29.7).
> Documentation-validated, **no sandbox run**.
> Validated: 2026-09-06 · claims + output provenance · session 4e8d4393

# 🎁 The language and framework presets

**Split from [01](01-env-react-typescript-and-framework.md) on the concept boundary: that page is
`preset-env`, which decides transforms from a *target matrix*. These three decide how a *language
or framework* is read — and every one of them has a default that moved, or a job it deliberately
does not do.**

### 4.2 @babel/preset-react

| Runtime | Emit |
| --- | --- |
| `classic` | `React.createElement` — needs `React` in scope. **The preset's own default under Babel 7** (probed: `runtime = "classic"` in the installed `@babel/preset-react` 7.29.7), where `automatic` is not applied unless you set it. |
| `automatic` (recommended for React 17+) | `jsx`/`jsxs` from `react/jsx-runtime`. Frameworks (Next.js, Vite's React plugin, CRA-successors) set this for you. 🔴 **Under Babel 8 this is the default** — the option *"defaults to `automatic`"*. |

🔴 **This default flipped, and it is the single most confusing thing about this preset.** Babel 8
lists the change as *"Use the new JSX implementation by default"*, with the migration note: *"If
you are using a modern version of React or Preact, it should work without any configuration
changes. Otherwise, you can pass the `runtime: "classic"` option"*
([Babel 8 breaking changes](https://babeljs.io/docs/v8-migration)). So on Babel 7 a bare
`@babel/preset-react` emits `React.createElement` and needs `React` in scope; on Babel 8 the same
config emits imports from `react/jsx-runtime` and does not. Writing `runtime` explicitly is how you
stop caring which major you are on.

`development: true` uses `jsx-dev-runtime` for better component stacks. ⚠️ Do not hand-wire it:
the current docs say `development` *"defaults to `true` if Babel's `envName` id `"development"`,
and `false` otherwise"* (grammar as published), and `envName` is
`BABEL_ENV || NODE_ENV || "development"` — so the preset already tracks the environment for you.

### 4.3 @babel/preset-typescript

**Type-stripping only**—no type checking, and the docs are blunt about what that costs:

> *"This plugin does not add the ability to type-check the JavaScript passed to it."* … *"Since
> Babel does not type-check, code which is syntactically correct, but would fail the TypeScript
> type-checking may successfully get transformed, and often in unexpected or invalid ways."*
> — [@babel/plugin-transform-typescript](https://babeljs.io/docs/babel-plugin-transform-typescript)

Align with TS:

- Prefer `isolatedModules` / `verbatimModuleSyntax` on the TS side, because Babel compiles one file
  at a time and *"The build process will always behave as though `isolatedModules` is turned on"*.
  Turning the same flag on in `tsconfig.json` makes `tsc` report the constructs that depend on
  cross-file knowledge — ambient declarations, re-exporting a type without `export type` — instead
  of letting Babel emit something plausible and wrong.
- ⚠️ **`const enum` is not one of the things Babel refuses to emit.** The preset ships an
  `optimizeConstEnums` option (default `false`); with it on, *"Babel will inline enum values rather
  than using the usual `enum` output"* and exported const enums become plain object literals,
  *"avoiding cross-file dependency requirements"*. Left off, a `const enum` compiles like a regular
  enum. The real caveat is the *cross-file* case, which no single-file compiler can do — not the
  syntax itself.

### 4.4 Framework-Bundled Presets

- **`next/babel`** — Next.js's bundled preset, shipped inside the `next` package itself (not a separately published `babel-preset-next` package). Reference it as `presets: ['next/babel']` in a custom `babel.config.js`/`.babelrc` when on the Babel path.  
- **`metro-react-native-babel-preset`** (name evolves—check RN version) — React Native entry  
- Always **read the framework default** before adding a custom `babel.config.js` (adding one may disable faster compilers)

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ preset-typescript “succeeds” with type errors
Always run `tsc --noEmit` separately—see [interop](../09-linter-and-type-checker-interop/01-babel-eslint-parser-and-tsc.md).

### ⚠️ classic JSX runtime + React 17+ automatic assumptions
Missing React imports or double runtimes.

### ⚠️ polyfills in library code with useBuiltIns: usage
Can pollute consumer globals—libraries often use `useBuiltIns: false` and document peer polyfills.

### ⚠️ Adding babel.config.js to Next without reading SWC docs
May silently leave the fast path—measure compile times.

## Gotchas

**★ `@babel/preset-react`'s `runtime` default is `classic` on Babel 7 and `automatic` on Babel 8.**
Probed as `runtime = "classic"` in the installed 7.29.7; the current docs say it *"defaults to
`automatic`"* and Babel 8 lists the change as *"Use the new JSX implementation by default"*.
Symptom on upgrade: `React` imports you added to satisfy the classic runtime become unused, or a
lint rule starts firing, or a Preact-style project suddenly imports from `react/jsx-runtime`. Fix:
write `runtime` explicitly in the config so the major stops mattering — and if you genuinely need
the old emit, *"you can pass the `runtime: "classic"` option"*.

**★ Hand-wiring `development` from `process.env` is redundant on Babel 8 and subtly wrong.** The
option *"defaults to `true` if Babel's `envName` id `"development"`, and `false` otherwise"*, and
`envName` is `BABEL_ENV || NODE_ENV || "development"`. The example above writes
`development: process.env.BABEL_ENV === 'development'`, which is `false` in the very common case
where only `NODE_ENV=development` is set — so you lose `jsx-dev-runtime` and the component stacks
it exists to give you. Fix: omit the option and let `envName` decide.

**★ `isTSX` and `allExtensions` no longer exist on Babel 8.** *"Remove `isTSX` and `allExtensions`
options"*, replaced by `ignoreExtensions: true` where you need it. The pair existed to force
TS/TSX parsing regardless of the file's extension — which is exactly the situation you are in when
compiling from a string, or from `.js` files that really contain TSX. Fix: `ignoreExtensions`, and
make sure you are passing a `filename` at all.

**★ `const enum` compiles; it is the cross-file behaviour that differs from `tsc`.** Babel's
preset has an `optimizeConstEnums` option that makes it *"inline enum values rather than using the
usual `enum` output"*; without it you get a normal enum object. What Babel cannot do is what `tsc`
does with an *ambient* const enum declared in another file, because *"The build process will always
behave as though `isolatedModules` is turned on"*. Fix: enable `isolatedModules` in `tsconfig.json`
so `tsc` refuses the patterns Babel would mis-emit, and treat `optimizeConstEnums` as a size
optimisation rather than a correctness fix.

**★ preset-typescript succeeding tells you nothing about your types.** *"This plugin does not add
the ability to type-check the JavaScript passed to it."* Worse than "no errors": *"code which is
syntactically correct, but would fail the TypeScript type-checking may successfully get
transformed, and often in unexpected or invalid ways."* Fix: `tsc --noEmit` as a separate,
required CI step — see
[interop](../09-linter-and-type-checker-interop/01-babel-eslint-parser-and-tsc.md).

**★ Adding a `babel.config.js` to a framework project can move you off the fast compiler.** That
is the scenario at the top of the track: the config exists for one plugin and costs every build.
⚠️ Whether your framework major still offers a Babel path at all was **not verified in this pass** —
it is a framework question, not a Babel one. Read the framework's current compiler documentation
before you plan a migration around it, in both directions.

**★ The React Native preset has been renamed more than once, and this page does not pin it.**
`metro-react-native-babel-preset` is the historical name. ⚠️ This pass did not verify which preset
name the current React Native release ships, so take the name from the RN version's own template
rather than from any reference page, this one included.

**★ `next/babel` is not a separately published package, and looking for one wastes an
afternoon.** It ships *inside* the `next` package, which is why it is referenced by the
path-style name `presets: ['next/babel']` rather than as `babel-preset-next`. There is no
`npm install` step, and the absence of a package by that name on npm is not evidence the preset
was removed.

## Interview questions

**★ What is the difference between the classic and automatic JSX runtimes, and what changed in
Babel 8?**
Classic compiles JSX to `React.createElement(...)`, so `React` must be in scope in every file that
uses JSX. Automatic compiles it to `jsx`/`jsxs` calls imported from `react/jsx-runtime`, so no
import is needed and the runtime can be swapped via `importSource` (Preact, Emotion's JSX). Babel 7
defaults to classic — probed as `runtime = "classic"` in 7.29.7 — and Babel 8 defaults to
automatic, described in its own breaking-change list as *"Use the new JSX implementation by
default"*. The practical answer in an interview and in a repo is the same: set it explicitly.

**★ Does Babel type-check TypeScript? If not, what does the rest of the setup have to do?**
No — *"This plugin does not add the ability to type-check the JavaScript passed to it."* Babel
strips types file by file and emits. So a real setup runs `tsc --noEmit` as its own CI job, and
turns on the `tsconfig.json` flags that forbid what a single-file compiler cannot do —
`isolatedModules`, and `verbatimModuleSyntax` for import elision. Babel's own docs make the same
point from the other side: *"The build process will always behave as though `isolatedModules` is
turned on."*

**★ Why does `const enum` behave differently under Babel than under `tsc`?**
Because inlining a const enum across files needs whole-program knowledge, and Babel compiles one
file at a time. Babel does emit `const enum` — as a regular enum by default, or as inlined values
with `optimizeConstEnums`, which the docs describe as making it *"inline enum values rather than
using the usual `enum` output"* and *"avoiding cross-file dependency requirements"*. What you
cannot rely on is a const enum declared ambiently elsewhere being inlined for you. `isolatedModules`
is what makes `tsc` tell you before Babel silently does something else.

**★ What does a framework-bundled preset like `next/babel` actually buy you, and what does it
cost?**
It bundles the framework's whole transform pipeline — JSX configuration, TypeScript, and whatever
the framework needs for its own runtime — behind one entry, so you do not have to keep it in sync
by hand. It ships inside the framework package rather than as a separate `babel-preset-*` package,
which is why you reference it by a path-style name. The cost is that reaching for it means you have
a custom Babel config at all, and on a framework whose default is a Rust/Go compiler that can mean
leaving the fast path for every build — which is a decision to measure, and to re-check against
your framework's current documentation rather than a reference page.

**★ What does `importSource` let you do, and why does it only exist on the automatic runtime?**
It redirects where the `jsx`/`jsxs` functions are imported from — `preact`, Emotion, or any
library shipping a JSX runtime — so the same JSX syntax compiles against a different
implementation. It only makes sense on the automatic runtime because that is the runtime that
*emits an import at all*; the classic runtime calls `React.createElement` from whatever `React`
happens to be in scope, so the only way to swap it is to change what you imported. That is also
why the classic runtime needs `React` in scope in every file and the automatic one does not.

---

← Prev: [`@babel/preset-env` and the polyfill boundary](01-env-react-typescript-and-framework.md) · [Track index](../../README.md)
