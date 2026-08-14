---
title: "ESLint Plugin Ecosystem: Anatomy, Frontend, Node & Security"
sidebar_label: "ESLint Plugin Ecosystem"
sidebar_position: 1
---

# 🔌 ESLint Plugin Ecosystem: Anatomy, Frontend, Node & Security

Covers syllabus **§6.1 Plugin Anatomy**, **§6.2 Essential Frontend Plugins**, **§6.3 Resolution Pitfalls**, and **§6.4 Node, Backend & Security Plugins**.

## 1. Concept & Under-the-Hood Mechanics

### 6.1 Plugin Anatomy

A flat-config plugin is a module exporting some of:

- **`rules`** — map of rule name → rule module  
- **`configs`** — named shareable configs (flat or legacy shapes)  
- **`processors`** — extract code blocks from non-JS carriers  
- **`meta`** — plugin metadata  

Registration:

```js
plugins: { react: reactPlugin }
// enables rules like react/jsx-no-target-blank
```

**`settings`** is how plugins share configuration (React version detection, import resolvers). Undocumented settings are footguns—prefer documented keys only.

### 6.2 Essential Frontend Plugins

| Plugin | Role |
| --- | --- |
| `eslint-plugin-react` | JSX/component practices; set `settings.react.version` |
| `eslint-plugin-react-hooks` | `rules-of-hooks`, `exhaustive-deps`; React Compiler-related rules where the plugin version ships them |
| `eslint-plugin-jsx-a11y` | Accessibility anti-patterns in JSX |
| `eslint-plugin-import` / `eslint-import-resolver-*` or **import-x** | Order, extensions, `no-cycle`, resolvers for TS paths |
| `eslint-plugin-unicorn` | Opinionated modern JS; cherry-pick rather than full preset unless team agrees |
| `@next/eslint-plugin-next` / `eslint-config-next` | Next.js App/Pages rules; modern Next exposes **flatConfig** exports |
| `eslint-plugin-jest` / Vitest / Testing Library | Test overrides; don’t apply jest rules to app code |
| `@stylistic/eslint-plugin` | Formatting-adjacent—only if not fully deferred to Prettier |
| `eslint-config-prettier` vs `eslint-plugin-prettier` | Prefer **config-prettier** (disable conflicts). Avoid dual-running Prettier inside ESLint |

### 6.3 Resolution Pitfalls

- **Peer dependency hell:** plugin expects ESLint 8, repo is on 9+ (or the reverse).  
- **Duplicate plugins** in monorepo nested `node_modules` → different rule versions per package.  
- **Import resolvers:** wrong resolver → false `import/no-unresolved` on `@/` aliases. Align with `tsconfig` paths.  
- **Legacy-only plugins:** still need FlatCompat until they ship flat configs.

### 6.4 Node, Backend & Security (Fullstack)

| Plugin | Role |
| --- | --- |
| `eslint-plugin-n` (successor thinking to eslint-plugin-node) | Node correctness: missing imports, deprecated APIs, unsupported features for your Node target |
| `eslint-plugin-security` | Heuristics: unsafe regex, `eval`, dangerous `child_process`, timing-safe comparisons gaps |
| `eslint-plugin-no-secrets` | High-entropy strings that look like committed secrets |

**ESM/CJS interop rules**, for mixed frontend/backend monorepos where a package targets both module systems: `import/no-commonjs` (import-x/eslint-plugin-import) flags stray `require()`/`module.exports` in a package that's declared ESM, and `n/no-unsupported-features/es-syntax` (eslint-plugin-n) flags ES syntax your pinned Node engine range can't run natively—both catch the same class of "this package.json says one thing, this file does another" bug from opposite ends.

**Oxlint gap:** there is typically **no full native replacement** for `eslint-plugin-security` / `no-secrets`. Production dual-run often keeps ESLint **only** for these residual plugins (see [§14](../14-oxlint-native-plugins-and-rule-coverage/01-plugins-and-categories.md) and [§18](../18-coexistence-eslint-and-oxlint/01-dual-run-overlap-and-retirement.md)).

Mixed monorepos: **files-scoped** config—browser globals + react for `apps/web`, node globals + `n`/`security` for `services/**`.

---

## 2. Real-World Engineering Scenario

**Scenario: secrets plugin saves a rotation incident.**

A developer pastes a cloud access key into a fixture “temporarily.” Unit tests pass; types pass. `eslint-plugin-no-secrets` fails CI on the high-entropy string. Key never lands on `main`. Cost of dual-running ESLint for this one plugin is minutes; cost of a leaked key is days of rotation and audit.

**Scenario: import resolver false positives block adoption of path aliases.**

Team enables `import/no-unresolved` without `eslint-import-resolver-typescript`. Every `import x from '@/lib/x'` fails. They disable the rule entirely—losing cycle detection later. Correct fix is resolver config, not disabling the plugin.

---

## 3. Production-Grade Code Example

```js
// eslint.config.mjs — frontend app block + API package block
import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import n from 'eslint-plugin-n';
import security from 'eslint-plugin-security';
import noSecrets from 'eslint-plugin-no-secrets';

export default [
  js.configs.recommended,
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    languageOptions: { globals: globals.browser },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.flat.recommended.rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'jsx-a11y/anchor-is-valid': 'error',
    },
  },
  {
    files: ['services/**/*.{js,ts}'],
    plugins: { n, security, 'no-secrets': noSecrets },
    languageOptions: { globals: globals.node },
    rules: {
      'n/no-deprecated-api': 'error',
      'n/no-missing-import': 'error',
      'security/detect-eval-with-expression': 'error',
      'no-secrets/no-secrets': 'error',
    },
  },
];
```

**Caveat:** exact `react.configs.flat.*` export names vary by plugin major—confirm against the installed `eslint-plugin-react` docs. If flat recommended is missing, register plugins manually and copy the recommended rule map from the plugin’s export.

Next.js modern flat sketch:

```js
import { flatConfig } from '@next/eslint-plugin-next';
// Prefer the package’s documented flat export for your Next major
export default [
  flatConfig.coreWebVitals, // name may vary — verify installed version
];
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Applying React hooks rules to non-React files
Noise and false confidence. Scope with `files: ['**/*.{jsx,tsx}']`.

### ⚠️ Full Unicorn preset without team buy-in
High churn PRs. Cherry-pick rules that match engineering standards.

### ⚠️ Security plugins as a false sense of AppSec complete
They are **heuristic**. They do not replace threat modeling, dependency scanning, or secret scanning in the git host.

### ⚠️ `eslint-plugin-prettier` + Prettier on save
Double format / fighting fixes. Use `eslint-config-prettier` only.

### ⚠️ Peer dependency warnings ignored for months
A plugin silently not loading recommended configs is worse than a hard failure—verify with Config Inspector.
