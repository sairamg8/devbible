---
title: "vi.mock is hoisted above every import in the file, which is why a mock factory cannot close over an outer variable, and Vitest 5 now throws instead of warning when it is called somewhere hoisting cannot reach"
sidebar_label: "01d · Mocking under a shared pipeline"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the Vitest documentation — [`vi` API reference](https://vitest.dev/api/vi.html), [Mocking Modules guide](https://vitest.dev/guide/mocking/modules), [Mocking guide](https://vitest.dev/guide/mocking.html), [Vitest 5.0 migration guide](https://vitest.dev/guide/migration.html). Documentation-validated; **no sandbox run**. Target: **Vitest 5.0.0 · Vite 8.2.2**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ Every `vi.mock` call runs before every import in the file, no exceptions

**`vi.mock` looks like an ordinary function call sitting wherever you put it in the file, and it is not one — Vitest statically hoists it, along with `vi.unmock` and `vi.hoisted`, to the very top of the module, above every `import` statement, before any of them execute.** That single mechanical fact explains why a mock factory cannot reference a variable declared earlier in the same file, why `vi.hoisted` exists as an escape hatch, and — new in Vitest 5 — why calling either of them somewhere hoisting genuinely cannot reach it is now a hard error instead of a warning.

## The hoisting warning, taken literally

> *"Don't forget that a `vi.mock` call is hoisted to top of the file. It will always be executed before all imports."* — [Mocking guide](https://vitest.dev/guide/mocking.html)

```typescript
import { getUser } from './api/users';
import { vi, test, expect } from 'vitest';

vi.mock('./api/users'); // ← this line runs FIRST, before the import above it does
```

Vitest rewrites the module at load time so that every `vi.mock`/`vi.unmock`/`vi.hoisted` call moves to the top, in source order relative to each other, ahead of the `import` statements the file appears to list first. This is what makes `vi.mock('./api/users')` intercept the very `import { getUser }` written above it — by the time that import actually resolves, the mock is already registered.

## Why a factory cannot close over an outer variable

Because the mock call executes *before* the rest of the file's top-level code — including variable declarations that textually precede it — any reference to those variables inside the factory tries to read something that has not been initialized yet:

```typescript
import { vi } from 'vitest';

const mockedFetch = vi.fn(); // declared here...

vi.mock('./api/client', () => ({
  fetchUser: mockedFetch, // ...but the factory runs BEFORE this line, per hoisting
}));
```

> *"This also means that you cannot use any variables inside the factory that are defined outside the factory."* — [`vi` API reference](https://vitest.dev/api/vi.html)

The real error string the docs quote for exactly this mistake:

> `Cannot access '__vi_import_0__' before initialization`

That message names an internal hoisting variable, not `mockedFetch` — which is itself a clue this is a hoisting-order problem and not a typo in the mock, the first time someone hits it.

## `vi.hoisted` — declaring the value where hoisting can see it

> *"All static `import` statements in ES modules are hoisted to the top of the file, so any code that is defined before the imports will actually be executed after imports are evaluated."* — [`vi` API reference](https://vitest.dev/api/vi.html)

`vi.hoisted` sidesteps the ordering problem by being hoisted itself, to the same place `vi.mock` calls move to — so a value it produces is guaranteed to exist by the time any `vi.mock` factory runs.

```typescript
// function hoisted<T>(factory: () => T): T
import { vi, test, expect } from 'vitest';

const { mockedMethod } = vi.hoisted(() => {
  return { mockedMethod: vi.fn() };
});

vi.mock('./path/to/module.js', () => {
  return { originalMethod: mockedMethod };
});
```

The fix is not "move the mock call" — hoisting already moved it as far as it can go. The fix is to move the *value's creation* into something that hoists alongside it.

## Mocking a module resolved through `resolve.alias`

`vi.mock`'s first argument is a module specifier, matched the same way an `import` in that file would resolve it — which means an aliased import can be mocked by the alias, not by chasing down the real path it points to:

```typescript
// vite.config.ts
export default defineConfig({
  resolve: { alias: { '@/api': './src/api' } },
});

// a-test-file.test.ts
import { vi, test } from 'vitest';
vi.mock('@/api/users'); // matches the ALIAS, resolved the same way the app resolves it
```

For a specifier that has no real file on disk for Vitest to find (a virtual module, or a package name you want redirected wholesale rather than partially mocked), the documented mechanism is Vitest's own `test.alias` list, which feeds the same resolver `vi.mock` and every real `import` in the test use:

```typescript
// vitest.config.ts — verbatim pattern from the Mocking Modules guide
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    alias: {
      vscode: resolve(import.meta.dirname, './mock/vscode.js'),
    },
  },
});
```

> *"To redirect the import, use `test.alias` config option"* — [Mocking Modules guide](https://vitest.dev/guide/mocking/modules)

Whether `test.alias` needs its own duplicate entries for aliases already declared in `resolve.alias`, or whether it inherits them, is **not something the fetched documentation settles either way** — treat the two lists as independent until confirmed, and do not assume one covers the other without checking against the installed version.

## `__mocks__` resolution

> *"If the file `./__mocks__/example.js` exists, then Vitest will load it instead"* when `vi.mock('./example.js')` is called without a factory function — the on-disk mock file substitutes for the real module, keyed by the module's own relative path.

```text
src/
├── api/
│   ├── users.ts
│   └── __mocks__/
│       └── users.ts       ← loaded automatically when vi.mock('./users') has no factory
└── users.test.ts
```

## Vitest 5.0 — hoisting misuse now throws

> *"`vi.mock`, `vi.unmock`, and `vi.hoisted` are hoisted to the top of the file and run before any surrounding code. Calling them inside a function, block, or `describe`/`test` callback previously only logged a warning. Vitest 5.0 now throws, because the call does not execute where it is written."* — [Vitest 5.0 migration guide](https://vitest.dev/guide/migration.html)

```typescript
// ❌ Vitest 4 and earlier: a logged warning, and the mock probably didn't do what
// the surrounding code implies. Vitest 5: this now THROWS.
describe('UserProfile', () => {
  if (someCondition) {
    vi.mock('./api/users'); // conditional/nested placement — hoisting can't honour this
  }
  // ...
});

// ✅ CORRECT: unconditional, top-level placement — matches where hoisting actually
// moves the call to, regardless of where it's textually written.
vi.mock('./api/users');

describe('UserProfile', () => {
  // ...
});
```

## `clearMocks` now defaults to `true`

> *"`clearMocks` now defaults to `true`: Vitest calls `vi.clearAllMocks()` before every test, clearing the recorded history of every mock while leaving implementations intact."* — [Vitest 5.0 migration guide](https://vitest.dev/guide/migration.html)

This clears call history (`.mock.calls`, `.mock.results`) between tests automatically — it does **not** reset a mock's configured implementation or return value; a `vi.fn().mockReturnValue(...)` set up once still returns that value on the next test. A suite that relied on the pre-5.0 default (no automatic clearing) and asserted on cumulative call counts across tests in the same file needs those assertions rewritten per-test, or the option explicitly turned back off:

```typescript
// vitest.config.ts — restoring the pre-5.0 behavior, if a suite genuinely depends on it
export default defineConfig({
  test: { clearMocks: false },
});
```

The fetched migration text does not state the current defaults for the related `mockReset` and `restoreMocks` options — do not assume either changed alongside `clearMocks` without checking the config reference for each directly.

## Gotchas

**★ Symptom: `Cannot access '__vi_import_0__' before initialization` on a `vi.mock` call.** Cause: the factory references a variable declared earlier in the same file — but `vi.mock` calls are hoisted above *all* top-level code, including that declaration, so at the moment the factory actually runs, the variable does not exist yet. Fix: create the value inside `vi.hoisted`, which is hoisted to the same place.
```typescript
const { mockedMethod } = vi.hoisted(() => ({ mockedMethod: vi.fn() }));
vi.mock('./module.js', () => ({ originalMethod: mockedMethod }));
```

**★ Symptom: a `vi.mock` call placed inside a `describe` block, or behind an `if`, used to log a warning and now hard-fails the test file.** Cause: Vitest 5.0 changed this from a warning to a thrown error — *"Calling them inside a function, block, or `describe`/`test` callback previously only logged a warning. Vitest 5.0 now throws"* — because hoisting moves the call regardless of where it is written, so the conditional/nested placement was always misleading, and it is now enforced. Fix: move the call to the top level of the file, unconditionally.

**★ Symptom: a suite upgraded to Vitest 5 starts failing assertions that count cumulative mock calls across multiple tests in one file.** Cause: `clearMocks` now defaults to `true`, so `vi.clearAllMocks()` runs before every test, resetting call history the old suite assumed would persist. Fix: either rewrite the assertions to be per-test (the more correct fix, since cross-test mock-count coupling is usually a smell), or set `clearMocks: false` explicitly to restore the old behavior for a suite not ready to be refactored.

**★ Symptom: `vi.mock('some-name')` with no factory does nothing, and the real module still runs.** Cause: automatic `__mocks__` substitution only applies to a relative or aliased module path Vitest can resolve to a real file next to which a `__mocks__` sibling exists — it is not automatic for arbitrary bare package names the way Jest's `node_modules`-level auto-mocking can be, and the Vitest documentation is explicit that, unlike Jest, `<root>/__mocks__` entries for packages are "not loaded unless `vi.mock()` is called" for that exact specifier. Fix: call `vi.mock('some-name')` explicitly for every module that should be substituted, even when a `__mocks__` file already exists for it.

**★ Symptom: mocking a module through its alias (`vi.mock('@/api/users')`) fails to intercept the real import, even though the alias resolves correctly elsewhere.** Cause: `vi.mock`'s specifier must match, exactly, however the *test file's own imports* resolve that module — if the alias is defined only in `resolve.alias` and the test imports the real relative path in one place and the alias in another, `vi.mock` only intercepts the form it was called with. Fix: call `vi.mock` with the same specifier form (alias or relative path) that the code under test actually uses to import it, and keep the two consistent within a file.

**★ Symptom: a virtual or non-file module needs to be entirely swapped for a mock, and there is no real path to put a `__mocks__` sibling next to.** Cause: the `__mocks__` convention needs a real file location to sit adjacent to; a bare package name resolved through node's module resolution, or a genuinely virtual specifier, has none. Fix: redirect the specifier with Vitest's own `test.alias`, pointing it straight at a mock file.
```typescript
test: { alias: { vscode: resolve(import.meta.dirname, './mock/vscode.js') } }
```

## Interview questions

**★ Why does `vi.mock('./api/users')` intercept an `import` statement written *above* it in the same file?**
Because Vitest statically hoists every `vi.mock`, `vi.unmock`, and `vi.hoisted` call to the very top of the module before any code — including the file's own `import` statements — actually executes. Source order between the mock call and the import it appears to follow is irrelevant to execution order; hoisting moves the mock registration ahead of every import resolution in the file, which is precisely what lets it intercept an import that was textually written first.

**★ Why can't a `vi.mock` factory reference a `const` declared earlier in the same file, and what actually fixes it?**
Because hoisting moves the mock call above that declaration too — by the time the factory body runs, the `const` has not been initialized, producing `Cannot access '<name>' before initialization`. The fix is not reordering the file (hoisting already puts the mock call first, regardless of where it is written) — it is wrapping the value's creation in `vi.hoisted`, which is hoisted to the same location as `vi.mock`, guaranteeing it exists by the time any mock factory runs.

**★ What changed about placing `vi.mock` inside a `describe` block between Vitest 4 and Vitest 5, and why was the old behavior a trap rather than a convenience?**
In Vitest 4 and earlier, a `vi.mock` call nested inside a `describe`/`test` callback, or behind a conditional, only logged a warning and kept running — but hoisting still moved the underlying registration to the top of the file regardless of where it was textually placed, so the nesting or condition was cosmetic and misleading: the mock applied unconditionally and to the whole file, not scoped to the block it appeared to live in. Vitest 5.0 turns that mismatch into a thrown error instead of a silent, misleading warning, because the call genuinely cannot execute where it is written.

**★ What does `clearMocks: true` (the Vitest 5 default) actually reset, and what does it leave alone?**
It calls `vi.clearAllMocks()` before every test, which clears each mock's recorded call history — `.mock.calls`, `.mock.results` — but leaves the mock's configured implementation and return value intact. A test asserting "this mock was called with these arguments" needs to account for history resetting every test; a test relying on `mockReturnValue` or a custom implementation set up once outside the test body is unaffected, because that configuration is not what `clearMocks` touches.

**★ Given that `vi.mock` reads a package name the same way a real `import` would, how does a monkeypatch for a bare specifier with no file on disk (a virtual module, a package you want to fully replace) actually get intercepted?**
Not through the `__mocks__` convention, which needs a real file path to sit a sibling directory next to — it goes through Vitest's own `test.alias` config, which redirects the specifier itself to a mock file before resolution ever happens. Because `test.alias` feeds the same resolver both real imports and `vi.mock` calls use, redirecting the specifier there makes every reference to that name — mocked or not — resolve to the substitute file, which is the correct tool specifically for names that resolution can find but that have no natural home for a `__mocks__` sibling.

---

← [01c · Browser Mode](01c-browser-mode.md) · [Vite overview](../../README.md) · Next → [01e · setupFiles vs globalSetup](01e-setup-and-teardown.md)
