---
title: "Language Options, Globals & File Targeting"
sidebar_label: "Language Options, Globals & File Targeting"
sidebar_position: 1
---

# 🌐 Language Options, Globals & File Targeting

Covers syllabus **§4.1 languageOptions Deep Dive** and **§4.2 File-Type Targeting Patterns**.

## 1. Concept & Under-the-Hood Mechanics

### 4.1 languageOptions

Flat config replaced legacy `env` / top-level `parser` with **`languageOptions`**:

| Option | Meaning |
| --- | --- |
| `ecmaVersion` | Language level the parser accepts (`2024`, `latest`, etc.) |
| `sourceType` | `'module'` \| `'script'` \| `'commonjs'` — affects module syntax and some scope rules |
| `globals` | Map of global name → `'readonly'` \| `'writable'` \| `'off'` |
| `parser` | Parser module (Espree default; `@typescript-eslint/parser` for TS) |
| `parserOptions` | Parser-specific: `ecmaFeatures.jsx`, `project` / `projectService` for type-aware TS, etc. |

**Globals package.** Legacy `env: { browser: true }` became explicit:

```js
import globals from 'globals';
// languageOptions: { globals: globals.browser }
```

Combine carefully: `globals.browser` + `globals.node` is common for isomorphic code but can hide “using `fs` in client components” mistakes—prefer **separate config objects** for browser app vs Node scripts.

**JSX.** With TypeScript parser, JSX is typically enabled for `tsx`/`jsx` via parser options / file extensions. With Espree alone, you need `parserOptions.ecmaFeatures: { jsx: true }` (and often a React plugin).

**Type-aware project discovery.** `parserOptions.project` (paths to tsconfig) or modern **`projectService`** tells typescript-eslint how to build TypeScript programs for rules that need types. This is the main ESLint **performance cliff** on large monorepos—see [typescript-eslint](../07-typescript-eslint/01-architecture-type-aware-and-stacks.md).

### 4.2 File-Type Targeting

Use **different config objects** for different runtime shapes:

- App UI: `**/*.{ts,tsx}`, browser globals, React plugins  
- Node tooling: `scripts/**/*.{js,mjs,ts}`, Node globals, `eslint-plugin-n`  
- Tests: `**/*.{test,spec}.{ts,tsx}`, Jest/Vitest globals, relaxed `no-console`  

**Standard globs:** `**/*.{js,mjs,cjs,ts,tsx,jsx}` is a common app surface. Over-broad `**/*` hits JSON, markdown processors, and binary-adjacent paths unnecessarily.

**Always ignore build/vendor outputs:** `dist`, `build`, `coverage`, `.next`, `storybook-static`, generated GraphQL/OpenAPI clients (or lint them with a *relaxed* override—never “fix” generated code into your style).

---

## 2. Real-World Engineering Scenario

**Scenario: `no-undef` errors on `describe` / `expect` only in CI.**

Locally, a developer’s VS Code ESLint uses a config object that includes Vitest globals for all `**/*.{ts,tsx}`. CI runs with a trimmed config that only sets `globals.browser` on app files and forgets test overrides. Every test file fails `no-undef`.

Fix: explicit test `files` block with `globals.vitest` or `globals.jest`, or use the Vitest/Jest plugin’s recommended config that sets this up.

**Scenario: type-aware lint on the whole monorepo including `eslint.config.ts` and scripts.**

`project: true` (or overly broad projectService) pulls tooling TS into the type program. Lint time explodes; `parserOptions` errors appear for files not in any tsconfig. Fix: `files: ['src/**/*.{ts,tsx}']` on type-aware blocks only.

---

## 3. Production-Grade Code Example

```js
// eslint.config.mjs
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  { ignores: ['dist/**', 'coverage/**', '.next/**', '**/*.gen.ts'] },
  js.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    // `recommendedTypeChecked` is an ARRAY of config objects, not a single
    // object with a `.rules` key — use `extends` (or spread the array
    // directly into the outer config array) instead of `...x.rules`.
    // See the pitfall below: `{ ...arrayValue.rules }` silently evaluates
    // to `{}` with no error, enabling zero type-aware rules.
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { '@typescript-eslint': tseslint.plugin },
  },
  {
    files: ['scripts/**/*.{js,mjs,ts}', 'eslint.config.mjs'],
    languageOptions: {
      globals: globals.node,
      sourceType: 'module',
    },
    // deliberately NOT type-aware
  },
  {
    files: ['**/*.{test,spec}.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.vitest },
    },
  },
];
```

Note: exact export shapes for shareable typescript-eslint configs vary by which config it is — most (`recommendedTypeChecked`, `strictTypeChecked`, etc.) are **arrays** of config objects, a few (`disableTypeChecked`) are a single object. Don't assume either shape; use `extends: [tseslint.configs.X]` (shown above) or spread the array directly into the outer config array — never `{ rules: { ...tseslint.configs.X.rules } }`, since that only works when `X` happens to be a single object.

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ `sourceType: 'script'` on ESM packages
`import`/`export` parse failures or wrong scope analysis. Match the actual module system.

### ⚠️ Writable globals for things that should be readonly
Marking `window` writable suppresses useful assignments checks. Prefer `readonly` unless you intentionally assign.

### ⚠️ JSX without the right parser features
Parse errors on `<div />` or rules that never see `JSXElement` nodes.

### ⚠️ One mega globals object for browser + node + jest
Hides architectural boundary violations. Split by `files`.

### ⚠️ Ignoring vs excluding from type-aware
`ignores` skips lint entirely. Sometimes you still want non-type-aware lint on a file—use a separate weaker config object, not a global ignore.

### ⚠️ Spreading a shareable config's `.rules` when the export is an array
`{ rules: { ...tseslint.configs.recommendedTypeChecked.rules } }` does not throw — arrays have no `.rules` property, so `{ ...undefined }` silently becomes `{}`, and the config object ends up with **zero rules enabled**. No lint errors, no warnings, just a linter that looks configured for type-aware checking and isn't. Always check whether a shareable config export is an array or a single object before spreading it; when in doubt, use `extends: [tseslint.configs.X]` instead of touching `.rules` directly.

Cross-link: for Babel-era experimental syntax that Espree cannot parse, see the Babel bible on [`@babel/eslint-parser`](../../../babel/pages/09-linter-and-type-checker-interop/01-babel-eslint-parser-and-tsc.md)—rare in 2026 if you are on typescript-eslint.
