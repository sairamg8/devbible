---
title: "Suppressions, Ignores & Lint Governance"
sidebar_label: "Suppressions, Ignores & Lint Governance"
sidebar_position: 1
---

# 🚫 Suppressions, Ignores & Lint Governance

Covers syllabus **§9.1 Inline Disable Comments** and **§9.2 Governance Patterns**.

## 1. Concept & Under-the-Hood Mechanics

### 9.1 Inline Disable Comments

| Directive | Scope |
| --- | --- |
| `/* eslint-disable rule-a, rule-b */` | From this point down (or whole file if at top) |
| `/* eslint-enable rule-a */` | Re-enable |
| `// eslint-disable-next-line rule-a` | Next line only |
| `// eslint-disable-line rule-a` | Same line |

**`linterOptions.reportUnusedDisableDirectives`** fails (or warns) when a disable no longer matches any finding—critical for preventing eternal debt.

**`noInlineConfig: true`** forbids inline disables so all exceptions go through config `overrides` (strict orgs).

### 9.2 Governance Patterns

- **Generated code:** ignore entirely or use a dedicated override with almost all rules off—never run `--fix` on generated trees (causes noisy diffs / fights generators).  
- **Gradual rollout:** `warn` → `error`; path-based enablement for `legacy/**`.  
- **Suppression budgets:** treat `eslint-disable` counts as tech debt metrics in review.  
- **Ignore alignment:** ESLint ignores ≠ Prettier ignore ≠ gitignore. Align intentionally; don’t assume one file feeds all tools.

Oxlint respects `eslint-disable` by default during migration (`respectEslintDisableDirectives`)—see [Oxlint diagnostics](../17-oxlint-fixes-ignores-and-diagnostics/01-fixes-ignores-and-diagnostics.md).

---

## 2. Real-World Engineering Scenario

**Scenario: file-level `eslint-disable` at top of a 2k-line god module.**

Years later nobody knows which rules were painful. `reportUnusedDisableDirectives` is off. A hooks bug ships because `react-hooks/exhaustive-deps` was file-disabled in 2021 for one false positive. Fix: delete file-level disable; add next-line disables with comments explaining *why*; enable unused-directive reporting.

---

## 3. Production-Grade Code Example

```js
// eslint.config.mjs
export default [
  {
    ignores: ['**/generated/**', '**/*.gen.ts'],
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      // ...
    },
  },
  {
    files: ['legacy/**/*.{js,ts}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn', // not error yet
    },
  },
];
```

```ts
// Intentional exception with reason (required in code review)
// eslint-disable-next-line @typescript-eslint/no-floating-promises -- fire-and-forget metrics; monitored in Datadog
trackMetric('checkout_render');
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Disable without rule names
`// eslint-disable-next-line` with no rules disables *everything* on that line—too broad.

### ⚠️ Fighting generators with autofix
OpenAPI client regenerate + eslint --fix = perpetual conflicts. Ignore or override.

### ⚠️ Divergent prettierignore vs eslint ignores
Formatted files that ESLint still parses (or the reverse) confuse contributors.

### ⚠️ `noInlineConfig` without a fast override path
Engineers will invent worse escapes (cast to `any`, `@ts-expect-error` spam). Provide a documented override process.
