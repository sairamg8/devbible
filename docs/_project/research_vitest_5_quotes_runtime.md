---
name: research-vitest-5-quotes-runtime
description: Verbatim Vitest 5.0.0 quotes, part 2 of 2 — mocking and vi.hoisted, coverage providers, in-source testing, CI/watch/pool/reporters, the v5 migration highlights, Browser Mode, and the deps.optimizer disabled-by-default corroboration. Banked by agent D of batch 3, 2026-09-08. Part 1 is [[research-vitest-5-quotes-config]]. Do NOT re-derive.
metadata:
  type: project
---

## Mocking
Source: https://vitest.dev/api/vi.html, https://vitest.dev/guide/mocking/modules,
https://vitest.dev/guide/mocking.html

Hoisting warning (guide/mocking.html): "Don't forget that a `vi.mock` call is hoisted
to top of the file. It will always be executed before all imports."

vi.mock factory scoping restriction (api/vi.html):
> "This also means that you cannot use any variables inside the factory that are
> defined outside the factory."
Real error string quoted from docs: "Cannot access '__vi_import_0__' before
initialization"

vi.hoisted:
> "All static `import` statements in ES modules are hoisted to the top of the file, so
> any code that is defined before the imports will actually be executed after imports
> are evaluated."
Signature: `function hoisted<T>(factory: () => T): T`
Example:
```ts
const { mockedMethod } = vi.hoisted(() => {
  return { mockedMethod: vi.fn() }
})
vi.mock('./path/to/module.js', () => {
  return { originalMethod: mockedMethod }
})
```

__mocks__ resolution (guide/mocking/modules):
> "If the file `./__mocks__/example.js` exists, then Vitest will load it instead" when
calling `vi.mock(import('./example.js'))` without a factory.

Aliased path mocking via `test.alias` (guide/mocking/modules, verbatim code block):
```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    alias: {
      vscode: resolve(import.meta.dirname, './mock/vscode.js'),
    },
  },
})
```
"To redirect the import, use test.alias config option" — i.e. for module names that
don't resolve to a real path Vitest can find on disk to place a __mocks__ sibling next
to, `test.alias` is the way to redirect the specifier to a mock file directly (this is
Vitest's OWN alias list, config/alias, feeding the same resolution vi.mock relies on —
not the same list as Vite's `resolve.alias`, though both can carry the same entries;
worth checking whether they need to be duplicated or whether test.alias defaults to
resolve.alias — NOT CONFIRMED, write as open question / verify before asserting either
way).

v5 migration — hoisting calls now THROW if misplaced (guide/migration.html):
> "vi.mock, vi.unmock, and vi.hoisted are hoisted to the top of the file and run before
> any surrounding code. Calling them inside a function, block, or describe/test
> callback previously only logged a warning. Vitest 5.0 now throws, because the call
> does not execute where it is written."

v5 migration — clearMocks default flip:
> "clearMocks now defaults to true: Vitest calls vi.clearAllMocks() before every test,
> clearing the recorded history of every mock while leaving implementations intact."
(mockReset / restoreMocks defaults not stated in the fetched migration text — do not
assert either way.)

Jest migration differences (guide/migration/jest):
> "Unlike Jest, mocked modules in `<root>/__mocks__` are not loaded unless `vi.mock()`
> is called."
> "When mocking a module in Jest, the factory argument's return value is the default
> export. In Vitest, the factory argument has to return an object with each export
> explicitly defined."
Example given:
```js
jest.mock('./some-path', () => 'hello')
// becomes:
vi.mock('./some-path', () => ({ default: 'hello' }))
```
> "Vitest doesn't support Jest's legacy timers."
> jest.setTimeout -> migrate to vi.setConfig.
NOTE: I could not retrieve verbatim text for moduleNameMapper -> resolve.alias mapping,
or the babel-hoisting-vs-static-analysis distinction, despite two fetch attempts on the
jest migration page — write those points as reasoned from Vite's own resolve.alias docs
(already covered in topic 08/other topics) plus the general hoisting mechanism above,
not as a direct quote, and say so.

## Coverage
Source: https://vitest.dev/guide/coverage.html

> "By default, `v8` will be used."
v8 provider:
> instrumented "using node:inspector and Chrome DevTools Protocol in browsers"
> "User's source files can be executed as-is without any pre-instrumentation steps."
> "Faster execute times than Istanbul", "Lower memory usage than Istanbul"
> "Does not work on environments that don't use V8, such as Firefox or Bun"
> "Since v3.2.0 Vitest has used AST based coverage remapping for V8 coverage, which
> produces identical coverage reports to Istanbul." / "This allows users to have the
> speed of V8 coverage with accuracy of Istanbul coverage."
istanbul provider:
> "coverage tracking works by transforming your source code to add instrumentation
> logic."
> "Works on any Javascript runtime"; "Widely used and battle-tested for over 13 years"
> "Source code is transformed to add instrumentation before running"
> "Execution speed is slower than V8 due to instrumentation overhead"
Ignore hints + esbuild comment stripping: need `@preserve` keyword in the ignore hint
comment so esbuild's legal-comment handling doesn't strip it before Istanbul/V8 ever
see it (paraphrase — exact sentence not fully captured verbatim, flag as approximate).

## In-source testing
Source: https://vitest.dev/guide/in-source.html
> "Vitest provides a way to run tests within your source code along side the
> implementation, similar to Rust's module tests."
```ts
if (import.meta.vitest) {
  const { it, expect } = import.meta.vitest
  it('add', () => {
    expect(add(1, 2)).toBe(3)
  })
}
```
Requires `includeSource` in config to have Vitest look for these blocks in source
files (not test files).
Production stripping — configure the bundler's `define`:
```ts
define: { 'import.meta.vitest': 'undefined' }
```
"the bundler do the dead code elimination" — same define/replace idea needed for
Rollup, webpack, Rolldown, unbuild (named explicitly across bundlers).
Caveat: "a limitation when using assertion functions such as `assert` in in-source
tests" (workaround pointed at API docs, not quoted in detail).
Recommended scope: "unit testing for small-scoped functions or utilities" rather than
component/E2E scenarios.

