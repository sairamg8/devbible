---
title: "ESLint Rules: Severity, Core Rules & Presets"
sidebar_label: "ESLint Rules"
sidebar_position: 1
---

# 📏 ESLint Rules: Severity, Core Rules & Presets

Covers syllabus **§5.1 Rule Identity & Severity**, **§5.2 High-Value Core Rules**, and **§5.3 Shareable Rule Presets**.

## 1. Concept & Under-the-Hood Mechanics

### 5.1 Rule Identity & Severity

- **Core rules:** bare ids (`no-unused-vars`, `eqeqeq`).
- **Plugin rules:** `plugin-name/rule-name` (`react-hooks/rules-of-hooks`).
- **Severity:** `'off' | 'warn' | 'error'` (or `0 | 1 | 2`).
- **Options:** `['error', { allow: ['warn'] }]` — first element severity, rest options validated against the rule’s JSON schema.

Mentally group core rules as: **possible problems** (likely bugs), **suggestions** (quality), **layout** (mostly obsolete if you use a formatter / moved to stylistic).

CI policies often treat warnings as failures via `--max-warnings 0`. That makes `warn` vs `error` a *team process* distinction (noise during rollout) more than a technical one.

### 5.2 High-Value Core Rules (Not an Exhaustive Catalog)

Worth knowing deeply:

| Rule | Why it matters |
| --- | --- |
| `no-undef` | Catches missing imports/globals when types are absent or JS files are linted without TS |
| `no-unused-vars` | Dead code; conflicts with `@typescript-eslint/no-unused-vars` if both on |
| `eqeqeq` | `==` coercion bugs |
| `no-async-promise-executor` | Subtle async/Promise anti-pattern |
| `require-atomic-updates` | Racey async assignments (understand false positives) |

ESM-era concerns largely live in **`eslint-plugin-import` / import-x** or Oxlint's native import plugin—not only core ESLint. Core still ships one directly-relevant rule, **`no-duplicate-imports`** (flags two separate `import` statements from the same module specifier that should be merged into one); everything past that—extension rules, cycle detection—is plugin territory, not core.

**Rollout strategy:** start from `recommended`, add strict rules as **warn**, then promote to **error** package-by-package. Big-bang `error` on 50 new rules produces disable-comment spam.

### 5.3 Shareable Presets

- **`@eslint/js`:** `js.configs.recommended` (sane) vs `all` (rarely production-sane).
- **Plugins:** ship `plugin.configs.recommended` / `strict` / `stylistic` as flat-config arrays or objects.
- **Company configs:** versioned `eslint-config-acme` packages—pin majors; breaking rule changes need semver discipline across the monorepo.

---

## 2. Real-World Engineering Scenario

**Scenario: enabling `eqeqeq` as error across a 200k-LOC legacy app.**

The first PR has 1,800 violations. The team either (a) mass-suppresses, destroying signal, or (b) never merges. A better approach: enable as `warn` with `--max-warnings` unset in CI for two sprints; fix hot paths; then error. Alternatively use overrides: error in `src/new-feature/**`, warn elsewhere.

---

## 3. Production-Grade Code Example

```js
import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{js,ts,tsx}'],
    rules: {
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-unused-vars': 'off', // replaced by TS-aware rule in TS blocks
    },
  },
];
```

Shared company preset sketch:

```js
// packages/eslint-config/index.js
import js from '@eslint/js';
export default [js.configs.recommended, { rules: { eqeqeq: 'error' } }];
```

```js
// apps/web/eslint.config.js
import acme from '@acme/eslint-config';
export default [...acme, { rules: { 'no-console': 'off' } }];
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Enabling `js.configs.all`
Hundreds of stylistic and niche rules. Teams mute ESLint entirely.

### ⚠️ Leaving both `no-unused-vars` and `@typescript-eslint/no-unused-vars` on
Duplicate or conflicting reports. Turn the base rule off for TS files.

### ⚠️ Options schema mistakes silently failing at config load
Invalid options throw when ESLint loads config—fix locally after every rule tweak.

### ⚠️ Using severity to mean “priority” without CI policy
If CI allows unlimited warnings, `warn` is documentation, not a gate.
