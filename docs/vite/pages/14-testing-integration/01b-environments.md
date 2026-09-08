---
title: "The test environment is a Vitest concept Vite has no notion of, node is the default, and environmentMatchGlobs is gone in v4+ — projects is the replacement"
sidebar_label: "01b · Environments"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the Vitest documentation — [`environment`](https://vitest.dev/config/environment), [Test Environment guide](https://vitest.dev/guide/environment.html). `environmentMatchGlobs`'s removal in Vitest 4 corroborated via third-party coverage of the v4 release and its absence from the current `/config/environment` reference page, **not** a direct vitest.dev quote — flagged inline. Documentation-validated; **no sandbox run**. Target: **Vitest 5.0.0 · Vite 8.2.2**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ `environment` is Vitest's problem to solve, not Vite's

**Vite has no concept of a test environment because Vite is not a test runner — `jsdom`, `happy-dom`, and `edge-runtime` are Vitest layering a fake DOM or a fake edge runtime on top of Node, entirely independent of anything Vite's dev server does.** Forgetting this is the most common first mistake in a new Vitest project: a component test throws `document is not defined` because the default environment is plain Node, and nothing about the shared `vite.config.ts` changes that default. This chunk covers the four built-in environments, the per-file override, and the config option that used to let you mix environments by file pattern — removed in Vitest 4, with `projects` as its replacement.

## The default is `node`, not a browser-like environment

> *"The environment that will be used for testing. The default environment in Vitest is a Node.js environment."* — [`environment`](https://vitest.dev/config/environment)

Type: `'node' | 'jsdom' | 'happy-dom' | 'edge-runtime' | string`, default `'node'`.

> *"If you are building a web application, you can use browser-like environment through either jsdom or happy-dom instead. If you are building edge functions, you can use edge-runtime environment."*

```typescript
// vite.config.ts — a component-testing project must opt into a DOM
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    environment: 'jsdom', // or 'happy-dom' — see the trade-off below
  },
});
```

`jsdom` *"emulates browser environment by providing Browser API, uses [`jsdom`](https://github.com/jsdom/jsdom) package"*; `happy-dom` *"emulates browser environment by providing Browser API, and considered to be faster than jsdom, but lacks some API, uses [`happy-dom`](https://github.com/capricorn86/happy-dom) package"*. Both are separate npm packages Vitest's own `peerDependencies` list as `"*"` (any version) — they are not bundled with `vitest` and must be installed directly. The trade-off in one sentence: `happy-dom` starts faster and covers less of the real DOM API surface; reach for `jsdom` first, and only measure the swap if startup time on a large suite is the actual bottleneck.

TypeScript support for the jsdom global types needs one more line, separate from the `vitest/globals` types entry covered in **[01 · The Vitest/Vite relationship](01-vitest-relationship.md)**:

> *"If you want TypeScript to recognize it, you can add `vitest/jsdom` to your `tsconfig.json` when you use this environment."*

```json
{ "compilerOptions": { "types": ["vitest/globals", "vitest/jsdom"] } }
```

## Per-file override — the docblock

A file that genuinely needs a different environment from the project default does not require a second config or a `projects` entry:

```typescript
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';

describe('Toast', () => {
  it('renders into the DOM', () => {
    expect(document.body).toBeDefined();
  });
});
```

> *"For compatibility with Jest, there is also a `@jest-environment`"* comment form, accepted as an alias — a Jest test suite mid-migration does not need every docblock rewritten to switch runners.

## `environmentMatchGlobs` — deprecated in v3, removed in v4

An older pattern for mixing environments by file path existed as `environmentMatchGlobs`, letting a glob pattern pick the environment without a per-file docblock in every matching file. It is **gone** from the current documentation: the `/config/environment` reference page makes no mention of it, checked directly against the live page. Third-party coverage of the release corroborates a deliberate removal:

- Deprecated in Vitest 3, with the deprecation message pointing at `workspace` as the replacement.
- Removed outright in Vitest 4.0.0, alongside its `pool` equivalent, `poolMatchGlobs`.

I could not locate a vitest.dev page stating the removal in as many words — this is corroborated via community coverage of the v4 release and the option's absence from current docs, **not a direct quote from Vitest's own site**. What the current docs *do* describe, and what replaced the glob-matching idea, is `projects` — the same mechanism the Vitest 5 migration guide discusses for inline, inheriting project configs:

> *"The `extends` option now defaults to `true`: every project defined as an inline configuration in `test.projects` inherits all options from the root configuration"* — [Vitest 5.0 migration guide](https://vitest.dev/guide/migration.html)

```typescript
// vitest.config.ts — the projects replacement for "match this environment to these globs"
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.unit.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'component',
          environment: 'jsdom',
          include: ['src/**/*.component.test.tsx'],
        },
      },
    ],
  },
});
```

Each project is a full test configuration, inheriting the root's `plugins`/`resolve`/`define` by default (`extends: true`) and overriding only `environment` and `include` — the same outcome `environmentMatchGlobs` gave with a glob pattern, expressed as an explicit list instead of a pattern match. The trade-off is verbosity for clarity: a `projects` array is longer than one glob line, but it shows up as named, separately-reportable groups in the CLI output rather than an implicit rule a reader has to reverse-engineer from file names.

## Gotchas

**★ Symptom: `document is not defined` (or `window is not defined`) the first time component tests are written in a new Vitest project.** Cause: the default `environment` is `node`, unconditionally — Vite's own config carries no notion of a test DOM, so there is nothing in a shared `vite.config.ts` that would set this for you. Fix: set `environment: 'jsdom'` (or `'happy-dom'`) in the `test` block, and install the package — it is a peer dependency, not a transitive one.
```typescript
test: { environment: 'jsdom' }
```

**★ Symptom: `environmentMatchGlobs` in an existing config throws or is silently ignored after a Vitest upgrade.** Cause: it was deprecated in Vitest 3 and removed in Vitest 4.0.0. Fix: migrate to `test.projects`, giving each environment its own named project with an `include` glob instead of a match-glob-to-environment table.

**★ Symptom: `jsdom` types are missing in the editor — `document`/`window`/`HTMLElement` all report as undefined — even though the tests pass under Node.** Cause: `environment: 'jsdom'` is a runtime setting Vitest applies when executing the test; TypeScript's static check needs the ambient DOM types added separately via `vitest/jsdom`. Fix: add both type entries if `globals: true` is also in play — they are independent additions.
```json
{ "compilerOptions": { "types": ["vitest/globals", "vitest/jsdom"] } }
```

**★ Symptom: a suite switched from `jsdom` to `happy-dom` for speed, and a component test that used a DOM API the old environment supported now fails.** Cause: `happy-dom`'s own description states it *"lacks some API"* relative to `jsdom` — it is a smaller, faster reimplementation, not a drop-in with full parity. Fix: either revert that specific test file to `jsdom` via the per-file docblock, or confirm the missing API against `happy-dom`'s own compatibility notes before committing to it project-wide.
```typescript
/**
 * @vitest-environment jsdom
 */
```

**★ Symptom: a per-file `// @vitest-environment` comment does nothing.** Cause: the docblock form (`/** @vitest-environment jsdom */`) is what the documentation shows and is confirmed to work; a single-line `//` comment in the same position has not been separately confirmed here to be recognized — treat the documented block-comment form as the reliable one and do not assume the single-line variant is equivalent without checking it against the installed version. Fix: use the block-comment form the docs demonstrate.

## Interview questions

**★ Why does Vite itself have no `environment` option, even though Vitest's `environment` lives inside the same `vite.config.ts`?**
Because `environment` is not a Vite concern at all — Vite serves and transforms modules, and has no opinion about whether the code under test runs against a real browser, a fake DOM, or plain Node. `environment` is purely a Vitest-side runtime concern, implemented by swapping the global object Vitest hands to the test process (a jsdom/happy-dom window, an edge-runtime VM, or nothing) before running the transformed module. It lives in the `test` key of the shared config file only because that is where all of Vitest's own options live, not because Vite processes it.

**★ What actually replaced `environmentMatchGlobs`, and why is the replacement more verbose?**
`test.projects`, where each project is a full test configuration with its own `environment` and `include` glob, optionally inheriting the root config via `extends: true`. It is more verbose than a single glob-to-environment mapping line, but each project becomes a separately named, separately reportable unit in Vitest's own output — a reader (or a CI dashboard) sees "unit" and "component" as distinct groups rather than having to infer the grouping from a glob pattern buried in config. The trade is explicitness for line count, which is generally the right trade for configuration that changes rarely and is read far more often than it is written.

**★ When is a per-file `@vitest-environment` docblock the right tool, versus a `projects` entry?**
The docblock is right for the rare exception — one or two files in an otherwise `node`-environment suite that specifically need `jsdom`, without wanting to restructure the whole test run into named projects. `projects` is right once there is a real, ongoing split — a genuine "unit tests run in `node`, component tests run in `jsdom`" architecture with enough files on each side that naming and reporting them separately in CI output is worth the extra config. Reaching for `projects` for a single exceptional file is over-engineering; reaching for a docblock scattered across forty files that all need the same non-default environment is under-engineering.

**★ Why install `jsdom` or `happy-dom` yourself rather than getting it as part of `vitest`?**
Because Vitest's own `peerDependencies` list both as `"*"` — any version, your choice — rather than bundling a specific one as a direct dependency. That keeps `vitest`'s own install light for the (common) case of a Node-only test suite that never needs a DOM at all, and it lets a project pick jsdom's stability or happy-dom's speed independently of which Vitest version it is on, as long as some version of the chosen package is present.

---

← [01a · The transform boundary](01a-the-transform-boundary.md) · [Vite overview](../../README.md) · Next → [01c · Browser Mode](01c-browser-mode.md)
