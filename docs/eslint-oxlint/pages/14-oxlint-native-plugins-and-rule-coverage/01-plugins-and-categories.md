---
title: "Oxlint Native Plugins & Category Strategy"
sidebar_label: "Oxlint Native Plugins & Category Strategy"
sidebar_position: 1
---

# 📚 Oxlint Native Plugins & Category Strategy

Covers syllabus **§14.1 Built-in Plugin Families** and **§14.2 Categories Strategy**.

## 1. Concept & Under-the-Hood Mechanics

### 14.1 Built-in Plugin Families

Oxlint ships **native** reimplementations of popular ESLint ecosystems (rule counts are in the **800+** range as of 2026 docs—verify current `oxc.rs` rules page for exact totals):

| Plugin id | Maps conceptually to |
| --- | --- |
| `eslint` | ESLint core rules |
| `typescript` | typescript-eslint (type-aware subset when type-aware mode on) |
| `react` | eslint-plugin-react + hooks (+ refresh / experimental React Compiler analysis notes) |
| `import` | eslint-plugin-import / import-x style rules including `no-cycle` |
| `unicorn` | eslint-plugin-unicorn |
| `jsdoc` | eslint-plugin-jsdoc |
| `promise` | promise plugin rules |
| `node` | Node-oriented rules |
| `jest` / `vitest` | Test framework rules + envs |
| `jsx-a11y` | Accessibility |
| `react-perf` | React performance-oriented rules |
| `oxc` | Oxc-specific |
| `vue` | Vue-oriented support |

**Compatibility mindset:** not every ESLint rule option exists. Migration tooling reports unsupported rules. Gaps are normal.

**Security rule gap:** there is typically **no complete native twin** of `eslint-plugin-security` / `eslint-plugin-no-secrets`. Keep those on **ESLint dual-run** until native coverage exists or accept residual risk with other scanners (git-host secret scanning, SAST).

### 14.2 Categories Strategy

Categories batch-enable rules by intent:

| Category | Intent |
| --- | --- |
| `correctness` | Likely bugs / unsafe code — **default adoption path** |
| `suspicious` | Smells that are often bugs |
| `pedantic` | Strict purity / nitpicks |
| `perf` | Performance smells |
| `style` | Style (prefer formatter for pure layout) |
| `restriction` | Ban patterns by policy |
| `nursery` | Experimental — expect churn |

**Override order:** category defaults, then individual `rules` entries win. Use categories for breadth; rules for surgery.

---

## 2. Real-World Engineering Scenario

**Scenario: enabling `pedantic` + `style` at error.**

A greenfield team turns all categories to `error`. PRs become 90% style argument. They revert to `correctness: error`, `suspicious: warn`, leave style to Prettier, and cherry-pick two restriction rules forbidding `console.log` in `src/`. Adoption recovers.

**Scenario: assuming security is “covered because unicorn is on.”**
Unicorn ≠ security plugin. Dual-run ESLint security rules stay until a dedicated scanner replaces them.

---

## 3. Production-Grade Code Example

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": [
    "typescript",
    "react",
    "import",
    "jsx-a11y",
    "unicorn",
    "promise",
    "node"
  ],
  "categories": {
    "correctness": "error",
    "suspicious": "warn",
    "perf": "warn",
    "nursery": "off",
    "style": "off",
    "pedantic": "off",
    "restriction": "off"
  },
  "rules": {
    "import/no-cycle": "error",
    "react/rules-of-hooks": "error"
  }
}
```

Exact rule ids for hooks may be namespaced as `react/rules-of-hooks` depending on Oxlint’s naming—confirm with `oxlint --help` / rules docs for your version if a rule is not found.

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Nursery rules in CI as error
They can change behavior between minors. Keep off or warn until stable.

### ⚠️ Style category + Prettier
Duplicate fights. Prefer formatter ownership.

### ⚠️ Believing plugin enable = all upstream rules
Coverage is large but partial. Maintain a gap list after migration.

### ⚠️ Dropping ESLint security plugins without replacement
Explicit risk acceptance required—or keep dual-run.
