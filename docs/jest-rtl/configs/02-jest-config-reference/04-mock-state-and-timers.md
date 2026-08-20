---
title: "Mock state and timers"
sidebar_label: "04 · Mock state and timers"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-20 against the [Jest configuration reference](https://jestjs.io/docs/configuration)
> (`clearMocks`, `resetMocks`, `restoreMocks`, `resetModules`, `automock`, `fakeTimers`,
> `testTimeout`) and the [Jest mock function API](https://jestjs.io/docs/mock-function-api).
> **No sandbox, no console blocks.**

**A test that passes alone and fails in the suite is a state-leak, and the config decides
what leaks.** Three options here have names so similar that people set all three "to be
safe" — which is itself a bug, because one of them destroys mock implementations.

---

## The three flags, and why they are not the same

| Option | Default | Calls | Wipes calls? | Wipes implementation? | Restores original? |
|---|---|---|---|---|---|
| `clearMocks` | `false` | `mockClear()` | ✅ | ❌ | ❌ |
| `resetMocks` | `false` | `mockReset()` | ✅ | 🔴 **yes** | ❌ |
| `restoreMocks` | `false` | `mockRestore()` | ✅ | ✅ | 🔴 **yes** — spies only |

Each runs **before every test**.

### What each one costs you

```ts
const getUser = jest.fn().mockReturnValue({ id: 1 });   // module scope

test('a', () => expect(getUser().id).toBe(1));          // ✅
test('b', () => expect(getUser().id).toBe(1));          // ❌ under resetMocks
```

🔴 **`resetMocks: true` throws away `mockReturnValue`.** In test `b` the mock returns
`undefined` and the failure — *"Cannot read properties of undefined"* — points at your
component, not at the config. This is the single most confusing setting in Jest, because
the option sounds like the safe one.

### What to actually set

```js
{
  clearMocks: true,     // ✅ call history resets — what you almost always want
  restoreMocks: true,   // ✅ jest.spyOn originals restored — prevents cross-file leaks
  // resetMocks: false  // 🔴 leave off unless every implementation is set inside a test
}
```

`restoreMocks` is the underrated one. Without it, a `jest.spyOn(console, 'error')` in one
file stays installed for the rest of the worker's files, and the eventual failure lands
somewhere unrelated.

⚠️ **`restoreMocks` only affects spies created with `jest.spyOn`.** A standalone
`jest.fn()` has no original to restore, so it is untouched by it.

---

## `resetModules` and `automock`

| Option | Default | What it does |
|---|---|---|
| `resetModules` | `false` | Fresh module registry before each test — every import re-evaluated |
| `automock` | `false` | Auto-mocks **every** import. Effectively never used |

`resetModules: true` is the fix for module-level state — a singleton, a cached client, a
`let` initialised once at import. It is also **slow**, because nothing is cached between
tests. Prefer the targeted form inside the one file that needs it:

```ts
beforeEach(() => {
  jest.resetModules();
});
```

🔴 **`automock: true` is a trap on any real project.** It mocks your dependencies *and*
your own modules, so nothing behaves and every test needs an explicit
`jest.unmock`. Mock deliberately instead.

---

## Timers

| Option | Default |
|---|---|
| `fakeTimers` | `{ enableGlobally: false }` |
| `testTimeout` | `5000` (ms) |

Since Jest 27 the **modern** implementation (backed by `@sinonjs/fake-timers`) is the
default. Enable globally, or per file:

```js
// jest.config.ts — global
fakeTimers: {
  enableGlobally: true,
  doNotFake: ['nextTick'],       // leave some real
},
```

```ts
// per file — usually better
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());   // 🔴 never omit this
```

### 🔴 Fake timers and `user-event` deadlock

This is the classic, and it looks like a hang rather than an error:

```ts
// ❌ user-event's internal delay never advances — the test times out
jest.useFakeTimers();
await userEvent.click(button);
```

`user-event` v14 awaits real timers between its synthetic events. With timers faked and
nothing advancing them, it waits forever. **The fix is to tell it which clock to use:**

```ts
// ✅
const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
await user.click(button);
```

The same applies to RTL's `waitFor`, which polls on a timer. Covered from the RTL side in
**04 · RTL configuration** *(not written yet)*.

⚠️ **Always restore real timers in `afterEach`.** Fake timers leak to the next file in the
same worker, and the resulting failure has no visible connection to the file that caused
it.

⚠️ **`testTimeout: 5000` interacts badly with faked timers** — the timeout is measured on
a clock you may have frozen. A test that "hangs" for exactly five seconds and then fails
is nearly always this.

---

## Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| Mock returns `undefined` in the second test only | `resetMocks: true` wiped `mockReturnValue` | Turn it off; use `clearMocks` |
| A spy stays installed across files | `restoreMocks` off, so `mockRestore` never ran | `restoreMocks: true` |
| `restoreMocks` does not restore a `jest.fn()` | Only `jest.spyOn` spies have an original | Not a bug — set implementations per test |
| Test passes alone, fails in the suite | Module-level state persisting | `jest.resetModules()` in that file |
| Everything mocked, nothing works | `automock: true` | Turn it off and mock deliberately |
| `await user.click()` never resolves | Fake timers with no `advanceTimers` bridge | `userEvent.setup({ advanceTimers: jest.advanceTimersByTime })` |
| `waitFor` times out with the element visibly present | Same cause — its polling clock is frozen | Same fix |
| A later file behaves strangely for no reason | Fake timers leaked; no `jest.useRealTimers()` | Restore in `afterEach` |
| Test fails at exactly 5000 ms | `testTimeout` against a frozen clock | Advance the timers, or raise the timeout for that test |
| Every test slowed after enabling `resetModules` globally | The module registry is rebuilt per test | Scope it to the one file that needs it |

---

## Interview questions

**Q. Difference between `mockClear`, `mockReset` and `mockRestore`?**
`mockClear` wipes call history. `mockReset` also removes the implementation and return
values. `mockRestore` does both and reinstates the original — meaningful only for
`jest.spyOn`.

**Q. Which config flags would you turn on?**
`clearMocks` and `restoreMocks`. `resetMocks` only if every implementation is set inside
a test, because it destroys module-scope `mockReturnValue` setups.

**Q. A mock works in the first test and returns `undefined` afterwards.**
`resetMocks: true` cleared the implementation between tests. The failure surfaces in the
component, which is why it misleads.

**Q. Why does `restoreMocks` matter for isolation?**
Without it, a `jest.spyOn` remains installed for the rest of the worker's files, so a
later, unrelated test fails.

**Q. When is `resetModules` the right tool?**
When a module holds state at import scope — a singleton client or an initialised `let`.
Scope it to the file that needs it; globally it is a large speed cost.

**Q. Why is `automock` effectively unusable?**
It mocks your own modules too, so nothing behaves and you spend the config's savings on
`jest.unmock` calls.

**Q. `await userEvent.click()` hangs under fake timers. Why, and the fix?**
`user-event` v14 awaits between synthetic events on a clock that is frozen. Bridge it:
`userEvent.setup({ advanceTimers: jest.advanceTimersByTime })`.

**Q. Why restore real timers in `afterEach`?**
Fake timers persist within a worker process, so the leak surfaces in a later file with no
obvious connection to its cause.

**Q. A test fails at exactly the timeout with fake timers on.**
The timeout is measured against the frozen clock. Advance the timers explicitly, or set a
per-test timeout.

---

← **Prev:** [03 · Module resolution](./03-module-resolution.md) ·
**Next:** [05 · Coverage](./05-coverage.md)
