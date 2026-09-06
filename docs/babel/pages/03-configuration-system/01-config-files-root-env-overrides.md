---
title: "Babel Configuration: Files, Root, env & overrides"
sidebar_label: "Babel Configuration"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-06 against the Babel documentation at babeljs.io for **Babel 8.0.1** — npm
> `latest` for `@babel/core`, read from `npm view @babel/core dist-tags` on 2026-09-06 —
> [Configuration files](https://babeljs.io/docs/config-files) (project-wide vs file-relative,
> `babelrcRoots`, `rootMode`) and [Options](https://babeljs.io/docs/options) (`envName`, `env`,
> `overrides`, `root`). Documentation-validated, **no sandbox run**; the packages installed in
> this checkout are Babel 7.29.7 and nothing on this page was executed.
> Validated: 2026-09-06 · claims + output provenance · session 4e8d4393

# 📋 Babel Configuration: Files, Root, env & overrides

Covers syllabus **§3.1 Config File Forms**, **§3.2 Root/Monorepos**, **§3.3 env-based Config**, and **§3.4 overrides**.

## 1. Concept & Under-the-Hood Mechanics

### 3.1 Config File Forms

| Form | Scope |
| --- | --- |
| `babel.config.json` / `.js` / `.cjs` / `.mjs` / `.cts` | **Project-wide** — monorepo root config applies across packages when resolved as root |
| `.babelrc` / `.babelrc.json` / `.js` / `.cjs` / `.mjs` / `.cts` | **File-relative** — package-local; does not automatically apply across package boundaries the same way |
| `package.json` `"babel"` | Inline small-repo config |

### 3.2 Config Resolution & Root (Monorepos)