## CI / watch / pool / reporters
Source: https://vitest.dev/guide/cli.html, https://vitest.dev/config/watch,
https://vitest.dev/config/pool, https://vitest.dev/config/reporters

--run: "Perform a single run without watch mode."
--watch: "Run all test suites but watch for changes and rerun tests when they change.
Same as calling `vitest` without an argument. Will fallback to `vitest run` in CI or
when stdin is not a TTY (non-interactive environment)."
Base command: "enter the watch mode in development environment and run mode in CI (or
non-interactive terminal) automatically."

watch config option: Default `!process.env.CI && process.stdin.isTTY`. CLI:
`-w, --watch, --watch=false`.

pool default: `'forks'`.
- threads: "Enable multi-threading" via worker_threads; process.chdir() etc unavailable.
- forks: "Similar as threads pool but uses child_process instead of worker_threads" —
  slower IPC, full process API access.
- vmThreads: run tests "using VM context (inside a sandboxed environment) in a threads
  pool" — faster, but memory-leak-prone, needs worker restarts.
- vmForks: "Similar as vmForks pool but uses child_process instead of worker_threads" —
  cheaper worker recycling for large suites, "usually noticeably faster than vmThreads"
  because the OS reclaims memory rather than Node's GC.

reporters: default is `'default'`. Built-ins: default, verbose, tree, dot, junit, json,
html, tap, tap-flat, hanging-process, github-actions, minimal (aliased as agent), blob.
(v5 migration note, already banked above: json/junit now write to a FILE by default
instead of stdout.)

## Vitest 5.0 migration highlights (guide/migration.html), consolidated
- "vi.mock, vi.unmock, and vi.hoisted are hoisted to the top of the file and run before
  any surrounding code. Calling them inside a function, block, or describe/test
  callback previously only logged a warning. Vitest 5.0 now throws..."
- "clearMocks now defaults to true: Vitest calls vi.clearAllMocks() before every test..."
- "testNamePattern (the -t CLI flag) now matches against the test's full name with the
  suite chain and test name joined by ' > ', the same string shown in the reporter
  output. Previously the segments were joined with a single space, mirroring Jest."
- "The extends option now defaults to true: every project defined as an inline
  configuration in test.projects inherits all options from the root configuration"
- "Inline projects that don't modify the Vite config now reuse the Vite server of the
  config that declares them instead of resolving a new Vite config"
- "The mock's prototype is now chained to the implementation's prototype" (class mocks)
- "bench is no longer a top-level import from vitest; it is a test-context fixture"
- "Vitest UI now requires token authentication for the HTML page and API access"
- test.sequential / describe.sequential / sequential test options removed; use
  `concurrent: false`.
- "json and junit reporters now write to a file by default instead of printing to
  stdout"
- "Vitest 5.0 requires Vite >= 6.4.0 and Node.js >= 22.12.0."
- Browser mode: strict locators by default, toHaveTextContent exact-equality by
  default, render is now async in vitest-browser-vue/vitest-browser-svelte,
  session-bound orchestrator URLs.

## Browser Mode
Source: https://vitest.dev/guide/browser/, https://vitest.dev/blog/vitest-4

Status: STABLE as of Vitest 4.0 —
> "With this release we are removing the `experimental` tag from Browser Mode." (v4
blog). Was still experimental in v3 per third-party coverage (deprecation of the
reference-comment config style, separate playwright/webdriverio guides added); I could
not find a vitest.dev page directly stating "was experimental in v3" — that half is
corroborated via search results (heise.de / infoq coverage of the v4 release), not a
direct vitest.dev quote. Written on the page with that provenance distinction kept.

Provider packages (v4+): @vitest/browser-playwright, @vitest/browser-webdriverio,
@vitest/browser-preview — separate installs, no more triple-slash reference comment
needed (blog: "eliminating the need for reference comments in configuration files").
Provider peer ranges in vitest 5.0.0's own peerDependencies: all pinned to 5.0.0 except
webdriverio's ('^5.0.0-beta.5 || >=5.0.0').

Recommendation: "If you don't already use one of these tools, we recommend starting
with Playwright because it supports parallel execution, which makes your tests run
faster."
Playwright browsers: firefox, webkit, chromium. WebdriverIO: firefox, chrome, edge,
safari.

v4 additions: Visual Regression Testing ("Vitest 4 adds support for Visual Regression
testing in Browser Mode" via `toMatchScreenshot`) and Playwright Trace support
("Vitest 4 supports generating Playwright Traces").

Scope / component vs E2E: the docs describe Browser Mode as running "component and unit
testing with DOM assertions" using component-render packages (vitest-browser-vue,
vitest-browser-react, etc.) and userEvent for interaction. I explicitly could NOT find
a vitest.dev sentence contrasting Browser Mode against full end-to-end Playwright tests
("not a replacement for E2E" or similar) — no such disclaimer was located after two
targeted fetches. Write the component-vs-E2E boundary as reasoned from what Browser
Mode actually tests (one component/page, in one real browser, orchestrated by Vitest's
runner and reporter) versus what a standalone Playwright suite tests (multi-page user
journeys, cross-origin navigation, its own test runner/reporter) — framed as an
architectural distinction, not a quoted doc warning.

## Deps.optimizer disabled-by-default corroboration
config/deps: "Default: false" for deps.optimizer.{mode}.enabled (web/client and ssr).
