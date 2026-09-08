---
title: "REACT_APP_ to VITE_ is a find-and-replace, but process.env.NODE_ENV to import.meta.env is not, because process does not exist in a Vite-built browser bundle at all"
sidebar_label: "01a · Environment variables"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08 against the Vite documentation — [Env Variables and Modes](https://vite.dev/guide/env-and-mode.md), the Create React App documentation — [Adding Custom Environment Variables](https://create-react-app.dev/docs/adding-custom-environment-variables/). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ Environment variables: the rename is easy, the `process` object is not

**Two migrations are hiding inside "update the env vars", and they are not the same size.** Renaming the prefix from `REACT_APP_` to `VITE_` is a mechanical find-and-replace across `.env*` files and source. Replacing every read of `process.env.X` with `import.meta.env.X` looks the same size but is not, because CRA's Webpack `DefinePlugin` silently gave every dependency in `node_modules` a working `process.env` too — and Vite does not. This chunk covers the rename, the read-site rewrite, and the specific runtime crash that only shows up once you have a *third-party* dependency that reads `process.env` directly, not your own code.

## The prefix rename

Both tools require a prefix specifically to prevent an env var from leaking into client code by accident. CRA:

> *"You must create custom environment variables beginning with `REACT_APP_`. Any other variables except `NODE_ENV` will be ignored to avoid accidentally exposing a private key on the machine that could have the same name."* — [Adding Custom Environment Variables](https://create-react-app.dev/docs/adding-custom-environment-variables/)

Vite, same intent, different prefix:

> *"Variables prefixed with `VITE_` will be exposed in client-side source code after Vite bundling."* — [Env Variables and Modes](https://vite.dev/guide/env-and-mode.md)

```bash
# .env — BEFORE (CRA)
REACT_APP_API_URL=https://api.acme.com
REACT_APP_STRIPE_KEY=pk_live_xxx
REACT_APP_FEATURE_NEW_CHECKOUT=true
```

```bash
# .env — AFTER (Vite) — same values, prefix renamed, nothing else changes here
VITE_API_URL=https://api.acme.com
VITE_STRIPE_KEY=pk_live_xxx
VITE_FEATURE_NEW_CHECKOUT=true
```

Two rename passes are required, not one — the `.env*` files, and every source reference:

```bash
# One sweep across the whole source tree. Review the diff; do not blind-apply
# across generated files, vendor code, or test fixtures that assert on the literal string.
grep -rl 'REACT_APP_' src/ | xargs sed -i 's/REACT_APP_/VITE_/g'
```

## The read-site rewrite: `process.env.X` → `import.meta.env.X`

This is not a rename of the same shape, because the two access patterns come from different origins. Webpack's `DefinePlugin` does textual substitution of `process.env.REACT_APP_API_URL` at build time, but the *identifier* `process` continues to exist elsewhere in the bundle because plenty of npm packages reference it. Vite's `import.meta.env` is a genuinely different object, populated at dev-server start and statically replaced at build:

> *"Vite exposes certain constants under the special `import.meta.env` object. These constants are defined as global variables during dev and statically replaced at build time to make tree-shaking effective."* — [Env Variables and Modes](https://vite.dev/guide/env-and-mode.md)

> *"Vite exposes env variables under the `import.meta.env` object as strings automatically."*

```typescript
// BEFORE (CRA)
const apiUrl = process.env.REACT_APP_API_URL;
const isFeatureOn = process.env.REACT_APP_FEATURE_NEW_CHECKOUT === 'true';

// AFTER (Vite)
const apiUrl = import.meta.env.VITE_API_URL;
const isFeatureOn = import.meta.env.VITE_FEATURE_NEW_CHECKOUT === 'true';
```

Both tools expose values as **strings**, string `'true'` included — the `=== 'true'` comparison above is required in both, not new to Vite. That is not what breaks; what breaks is the identifier itself.

## `process` does not exist in the browser under Vite — the exact failure

CRA's `DefinePlugin`, configured by `react-scripts` invisibly, replaced `process.env.NODE_ENV` (and only variables it knew about) throughout the bundle, but Webpack also ships a `process` shim (via `node-libs-browser` / its Node polyfill defaults) for anything that still refers to the bare identifier. Vite does neither: it performs textual replacement only for the specific `import.meta.env.*` accesses it knows about, and it does not polyfill `process` as a global at all. A dependency in `node_modules` — commonly an older or CJS-authored package — that reads `process.env.SOMETHING` at module-evaluation time, rather than at call time behind a guard, throws in the browser the moment that module is evaluated, because `process` is simply undefined there:

```typescript
// Inside some-old-npm-package/dist/index.js, running in the BROWSER under Vite:
if (process.env.DEBUG) {
  // ReferenceError: process is not defined
  // This line executes at module load — the browser has no `process`, full stop.
}
```

This never happened under CRA, because Webpack's environment shim meant `process` always resolved to *something*, even if `process.env.DEBUG` was `undefined`. Under Vite, `process` is not a variable in browser code at all unless you put it there.

### The three fixes, in order of preference

**1 — Fix or replace the dependency.** If the package has a newer major that reads env vars lazily or via an isomorphic check (`typeof process !== 'undefined'`), upgrade. This is the only fix that removes the problem rather than working around it.

**2 — `define` a minimal shim, scoped to what actually breaks.** `define` performs the same textual-replacement trick Vite already uses for `import.meta.env`, so you can extend it to cover the specific `process.env` accesses a dependency needs:

```typescript
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    // Textual replacement — every occurrence of `process.env` in the built output
    // becomes `{}`. This satisfies `if (process.env.DEBUG)` (reads undefined,
    // falsy, no crash) without reintroducing a real Node process object.
    'process.env': {},
  },
});
```

**3 — A real shim, when the dependency needs actual values (not just non-crashing reads).** Some packages check specific keys and behave differently based on them — `process.env.NODE_ENV === 'production'` is common enough that a bare `{}` breaks the package's own optimisation branches. Feed it what it expects:

```typescript
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
  },
});
```

The `JSON.stringify` is load-bearing in every one of these — `define` is a textual substitution, not a JS value assignment. Without it, `process.env.NODE_ENV` would be replaced by the bare characters `production`, an undeclared identifier, and the build would fail (or worse, silently reference an unrelated global if one happened to exist with that name).

## Mode vs `NODE_ENV` — do not conflate them, and do not re-derive this here

CRA has no `--mode` concept; `NODE_ENV` is the only axis, set implicitly by `react-scripts start`/`build`/`test`. Vite has two independent axes — `import.meta.env.MODE` (free-form, selects which `.env.[mode]` file loads) and `NODE_ENV` (binary, drives `import.meta.env.PROD`/`.DEV`) — and conflating them is a documented, common production incident, covered in full with the exact failure mode and CI guard already in this corpus:

**[07 · Modes & `NODE_ENV`](../07-env-variables-and-modes/01e-modes-and-node-env.md)** — read that chunk before introducing a `staging` or `qa` mode during this migration; the eleven-week incident it documents is exactly the trap a CRA team reaches for first, because CRA never had a second axis to get wrong.

Also load-bearing for this migration specifically: **[07 · The `VITE_` prefix and secrets](../07-env-variables-and-modes/01b-the-vite-prefix-and-secrets.md)** — CRA's `REACT_APP_` prefix had the identical exposure semantics (everything prefixed ships to the browser bundle), so a secret that was already safely unprefixed under CRA should stay unprefixed under Vite; the risk is a mechanical rename script that blindly prefixes *every* variable in `.env`, including ones that were deliberately left unprefixed. And **[07 · Typing `import.meta.env`](../07-env-variables-and-modes/02e-typing-import-meta-env.md)** for the TypeScript side, which CRA's `react-app-env.d.ts` handled differently.

## Gotchas

**★ Symptom: `ReferenceError: process is not defined`, thrown from inside a `node_modules` package, not your own code.** Cause: the package reads `process.env.SOMETHING` at module-evaluation time, and Vite does not polyfill a global `process` the way Webpack's browser build did. Fix: upgrade the package if a fixed version exists; otherwise scope a `define` shim to it.
```typescript
define: { 'process.env': {} },
```

**★ Symptom: `import.meta.env.VITE_FEATURE_NEW_CHECKOUT` is `undefined`, and the corresponding CRA var was definitely set.** Cause: the rename script updated `.env` but missed a reference in source, or updated source but missed one `.env.*` file (commonly `.env.local`, which is gitignored and easy to forget). Fix: grep both directions after the rename — `grep -r REACT_APP_ .` should return nothing, and every `import.meta.env.VITE_*` reference in source should have a matching key in at least one loaded `.env` file.

**★ Symptom: a value that was `process.env.NODE_ENV` under CRA now reads `undefined` under Vite, even outside any third-party package.** Cause: `import.meta.env.MODE` and `import.meta.env.PROD`/`.DEV` are Vite's replacements for the two things CRA's single `NODE_ENV` string conflated — there is no direct `import.meta.env.NODE_ENV`. Fix: decide which question the original code was actually asking (see **[07 · Modes & `NODE_ENV`](../07-env-variables-and-modes/01e-modes-and-node-env.md)**) and use `MODE` or `PROD`/`.DEV` accordingly, not a literal rename.

**★ Symptom: after the migration, a dependency that reads `process.env.NODE_ENV` to decide between a dev and prod code path always takes the dev path, even in a production build.** Cause: a `define: { 'process.env': {} }` shim satisfies the *existence* check but returns `undefined` for `NODE_ENV` specifically, which is not `'production'`, so the package's own branch takes the non-production path. Fix: shim the specific key with a real value rather than the whole object.
```typescript
define: { 'process.env.NODE_ENV': JSON.stringify('production') },
```

**★ Symptom: adding `define: { 'process.env.NODE_ENV': production }` (without `JSON.stringify`) breaks the build with a syntax or reference error.** Cause: `define` performs literal text substitution, not value assignment — `production` is spliced into the output as a bare, undeclared identifier. Fix: always wrap the replacement value in `JSON.stringify`, even for what looks like a constant string.

**★ Symptom: a rename script prefixed a variable with `VITE_` that was previously deliberately left unprefixed under CRA (no `REACT_APP_`), and it is now visible in the production bundle.** Cause: a blind `s/^([A-Z])/VITE_$1/` style rename catches every line in `.env`, not just the ones that previously had `REACT_APP_`. Fix: rename only variables that already carried the old prefix; audit the finished `dist/` for anything that should not be there, exactly as described in **[07 · The `VITE_` prefix and secrets](../07-env-variables-and-modes/01b-the-vite-prefix-and-secrets.md)**.

## Interview questions

**★ Why does `ReferenceError: process is not defined` only show up in third-party dependencies and almost never in the app's own migrated code?**
Because the migration naturally rewrites every `process.env.X` the application's own developers wrote, since those are the lines the rename script and the code review both target. A `node_modules` package that reads `process.env` internally is invisible to that rewrite — nobody is editing the dependency's source — and it was previously working only because Webpack's Node-polyfill defaults gave `process` a real (if often empty) object to read from, not because the package was written to run without one. Vite does not carry that polyfill by default, so the dependency's own assumption, which was always slightly wrong, stops being covered for it.

**★ A teammate wants to fix the `process is not defined` crash by adding `global.process = {}` to `main.tsx`. Why is `define` the better fix?**
`define` is a build-time textual substitution — the string `process.env.SOMETHING` is replaced with the actual value (or `{}`) before the code ships, so the shipped bundle never references an undefined global at runtime and the substitution is scoped, auditable in a diff, and dead-code-eliminable where the result is provably unreachable. `global.process = {}` at the top of the entry file is a runtime patch: it works, but it silently reintroduces the CRA-era Webpack behaviour of "there's always a `process` object" for the *entire* bundle, permanently, rather than for the one dependency that actually needed it — and it does nothing to fix `process.env.NODE_ENV`-dependent branches, since an empty object's `.NODE_ENV` is still `undefined`, not `'production'`.

**★ You're migrating a CRA app and the rename script has run. What's the fastest way to prove no stale `REACT_APP_` reference survived, including in files the script might not have touched?**
Two greps, not a manual review: `grep -r REACT_APP_ src/` should return nothing in source, and `grep -r REACT_APP_ .env*` should return nothing in any environment file — including `.env.local`, `.env.production.local`, and any file gitignored specifically because it holds real secrets, which is exactly the file a source-only rename script tends to skip because it never looked inside `.gitignore`'d files at all.

**★ Both CRA and Vite expose env vars as strings, so `REACT_APP_FLAG=false` was already a `'false'` string bug under CRA — why does the migration make this worse rather than just carrying the existing bug forward unchanged?**
It does not make the truthiness bug worse — that bug is identical in both tools and pre-dates the migration entirely — but the migration is the moment a team is already touching every one of these read sites, which makes it the cheapest point to fix the coercion once, at a module boundary, rather than re-encounter the same `if (import.meta.env.VITE_FLAG)` bug later under a new name. **[07 · The `VITE_` prefix and secrets](../07-env-variables-and-modes/01b-the-vite-prefix-and-secrets.md)** shows the module-boundary pattern; doing that rewrite during the migration, rather than a line-for-line rename, is the difference between fixing the bug and relocating it.

---

← [01 · CRA → Vite overview](01-cra-to-vite-migration.md) · [Vite overview](../../README.md) · Next → [01b · File extensions](01b-file-extensions-and-the-jsx-transform.md)