- **`root` / `rootMode: 'root' | 'upward' | 'upward-optional'`** — find monorepo root config when compiling from a package subdirectory. `'root'` is the default and means "use `root` as given"; `'upward'` *"will make Babel search from the working directory upward looking for your `babel.config.json` file"*; `'upward-optional'` does the same search but falls back to `root` instead of failing when nothing is found ([Configuration files](https://babeljs.io/docs/config-files), [Options](https://babeljs.io/docs/options)).  
- **`babelrcRoots`** — allow specific packages’ `.babelrc` to load when using a shared root config. The docs' own instruction is to *"Use the `babelrcRoots` option from inside your `babel.config.json` file"* so as to *"consider all `packages/*` packages as allowed to load `.babelrc.json` files"* — without it, a package-local `.babelrc` in a monorepo is simply not read: *"must be inside of `babelrcRoots` packages, or else searching will be skipped entirely."*  

🔴 **`rootMode` is a config-*loading* option, so it comes from whoever calls Babel — not from the config file it is supposed to find.** Babel's reference groups it with `root`, `envName`, `configFile` and `babelrc`: the options that decide *which config files get loaded at all*. A value that tells Babel where to look for the root config cannot itself be read out of that root config; by the time Babel has parsed the file, the search is already over. Pass it from the integration instead — the loader's options, the CLI's root-mode flag, or the programmatic call:

```js
// tools/compile.mjs — the shape that is unambiguously Babel's own API surface
import { transformFileSync } from '@babel/core';
transformFileSync('packages/ui/src/Button.tsx', { rootMode: 'upward' });
```

⚠️ The reference does not print the sentence *"this key is ignored inside a config file"*, so remember the mechanism rather than an error message, and check your integration's README for the exact spelling it exposes.

This is **not** the same as ESLint's flat-config resolution model: flat config is a single non-cascading array evaluated from the project root, not a per-directory lookup at all (that per-directory cascade was legacy `.eslintrc`'s behavior, which flat config replaced). Babel's root/rootMode resolution is its own distinct model and a common source of "why didn't my transform apply?" bugs—see [recipes](../16-real-world-workflows-and-recipes/01-setup-debug-and-migrate.md).

### 3.3 env-based Config

The `"env"` key selects blocks via `BABEL_ENV` or fallback `NODE_ENV` (`development`, `production`, `test`). Classic pattern: enable **CommonJS modules** only under `env.test` for Jest, keep ESM for modern bundlers in development/production.

The selection rule is `envName`, and its default is worth memorising verbatim because the third term surprises people:

> *"Default: `process.env.BABEL_ENV || process.env.NODE_ENV || "development"`"* — [Options](https://babeljs.io/docs/options)

So with neither variable set, **`env.development` is what runs** — not "no env block". And the blocks are additive, not alternatives: *"`env[envKey]` options will be merged on top of the options specified in the root object."*

### 3.4 overrides

`overrides: [{ test, include, exclude, plugins, presets }]` applies different pipelines to path globs (e.g. legacy folder needs older targets).

---

## 2. Real-World Engineering Scenario

**Scenario: workspace package not transformed in the app build.**

App depends on `@acme/ui` published as raw ESM+JSX from source. Root has no `babel.config.js`; only `apps/web/.babelrc`. Babel never applies to files under `packages/ui` because `.babelrc` is package-scoped. Fix: root `babel.config.js` + `rootMode: 'upward'` from the bundler context, or compile packages before publish.

---

## 3. Production-Grade Code Example

```js
// babel.config.js (repo root)
// NOTE: no `rootMode` here on purpose — see the config-loading note above. It is passed by
// the caller (loader options / CLI flag / programmatic options), because it decides which
// config file gets loaded and therefore cannot be read from that file.
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' }, modules: false }],
    ['@babel/preset-react', { runtime: 'automatic' }],
    '@babel/preset-typescript',
  ],
  env: {
    test: {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }],
        ['@babel/preset-react', { runtime: 'automatic' }],
        '@babel/preset-typescript',
      ],
    },
  },
  overrides: [
    {
      test: ['./packages/legacy/**'],
      presets: [
        ['@babel/preset-env', { targets: { ie: '11' } }],
      ],
    },
  ],
};
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Both babel.config.js and nested .babelrc fighting
Unpredictable merges—prefer one strategy.

### ⚠️ `NODE_ENV=production` during tests accidentally
Skips test env block; Jest gets ESM when it expected CJS (or the reverse).

### ⚠️ Setting `modules: false` for Jest without an ESM runner
Hard-to-parse import errors—use env.test.

### ⚠️ Forgetting monorepo root when using babel-loader in a package
Transforms silently no-op on linked workspace sources.

## Gotchas

**★ `.babelrc` stops at the nearest `package.json`, which is why it "works locally and not in the
monorepo".** The docs state the search rule plainly: *"Searching will stop once a directory
containing a `package.json` is found, so a relative config only applies within a single package."*
Symptom: the app compiles, a linked workspace package's source does not. Cause: the file being
compiled lives in a different package from the `.babelrc`. Fix: a project-wide `babel.config.json`
at the repo root, plus `rootMode: 'upward'` from the caller so Babel finds it from a package
subdirectory.

**★ Adding a `.babelrc` inside a workspace package does nothing until you allow it.** Even with a
root config in place, *"[it] must be inside of `babelrcRoots` packages, or else searching will be
skipped entirely."* Symptom: a per-package override that is simply ignored, with no warning. Fix:
list the packages in `babelrcRoots` in the root config — the documented example is
`"babelrcRoots": ["packages/*"]`, described as making Babel *"consider all `packages/*` packages
as allowed to load `.babelrc.json` files"*.

**★ `rootMode` inside `babel.config.js` is a no-op waiting to be discovered.** It is the option
that decides *which* config file Babel loads, so by the time Babel is reading options out of a
config file, it has already finished searching. Symptom: you added `rootMode: 'upward'` to the
root config and the workspace package still is not transformed. Fix: pass it from the caller —
loader options, the CLI flag, or `transformFileSync(file, { rootMode: 'upward' })`.

**★ With neither `BABEL_ENV` nor `NODE_ENV` set, you are in the `development` env block.** The
default is *"`process.env.BABEL_ENV || process.env.NODE_ENV || "development"`"*. Symptom: a
one-off script or a fresh CI step behaves like a dev build — dev-only plugins running, dev-only
JSX runtime, dev-only assertions in the output. Fix: set `BABEL_ENV` explicitly in any pipeline
whose behaviour you care about, rather than relying on the tool to have set `NODE_ENV`.

**★ `BABEL_ENV` beats `NODE_ENV`, and that is the escape hatch, not a bug.** When a tool insists
on `NODE_ENV=production` but you need Babel's `test` pipeline (or vice versa), setting `BABEL_ENV`
overrides Babel's choice without touching what the rest of the process sees. Symptom this fixes:
tests run with `NODE_ENV=production`, the `env.test` block is skipped, and Jest gets ESM where it
expected CommonJS.

**★ `env` blocks merge on top of the root options — they do not replace them.** The docs:
*"`env[envKey]` options will be merged on top of the options specified in the root object."* So an
`env.test` block that only sets `modules: 'commonjs'` still inherits every root-level preset and
plugin. ⚠️ This pass did **not** verify how two entries for the *same* preset (root and env) are
reconciled, so the safe pattern is the one in the example above: re-state the preset list in the
env block so the resolved result is unambiguous, or keep env blocks to options that appear nowhere
else.

**★ Project-wide and file-relative config are two mechanisms, not two spellings of one.** A repo
can have `babel.config.json` *and* `.babelrc` files, and both participate. ⚠️ This pass did not
confirm the precedence order between them, so do not build on a remembered rule: pick one strategy
per repo. When you must debug an existing mixed setup, use `loadPartialConfig` from `@babel/core`
to print what Babel actually resolved for a specific file rather than reasoning about it.

**★ `overrides` and `env` answer different questions, and using the wrong one duplicates config.**
`overrides` matches on **file paths** (`test`, `include`, `exclude`) and is how one directory gets
older targets; `env` matches on the **environment name** and is how the test run gets CommonJS.
Symptom of the mix-up: an `env.test` block full of path globs, or an `overrides` entry keyed on
`process.env`, both of which quietly stop tracking whatever they were meant to follow.

**★ `overrides`' `test`/`include`/`exclude` are file-path matchers, so they need a filename.**
Under a bundler or test runner you always have one. In a programmatic `transformSync` call you do
not, unless you pass `filename` — and an override that never matches looks exactly like an override
that is wrong. See
[the core pipeline](../02-core-compilation-pipeline/01-parse-transform-generate-and-api.md).

**★ `modules: false` plus a CommonJS test runner is the most common self-inflicted "unexpected
token import".** The root config is right for the bundler and wrong for the runner. Fix is the
`env.test` block in the example above, not a global change — that would cost the bundler its
tree-shaking.

**★ A config file may be `.cts` as well as `.js`/`.cjs`/`.mjs`/`.json`.** The current docs list
`.cts` among both the `babel.config.*` and `.babelrc.*` extensions. It is the one to know about
because a TypeScript config file is loaded by a different mechanism from a plain `.js` one — check
what your Node version and Babel version require before reaching for it in CI.

## Interview questions

**★ `babel.config.json` or `.babelrc` — which do you reach for, and what actually differs?**
`babel.config.json` is *project-wide*: Babel looks for it in the root directory and it applies to
everything compiled under that root, including files in other packages of a monorepo.
`.babelrc` is *file-relative*: Babel searches upward from the file being compiled and stops at the
first directory containing a `package.json`, so it can never reach past its own package. Rule of
thumb: anything that must apply across package boundaries — presets, the framework's JSX
configuration — goes in the project-wide file; genuinely package-local tweaks go in `.babelrc`, and
in a monorepo they need `babelrcRoots` before they are read at all.

**★ A linked workspace package's source is not being transformed. Walk me through the diagnosis.**
First, establish where the config lives relative to the file. If the only config is a `.babelrc`
inside the app package, it cannot apply to files in another package — the search stops at that
package's `package.json`. Second, if a root `babel.config.json` exists, check that the caller is
finding it: compilation starting inside a package subdirectory needs `rootMode: 'upward'` (or an
explicit `root`) passed from the loader or the API, not written into the root config. Third, if
you added a per-package `.babelrc`, check `babelrcRoots` — without it that file is skipped
silently. And confirm all three with `loadPartialConfig` instead of guessing.

**★ How do you get CommonJS in the test run and ES modules in the bundle from a single config?**
An `env.test` block that sets `modules: 'commonjs'` on `@babel/preset-env`, with the root config
leaving modules alone (or `false`) for the bundler. It works because the active block is chosen by
`envName`, whose default is `BABEL_ENV || NODE_ENV || "development"`, and test runners set
`NODE_ENV=test`. The alternative that avoids the env block entirely is `modules: "auto"`, which
asks the caller whether ES modules survive downstream — but then you are trusting each integration
to report itself correctly, which is harder to reason about when it goes wrong.

**★ Nothing sets `NODE_ENV`. Which `env` block runs?**
`development`. The `envName` default chain ends in the literal string `"development"`, so "no
environment" is not a state Babel has. This is why a script that runs Babel outside your normal
pipelines can produce different output from the same config in CI, and why anything whose output
you ship should set `BABEL_ENV` explicitly.

**★ When is `overrides` the right tool rather than a second config file?**
When the difference is *which files*, not *which environment*. A legacy directory that must target
IE11, a vendored folder that needs a plugin nothing else needs, generated code that must skip a
transform — all path-shaped, all `overrides` with `test`/`include`/`exclude`. Splitting them into
separate config files means either duplicating the shared pipeline or relying on file-relative
config resolution, which is exactly the mechanism people find hardest to predict.

**★ Where does `rootMode` belong, and why not in the config file?**
In the caller's options: the loader's `options`, the CLI's root-mode flag, or the options object
you pass to `transformFileSync`. It is one of the config-*loading* options, alongside `root`,
`envName`, `configFile` and `babelrc` — it decides which files get loaded, so it has to be known
before any file is read. Putting it in `babel.config.js` asks Babel to consult the file it has not
found yet.
