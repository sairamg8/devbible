---
title: "ESLint flat config, Prettier, or Biome for both"
sidebar_label: "16 · ESLint, Prettier, Biome"
sidebar_position: 16
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 — `eslint` 10.8.1, `prettier` 3.9.6, `@biomejs/biome` 2.5.8 on
> **Node 24.19.0**.

**Linting and formatting are different jobs.** A formatter rewrites layout and has no
opinions about correctness; a linter finds code that is legal but wrong. You need both,
from either two tools or one.

## The measurement

Same four files, direct binaries, three runs each:

| Tool | Runs | Job |
|---|---|---|
| **eslint** 10.8.1 | 0.43 · 0.46 · 0.45 s | lint |
| **prettier** 3.9.6 | 0.31 · 0.29 · 0.28 s | format |
| **@biomejs/biome** 2.5.8 | **0.09 · 0.09 · 0.09 s** | lint **+** format **+** imports |

ESLint plus Prettier is about **0.75 s**; Biome is **0.09 s** and does more. Biome
self-reports `Checked 1 file in 5ms` — nearly all of the 0.09 s is process startup, so
the gap widens with file count, not narrows.

## ESLint flat config

`eslint.config.mjs` replaced `.eslintrc` — flat config is the only format in ESLint 9+.
It is plain JavaScript, an array, evaluated in order:

```js
// eslint.config.mjs
import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {...globals.node},
    },
    rules: {
      'eqeqeq': 'error',
      'no-unused-vars': 'error',
      'no-console': 'warn',
    },
  },
  {
    files: ['**/*.test.mjs'],
    rules: {'no-console': 'off'},        // later entries override
  },
];
```

```console
/…/src/messy.mjs
  2:7   error  'unused' is assigned a value but never used  no-unused-vars
  5:14  error  Expected '===' and instead saw '=='          eqeqeq

✖ 2 problems (2 errors, 0 warnings)
```

Differences from the old format that catch people: no `extends` (spread the config
object instead), no `env` (use `globals`), and **no automatic cascade** from nested
config files — one file describes the whole project, with `files` globs doing the
scoping.

## Prettier

Formatting only, deliberately almost unconfigurable:

```json
{"semi": true, "singleQuote": true, "printWidth": 100, "trailingComma": "all"}
```

```bash
prettier --check .     # CI
prettier --write .     # locally
```

Its value is that it ends the argument. Do not add formatting rules to ESLint alongside
it — the two will disagree and fight on save. If you run both, use
`eslint-config-prettier` to switch ESLint's stylistic rules off.

## Biome

One binary, no plugins to install, `biome.json`:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.8/schema.json",
  "formatter": {"enabled": true, "indentStyle": "space", "indentWidth": 2},
  "linter": {"enabled": true, "rules": {"recommended": true}},
  "assist": {"actions": {"source": {"organizeImports": "on"}}}
}
```

```console
src/messy.mjs:2:7  lint/correctness/noUnusedVariables  FIXABLE
src/messy.mjs:4:5  lint/style/useConst                 FIXABLE
src/messy.mjs:2:1  assist/source/organizeImports       FIXABLE
src/messy.mjs:5:14 lint/suspicious/noDoubleEquals      FIXABLE
  × Using == may be unsafe if you are relying on type coercion.
Checked 1 file in 5ms.
```

On the same file it found everything ESLint did, plus `useConst` and import ordering,
and offered to fix all of it — `biome check --write`.

The trade-off is the ecosystem. ESLint has a plugin for everything —
`eslint-plugin-security`, framework-specific rules, custom organisational rules. Biome
has its own rule set and no plugin API for JavaScript rules yet. **Check that the rules
you actually depend on exist before switching.**

## Choosing

| Situation | Choice |
|---|---|
| New project, no unusual rules | **Biome** — one tool, one config, ~8× faster |
| You depend on specific ESLint plugins | ESLint + Prettier |
| Large existing ESLint setup | Keep it; the speed is not worth a migration alone |
| TypeScript type-aware rules | ESLint with `typescript-eslint` — Biome does not do type-aware analysis |

That last row is the real dividing line. Rules like `no-floating-promises` need type
information, and it is the rule that catches the missing `await` from
[page 06](./06-async-testing.md) — before the test runs, at the point it was written.

## Wire it into CI, not just the editor

```json
{
  "scripts": {
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "test": "node --test",
    "verify": "npm run lint && npm test"
  }
}
```

Editor-only linting means it applies to whoever has the extension. `verify` in CI means
it applies to the codebase. A pre-commit hook on changed files only
(`lint-staged`, `husky`) keeps the local loop fast.

## Why this is in the testing phase

Because it is the cheapest layer of the same job. A type-aware linter catches a floating
promise, an unused variable and a `==` in milliseconds, on every file, without anyone
writing a test. Everything it can catch is something your tests do not have to.

## Gotchas

**Symptom:** ESLint ignores `.eslintrc`
**Cause:** ESLint 9+ uses flat config only.
**Fix:** Migrate to `eslint.config.mjs`. `@eslint/migrate-config` does most of it.

**Symptom:** The editor reformats a file back and forth on every save
**Cause:** ESLint stylistic rules and Prettier disagree.
**Fix:** `eslint-config-prettier` to disable ESLint's formatting rules, or move to
Biome.

**Symptom:** `'process' is not defined`
**Cause:** Flat config has no `env`.
**Fix:** `languageOptions.globals: {...globals.node}` from the `globals` package.

**Symptom:** Biome does not report a rule you relied on
**Cause:** Different rule set, and no JS plugin API.
**Fix:** Check coverage of your important rules before migrating; keep ESLint for
type-aware rules.

**Symptom:** Lint passes locally, fails in CI
**Cause:** Different versions, or the editor extension using its own bundled binary.
**Fix:** Pin the tool in `devDependencies` and run it through an npm script everywhere.

**Symptom:** Linting a large repo is slow in the pre-commit hook
**Cause:** Linting everything on every commit.
**Fix:** `lint-staged` on changed files; full lint in CI.

## Interview questions

**★ What is the difference between a linter and a formatter?**
A formatter rewrites layout and has no opinion about correctness; a linter finds legal
code that is probably wrong — unused variables, `==`, floating promises. Formatting
disagreements are settled by a tool; correctness needs rules.

**★ What changed with ESLint flat config?**
`eslint.config.mjs` replaced `.eslintrc`, `extends` became spreading config objects,
`env` became `languageOptions.globals`, and the nested-file cascade is gone — one file
describes the project, scoped by `files` globs.

**★ Is Biome worth switching to?**
Measured on the same four files: 0.09 s against 0.75 s for ESLint plus Prettier, doing
lint, format and import organisation in one pass with one config. The cost is the
ecosystem — no JS plugin API, and no type-aware rules. Check your important rules exist
first.

**★ Why can Biome not replace `typescript-eslint`?**
Type-aware rules need the type checker. `no-floating-promises` — the rule that catches
a missing `await` — is exactly that class, and it is the highest-value rule a Node
codebase can turn on.

**Why do ESLint and Prettier fight?**
Because ESLint also has stylistic rules. Turn them off with `eslint-config-prettier`,
or use one tool that owns both jobs.

**What does linting have to do with testing?**
It is the cheapest layer of the same work. Anything a linter catches on every file in
milliseconds is something no test has to be written for.

---

← Prev: [15 · Snapshot testing](./15-snapshot-testing.md) ·
Next → [17 · Property-based and mutation testing](./17-property-and-mutation.md)
