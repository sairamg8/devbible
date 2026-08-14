---
title: "Migration & Decision Recipes: SWC, esbuild, Keep Babel, Audit Config"
sidebar_label: "Migration & Decision Recipes"
sidebar_position: 1
---

# 🚚 Migration & Decision Recipes: SWC, esbuild, Keep Babel, Audit Config

Covers syllabus **§15.1 Babel → SWC**, **§15.2 Babel → esbuild/Vite**, **§15.3 Keeping Babel Deliberately**, and **§15.4 Auditing Inherited Config**.

## 1. Concept & Under-the-Hood Mechanics

### 15.1 Babel → SWC (Next.js / general)

- **Blocker identification:** a root/custom `babel.config.js` often forces Next off default SWC—confirm with current Next major docs.  
- **Plugin ports:** styled-components and Emotion have **SWC-native** compiler options/plugins—prefer those over staying on Babel.

### 15.2 Babel → esbuild / Vite native

Remove Babel plugins from `@vitejs/plugin-react` once nothing requires Babel. Dev/build return to the fast path.

### 15.3 Keeping Babel Deliberately

If you stay: **document why** (macro X, custom plugin Y, target matrix Z) in README/ADR so the next engineer does not “helpfully” delete it.

### 15.4 Auditing Inherited Config

- List presets/plugins; remove duplicates and no-ops  
- Diff emit before/after trimming (`babel` CLI on sample files)  
- Confirm browserslist still matches product policy  

---

## 2. Real-World Engineering Scenario

**Scenario: inherited CRA-era babel.config with three unused proposal plugins.**

Build works; nobody knows why stage-2 decorators are enabled. Audit removes them; emit identical on golden files; complexity drops. A second PR migrates Emotion to SWC and deletes Babel from the app.

---

## 3. Production-Grade Code Example

```markdown
<!-- docs/adr/0007-keep-babel.md -->
# ADR 0007: Keep Babel for graphql.macro

- Status: Accepted
- Because: `graphql.macro` has no SWC equivalent in our stack
- Revisit: when we migrate to typed document nodes codegen without macros
```

```bash
# Minimal-diff verification
npx babel src/App.tsx --out-file /tmp/before.js
# trim config...
npx babel src/App.tsx --out-file /tmp/after.js
diff /tmp/before.js /tmp/after.js
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Deleting babel.config.js without checking Next/SWC plugin parity
CSS-in-JS display names or SSR class mismatches appear only in prod.

### ⚠️ “Migration” that only removes Babel from the app but leaves babel-jest forever
Split brains remain—align test transformer.

### ⚠️ No golden emit tests for plugin removals
Silent behavior changes.

### ⚠️ Keeping Babel undocumented
Guarantees accidental removal or cargo-cult forever.
