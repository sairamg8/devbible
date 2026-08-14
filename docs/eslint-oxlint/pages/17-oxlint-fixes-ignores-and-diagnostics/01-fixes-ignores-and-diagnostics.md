---
title: "Oxlint Fixes, Ignore Comments & Diagnostics"
sidebar_label: "Oxlint Fixes, Ignore Comments & Diagnostic"
sidebar_position: 1
---

# 🩹 Oxlint Fixes, Ignore Comments & Diagnostics

Covers syllabus **§17.1 Automatic Fixes**, **§17.2 Ignore Comments**, and **§17.3 Ignore Files & Patterns**.

## 1. Concept & Under-the-Hood Mechanics

### 17.1 Automatic Fixes

`oxlint --fix` applies safe autofixes for rules that implement them. **Parity with ESLint fixes is not guaranteed** rule-for-rule—some native reimplementations fix less (or differently). Always review large fix PRs.

### 17.2 Ignore Comments

| Dialect | Examples |
| --- | --- |
| Native | `// oxlint-disable`, `// oxlint-enable`, `// oxlint-disable-next-line`, `// oxlint-disable-line` |
| ESLint-compatible | `// eslint-disable*` when `options.respectEslintDisableDirectives` is true (**default true**) |

Migration tooling (`@oxlint/migrate --replace-eslint-comments`) can rewrite comments to oxlint dialect when you want a clean long-term style.

`reportUnusedDisableDirectives` (config `options` / CLI severity flags) cleans stale suppressions—same governance idea as ESLint.

### 17.3 Ignore Files & Patterns

- Prefer **`ignorePatterns`** in `.oxlintrc.json` long-term.  
- `.eslintignore` may be respected during migration—**consolidate** eventually.  
- Diagnostics aim for precise spans, structured data, and documentation links—useful for both humans and AI-assisted fix tools.

---

## 2. Real-World Engineering Scenario

**Scenario: half the repo uses eslint-disable, half oxlint-disable.**

After dual-run introduction, developers copy whichever comment the IDE autocomplete inserted. Reviewers argue. Policy: keep `respectEslintDisableDirectives: true` for six months; enable unused-directive reporting; gradually codemod to one dialect with `--replace-eslint-comments` on a cleanup sprint.

---

## 3. Production-Grade Code Example

```json
{
  "ignorePatterns": [
    "dist/**",
    "coverage/**",
    "**/*.gen.ts",
    "**/generated/**"
  ],
  "options": {
    "respectEslintDisableDirectives": true,
    "reportUnusedDisableDirectives": "error"
  }
}
```

```ts
// oxlint-disable-next-line import/no-cycle -- temporary until ADR-88 package split lands (remove by 2026-Q4)
import { legacyStore } from './legacyStore';
```

```bash
oxlint --fix
npx @oxlint/migrate --replace-eslint-comments
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Disabling respect for eslint-disable too early
Breaks half the suppressions overnight and floods CI.

### ⚠️ File-level disables without expiry comments
Same debt problem as ESLint—require reasons and owners.

### ⚠️ Assuming --fix is idempotent across ESLint and Oxlint
Running both with fix can thrash if overlapping rules disagree—disable overlaps first.

### ⚠️ ignorePatterns that accidentally ignore `src`
Test with a known violation file after changing ignores.
