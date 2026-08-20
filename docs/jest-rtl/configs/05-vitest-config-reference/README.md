---
title: "vitest.config reference"
sidebar_label: "05 · vitest.config reference"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-20 against the [Vitest config reference](https://vitest.dev/config/)
> and the [Vitest guide](https://vitest.dev/guide/). **No sandbox, no console blocks.**

**Vitest's config is small because most of it is somebody else's.** Resolution, aliasing,
plugins and transforms come from Vite — the same config the application builds with. What
remains under `test` is only the part that is genuinely about running tests.

That is the whole architectural difference from Jest, and it explains both what is easy
here and what is confusing.

---

## What you configure, and what you inherit

| Concern | Jest | Vitest |
|---|---|---|
| Path aliases | `moduleNameMapper` | 🔵 **inherited** — `resolve.alias` |
| TypeScript / JSX | `transform` | 🔵 **inherited** — esbuild via Vite |
| CSS Modules | `moduleNameMapper` → `identity-obj-proxy` | 🔵 **inherited** — Vite handles CSS natively |
| Static assets | `moduleNameMapper` → a file stub | 🔵 **inherited** |
| ESM dependencies | `transformIgnorePatterns` | 🔵 mostly inherited; `server.deps.inline` for the rest |
| Environment | `testEnvironment` | 🟢 `test.environment` |
| Setup files | `setupFilesAfterEnv` | 🟢 `test.setupFiles` |
| Isolation | one process per file | 🟢 `test.pool` + `test.isolate` |
| Coverage | `coverageProvider` | 🟢 `test.coverage.provider` |

🔵 **inherited** — nothing to configure, and nothing to keep in sync. That is the
[three-copies alias problem](../README.md) reduced to two.

---

## The chunks

| Chunk | Covers |
|---|---|
| [01](./01-environment-and-globals.md) | `environment`, per-file overrides, `globals`, `include`/`exclude`, `css` |
| [02](./02-pools-and-isolation.md) | `pool`, `poolOptions`, `isolate`, `sequence`, `retry`, `testTimeout` |
| [03](./03-deps-coverage-and-projects.md) | `server.deps.inline`, `coverage`, `projects`, `browser` mode and its boundary |

---

## Read this first: the two `defineConfig`s

```ts
import { defineConfig } from 'vitest/config';   // ✅ knows about `test`
import { defineConfig } from 'vite';            // ❌ does not
```

Covered in [chunk 01 of this section](../01-where-config-lives.md), and repeated here
because it is the failure that wastes the most time: with the wrong import in a loosely
typed project, **the `test` block is accepted, ignored, and reports nothing.**

---

← **Prev:** [04 · RTL configuration](../04-rtl-configuration/README.md) ·
**Next:** [01 · Environment and globals](./01-environment-and-globals.md)
