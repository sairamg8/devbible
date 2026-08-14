---
title: "Testing hooks"
sidebar_label: "09 · Testing hooks"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **RTL 16.x** and **React 19.2**, from documentation —
> [RTL · API](https://testing-library.com/docs/react-testing-library/api): `renderHook`'s
> options (`initialProps`, `wrapper`) and return value (`result.current`, `rerender`,
> `unmount`), and the explicit recommendation *"You should prefer `render` since a custom
> test component results in more readable and robust tests since the thing you want to test
> is not hidden behind an abstraction."*
> No sandbox script backs this page; claims are cited, not measured.

`renderHook` exists, it works, and **the documentation recommends against reaching for it
first.** That sentence is the whole topic: a hook is not a feature, it is a piece of one, and
the readable test is usually of the component that uses it.

## The default: test the hook through a component

```jsx
// the hook
function useDebouncedSearch(query, delay = 300) { /* … */ }

// the test — through the component that consumes it
test("searches after the user stops typing", async () => {
  const user = userEvent.setup();
  render(<SearchBox />);

  await user.type(screen.getByRole("searchbox", { name: /search/i }), "lovelace");

  expect(await screen.findByRole("listitem", { name: /Ada Lovelace/ })).toBeInTheDocument();
});
```

This is the docs' argument made concrete: nothing is hidden behind an abstraction. It proves
the hook debounces, that the component wires it to the input, that the result renders, and
that the whole path works — which is what "the search works" means. A `renderHook` test of the
same hook proves that a value changed, and leaves the wiring untested.

**The rule of thumb:** if the hook is used by exactly one component, or by components you
already test, test it through them.

## When `renderHook` is the right tool

It earns its place when there is no single natural consumer:

- **A published or shared hook** — a design-system or internal-library hook used by many
  teams. Its consumers are unknown, so it is the unit.
- **A large API surface** — a hook returning six functions with edge cases that would need a
  contrived component exercising each one.
- **Behaviour with no visual consequence** — a cache eviction, a retry counter, a
  subscription cleaning itself up.
- **A regression test** for a bug that lives in the hook itself.

```jsx
const { result, rerender, unmount } = renderHook(
  ({ delay }) => useDebouncedValue("a", delay),
  { initialProps: { delay: 300 } },
);

expect(result.current).toBe("a");
rerender({ delay: 500 });          // new props, same hook instance
unmount();                          // asserts cleanup runs
```

| Piece | What it is for |
|---|---|
| `result.current` | the hook's latest return value — **read it fresh every time** |
| `rerender(props)` | re-render with new props, for testing reaction to a prop change |
| `unmount()` | teardown, which is how you test that a subscription or timer is cleaned up |
| `initialProps` | the first props passed to the callback |
| `wrapper` | providers the hook needs — the same option `render` takes ([topic 10](10-wrappers-and-providers.md)) |

## Updating state inside a hook test

There is no component and no UI, so state changes are driven directly — and because they
happen outside React's own event handling, this is one of the few places `act` is genuinely
yours to call ([topic 05](05-async-testing-and-act/README.md)):

```jsx
const { result } = renderHook(() => useCounter());

await act(async () => {
  result.current.increment();
});

expect(result.current.count).toBe(1);
```

🔴 **`result.current` is a snapshot, not a live binding.** This is the mistake everyone makes
once:

```jsx
const { increment } = result.current;    // ❌ captured before the update
await act(async () => { increment(); });
expect(result.current.count).toBe(1);     // may hold a stale closure
```

Read through `result.current` at the moment you use it, every time.

## Hooks that need providers

Pass the `wrapper` option — the same mechanism `render` uses:

```jsx
const wrapper = ({ children }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

const { result } = renderHook(() => useOrders(), { wrapper });
await waitFor(() => expect(result.current.isSuccess).toBe(true));
```

⚠️ **A hook needing four providers to render is telling you something.** The test is awkward
because the hook is coupled to four contexts; the fix is usually in the hook, not in a bigger
wrapper.

## Async hooks

Everything from [topic 05](05-async-testing-and-act/README.md) applies — wait for the
condition rather than sleeping:

```jsx
const { result } = renderHook(() => useUser("u1"), { wrapper });

expect(result.current.isLoading).toBe(true);
await waitFor(() => expect(result.current.isLoading).toBe(false));
expect(result.current.data).toEqual({ id: "u1", name: "Ada" });
```

And the data still comes from MSW ([topic 06](06-mocking-the-api/README.md)) — a hook test is
no reason to start mocking modules.

## Testing cleanup

The one thing that is genuinely easier without a component:

```jsx
test("unsubscribes on unmount", () => {
  const { unmount } = renderHook(() => useSocket("wss://x"));
  expect(socket.listenerCount("message")).toBe(1);
  unmount();
  expect(socket.listenerCount("message")).toBe(0);
});
```

A leaked subscription is invisible in normal use and expensive in production, and `unmount()`
tests it directly.

## Gotchas

**Symptom:** a `renderHook` test passes and the feature is broken.
**Cause:** the hook works; the component using it does not — the wiring was never covered.
**Fix:** test through the component, and keep `renderHook` for hooks with no single consumer.

**Symptom:** state does not update after calling a returned function.
**Cause:** the call was not wrapped in `act`, so React never applied the update, or a stale
`result.current` was destructured earlier.
**Fix:** `await act(async () => { result.current.fn(); })`, and always read through
`result.current`.

**Symptom:** "Invalid hook call" from `renderHook`.
**Cause:** the hook is being called outside the callback, or there are two copies of React —
the usual culprit is a linked package.
**Fix:** call the hook *inside* the `renderHook` callback; check for duplicate React in
`node_modules` if that is not it.

**Symptom:** the wrapper grows to four providers.
**Cause:** the hook depends on a lot of context.
**Fix:** treat it as a design signal. A shared `renderHookWithProviders` helps
([topic 10](10-wrappers-and-providers.md)), but the coupling is the real finding.

**Symptom:** an `act` warning at the end of an async hook test.
**Cause:** the request resolved after the test finished.
**Fix:** `await waitFor(...)` for the settled state before the test ends.

## Interview questions

**★ Should you test hooks with `renderHook` or through a component?**
Through a component by default — the RTL docs say to prefer `render` because a custom test
component keeps the thing under test from being hidden behind an abstraction, and it covers
the wiring as well as the logic. `renderHook` is for hooks with no single natural consumer: a
shared or published hook, a large API surface, behaviour with no visual consequence, or a
regression test for a bug in the hook itself.

**★ What is the trap with `result.current`?**
It is a snapshot of the last render, not a live binding. Destructuring a function from it and
calling that later can run a stale closure, and reading a value captured before an update
gives the old value. Always go through `result.current` at the moment you use it.

**★ Why is `act` needed in hook tests when it is almost never needed in component tests?**
Because there is no component and no event handler — you are calling the setter directly, so
nothing wraps the update for you. In a component test, `render`, `user-event` and the async
utilities already do that.

**How do you test that a hook cleans up after itself?**
`renderHook`, assert the subscription or timer exists, call `unmount()`, and assert it is
gone. This is one case where the hook-level test is clearly better than a component test — a
leaked listener has no visible symptom until it causes a leak in production.

**A hook needs three providers to render in a test. What does that tell you?**
That it is coupled to three contexts. A shared wrapper makes the test writable, but the
awkwardness is a design signal worth acting on — the test is reporting the hook's real
dependency surface.

---

← Prev: [Testing forms and Actions](08-testing-forms-and-actions.md) ·
Index: [Phase 14](README.md) ·
Next → [Wrappers — context, providers and the router](10-wrappers-and-providers.md)
