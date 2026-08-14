---
title: "Migration Paths: Legacy \u2192 Flat \u2192 Oxlint \u2192 Phased Dual-Stack"
sidebar_label: "Migration Paths"
sidebar_position: 1
---

# 🚚 Migration Paths: Legacy → Flat → Oxlint → Phased Dual-Stack

Covers syllabus **§19.1 ESLint Legacy → Flat**, **§19.2 ESLint → Oxlint**, and **§19.3 Dual-Stack Migration**.

## 1. Concept & Under-the-Hood Mechanics

### 19.1 ESLint Legacy → Flat Config

1. Run **`@eslint/migrate-config`** on `.eslintrc.*` to generate a starting `eslint.config.*`.  
2. Fix peer deps; move to ESLint 9+ APIs.  
3. Replace stubborn `extends` strings with **FlatCompat** temporarily.  
4. Swap plugins to native flat exports (Next, React, typescript-eslint).  
5. **Cutover day:** editor settings, delete eslintrc, clear caches, make CI required checks green.

### 19.2 ESLint → Oxlint

1. Prefer migrating **from flat config** (convert legacy first if needed).  
2. Run **`npx @oxlint/migrate [eslint.config path]`** → `.oxlintrc.json` + report of unsupported rules.  
3. Review severities/options; build a **gap list**.  
4. Move ignores into `ignorePatterns`.  
5. Map `biome-ignore` / other dialects to eslint-disable or oxlint-disable.  
6. Optionally `--replace-eslint-comments`.

### 19.3 Dual-Stack Phases (Large Monorepos)

| Phase | Action |
| --- | --- |
| 1 | Add Oxlint correctness; **do not** delete ESLint rules yet |
| 2 | Add `eslint-plugin-oxlint`; measure CI time |
| 3 | Expand Oxlint plugins/categories; remove dead ESLint plugins |
| 4 | Optional full ESLint removal when residual set is empty or explicitly accepted |

---

## 2. Real-World Engineering Scenario

**Scenario: migrate-config emits a 400-line flat config full of FlatCompat.**

Mechanical migration succeeds but nobody understands the file. Next engineer adds a rule in the wrong place. Fix: spend a dedicated PR to replace FlatCompat chunks with native flat configs one plugin at a time; delete dead extends; add Config Inspector screenshots to the PR description for training.

---

## 3. Production-Grade Code Example

```bash
# Legacy → flat
npx @eslint/migrate-config .eslintrc.json

# Flat → oxlint
npx @oxlint/migrate ./eslint.config.mjs
npx @oxlint/migrate --replace-eslint-comments
```

```json
// package.json scripts during phase 2
{
  "scripts": {
    "lint": "oxlint && eslint . --max-warnings 0"
  }
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Migrating to Oxlint before flat config
Harder tooling path—flatten ESLint first.

### ⚠️ Trusting migrate output without gap triage
Unsupported rules vanish silently from enforcement if you delete ESLint too early.

### ⚠️ Leaving `.eslintignore` forever
Ignores drift from Oxlint patterns—consolidate.

### ⚠️ Big-bang monorepo cutover on Friday
Phased dual-run exists for a reason—use it.
