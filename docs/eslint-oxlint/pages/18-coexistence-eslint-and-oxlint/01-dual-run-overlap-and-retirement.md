---
title: "Coexistence: Running ESLint + Oxlint Together"
sidebar_label: "Coexistence"
sidebar_position: 1
---

# 🤝 Coexistence: Running ESLint + Oxlint Together

Covers syllabus **§18.1 Dual-Run Pattern**, **§18.2 Overlap & Conflicts**, and **§18.3 When to Drop ESLint**.

## 1. Concept & Under-the-Hood Mechanics

### 18.1 Recommended Dual-Run Pattern

```bash
oxlint && eslint
```

1. **Oxlint first** — fast correctness + native plugins; fail cheap.  
2. **ESLint second** — residual rules only (custom, security, niche plugins).  
3. **`eslint-plugin-oxlint`** — disables ESLint rules that Oxlint already implements so you do not double-report or double-pay.

**Rule ownership matrix** (document in the repo):

| Concern | Owner |
| --- | --- |
| Hooks, many React/TS correctness rules | Oxlint |
| import/no-cycle (if enabled natively) | Oxlint |
| `eslint-plugin-security` / `no-secrets` | ESLint |
| Custom boundary rules | ESLint (until ported) |

Scripts:

```json
{
  "scripts": {
    "lint:ox": "oxlint",
    "lint:eslint": "eslint . --cache --max-warnings 0",
    "lint": "pnpm lint:ox && pnpm lint:eslint"
  }
}
```

### 18.2 Overlap & Conflict Management

- **Duplicate diagnostics** confuse authors—always disable overlap on one side.  
- **Severity mismatch** (error in Oxlint, warn in ESLint for the “same” rule) is worse than a single owner.  
- **Disable comments:** respect both dialects during transition; pick one long-term.  
- **IDE:** running both extensions on large files can lag—prefer Oxlint for editor if most rules moved; keep ESLint for residual package paths only if needed.

### 18.3 When to Drop ESLint Entirely

Checklist:

- [ ] Custom rules ported, replaced, or accepted dropped  
- [ ] Security/secret coverage replaced by native rules **or** other scanners  
- [ ] Plugin gaps reviewed with `@oxlint/migrate` reports  
- [ ] Team trained on oxlint-disable + config  
- [ ] Rollback plan (git history / feature-flag script) for one release cycle  

Upstream guidance nuance: **small/medium** projects often full-replace; **large** projects stay dual longer.

---

## 2. Real-World Engineering Scenario

**Scenario: double `no-unused-vars` on every PR.**

Without `eslint-plugin-oxlint`, both tools report unused vars with slightly different messages. Developers disable the rule in both configs “to ship.” Fix: install eslint-plugin-oxlint recommended flat config slice; remove mental noise; re-enable as single owner (Oxlint).

---

## 3. Production-Grade Code Example

```js
// eslint.config.mjs — residual ESLint after Oxlint owns the bulk
import oxlint from 'eslint-plugin-oxlint';
import security from 'eslint-plugin-security';
import noSecrets from 'eslint-plugin-no-secrets';

export default [
  // Turns off rules Oxlint already covers — use the plugin’s recommended flat export for your version
  ...oxlint.configs['flat/recommended'],
  {
    files: ['**/*.{js,ts,tsx}'],
    plugins: { security, 'no-secrets': noSecrets },
    rules: {
      'security/detect-eval-with-expression': 'error',
      'no-secrets/no-secrets': 'error',
    },
  },
];
```

**Note:** exact `eslint-plugin-oxlint` export path (`configs['flat/recommended']` vs `configs.recommended`) varies by version—confirm in the installed package’s README.

```yaml
# CI: fail fast
- run: pnpm lint:ox
- run: pnpm lint:eslint
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Dual-run without eslint-plugin-oxlint
Wasted CI time and alert fatigue.

### ⚠️ Dropping ESLint while still depending on a custom rule in “forgotten” package
Monorepos hide residual eslint configs—inventory with `rg "eslint-plugin"`.

### ⚠️ IDE shows only one tool’s results
Engineers “fix” the other tool’s CI failures—align editor with CI owners.

### ⚠️ No rollback switch
Keep `"lint": "oxlint && eslint"` vs `"lint": "oxlint"` behind a short-lived branch or documented script change window.
