---
title: "ESLint Flat Config: Forms, Fields & Composition"
sidebar_label: "ESLint Flat Config"
sidebar_position: 1
---

# 📋 ESLint Flat Config: Forms, Fields & Composition

Covers syllabus **§3.1 Config File Forms**, **§3.2 Core Flat-Config Object Fields**, and **§3.3 Composition**.

## 1. Concept & Under-the-Hood Mechanics

### 3.1 Config File Forms

Flat config is a **default-exported array** (or a config helper that resolves to one) of plain objects. Common filenames:

| File | Notes |
| --- | --- |
| `eslint.config.js` | Works with `"type": "module"` (ESM) or as CJS depending on package type |
| `eslint.config.mjs` | Explicit ESM — safest when `package.json` is `"type": "commonjs"` |
| `eslint.config.cjs` | Explicit CJS `module.exports` |
| `eslint.config.ts` | Type-safe config; supported in modern ESLint — needs a runtime that can load TS config (version-dependent; verify against your ESLint major) |

**`defineConfig()`** (from `eslint/config` in modern ESLint) improves typing/IntelliSense and aligns with how other tools expose typed config helpers. Prefer it when your ESLint version exports it.

Each array element can target different files. There is no hidden parent-directory merge unless you *compose* configs yourself via imports/`extends`.

### 3.2 Core Flat-Config Object Fields

| Field | Role |
| --- | --- |
| `files` | Globs this object applies to. If omitted in some positions, behavior interacts with global ignores—prefer **explicit `files`** for rule blocks |
| `ignores` | Globs excluded for *this* object; a lone ignores-only object acts as global ignore when shaped correctly |
| `globalIgnores()` | Helper for repo-wide ignores without accidentally creating a config that disables other blocks |
| `languageOptions` | `parser`, `parserOptions`, `globals`, `ecmaVersion`, `sourceType` |
| `plugins` | **Map** of short name → plugin object (`{ react: reactPlugin }`). No legacy magic string plugin resolution |
| `rules` | Rule id → `'off'\|'warn'\|'error'` or `[severity, ...options]` |
| `settings` | Shared data plugins read (`react.version`, import resolvers, etc.) |
| `linterOptions` | e.g. `reportUnusedDisableDirectives`, `noInlineConfig` |
| `processor` | Extract JS from multi-part files (Vue SFC, Markdown, etc.) before lint |

**Plugins must be imported and registered.** Flat config does not `require('eslint-plugin-react')` by name from a string in `plugins: ['react']` the legacy way—you pass the module object.

### 3.3 Composition: extends, Order, FlatCompat, Inspector

- **Order:** later config objects that apply to the same file **override** earlier rule settings for the same rule id.
- **Spreading recommended configs:** `js.configs.recommended`, `...tseslint.configs.recommended`, plugin-exported flat configs.
- **`extends` in flat config:** modern ESLint added ergonomic `extends` support so configs compose more like shareable presets—use the pattern your ESLint version documents (`defineConfig` + `extends` where available).
- **FlatCompat (`@eslint/eslintrc`):** bridges old `extends: 'plugin:X/recommended'` string configs during migration. Temporary scaffolding, not the end state.
- **ESLint Config Inspector:** visualizes which object contributed which rules to a given file—essential for monorepo debugging.

---

## 2. Real-World Engineering Scenario

**Scenario: ignores that “turn off the whole linter.”**

A team adds:

```js
export default [
  { ignores: ['**/*'] }, // mistake during debugging
  js.configs.recommended,
];
```

Or they put `ignores` on the same object as `rules` incorrectly and wonder why nothing linted. Another common failure: a global ignore pattern of `**/*.*` copied from a blog that used legacy ignore semantics.

**Scenario: plugin not found / rules not registered.**

```js
export default [
  { rules: { 'react-hooks/rules-of-hooks': 'error' } }, // plugin never registered
];
```

Flat config will not invent the plugin from the rule prefix. You must `import reactHooks from 'eslint-plugin-react-hooks'` and set `plugins: { 'react-hooks': reactHooks }`.

---

## 3. Production-Grade Code Example

```js
// eslint.config.mjs
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['dist/**', 'coverage/**', '.next/**', 'storybook-static/**']),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['**/*.{test,spec}.{ts,tsx}'],
    rules: {
      'no-console': 'off',
    },
  },
]);
```

**FlatCompat bridge (migration only):**

```js
import { FlatCompat } from '@eslint/eslintrc';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const compat = new FlatCompat({
  baseDirectory: path.dirname(fileURLToPath(import.meta.url)),
});

export default [
  ...compat.extends('plugin:storybook/recommended'),
  // ...native flat configs
];
```

**Config Inspector:**

```bash
npx @eslint/config-inspector
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ `files` omitted on a rules block in a multi-package repo
Rules may apply to config files, scripts, or generated output you never intended. Prefer explicit globs.

### ⚠️ Registering plugins under the wrong key
`plugins: { react: plugin }` means rules are `react/rule-name`. If the plugin historically used a different prefix, match its documented flat-config name.

### ⚠️ Putting Prettier-disable config too early
`eslint-config-prettier` must come **after** configs that enable formatting rules so it can turn them off.

### ⚠️ Assuming `defineConfig` exists on older ESLint 9 minors
APIs evolved through the flat-config era. If `eslint/config` export is missing, upgrade ESLint or use a plain array export—do not invent a polyfill.

### ⚠️ Forever FlatCompat
Each compat extend is tech debt. Track tickets to replace with native flat exports (`plugin.flatConfigs`, `plugin.configs['flat/recommended']`, etc.) as plugins ship them.
