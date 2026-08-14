---
title: "Oxlint Install, CLI & Config Schema"
sidebar_label: "Oxlint Install, CLI & Config Schema"
sidebar_position: 1
---

# 📦 Oxlint Install, CLI & Config Schema

Covers syllabus **§13.1 Getting Started**, **§13.2 Configuration Surfaces**, and **§13.3 Config Schema Essentials**.

## 1. Concept & Under-the-Hood Mechanics

### 13.1 Getting Started

```bash
pnpm add -D oxlint
# yarn add -D oxlint / npm i -D oxlint
```

```json
{
  "scripts": {
    "lint": "oxlint",
    "lint:fix": "oxlint --fix"
  }
}
```

CLI accepts path arguments and `-c` / config path flags. Zero-config runs are intentional: correctness defaults without a config file.

### 13.2 Configuration Surfaces

| Surface | Notes |
| --- | --- |
| `.oxlintrc.json` | Primary JSON config; `$schema` enables editor completion from `oxlint/configuration_schema.json` |
| `oxlint.config.ts` | `defineConfig` from `oxlint`; `extends` takes config **objects** |
| Nearest-config resolution | Hierarchical discovery similar to eslintrc mental model—closest applicable config to a file wins/merges per Oxlint rules |
| `extends` | In JSON: path strings to other configs. In TS: imported config objects. **Last wins** on conflicts |

### 13.3 Schema Essentials

| Key | Role |
| --- | --- |
| `plugins` | Enable native plugin families: `import`, `typescript`, `react`, `unicorn`, `jest`, `vitest`, `jsx-a11y`, `node`, `promise`, `jsdoc`, … |
| `categories` | `correctness`, `suspicious`, `pedantic`, `perf`, `style`, `restriction`, `nursery` → severity |
| `rules` | Per-rule overrides (win over categories) |
| `overrides` | `files` / `excludeFiles` scoped env/rules/plugins |
| `env` / `globals` | Preset global sets (browser, node, jest, vitest, es2026, …) + per-global readonly/writable/off |
| `settings` | Plugin settings (e.g. `react.version`) |
| `ignorePatterns` | gitignore-style, rooted at config directory |
| `options` | `typeAware`, `typeCheck`, `denyWarnings`, `maxWarnings`, `reportUnusedDisableDirectives`, `respectEslintDisableDirectives` |
| `jsPlugins` | Alpha ESLint plugin bridge |

---

## 2. Real-World Engineering Scenario

**Scenario: monorepo package needs different React version settings.**

Root `.oxlintrc.json` enables `react` plugin with `settings.react.version: "18.2.0"`. A package upgrades to React 19. Without `overrides` or package-local config, rules that branch on version behave wrong. Fix: package-local `.oxlintrc.json` extending root with updated settings, or an override with `files: ["packages/new-app/**"]`.

---

## 3. Production-Grade Code Example

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["typescript", "react", "import", "unicorn", "jsx-a11y"],
  "categories": {
    "correctness": "error",
    "suspicious": "warn"
  },
  "env": {
    "browser": true
  },
  "settings": {
    "react": {
      "version": "19.0.0"
    }
  },
  "ignorePatterns": ["dist/**", "coverage/**", ".next/**"],
  "rules": {
    "eqeqeq": "error",
    "import/no-cycle": "error"
  },
  "overrides": [
    {
      "files": ["**/*.{test,spec}.{ts,tsx}"],
      "env": { "vitest": true },
      "rules": {
        "typescript/no-explicit-any": "off"
      }
    }
  ],
  "options": {
    "typeAware": false,
    "denyWarnings": false,
    "respectEslintDisableDirectives": true
  }
}
```

```ts
// oxlint.config.ts
import { defineConfig } from 'oxlint';
import base from './oxlint.base.js';

export default defineConfig({
  extends: [base],
  plugins: ['typescript', 'react', 'import'],
  categories: { correctness: 'error' },
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ `ignorePatterns` with `..`
Rejected or ineffective—patterns are rooted at the config file directory.

### ⚠️ Expecting ESLint flat `files` at top level for all rules
Use `overrides[].files` for path-specific rules.

### ⚠️ Forgetting `$schema`
You lose JSON completion and are more likely to mistype keys.

### ⚠️ `options.typeAware: true` without `oxlint-tsgolint`
Type-aware mode requires the companion package—install it explicitly when enabling.
