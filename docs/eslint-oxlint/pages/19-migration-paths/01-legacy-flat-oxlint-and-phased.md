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

{/* LINKMAP:START */}

## Further reading

*Best explanations found elsewhere on the web — added alongside this page, nothing here replaces it.*

- **Read this:** [Configuration Migration Guide](https://eslint.org/docs/latest/use/configure/migration-guide) — ESLint docs: plugins and parsers become imported objects; `globals` and `parserOptions` move under `languageOptions`; `@eslint/migrate-config` gives a starting point; `FlatCompat` for old shareable configs (*read*)
- **Also good:** [Migrate to v10.0.0](https://eslint.org/docs/latest/use/migrate-to-10.0.0) — ESLint docs: eslintrc no longer supported; Node 20.19+, 22.13+, 24+; new config lookup algorithm (*read*)
- **Also good:** [New config system, part 2](https://eslint.org/blog/2022/08/new-config-system-part-2/) — Nicholas C. Zakas, ESLint blog, 2022-08-05: the design reasons behind the change (*read*)
- **Beyond the docs:** [ESLint v10: Flat Config Completion and JSX Tracking](https://www.infoq.com/news/2026/04/eslint-10-release/) — Daniel Curtis, InfoQ, 2026-04-01: what teams still on `.eslintrc` must do before upgrading to v10, including `npx @eslint/migrate-config` (*read*)
- **Read this:** [Migrate from ESLint](https://oxc.rs/docs/guide/usage/linter/migrate-from-eslint.html) — oxc.rs: `npx @oxlint/migrate` converts a flat config; `--type-aware` and JS-plugin options; legacy `.eslintrc` must go through `@eslint/migrate-config` first (*read*)
- **Beyond the docs:** [How to Migrate from ESLint to Oxlint](https://www.hongkiat.com/blog/eslint-to-oxlint-migration-guide/) — Hongkiat Lim, updated 2025-11-21: short steps: run `@oxlint/migrate`, then Oxlint, then add the lint script; handling unsupported rules (*read*)

{/* LINKMAP:END */}
