---
title: "Custom module loaders and resolution hooks"
sidebar_label: "08 · Custom loaders"
sidebar_position: 8
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08 on **Node 24** loader direction. Loader hooks evolve — read current
> Node docs before writing production hooks; Phase 1 covers everyday resolution.

**Custom loaders intercept module resolution and loading — transpile on the fly, mock
dependencies, or enforce import policies. They are power tools for tooling authors, not
the default path for application code (prefer real builds).**

## Everyday vs custom

| Need | Prefer |
|---|---|
| Path aliases in an app | Bundler / TS paths at build time |
| Run TypeScript in dev | Official type-stripping / tsx with eyes open ([Phase 1](../phase-1-modules/12-typescript-natively.md)) |
| Coverage / instrumentation | Established agents |
| Novel resolution policy | Custom loader hooks |

Phase 1's `node:module` API page covers compile cache and hooks at recognition level
([Phase 1](../phase-1-modules/14-node-module-api.md)).

## What hooks can do (conceptually)

- **resolve** — map specifier → URL  
- **load** — return source for a URL  
- Chain with `next()` to defer to default behaviour  

```bash
# shape — register a loader
node --import ./register-loader.mjs app.js
```

Exact hook signatures have changed across Node majors. **Pin Node 24** and copy from
current docs when implementing.

## Production caution

On-the-fly transforms in production:

- Hurt startup  
- Complicate debugging  
- Drift from the artifact you tested in CI  

Ship compiled JS in images ([Phase 11](../phase-11-deployment/08-cicd.md)).

## Gotchas

**Symptom:** Loader works in dev, silent miss in prod
**Cause:** Different NODE_OPTIONS / missing `--import`
**Fix:** Same entry flags in the image CMD

**Symptom:** Double transpile / broken source maps
**Cause:** Loader + bundler both rewriting
**Fix:** One transform pipeline

**Symptom:** Security review rejects dynamic resolve
**Cause:** User-controlled specifiers reaching the loader
**Fix:** Do not resolve untrusted strings to filesystem URLs

## Interview questions

**★ What are custom module loaders for?**
Intercept resolve/load to implement tooling behaviours — transpile, mock, policy.

**Should application servers use loaders in production?**
Usually no — build ahead of time and run plain Node.

**How do you register a loader on modern Node?**
Typically `--import` a registration module (check current Node 24 docs).

**Where is ordinary resolution documented in this bible?**
Phase 1 — modules and packages.

**Main risk of custom resolve hooks?**
Incorrect mapping or untrusted input → loading the wrong code.

---

← Prev: [WASI](./07-wasi.md) · Next → [Startup snapshots](./09-startup-snapshots.md)
