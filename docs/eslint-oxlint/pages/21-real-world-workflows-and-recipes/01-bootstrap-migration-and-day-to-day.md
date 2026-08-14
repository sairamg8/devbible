---
title: "Real-World Workflows & Recipes (ESLint & Oxlint)"
sidebar_label: "Real-World Workflows & Recipes (ESLint & O"
sidebar_position: 1
---

# 🍳 Real-World Workflows & Recipes (ESLint & Oxlint)

Covers syllabus **§21.1 Bootstrap**, **§21.2 Migration**, and **§21.3 Day-to-Day** recipes. Task-driven—not API rehash.

## 1. Concept & Under-the-Hood Mechanics

Recipes package earlier mechanics into **end-to-end playbooks**. Each recipe assumes 2026 defaults: ESLint flat config, Oxlint `.oxlintrc.json` / `oxlint.config.ts`, Prettier (or Oxfmt) as formatter.

---

## 2. Real-World Engineering Scenario

A staff engineer joins a repo with three lint configs (two eslintrc, one broken flat experiment), Biome partially adopted, and CI lint flaking. They need a sequenced plan: stabilize flat ESLint **or** dual Oxlint path, kill style fights, restore pre-commit. The recipes below are that plan’s building blocks.

---

## 3. Production-Grade Code Example

### 21.1 Bootstrap Recipes

#### A) Greenfield Vite + React + TS — Oxlint-only

```bash
pnpm create vite@latest my-app -- --template react-ts
cd my-app
pnpm add -D oxlint
```

```json
// .oxlintrc.json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["typescript", "react", "import", "jsx-a11y"],
  "categories": { "correctness": "error", "suspicious": "warn" },
  "env": { "browser": true },
  "ignorePatterns": ["dist/**"]
}
```

```json
// package.json scripts
{
  "lint": "oxlint",
  "lint:fix": "oxlint --fix"
}
```

Install the Oxlint editor extension; skip ESLint until a gap appears.

#### B) Greenfield ESLint flat + typescript-eslint + React

```bash
pnpm add -D eslint @eslint/js typescript-eslint eslint-plugin-react eslint-plugin-react-hooks globals eslint-config-prettier
```

```js
// eslint.config.mjs
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  prettier,
);
```

#### C) Add Oxlint beside existing ESLint

```bash
pnpm add -D oxlint eslint-plugin-oxlint
npx @oxlint/migrate ./eslint.config.mjs
```

```json
{ "scripts": { "lint": "oxlint && eslint ." } }
```

Wire `eslint-plugin-oxlint` into flat config (see [coexistence](../18-coexistence-eslint-and-oxlint/01-dual-run-overlap-and-retirement.md)).

### 21.2 Migration Recipes

| Recipe | Steps |
| --- | --- |
| **eslintrc → flat** | `npx @eslint/migrate-config .eslintrc.json` → fix peers → FlatCompat cleanup → delete eslintrc → editor cutover |
| **ESLint flat → Oxlint full** | `@oxlint/migrate` → gap triage → CI swap to `oxlint` → keep ESLint only if gaps remain |
| **Next eslint-config-next → flat + dual Oxlint** | Use Next’s flatConfig exports for your major → migrate → oxlint first in `lint` script |
| **Biome lint → Oxlint** | Map rules; replace `biome-ignore` with oxlint/eslint disables; decide formatter (Biome format vs Prettier/Oxfmt) separately |

### 21.3 Day-to-Day Recipes

#### Debug “why is this rule firing?”

1. ESLint: `npx @eslint/config-inspector` — see which config object applied.  
2. Oxlint: check nearest `.oxlintrc.json`, `overrides.files`, category vs rule severity.  
3. Confirm file not ignored; confirm plugin enabled.

#### Delete eslint-disable debt safely

1. Enable `reportUnusedDisableDirectives`.  
2. Remove unused.  
3. Replace file-level disables with overrides for `legacy/**`.  
4. Track remaining count in a tech-debt issue.

#### Shared company preset

Publish `@acme/eslint-config` and/or `@acme/oxlint-config` with semver. Apps extend; never copy-paste 200-line configs.

#### Pre-commit people will not skip

```js
// lint-staged: oxlint on all staged JS/TS; eslint only if residual rules matter
export default {
  '*.{ts,tsx,js,jsx}': ['oxlint', 'eslint --fix --max-warnings 0'],
};
```

Keep under a few seconds; push type-aware full-tree to CI.

#### Generated code without silencing the repo

```json
{
  "ignorePatterns": ["**/generated/**", "**/*.gen.ts"],
  "overrides": [
    {
      "files": ["**/generated/**"],
      "rules": {}
    }
  ]
}
```

Prefer ignore over broad rule offs that also hit hand-written code.

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Bootstrap Oxlint-only then adding random ESLint plugins without dual-run design
You reintroduce ESLint cost without `eslint-plugin-oxlint` hygiene.

### ⚠️ Migration PR that changes formatter and linter together
Unreviewable diffs—split format cleanup from rule engine swap.

### ⚠️ Company preset that pins `error` on nursery/pedantic
All product apps inherit thrash—export a `strict` optional extend.

### ⚠️ Generated code committed with eslint --fix applied
Breaks deterministic codegen—ignore generated paths.

### ⚠️ “Debugging” by disabling the rule globally
Always find the owning config first; disable is last resort with expiry.
