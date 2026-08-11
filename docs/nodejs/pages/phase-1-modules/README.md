---
title: "Phase 1 — Modules and packages"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target runtime: Node 24 — the Active LTS as of August 2026.**
> Every example on these pages was executed on **Node 24.19.0** with **npm
> 12.0.2**, and every API used is available there.

How code gets into your program, and how other people's code gets into your
project. Two module systems that finally interoperate in both directions, one
resolution algorithm worth learning once, and the `package.json` fields that decide
how everything is parsed and shipped.

Fourteen pages. The first four are the ones you use daily.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[ESM](01-esm.md)** | <span className="db-tier t-master">Master</span> | Static imports, live bindings, top-level `await`, and `import()` for everything dynamic |
| 02 | **[CommonJS](02-commonjs.md)** | <span className="db-tier t-master">Master</span> | The wrapper, `module.exports` vs `exports`, and the cache that makes every module a singleton |
| 03 | **[The `node:` prefix](03-node-prefix.md)** | <span className="db-tier t-master">Master</span> | Four built-ins are reachable no other way, and `require('test')` is somebody else's package |
| 04 | **[CJS ↔ ESM interop](04-cjs-esm-interop.md)** | <span className="db-tier t-understand">Understand</span> | `require(esm)` works now; top-level `await` is the one hard boundary |
| 05 | **[Module resolution](05-module-resolution.md)** | <span className="db-tier t-understand">Understand</span> | The `node_modules` walk, and why ESM refuses to guess your file extension |
| 06 | **[Circular dependencies](06-circular-dependencies.md)** | <span className="db-tier t-understand">Understand</span> | CommonJS hands over a half-built object; ESM throws. Both are telling you something |
| 07 | **[package.json essentials](07-package-json.md)** | <span className="db-tier t-master">Master</span> | `type`, `main`, `scripts`, `engines`, `files` — and what each one silently controls |
| 08 | **[The `exports` map](08-exports-map.md)** | <span className="db-tier t-understand">Understand</span> | Declare a public surface, block deep imports, and alias your own files with `#internal` |
| 09 | **[Semver and lockfiles](09-semver-and-lockfiles.md)** | <span className="db-tier t-master">Master</span> | What `^` really permits, and why `npm ci` belongs in every pipeline |
| 10 | **[npm day to day](10-npm-day-to-day.md)** | <span className="db-tier t-master">Master</span> | The dozen commands, and the dependency-list decision that only fails in production |
| 11 | **[Package managers](11-package-managers.md)** | <span className="db-tier t-know">Know</span> | Hoisting, phantom dependencies, and what workspaces do and do not give you |
| 12 | **[TypeScript natively](12-typescript-natively.md)** | <span className="db-tier t-understand">Understand</span> | `node server.ts` runs — and never checks a single type |
| 13 | **[Publishing](13-publishing.md)** | <span className="db-tier t-know">Know</span> | A checklist, two irreversible steps, and `npm pack --dry-run` every time |
| 14 | **[The `node:module` API](14-node-module-api.md)** | <span className="db-tier t-when">Learn When Needed</span> | Loader hooks and the compile cache — read it when a problem sends you here |

## Coverage

The syllabus lists sixteen topics for this phase. Two pairs are merged because you
would never read one without the other; nothing is dropped.

| Syllabus topic | Page |
|---|---|
| ESM: `import`/`export`, default vs named, top-level `await`, dynamic `import()` | 01 |
| CommonJS: `require`, `module.exports` vs `exports`, the module cache | 02 |
| The `node:` prefix for core modules | 03 |
| CJS ↔ ESM interop, default-export gotchas, `createRequire` | 04 |
| Module resolution algorithm, CJS vs ESM extension handling | 05 |
| Circular dependencies in CJS vs ESM | 06 |
| `package.json` essentials: `type`, `main`, `scripts`, `engines`, `files` | 07 |
| `exports` map: conditional exports, subpath exports, encapsulation | 08 |
| Subpath **imports** (`#internal`) for private aliases | 08 |
| Semver and dependency ranges, lockfiles | 09 |
| npm basics: `install` vs `ci`, dependencies vs devDependencies, `npx` | 10 |
| pnpm vs npm vs yarn — layout and strictness | 11 |
| Workspaces / monorepos | 11 |
| TypeScript natively: type stripping, non-erasable syntax, no type checking | 12 |
| Publishing: scoped packages, `npm pack`, provenance, dual CJS/ESM | 13 |
| `node:module`: `module.register()`, hooks, `enableCompileCache()` | 14 |

## Phase gate

**Deliverable:** a package with a clean `exports` map that imports correctly from
both an ESM and a CJS consumer.

Concretely, you should be able to build a package that:

1. Declares `"type": "module"` and an `exports` map with a root and one subpath.
2. Blocks deep imports — `your-pkg/src/internal.js` throws
   `ERR_PACKAGE_PATH_NOT_EXPORTED`.
3. Works from `import { x } from 'your-pkg'` **and** from
   `require('your-pkg')` — remembering that `require(esm)` hands back the
   namespace, so the default export is at `.default`.
4. Ships only what `files` allows, confirmed with `npm pack --dry-run` and a
   tarball install into a scratch directory.

If step 3 surprises you, reread [interop](04-cjs-esm-interop.md). If step 2 does
not throw, your `exports` map is not doing its job — [page 08](08-exports-map.md).

## A note on what changed recently

Advice written before 2025 says CommonJS cannot load ES modules. On Node 24 it can:
`require(esm)` was unflagged in v23.0.0 / v22.12.0 / v20.19.0 and lost its
experimental label in **v24.15.0**. Likewise, running `.ts` files directly is not
a preview feature here — type stripping is **Stability 2 – Stable as of v24.12.0**.

Both change the correct default answer to common questions, so check the date on
anything you read elsewhere about this phase.

## Where this connects

- **Phase 0 — The runtime model** introduced `import.meta.dirname`, `process` and
  the `node:` prefix in passing. This phase is the full treatment.
- **Phase 2 — Async** picks up top-level `await` and dynamic `import()` as event
  loop citizens rather than module syntax.
- **Phase 5 — Processes** covers `util.parseArgs()` for the CLI scripts you wire
  into `package.json`.
- **Phase 12 — Deployment** returns to `npm ci`, `--omit=dev` and lockfiles as
  build-pipeline concerns.

---

← Syllabus: [Part 1 — Foundations](../../syllabus/01-foundations.md) · Start → [ESM](01-esm.md)
