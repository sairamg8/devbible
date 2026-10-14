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

{/* LINKMAP:START */}

## Further reading

*Best explanations found elsewhere on the web — added alongside this page, nothing here replaces it.*

- **Read this:** [SWC compilation config](https://swc.rs/docs/configuration/compilation) — swc.rs: `env.targets` as the preset-env equivalent (does not work with `jsc.target`), `jsc.transform.react` (default runtime classic), plugins under `jsc.experimental` (*read*)
- **Also good:** [esbuild: TypeScript caveats](https://esbuild.github.io/content-types/) — esbuild.github.io: no type-check, no `declaration`, no `emitDecoratorMetadata`, isolatedModules needed (*read*)
- **Also good:** [SWC disabled](https://nextjs.org/docs/messages/swc-disabled) — nextjs.org: a Babel config makes Next fall back to Babel; `experimental.forceSwcTransforms`; text dates from Next 12, and Next 16 Turbopack behaves differently (see T04-01b) (*read*)
- **Beyond the docs:** [Jest: Babel to SWC](https://www.joshuakgoldberg.com/blog/jest-babel-to-swc) — Josh Goldberg, 2022-02-21: a worked migration with the real traps: missing `regenerator-runtime`, coverage on re-export files, node_modules 186M to 330M; written for an early `@swc/jest`, and the author notes 0.2.18 later auto-detects the target
- **Read this:** [Babel 8 migration](https://babeljs.io/docs/v8-migration) — babeljs.io: the list of renamed and removed packages and options to audit against, including syntax plugins that are no longer needed (*read*)
- **Also good:** [@babel/plugin-transform-runtime](https://babeljs.io/docs/babel-plugin-transform-runtime) — babeljs.io: helper aliasing to `@babel/runtime`; `corejs` option "removed in Babel 8" (`useBuiltIns` is not mentioned as a Babel 8 removal on this page) (*read*)
- **Also good:** [Releasing Babel 8 today](https://babeljs.io/blog/2026/06/16/8.0.0) — babeljs.io blog, 2026-06-16: the release post: ESM-only, no ES5 default, `loose`/`spec` removed, Babel 7 security fixes until June 2027 (*read*)

{/* LINKMAP:END */}
