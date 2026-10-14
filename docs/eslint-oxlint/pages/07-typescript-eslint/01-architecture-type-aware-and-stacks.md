---
title: "typescript-eslint: Architecture, Type-Aware Lint & Production Stacks"
sidebar_label: "typescript-eslint"
sidebar_position: 1
---

# 🔷 typescript-eslint: Architecture, Type-Aware Lint & Production Stacks

Covers syllabus **§7.1 Architecture**, **§7.2 Type-Aware Linting**, and **§7.3 TS + React + Next Production Stack**.

## 1. Concept & Under-the-Hood Mechanics

### 7.1 Architecture

| Package | Role |
| --- | --- |
| `@typescript-eslint/parser` | Parses TS/TSX into an ESLint-compatible AST |
| `@typescript-eslint/eslint-plugin` | Rules that understand TS syntax and optionally **type information** |
| `typescript-eslint` | Modern umbrella package for flat config (`import tseslint from 'typescript-eslint'`) |

**Preset ladder:** `recommended` → `strict` → stylistic variants; **type-checked** variants (`recommendedTypeChecked`, `strictTypeChecked`) enable rules that need the TypeScript program.

### 7.2 Type-Aware Linting

Type-aware rules query the TypeScript type checker via:

- **`parserOptions.project`** — classic: path(s) to `tsconfig.json`  
- **`parserOptions.projectService`** — modern DX/perf-oriented service (preferred when your typescript-eslint version supports it well)

Rules that typically need types:

- `@typescript-eslint/no-floating-promises` — unhandled Promise rejections at the call site  
- `@typescript-eslint/no-misused-promises` — async functions in sync-void slots (e.g. React event handlers typed wrong)  
- `@typescript-eslint/no-unsafe-*` — `any` contagion  
- Import-type nuances around `consistent-type-imports` / verbatim style (coordinate with TS `verbatimModuleSyntax`)

**Performance:** type-aware lint cost scales with program size and how many files participate. Isolate type-aware configs to application `src`, use ESLint `--cache`, shard CI by package, and avoid including tests/tooling if not needed.

**Base rule conflicts:** disable core `no-unused-vars` in favor of `@typescript-eslint/no-unused-vars` (and similar pairs).

**Type-aware lint ≠ typecheck.** ESLint does not replace `tsc --noEmit`. Both belong in CI.

### 7.3 TS + React + Next Stack

Layer order that usually works:

1. `@eslint/js` recommended  
2. `typescript-eslint` (typed on `ts/tsx` only)  
3. React + hooks + jsx-a11y  
4. Next flat config  
5. `eslint-config-prettier` last  

Monorepos: either root flat config with per-package `files` globs + projectService roots, or per-package `eslint.config` with package-local tsconfigs / project references.

---

## 2. Real-World Engineering Scenario

**Scenario: floating promises in a server action pipeline.**

An async function `auditLog(event)` is called without `await` inside a route handler. Types allow it (`void` ignore patterns vary). Production loses audit entries under load. `@typescript-eslint/no-floating-promises` as **error** fails CI on the missing await. The team adds a deliberate `void auditLog(...)` only where fire-and-forget is intentional and documented.

**Scenario: type-aware lint takes 18 minutes.**

Root cause: `project: ['./tsconfig.json']` at monorepo root that references every package, plus linting `**/*.{ts,tsx}` including stories and scripts. Fix: package-level lint tasks, `files: ['src/**/*.{ts,tsx}']`, projectService per package, Oxlint for non-type-aware correctness in the fail-fast job.

---

## 3. Production-Grade Code Example

```js
// eslint.config.mjs
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

export default defineConfig(
  globalIgnores(['dist/**', '.next/**']),
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.{jsx,tsx}'],
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
);
```

`disableTypeChecked` happens to export a single config object (unlike `recommendedTypeChecked`, which exports an array — see [SECTION 4's pitfall](../04-eslint-language-options-globals-and-parsing/01-language-options-and-file-targeting.md) on spreading `.rules` off the wrong shape), so `...tseslint.configs.disableTypeChecked` would technically still work here. `extends: [...]` is used instead because it's the form typescript-eslint's own docs use and it stays correct regardless of which export shape a given shareable config has — don't rely on remembering which configs are arrays vs objects. Exact helper names (`disableTypeChecked`, `recommendedTypeChecked`) come from the `typescript-eslint` package version—use the project's installed docs if an export differs.

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Type-aware rules on plain JS without a TS program
Config errors or useless analysis. Disable type-checked configs for `**/*.{js,mjs,cjs}`.

### ⚠️ `no-floating-promises` without team conventions for `void`
Either allow a documented `void` pattern or you will get noisy false “errors” on intentional fire-and-forget.

### ⚠️ Duplicate typescript-eslint installs
Monorepo resolution can run different plugin versions—lock and dedupe.

### ⚠️ Believing type-aware lint replaces `tsc`
It does not. Keep `tsc -b --pretty false` (or equivalent) as a required check.

### ⚠️ Next + typed lint without ignoring `.next`
Generated files create parse/project noise—global ignore them.

{/* LINKMAP:START */}

## Further reading

*Best explanations found elsewhere on the web — added alongside this page, nothing here replaces it.*

- **Read this:** [@typescript-eslint/parser](https://typescript-eslint.io/packages/parser/) — typescript-eslint.io: turns TypeScript into ESLint-compatible nodes; `projectService` uses the nearest `tsconfig.json` for each file; `programs` accepts your own TS program (*read*)
- **Also good:** [typescript-eslint package](https://typescript-eslint.io/packages/typescript-eslint/) — typescript-eslint.io: exports `configs`, `extensions`, `globs`; `config(...)` is deprecated in favour of ESLint's `defineConfig(...)`, and the usage example now uses `defineConfig` with `extends` (*read*)
- **Read this:** [Linting with Type Information](https://typescript-eslint.io/getting-started/typed-linting/) — typescript-eslint.io: `parserOptions.projectService: true`; typed rules need TypeScript to analyse the whole project, so they are slower (*read*)
- **Also good:** [Performance](https://typescript-eslint.io/troubleshooting/typed-linting/performance/) — typescript-eslint.io: narrow `tsconfig` includes; slow third-party rules named: `@stylistic/indent`, `eslint-plugin-prettier`, and several `eslint-plugin-import` rules (*read*)
- **Also good:** [Project Service](https://typescript-eslint.io/blog/project-service/) — Josh Goldberg, typescript-eslint blog, 2025-05-29: why the project service replaces `parserOptions.project`; stable since v8 (*read*)
- **Beyond the docs:** [Configuring ESLint with TypeScript](https://nx.dev/docs/kb/configuring-eslint-with-typescript) — Nx docs (undated): turn typed linting on per project only when needed, because building the TS programs is expensive; its examples use `FlatCompat`, not `defineConfig` (*read*)

{/* LINKMAP:END */}
