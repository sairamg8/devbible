---
title: "Deps, coverage and projects"
sidebar_label: "03 · Deps, coverage and projects"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the [Vitest config reference](https://vitest.dev/config/)
> — `server.deps.inline`, `deps.optimizer`, `coverage`, `projects`, `browser` — the
> [Vitest coverage guide](https://vitest.dev/guide/coverage) and the
> [browser mode guide](https://vitest.dev/guide/browser/). **No sandbox, no console blocks.**

---

## Dependency handling — the `transformIgnorePatterns` analogue

Vitest externalises `node_modules` by default: dependencies are loaded by Node rather than
pushed through Vite's transform pipeline. Faster, and correct for the vast majority.

**Inlining is needed when a package must go through Vite** — it ships untranspiled source,
imports CSS or assets, or is linked from a monorepo:

```ts
test: {
  server: {
    deps: {
      inline: ['some-esm-pkg', /^@myorg\//],
    },
  },
},
```

**Compare with Jest, because the shapes are opposite:**

| | Jest | Vitest |
|---|---|---|
| Default for `node_modules` | **not transformed** | **externalised** (Node loads it) |
| The fix | `transformIgnorePatterns` — a negative lookahead **excluding from the ignore list** | `server.deps.inline` — an **allowlist** |
| Syntax | one regex with `(?!…)` | an array of strings or regexes |

🔴 **The Vitest form is the easier one to get right**, because it is a positive list rather
than a negation inside a regex. When migrating, do not port the lookahead — read the
package names out of it and list them.

⚠️ **`deps.optimizer` is a different tool.** It pre-bundles dependencies with esbuild for
speed; it is not the fix for "this package will not load". Reach for `inline` first.

---

## Coverage

| Option | Default |
|---|---|
| `test.coverage.provider` | `'v8'` |
| `test.coverage.enabled` | `false` |
| `test.coverage.all` | *(see below)* |

```ts
test: {
  coverage: {
    provider: 'v8',              // or 'istanbul'
    reporter: ['text-summary', 'lcov'],
    include: ['src/**/*.{ts,tsx}'],
    exclude: ['**/*.stories.tsx', '**/*.d.ts', 'src/main.tsx'],
    thresholds: {
      statements: 80,
      branches: 70,
      'src/lib/pricing/**': { statements: 95 },
    },
  },
},
```

**The provider default is the opposite of Jest's** — Vitest defaults to `v8`, Jest to
`babel`. `istanbul` is Vitest's equivalent of the instrumenting approach: slower, and the
reference for branch accuracy.

🔴 **The same denominator trap applies as in Jest.** Unless the config names the files that
*should* be measured, an untested file that nothing imports may not appear at all — and
the percentage rises as untested code is added. **Set `include` explicitly**; it is the
counterpart of Jest's `collectCoverageFrom`
([02 · chunk 05](../02-jest-config-reference/05-coverage.md)).

⚠️ Coverage option **names differ from Jest's** — `include`/`exclude`/`thresholds` rather
than `collectCoverageFrom`/`coveragePathIgnorePatterns`/`coverageThreshold` — and they are
globs on both sides here. The `all` option has moved between Vitest majors; check the
reference for the version you are on rather than copying a config from a blog.

---

## `projects` — several configurations, one run

```ts
// vitest.config.ts
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'client',
          environment: 'jsdom',
          include: ['src/**/*.test.tsx'],
          setupFiles: ['./src/setupTests.ts'],
        },
      },
      {
        test: {
          name: 'server',
          environment: 'node',
          include: ['server/**/*.test.ts'],
        },
      },
    ],
  },
});
```

Same benefit as Jest's `projects` — one command, one merged coverage report, `name`
labelling each result.

⚠️ **This replaced the older `vitest.workspace.ts` file.** Both shapes are in circulation
online; `projects` inside `test` is the current form. If you inherit a workspace file, it
is not broken, but new configuration should not add one.

🔴 **Coverage belongs at the top level, not inside a project** — the same rule as Jest, for
the same reason: per-project coverage gives you partial reports and thresholds that
measure a fraction of the codebase.

---

## Browser mode, and where this section stops

```ts
test: {
  browser: {
    enabled: true,
    provider: 'playwright',
    instances: [{ browser: 'chromium' }],
  },
},
```

Browser mode runs component tests in a **real browser** instead of jsdom — real layout,
real CSS, a real event loop. It removes the entire polyfill checklist
([04 · chunk 03](../04-rtl-configuration/03-the-jsdom-polyfill-checklist.md)) because
nothing is missing.

**The boundary this section draws:**

| | jsdom | browser mode | Playwright E2E |
|---|---|---|---|
| Renders | one component | one component | the whole app |
| Layout | ❌ none | ✅ real | ✅ real |
| Speed | fastest | middle | slowest |
| Use for | logic, roles, text, interaction | anything measuring or painting | user journeys across pages |

**Reach for browser mode when a component genuinely depends on layout** — a virtualised
list, a drag handle, a popover that needs collision detection. Do not migrate a whole
jsdom suite to it; the cost per file is real, and most component tests do not need a
layout engine.

Full E2E belongs in [Playwright](../../../playwright/pages/README.md).

⚠️ **Browser mode has moved quickly across Vitest versions** — `instances` replaced an
earlier `name` field, among other changes. Check the guide for your version rather than
trusting an example, including this one.

---

## Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| A dependency fails to parse | Externalised, ships untranspiled source | Add it to `server.deps.inline` |
| A linked monorepo package is stale or unresolved | Externalised rather than transformed | Inline it |
| A ported Jest lookahead does nothing | `inline` is an allowlist, not a negation | List the package names plainly |
| `deps.optimizer` does not fix a load error | It is a pre-bundling speed tool | Use `inline` |
| Coverage rises as untested files are added | No explicit `include` | Set it — Vitest's `collectCoverageFrom` |
| Coverage config copied from Jest does nothing | Different option names | `include`/`exclude`/`thresholds` |
| Branch coverage looks wrong under `v8` | Provider difference, or weak source maps | Compare against `istanbul` |
| Coverage halves after adopting `projects` | Coverage placed inside a project | Move it to the top level |
| A workspace file and `projects` both present | Two generations of the same feature | Keep `projects` |
| Browser-mode example from a blog errors | The API changed between majors | Check the guide for your version |
| Suite much slower after enabling browser mode | Real browsers cost real time | Use it for the components that need layout |

---

## Interview questions

**Q. How does Vitest treat `node_modules` by default, and how does that differ from Jest?**
Vitest externalises them — Node loads them directly. Jest transforms nothing there by
default. Opposite defaults, so the fixes are shaped differently.

**Q. What is `server.deps.inline` for?**
Forcing specific dependencies through Vite's pipeline — packages shipping untranspiled
source, importing CSS or assets, or linked from a monorepo.

**Q. Why is it easier to get right than `transformIgnorePatterns`?**
It is a positive allowlist of names. Jest's equivalent is a negative lookahead inside one
regex, which is easy to write and hard to read.

**Q. Which coverage provider does Vitest default to?**
`v8`, reading the engine's own data. Jest defaults to `babel` instrumentation — so the
same project reports through different machinery on each runner.

**Q. Does the coverage denominator trap apply to Vitest?**
Yes. Without an explicit `include`, unimported files may not be counted, so the percentage
can rise as untested code is added.

**Q. Where does coverage config belong under `projects`?**
Top level. Inside a project it produces partial reports and thresholds that see only part
of the codebase.

**Q. What replaced `vitest.workspace.ts`?**
`projects` inside the `test` block. Existing workspace files still work, but new config
should use `projects`.

**Q. What does browser mode change?**
Component tests run in a real browser, so layout, CSS and events are real and the jsdom
polyfill checklist disappears.

**Q. When would you not use it?**
For the bulk of component tests. It costs real time per file, and a test asserting on
roles and text needs no layout engine.

**Q. Where is the line between browser mode and Playwright E2E?**
Browser mode renders one component in a real browser; Playwright drives the whole
application through a user journey.

---

← **Prev:** [02 · Pools and isolation](./02-pools-and-isolation.md) ·
**Next:** 06 · The annotated configs *(not written yet)*
