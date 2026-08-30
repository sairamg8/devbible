---
title: "Configs — Jest, RTL & Vitest"
sidebar_label: "Configs — overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-20 against the [Jest configuration reference](https://jestjs.io/docs/configuration),
> the [Vitest config reference](https://vitest.dev/config/), and the
> [Testing Library `configure()` docs](https://testing-library.com/docs/dom-testing-library/api-configuration).
> **No sandbox, no console blocks** — every claim here is documentation-derived.

**A test that passes locally and fails in CI is almost never a bad test. It is a
different config.** This section explains the three config surfaces a React + TypeScript
project puts between your source and your assertions — option by option, the way
`tsconfig.json` and its `compilerOptions` are explained elsewhere in this reference.

---

## The three config surfaces

The first thing to understand is that they are not three of the same thing.

| Tool | Where its config lives | What it actually controls |
|---|---|---|
| **Jest** | `jest.config.{js,ts,mjs,cjs,json}`, or a `"jest"` key in `package.json` | **Everything.** Jest owns discovery, the environment, the transform pipeline, module resolution, coverage and the worker pool — it is a bundler, a resolver and a runner in one |
| **Vitest** | `vitest.config.ts`, or a `test:` key in `vite.config.ts` | **Only the test-specific half.** Resolution, aliasing and transforms are inherited from Vite's own config, which the app already uses |
| **React Testing Library** | 🔴 **no config file at all** | A runtime `configure()` call, plus whatever the *runner* loads as a setup file |

### Why that third row is the one that trips people

Search for `rtl.config.js` and you will not find it, because it does not exist. RTL is a
library you call, not a tool that runs your code — so "configuring RTL" means two
different things wearing one name:

1. **`configure({ testIdAttribute, asyncUtilTimeout, … })`** — a function you call, whose
   effect lasts for the module registry it was called in.
2. **`setupTests.ts`** — an ordinary file that only matters because the **runner** was
   told to load it, via Jest's `setupFilesAfterEnv` or Vitest's `test.setupFiles`.

So RTL's configuration is genuinely a *runner* concern. That is why this section covers
all three tools together rather than in three places: **the interesting questions all sit
on the seams between them.**

---

## Which runner, and when

| Your project | Runner | Why |
|---|---|---|
| Built with **Vite** | **Vitest** | It reads the same `vite.config.ts` your app builds with. Aliases, plugins and transforms cannot drift, because there is only one copy of them |
| **Create React App**, or any Babel/webpack app | **Jest** | Already wired, already transforming. Migrating buys you little until you also leave webpack |
| **Next.js** | **Jest** *(usually)* | `next/jest` supplies a transform that matches the framework's own compilation. Vitest works but you own the SWC/JSX wiring yourself |
| **Node backend, no bundler** | **either**, or `node:test` | Nothing to inherit, so the Vitest advantage narrows to speed and API ergonomics |
| **Large existing Jest suite** | **stay on Jest** | Migrate when a concrete pain forces it — usually native ESM. Chunk 07 is the map for when that day comes |

⚠️ **"Vitest is faster" is not on its own a reason to migrate.** The measured difference
is mostly transform and startup cost, and it shrinks once Jest is on `@swc/jest`. The
durable argument for Vitest is **config singularity** — one resolution story instead of
two — and that is a correctness argument, not a speed one.

---

## The seam that causes the most bugs

Here is the thing worth carrying into every chunk that follows. In a Jest project, a
single path alias must be declared in **three** files that know nothing about each other:

| File | Declaration | Who reads it |
|---|---|---|
| `tsconfig.json` | `"paths": { "@/*": ["src/*"] }` | the type checker and your editor |
| `jest.config.ts` | `moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' }` | the test runner |
| `vite.config.ts` / `webpack.config.js` | `resolve.alias` | the dev server and the build |

Add an alias to two of the three and everything looks fine — until the one you forgot
runs. **The editor is green, the build is green, and the tests cannot resolve the
import** (or the reverse, which is worse, because it ships).

**Vitest collapses that three to two**, because the runner and the build read the same
file. That is the whole substance of the "shared config" claim, and
[Vite's own testing-integration page](../../vite/pages/14-testing-integration/01-vitest-relationship.md)
argues the same point from the build side.

---

## How to read this section

The chunks build in the order you would actually hit the problems.

| # | Chunk | Answers |
|---|---|---|
| **01** | **Where config lives and how it resolves** | Which file wins when there are two? What is `<rootDir>` relative to? When does `extends` merge and when does it replace? |
| **02** | **`jest.config` reference** | The option-by-option pass — discovery, environments, transforms, resolution, mock state, coverage, workers, `projects` |
| **03** | **The setup lifecycle** | The exact order of `globalSetup` → `setupFiles` → framework install → `setupFilesAfterEnv` → your test, and why putting a line in the wrong one silently does nothing |
| **04** | **RTL configuration** | `configure()`, the `setupTests.ts` anatomy, the jsdom polyfill checklist, and `userEvent.setup()` options |
| **05** | **`vitest.config` reference** | The option-by-option pass — environment, globals, `pool` and `isolate`, `server.deps.inline`, coverage, workspace, browser mode |
| **06** | **The annotated configs** | One React + TypeScript app configured **twice**, complete, with every line justified |
| **07** | **Jest → Vitest, key by key** | The migration map at config level first, then API level |

**Chunks 02 and 05 are references** — read the group you need, skip the rest.
**Chunks 03 and 06 are the ones to read end to end**, because they are about ordering and
about a whole config being coherent, and neither survives being skimmed.

---

## What this section deliberately does not cover

- **End-to-end and real-browser testing.** Vitest's `browser` mode is described in chunk
  05 only far enough to mark the boundary; past that boundary is
  [Playwright](../../playwright/pages/README.md).
- **What to test.** This is configuration, not strategy — the query hierarchy and the
  behaviour-not-implementation argument live in
  [RTL core philosophy](../pages/07-rtl-core-philosophy/01-guiding-principle.md) and
  [RTL queries](../pages/08-rtl-queries/01-query-variants-and-priority.md).
- **CI orchestration.** Sharding, worker tuning and flakiness are runner *flags* and
  pipeline shape, covered by
  [Part 4 of the syllabus](../syllabus/04-production-ci.md).

---

## Versions this section is written against

| Tool | Version | Note |
|---|---|---|
| **Jest** | 30.x | Where a default changed from 29, the chunk says so explicitly rather than quietly assuming 30 |
| **Vitest** | 3.x | Config keys moved between major versions more than Jest's did; each chunk names the version a key belongs to |
| **Testing Library** | `@testing-library/react` 16.x, `dom-testing-library` 10.x, `user-event` 14.x | `user-event` v14 changed from a callable API to `setup()`-first; v13 examples on the web do not apply |
| **jsdom** | 26.x | The default Jest environment, and Vitest's when `environment: 'jsdom'` |

⚠️ **Version-check before copying any config off the internet.** These four move
independently, and a config that worked in 2023 can fail on all four counts at once.

---

## Where this connects

- [Jest & RTL — Overview](../README.md) · [Explanations](../pages/README.md)
- [Coverage & Configuration](../pages/06-coverage-and-configuration/01-jest-config.md) —
  the narrative introduction this section expands into a reference
- [Part 4 — Production Setup, CI & Vitest Bridge](../syllabus/04-production-ci.md) — the
  syllabus rows these chunks satisfy
- [tsconfig.json anatomy](../../typescript/pages/phase-0-how-typescript-runs/06-tsconfig-anatomy.md)
  — the same treatment for the type checker, and the model this section follows
- Progress tracker (`reviews/snipperts-progress.md`) — live status of every chunk here
