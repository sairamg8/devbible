---
title: "Oxlint JS Plugins (Alpha) & Custom Rules Strategy"
sidebar_label: "Oxlint JS Plugins (Alpha) & Custom Rules S"
sidebar_position: 1
---

# 🧪 Oxlint JS Plugins (Alpha) & Custom Rules Strategy

Covers syllabus **§16.1 jsPlugins Bridge** and **§16.2 Custom Rules Strategy**.

## 1. Concept & Under-the-Hood Mechanics

### 16.1 jsPlugins Bridge

**Goal:** run many existing **ESLint plugins** inside Oxlint without rewriting rules in Rust.

Config:

```json
{
  "jsPlugins": ["./tools/eslint-plugin-acme/index.js"],
  "rules": {
    "acme/no-legacy-api": "error"
  }
}
```

Or with alias when a name conflicts with a **native** plugin:

```json
{
  "plugins": ["import"],
  "jsPlugins": [
    {
      "name": "import-js",
      "specifier": "eslint-plugin-import"
    }
  ],
  "rules": {
    "import/no-cycle": "error",
    "import-js/no-unresolved": "warn"
  }
}
```

**Reserved native names** (cannot use as raw JS plugin names without alias):  
`react`, `unicorn`, `typescript`, `oxc`, `import`, `jsdoc`, `jest`, `vitest`, `jsx-a11y`, `react-perf`, `promise`, `node`, `vue`, `eslint`, and related reserved sets per current docs.

**TypeScript plugin files:** supported on modern Node (type-stripping), Bun, Deno—older Node may need compiled JS. Check your Node version matrix.

**Alpha expectations:** not semver-stable; API surface incomplete vs full ESLint; **performance can collapse** when many JS plugins load simultaneously (community reports of large regressions with several plugins at once).

### 16.2 Custom Rules Strategy

1. Prefer **native Oxlint rules** first.  
2. Keep **ESLint dual-run** for irreplaceable custom rules until JS plugins are stable enough.  
3. When writing custom JS rules for Oxlint, follow ESLint rule shapes where the hosted API supports them—verify against Oxlint JS plugin docs for your version; do not assume 100% `RuleTester` parity.

---

## 2. Real-World Engineering Scenario

**Scenario: four JS plugins make Oxlint slower than ESLint.**

A team ports `eslint-plugin-security`, a custom plugin, `eslint-plugin-barrel-files`, and another niche plugin all via `jsPlugins`. Lint jumps from ~3s to ~40s. Fix: keep security + custom on ESLint residual; use Oxlint native for the rest; limit alpha JS plugins to ≤1–2 carefully measured plugins.

---

## 3. Production-Grade Code Example

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["typescript", "react", "import"],
  "jsPlugins": ["./eslint-plugin-acme/dist/index.js"],
  "categories": { "correctness": "error" },
  "rules": {
    "acme/no-legacy-api": "error"
  }
}
```

```bash
# Prefer dual-run over stacking many JS plugins
oxlint && eslint .
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Treating JS plugins as production-stable
Pin versions; read Oxlint changelogs; have a rollback to ESLint-only residual.

### ⚠️ Name collisions with native plugins
Always alias.

### ⚠️ Expecting type-aware *custom* JS rules
Upstream notes limitations—type-aware custom rules may not be supported the way typescript-eslint does; confirm before designing architecture around them.

### ⚠️ Infinite “temporary” dual systems without ownership matrix
Document which rules live where.
