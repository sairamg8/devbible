---
title: "A Jest suite does not fail on Vitest because the assertions are wrong — it fails because hoisting, hook ordering, and __mocks__ auto-loading are all quietly different defaults"
sidebar_label: "01i · Migrating from Jest"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the [Migrating from Jest guide](https://vitest.dev/guide/migration/jest). Several claims below (the `moduleNameMapper`/`resolve.alias` relationship, the babel-hoisting-vs-static-analysis distinction, CJS-only helper file behavior) are **not stated on that page** and are reasoned from Vite's own config model and Vitest's own hoisting mechanism (**[01d](01d-mocking.md)**) rather than quoted — flagged individually below. Documentation-validated; **no sandbox run**. Target: **Vitest 5.0.0 · Vite 8.2.2**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ The failures a Jest migration produces are default-shape mismatches, not API gaps

**A team moving a Jest suite to Vitest almost never hits a missing feature — `describe`, `it`, `expect`, `vi.fn()` all exist and mostly match Jest's shape.** What breaks is a set of defaults that look identical on the surface and are not: whether globals need importing, what a mock factory is allowed to return, whether hooks run in the order they were declared, whether `__mocks__` loads itself, and whether `jest.useFakeTimers()`'s legacy mode has an equivalent at all. This chunk collects the differences the official migration guide states directly, and separately flags the ones a migration commonly hits that the guide does not cover.

## Globals — Jest's default is Vitest's opt-in

> *"Jest has their globals API enabled by default. Vitest does not. You can either enable globals via the `globals` configuration setting or update your code to use imports from the `vitest` module instead."* — [Migrating from Jest guide](https://vitest.dev/guide/migration/jest)

The mechanical fix — `globals: true` plus the `vitest/globals` type entry — is covered in full in **[01 · The Vitest/Vite relationship](01-vitest-relationship.md)**. For a large existing Jest suite, turning `globals: true` on is almost always less work than rewriting every file's implicit `describe`/`it`/`expect` into explicit imports, and it is the documented escape hatch specifically for this migration.

## Mock factory return shape — Jest's shortcut does not exist in Vitest

> *"When mocking a module in Jest, the factory argument's return value is the default export. In Vitest, the factory argument has to return an object with each export explicitly defined."*

```javascript
// Jest — the factory's return value itself becomes the module's default export
jest.mock('./some-path', () => 'hello');

// Vitest — the factory must return the full module shape, default export named explicitly
vi.mock('./some-path', () => ({ default: 'hello' }));
```

A mechanical find-and-replace of `jest.mock` → `vi.mock` across a large codebase reproduces this exact class of bug silently: the call succeeds, TypeScript may not catch it if the mocked module's type is loose, and the failure surfaces as `undefined` where a value was expected, deep inside whatever consumed the mocked default export.

## `__mocks__` auto-loading — Jest does more than Vitest by default

> *"Unlike Jest, mocked modules in `<root>/__mocks__` are not loaded unless `vi.mock()` is called."*

Jest auto-applies a `__mocks__/some-package.js` file adjacent to `node_modules` for any import of `some-package`, with no explicit `jest.mock('some-package')` call required in the test file. Vitest's `__mocks__` convention (covered in **[01d](01d-mocking.md)**) only substitutes the file when `vi.mock()` is explicitly called for that specifier — the file existing is not, by itself, enough. A Jest suite relying on implicit package-level automocking needs an explicit `vi.mock('some-package')` added everywhere that automocking was previously assumed, typically surfaced as a real module's real network/filesystem code running unexpectedly during a migrated test, rather than an error.

## Hooks — return values, and default ordering

> *"beforeAll/beforeEach hooks may return teardown function in Vitest. Because of that you may need to rewrite your hooks declarations, if they return something other than undefined or null."*

A Jest `beforeEach` that happens to return some non-`undefined`/non-`null` value for reasons unrelated to teardown (a common pattern: `beforeEach(() => someSetupPromise.then(() => someUnrelatedValue))`) is interpreted differently by Vitest, which treats a hook's return value as a potential teardown function to invoke later. This needs auditing per hook, not assumed compatible.

> *"In Jest hooks are called sequentially (one after another). By default, Vitest runs hooks in a stack. To use Jest's behavior, update `sequence.hooks` option."*

```typescript
// vite.config.ts — restoring Jest's sequential hook ordering during a migration
export default defineConfig({
  test: {
    sequence: { hooks: 'list' }, // Jest-equivalent: declared order, not stack order
  },
});
```

"Stack" ordering means the *last*-registered hook of a given type at a given nesting level runs *first* on teardown-style hooks (`afterEach`/`afterAll`) — the reverse of declaration order — which is a meaningfully different execution order than Jest's straightforward sequential model, and a suite with hooks that have ordering dependencies between them (a common anti-pattern, but a real one in large legacy suites) can start failing in ways that have nothing to do with the tests themselves.

The guide also notes Vitest does not accept `done`-callback-style async tests — a Jest test written as `it('works', (done) => { ...; done(); })` needs converting to `async`/`await` or a returned `Promise`, since Vitest's test function signature has no callback-completion mode.

## Timers — no legacy mode, and a different timeout API

> *"Vitest doesn't support Jest's legacy timers."*

Jest historically shipped two fake-timer implementations — "modern" (based on `@sinonjs/fake-timers`) and a "legacy" one predating it. Vitest's `vi.useFakeTimers()` corresponds to Jest's modern implementation only; a suite still using `jest.useFakeTimers('legacy')` (or relying on the old default before Jest itself switched) has no direct equivalent to migrate to and needs its fake-timer usage rewritten against the modern API's semantics, which is usually a smaller change than it sounds, since Jest's own modern timers were already the default for years before most active codebases would be migrating from.

> If you used `jest.setTimeout`, you would need to migrate to `vi.setConfig`.

```typescript
// Jest
jest.setTimeout(10_000);

// Vitest
import { vi } from 'vitest';
vi.setConfig({ testTimeout: 10_000 });
```

## Snapshots — a different import surface for custom serializers/matchers

> *"Jest imports snapshot composables from `jest-snapshot`. In Vitest, use `Snapshots` from `vitest` instead."*

And for a Vue CLI preset specifically: *"if you previously were using Jest with vue-cli preset, you will need to install `jest-serializer-vue` package, and specify it in `snapshotSerializers`"* — a narrow, framework-specific note, but a real one for any Vue project migrating a snapshot-heavy suite.

## What the migration guide does not cover — and what to check instead

Three things a real Jest migration commonly hits are **not addressed on the official migration page**, confirmed by two direct, targeted fetches of it:

**`moduleNameMapper` versus `resolve.alias`.** Jest's `moduleNameMapper` is a regex-to-path mapping table maintained independently of any bundler config. Vite's `resolve.alias` — which Vitest inherits directly, per **[01](01-vitest-relationship.md)** and **[01a](01a-the-transform-boundary.md)** — replaces it structurally, but the guide gives no explicit translation table between Jest's regex-capture-group mapping style and Vite's alias entries. A `moduleNameMapper` entry using a regex capture group (`'^@components/(.*)$': '<rootDir>/src/components/$1'`) needs to be re-expressed as a `resolve.alias` entry (`{ '@components': path.resolve(__dirname, 'src/components') }`) by hand — this is reasoned from how each system's alias mechanism works, not quoted from a stated equivalence in Vitest's own docs.

**Hoisting mechanism.** Jest's `jest.mock` hoisting is implemented via a Babel transform (`babel-plugin-jest-hoist`) that runs at compile time, ahead of the code being handed to the JS engine at all. Vitest's `vi.mock` hoisting (covered in full in **[01d](01d-mocking.md)**) is Vitest's own static analysis of the module during its transform step, not a Babel plugin. The *visible* behavior — the call moves to the top of the file — is similar enough that most migrated code works unchanged, but the two are genuinely different mechanisms, and edge cases in what each can statically detect (dynamic specifiers, computed factory arguments) are not guaranteed to behave identically. This distinction is not addressed in Vitest's own Jest migration guide; it follows from how each tool is documented to hoist, not from a stated compatibility claim.

**CJS-only test helper files.** A Jest suite using `require()`-based helper files with no ESM equivalent runs under Jest's own CJS-native transform regardless of the project's `type` field. Vitest inherits Vite's ESM-first module handling — a CJS helper file that is *not* inside `node_modules` runs through Vite's transform (per **[01a](01a-the-transform-boundary.md)**), and `deps.interopDefault` (default `true`) covers named-import interop for CJS *dependencies*, but a project's own CJS-authored helper files are a different case the migration guide does not address directly. Treat any lingering `require()`/`module.exports` helper file inside the project's own source (not `node_modules`) as worth converting to `import`/`export` during a migration rather than assuming Vitest's transform handles arbitrary CJS source the same way Jest's did — this has not been separately confirmed here.

## Gotchas

**★ Symptom: a mechanical `jest.mock` → `vi.mock` rename across the codebase leaves some mocked modules returning `undefined` where a value was previously mocked correctly.** Cause: Jest's factory return value becomes the module's default export directly; Vitest requires the factory to return the full shaped object, with `default` named explicitly. Fix: audit every renamed `vi.mock` call whose factory returns a bare value rather than an object, and wrap it.
```javascript
vi.mock('./some-path', () => ({ default: 'hello' }));
```

**★ Symptom: a test that previously relied on Jest auto-mocking a `node_modules` package via a `__mocks__/package-name.js` file now runs the real package's code — a real network call fires, or real filesystem I/O happens, during a "unit" test.** Cause: Vitest does not auto-load `__mocks__` entries without an explicit `vi.mock()` call for that exact specifier — the file existing is not sufficient, unlike Jest. Fix: add the explicit call for every package previously relying on implicit automocking.
```javascript
vi.mock('the-package-name');
```

**★ Symptom: after migration, teardown-style `afterEach` hooks across nested `describe` blocks run in a different order than they did under Jest, and a test that depended on cleanup order starts failing intermittently.** Cause: Vitest's default hook execution is a stack (last-registered-first for teardown-style hooks), while Jest's is strictly sequential in declaration order. Fix: set `sequence.hooks: 'list'` to restore Jest's ordering during the migration, and treat any genuine ordering *dependency* between hooks — rather than the config mismatch — as worth fixing on its own merits afterward.
```typescript
test: { sequence: { hooks: 'list' } }
```

**★ Symptom: a `beforeEach` that used to work under Jest now produces a confusing error, or an unexpected function invocation, after the test that uses it.** Cause: Vitest interprets a non-`undefined`/non-`null` return value from `beforeAll`/`beforeEach` as a teardown function to call later — a Jest hook that happened to return some other value (a promise resolving to unrelated data, for instance) is now misread as teardown logic. Fix: audit every migrated hook's return value and make it explicitly `undefined` unless it is genuinely meant to be a teardown function.

**★ Symptom: `it('does something async', (done) => { ...; done(); })` throws or hangs after migration.** Cause: Vitest's test function signature does not support the Jest/Mocha-style `done` callback for signaling async completion. Fix: convert to `async`/`await` or return a `Promise` directly.
```typescript
it('does something async', async () => {
  await doSomething();
});
```

**★ Symptom: `jest.useFakeTimers('legacy')` (or code relying on Jest's old default fake-timer behavior) has no direct Vitest equivalent to swap in.** Cause: *"Vitest doesn't support Jest's legacy timers"* — only the modern, `@sinonjs/fake-timers`-based implementation has a Vitest counterpart (`vi.useFakeTimers()`). Fix: rewrite the fake-timer usage against the modern API's semantics; most active Jest codebases have been on modern timers as Jest's own default for long enough that this is usually a smaller rewrite than migrating from a genuinely legacy pattern.

**★ Symptom: a `moduleNameMapper` regex entry with a capture group has no obvious `resolve.alias` equivalent, and the migrated alias silently fails to match some import paths.** Cause: Jest's `moduleNameMapper` is regex-based and supports capture-group substitution; Vite's `resolve.alias` matches on exact prefixes or full specifiers, not arbitrary regex. Fix: translate each `moduleNameMapper` regex entry to the corresponding prefix-style `resolve.alias` entry by hand — there is no automatic converter, and the migration guide does not address this mapping directly, so each entry needs manual verification against the actual import paths it is meant to catch.

**★ Symptom: a project's own CJS-authored helper file (not a `node_modules` dependency) behaves differently under Vitest than it did under Jest — an import that resolved fine in Jest now errors or resolves an unexpected shape.** Cause: Vitest inherits Vite's ESM-first transform pipeline for project source; Jest's CJS-native transform handled `require()`/`module.exports` files without needing any interop step, because Jest itself is CJS by default. Fix: convert lingering CJS-authored source-level helper files to `import`/`export` syntax as part of the migration, rather than relying on either tool's interop layer to paper over a source file that predates the switch to Vite/Vitest.

## Interview questions

**★ Why does a large-scale `jest.mock` → `vi.mock` find-and-replace look like it worked, and then produce `undefined` failures scattered through the test run?**
Because the two APIs have the same call signature but a different factory-return contract: Jest treats the factory's return value as the module's default export directly, while Vitest requires the factory to return the module's full export shape, with `default` as an explicit key. A mechanical rename does not change the factory body, so every `jest.mock('./x', () => someValue)` becomes a `vi.mock` call whose factory still returns a bare value — which Vitest then treats as the entire module object having no properties at all, so any named or default import from that mocked module reads as `undefined`.

**★ A migrated suite starts failing intermittently in ways that look like flaky ordering, specifically around cleanup logic in nested `describe` blocks. What's the first thing to check, and why?**
The `sequence.hooks` setting, because Vitest's default hook execution model is a stack — the most recently registered hook of a given teardown type runs first — while Jest runs hooks strictly in declaration order. A suite with any implicit ordering dependency between multiple `afterEach`/`afterAll` hooks at the same nesting level (a common pattern in large, long-lived Jest suites, even if not a best practice) will behave differently under Vitest's default without any code change at all, purely because of this ordering-model mismatch — and it is worth checking before assuming the tests themselves have a genuine race condition.

**★ Why doesn't `deps.interopDefault` (default `true`, covered in 01a) fully solve CJS-compatibility problems during a Jest-to-Vitest migration?**
Because `deps.interopDefault` specifically addresses named-import interop for CJS *dependencies* resolved from `node_modules` — it lets `import { x } from 'a-cjs-package'` work against a package that only defines `module.exports = { x }`. It says nothing about a project's *own* source-level helper files that were authored as CJS (`require`/`module.exports`) and live outside `node_modules`, which go through Vite's ESM-first transform pipeline for project source rather than the dependency-externalization path `interopDefault` governs. Those files need converting to `import`/`export` directly; there is no equivalent "interop for my own CJS source" switch documented for Vitest the way there is for CJS dependencies.

**★ Why does Vitest's Jest migration guide not mention `moduleNameMapper` at all, given how central it is to most real Jest configs?**
Because the two tools solve the aliasing problem at structurally different layers: Jest's `moduleNameMapper` is a Jest-specific, regex-based mapping table that exists because Jest has no underlying bundler config to read aliases from — it has to reimplement alias resolution itself. Vitest has no equivalent concept to document, precisely because it does not need one: it inherits `resolve.alias` directly from the same `vite.config.ts` the app already uses, per the shared-config model covered in **[01](01-vitest-relationship.md)**. The migration work is not "learn Vitest's `moduleNameMapper` equivalent" — it is "delete the Jest-specific alias table entirely and make sure the same aliases already exist in `resolve.alias`," which is a smaller, structurally different task the guide has no reason to frame as a feature-by-feature translation.

---

← [01h · CI, pool, and reporters](01h-ci-execution-and-reporters.md) · [Vite overview](../../README.md) · Next → [01 · base and the deploy path](../15-deployment-considerations/01-shipping-the-build.md)
