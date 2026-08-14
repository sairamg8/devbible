---
title: "Testing a custom hook"
sidebar_label: "11 · Testing a custom hook"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — React Testing
> Library's [`renderHook` API](https://testing-library.com/docs/react-testing-library/api/)
> and react.dev [`act`](https://react.dev/reference/react/act).
> **No test suite was executed for this page** — the API contracts are quoted and the
> examples are written against them. There are no console blocks.
> No sandbox script backs this page; claims are cited, not measured.

**React Testing Library ships `renderHook` and then tells you to prefer not using it.
That sentence is the whole topic: a hook has no behaviour of its own, so the honest
subject of a test is a component that uses it.**

## The recommendation, from the library that provides the tool

> `renderHook` … "This is a convenience wrapper around `render` with a **custom test
> component**."

> **You should prefer `render` since a custom test component results in more readable and
> robust tests.**

That is RTL's own guidance about its own API, and the reasoning follows from everything
in this phase. A custom hook is not a unit with independent behaviour — it is code that
runs inside a component and takes slots in that component's hook list
([Phase 7 · 05 · 01](05-why-the-rules-exist/01-the-array-and-the-index.md)). Testing it in
isolation means testing it in a component you invented, so you may as well invent a
component that resembles the real caller and assert on what the user would see.

## The two shapes

**A harness component — the default.**

```jsx
function Harness({ delay }) {
  const [text, setText] = useState('');
  const debounced = useDebouncedValue(text, delay);
  return (
    <>
      <input value={text} onChange={(e) => setText(e.target.value)} />
      <output>{debounced}</output>
    </>
  );
}

test('only the last value in a quiet period is published', async () => {
  render(<Harness delay={300} />);
  await user.type(screen.getByRole('textbox'), 'abc');
  expect(screen.getByRole('status')).toHaveTextContent('');   // nothing yet
  act(() => vi.advanceTimersByTime(300));
  expect(screen.getByRole('status')).toHaveTextContent('abc'); // once, not three times
});
```

The assertion is about what is *rendered*, which is what the hook exists to affect. The
test survives the hook being reimplemented on `useDeferredValue`, on a store, or with a
different return shape — the rewrite-without-touching-callers property from
[Phase 7 · 06 · 02](06-designing-a-hooks-api/02-the-return-value-and-the-seam.md), applied
to tests.

**`renderHook` — when the hook's contract really is its return value.**

```typescript
function renderHook<Result, Props>(
  render: (initialProps: Props) => Result,
  options?: RenderHookOptions<Props>
): RenderHookResult<Result, Props>
```

What you get back:

> **`result.current`**: "Holds the value of the most recently **committed** return value
> of the render-callback"
>
> **`rerender`**: "Renders the previously rendered render-callback with the new props"
>
> **`unmount`**: "Unmounts the test hook"

And the two options that matter:

> **`initialProps`**: "Declares the props that are passed to the render-callback when
> first invoked"
>
> **`wrapper`**: A component to wrap the hook for providing context/providers

`wrapper` is the one that makes `renderHook` genuinely useful: a hook that reads context
([Phase 7 · 03 · 03](03-share-logic-not-state/03-when-you-wanted-shared-state.md)) needs a
provider above it, and `wrapper` is how you supply one without building a tree.

## 🔴 `result.current` is a snapshot, and destructuring it is the classic bug

Read the definition again: *the most recently **committed** return value*. `result` is a
stable box; `result.current` is replaced after each commit.

```jsx
// 🔴 stale — `toggle` and `on` are frozen at the first commit
const { result } = renderHook(() => useToggle(false));
const [on, toggle] = result.current;
act(() => toggle());
expect(on).toBe(true);        // fails: `on` is still the first render's value
```

```jsx
// ✅ read through result.current every time
const { result } = renderHook(() => useToggle(false));
act(() => result.current[1]());
expect(result.current[0]).toBe(true);
```

This is the same snapshot semantics as state itself
([Phase 3 · 02](../phase-3-state/02-state-is-a-snapshot.md)) — destructuring captures the
value from one render, and the test then asserts against a value that was never going to
change. It is by far the most common way a `renderHook` test is wrong while looking right.

## `act`, and the two rules that come with it

> `act` is a **test helper to apply pending React updates before making assertions.**

> When writing UI tests, tasks like rendering, user events, or data fetching can be
> considered as "units" of interaction with a user interface. React provides a helper
> called `act()` that makes sure **all updates related to these "units" have been
> processed and applied to the DOM before you make any assertions.**

**Rule 1 — prefer the async form.**

> We recommend using `act` with **`await` and an `async` function**. Although the sync
> version works in many cases, **it doesn't work in all cases** and due to the way React
> schedules updates internally, **it's difficult to predict when you can use the sync
> version. We will deprecate and remove the sync version in the future.**

So `await act(async () => { … })` is the form to write by default, and a sync `act(() =>
…)` is a shortcut that will eventually stop being available.

**Rule 2 — the environment flag.**

> Using `act` requires setting **`global.IS_REACT_ACT_ENVIRONMENT=true`** in your test
> environment. This is to ensure that `act` is only used in the correct environment.

RTL sets this up for you and re-exports the helper:

> All it does is forward all arguments to the `act` function if your version of react
> supports `act`. **It is recommended to use the import from `@testing-library/react`
> over `react`** for consistency reasons.

Take that literally — import `act` from `@testing-library/react`, not from `react`.

## What to actually assert

The useful tests for a custom hook are the **gotchas**, because those are the behaviours a
reimplementation could plausibly lose. Everything in
[Phase 7 · 07](07-the-standard-set/README.md) suggests its own test:

| Hook | The test worth writing |
|---|---|
| `useToggle` | Two toggles in one act block flip twice — proves the updater form |
| `useDebouncedValue` | Three rapid changes publish **once** — proves the `clearTimeout` |
| `usePrevious` | An unrelated re-render does **not** change "previous" — proves it tracks values, not renders |
| `useLocalStorage` | Two components rendered together both update after one writes |
| `useEventListener` | A re-render of the caller does not re-attach — assert `addEventListener` call count |
| `useInterval` | Ticks read current state after an update, and `unmount` stops the timer |
| Any hook with cleanup | `unmount()` releases what setup acquired |

Note how many of those are **negative** assertions — *did not* re-subscribe, *did not*
publish three times. That is not incidental: the bugs this phase is about are all
"something happened more often than it should have", and only a counting assertion
catches them.

## What not to test

- **The return shape as an implementation detail.** Asserting `result.current` is a
  two-element array locks in a decision
  ([Phase 7 · 06 · 02](06-designing-a-hooks-api/02-the-return-value-and-the-seam.md)) that
  should be free to change.
- **That it calls `useState`.** Mocking React's hooks to assert they were called tests
  React, not you, and breaks on every refactor.
- **A hook with no logic.** A `useState` wrapper has nothing to verify; the test is as
  trivial as the hook, and both should probably be deleted
  ([Phase 7 · 12](12-extracting-too-early.md)).

## Two things that will bite

**`StrictMode` in the test tree.** If your app renders under `StrictMode`, test under it
too — otherwise the double-invocation class of bug
([Phase 4 · 05](../phase-4-effects/05-strictmode-double-invocation.md)) is exactly the
class your tests cannot see. A hook whose test passes only outside `StrictMode` has a
cleanup bug, and production is the wrong place to find that out.

**Fake timers and `act` interact.** Advancing timers triggers state updates, so the
advance has to happen inside `act` or React will warn that an update was not wrapped —
that warning is the `act` contract being enforced, not noise to suppress.

## Gotchas

**Symptom:** a `renderHook` assertion fails even though the hook works in the app.
**Cause:** `result.current` was destructured once; it holds the most recently *committed*
value and the local variables are frozen at the first commit.
**Fix:** read through `result.current` at every assertion.

**Symptom:** "An update to X inside a test was not wrapped in act(...)".
**Cause:** something updated state outside an `act` block — commonly a fake-timer advance
or a resolved promise.
**Fix:** wrap the triggering call. Prefer `await act(async () => …)`.

**Symptom:** `act` throws about the environment.
**Cause:** `global.IS_REACT_ACT_ENVIRONMENT` is not set.
**Fix:** set it in the global test setup, or use RTL's re-exported `act`, which is the
recommended import anyway.

**Symptom:** the sync `act` works locally and fails in CI or after an upgrade.
**Cause:** the sync form does not work in all cases and is slated for removal.
**Fix:** the async form.

**Symptom:** tests pass and `StrictMode` breaks the feature in the app.
**Cause:** the test tree does not use `StrictMode`, so double invocation is untested.
**Fix:** render tests the way the app renders.

**Symptom:** a refactor that changes nothing user-visible breaks twenty tests.
**Cause:** the tests assert on the hook's return shape rather than on behaviour.
**Fix:** a harness component and assertions on rendered output — RTL's own
recommendation.

## Interview questions

**★ How do you test a custom hook?**
Preferably by not testing it in isolation. React Testing Library provides `renderHook`
and then recommends `render` instead, because a custom test component produces more
readable and robust tests — and a hook has no behaviour of its own, since it runs inside a
component and takes slots in that component's hook list. Write a small harness component
that uses the hook the way a real caller would, and assert on what is rendered.

**★ When is `renderHook` the right tool?**
When the hook's contract genuinely is its return value rather than any rendered output —
and especially when you need its `wrapper` option to supply a context provider the hook
reads. It gives you `result.current`, `rerender` for new props, and `unmount` for testing
cleanup.

**★ What is the classic `renderHook` mistake?**
Destructuring `result.current` into local variables. It holds the most recently
*committed* return value, so the locals are frozen at the first commit and every later
assertion checks a value that was never going to change — the same snapshot semantics as
state itself. Read through `result.current` at each assertion instead.

**★ What are the rules for `act` in these tests?**
Prefer the async form: React recommends `await act(async () => …)` because the sync
version does not work in all cases, is hard to predict, and will be deprecated and
removed. And `act` requires `global.IS_REACT_ACT_ENVIRONMENT = true` in the test
environment — RTL sets that up and re-exports `act`, which is the recommended import.

**What should a hook's tests actually assert?**
Its gotchas, and usually as counting or negative assertions: three rapid changes publish
once (the debounce cleanup), two toggles in one act flip twice (the updater form), a
re-render does not re-attach a listener, `unmount` releases what setup acquired. The bugs
this phase is about are all "that happened more often than it should have", which only a
count catches.

**Should tests run under `StrictMode`?**
If the app does, yes. Otherwise the double-invocation class of bug is precisely the class
the suite cannot see, and a hook whose tests pass only outside `StrictMode` has a cleanup
bug you will meet in production instead.

---

← Prev: [`use` breaks the rule on purpose](10-use-breaks-the-rule.md) ·
Index: [Phase 7](README.md) ·
Next → [Extracting too early](12-extracting-too-early.md)
