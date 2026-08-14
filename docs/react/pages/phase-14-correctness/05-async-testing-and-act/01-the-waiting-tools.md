---
title: "The three waiting tools"
sidebar_label: "01 · The waiting tools"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **Testing Library DOM 10.x / RTL 16.x**, from documentation —
> [dom-testing-library · Async APIs](https://testing-library.com/docs/dom-testing-library/api-async):
> the `waitFor` signature and options (**`timeout` default 1000 ms**, **`interval` default
> 50 ms**, run immediately before the intervals; `container` defaults to `document`;
> `onTimeout`; `mutationObserverOptions` defaulting to child additions/removals including
> text nodes, and attribute changes), the rule that *"returning a falsy condition is not
> sufficient to trigger a retry, the callback must throw an error"*, and
> `waitForElementToBeRemoved`'s error when the element is already gone.
> No sandbox script backs this page; claims are cited, not measured.

## Three tools, three questions

| Tool | The question it answers |
|---|---|
| `findBy…` | "wait until this element **exists**" |
| `waitForElementToBeRemoved` | "wait until this element is **gone**" |
| `waitFor` | "wait until this **assertion stops throwing**" |

They are ordered by preference. Reach for `waitFor` only when neither of the other two
expresses what you mean, because it is the one that lets you write something subtly wrong.

## `findBy` — the default wait

Covered in [topic 03](../03-the-query-families/README.md), and repeated here because it is
the answer most of the time:

```jsx
await user.click(screen.getByRole("button", { name: /load/i }));
expect(await screen.findByRole("row", { name: /A-1001/ })).toBeInTheDocument();
```

One call, retries built in, and the failure message carries the query and the DOM.

## `waitForElementToBeRemoved` — for disappearance

```jsx
render(<Orders />);
await waitForElementToBeRemoved(() => screen.queryByRole("progressbar"));
expect(screen.getByRole("table")).toBeInTheDocument();
```

Its most valuable property is a guard rail: it **throws if the element is not there when
the wait begins**, with the message that the elements *"are already removed"* and that it
*"requires that the element(s) exist(s) before waiting for removal"*.

That converts a whole class of false passes into failures. The naive version —

```jsx
// ❌ passes if the spinner never rendered, if the query is wrong, if the render failed
expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
```

— cannot distinguish "it finished loading" from "it never started". `waitForElementToBeRemoved`
can, because it insists the spinner existed first.

⚠️ Pass a **callback**, not the element. `waitForElementToBeRemoved(screen.queryByRole(…))`
evaluates the query once; the callback form is re-run and is what the docs use.

## `waitFor` — and the rule that explains its misuse

```jsx
await waitFor(() => expect(mockSave).toHaveBeenCalledWith({ title: "Q3" }));
```

Use it when what you are waiting for **is not a DOM element**: a mock being called, a
router location changing, a store reaching a state.

| Option | Default | Notes |
|---|---|---|
| `timeout` | **1000 ms** | how long to keep retrying |
| `interval` | **50 ms** | *"it runs your callback immediately before starting the intervals"* — so a condition already true costs nothing |
| `container` | `document` | the subtree whose mutations trigger a re-check |
| `onTimeout` | appends the container's printed state to the error | override to customise the failure |
| `mutationObserverOptions` | child additions/removals **including text nodes**, and attribute changes | what counts as a change worth re-running for |

🔴 **The rule people get wrong:** *"Returning a falsy condition is not sufficient to trigger
a retry, the callback must throw an error in order to retry the condition."*

```jsx
// ❌ resolves immediately — returning false is not a retry signal
await waitFor(() => screen.queryAllByRole("row").length === 3);

// ✅ throws until true
await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(3));
```

The first line looks like a wait and is a no-op. It is a silent false pass, and it is by
some distance the most common `waitFor` bug — the test "waits", proceeds instantly, and the
assertion that follows fails somewhere confusing.

## The four `waitFor` anti-patterns

**1 · Side effects inside the callback.** The callback runs repeatedly — immediately, then
every 50 ms, and again on every mutation. Anything with an effect happens many times:

```jsx
// ❌ may click several times
await waitFor(() => {
  user.click(screen.getByRole("button", { name: /retry/i }));
  expect(mockRetry).toHaveBeenCalled();
});

// ✅ interaction outside, wait inside
await user.click(screen.getByRole("button", { name: /retry/i }));
await waitFor(() => expect(mockRetry).toHaveBeenCalled());
```

**2 · Several assertions in one callback.** All of them are retried, so a failure tells you
only that the *last* one never became true — and the earlier ones may have been true at
different moments. Wait for one thing, then assert the rest synchronously.

**3 · Wrapping something that is already there.** `await waitFor(() => expect(screen.getByText('Title')).toBeInTheDocument())`
for static content adds a promise and a mutation observer to prove something that was true
before the wait began. `expect(screen.getByText('Title'))` is the same assertion, without
the machinery.

**4 · Raising the timeout to fix flakiness.** A test that needs 5000 ms is waiting on
something real — an un-mocked network call, a long fake-timer chain, a genuinely slow
render. Raising the number converts a fast failure into a slow one and leaves the cause in
place. Fix what is slow; the network belongs in MSW ([topic 06](../06-mocking-the-api.md)).

## Deciding, in one table

| You want to wait for | Use |
|---|---|
| an element to appear | `await screen.findBy…` |
| several elements to appear | `await screen.findAllBy…` |
| an element to disappear | `await waitForElementToBeRemoved(() => screen.queryBy…)` |
| a mock to have been called | `await waitFor(() => expect(fn).toHaveBeenCalled…)` |
| an element to *change* (text, attribute, disabled state) | `await waitFor(() => expect(el).toHaveTextContent(…))` |
| "nothing else happens" | nothing — see below |

⚠️ **You cannot wait for the absence of a future event.** A test that waits 1000 ms to prove
an error toast never appears is 1000 ms of nothing and proves only that it did not appear
*yet*. Assert the positive instead: the success state rendered, the error handler was never
called.

## Gotchas

**Symptom:** a `waitFor` returns instantly and the next assertion fails.
**Cause:** the callback returns a boolean instead of throwing, so there was never a retry.
**Fix:** put an `expect` inside the callback. Throwing is the retry signal; a falsy return
is not.

**Symptom:** an interaction happens two or three times.
**Cause:** it is inside a `waitFor` callback, which is re-run on every interval and mutation.
**Fix:** move the interaction out; leave only assertions in the callback.

**Symptom:** "The element(s) given to waitForElementToBeRemoved are already removed."
**Cause:** the element was gone before the wait started — often the loading state resolved
synchronously with mocked data, or the query is wrong.
**Fix:** assert the loaded state directly if there was never a spinner to wait for; check
the query first, because a wrong query produces the same message.

**Symptom:** a test fails with "unable to find element" only in CI.
**Cause:** something asynchronous is slower there and the test never waited at all.
**Fix:** `findBy` rather than `getBy`. Not a longer timeout on a wait that is not happening.

**Symptom:** a suite got slow after adding waits everywhere.
**Cause:** `waitFor` around already-satisfied conditions, and inflated timeouts.
**Fix:** remove waits for static content — the callback runs immediately, so a satisfied
`waitFor` is cheap, but it still adds a promise, an observer and noise for the next reader.

**Symptom:** a `waitFor` with four assertions fails and the message is useless.
**Cause:** all four retry together; only the last one's failure surfaces.
**Fix:** wait for one condition, then assert the others synchronously afterwards.

## Interview questions

**★ When do you use `waitFor` rather than `findBy`?**
When what you are waiting for is not the appearance of an element — a mock being called, a
navigation, a store value. If it *is* an element appearing, `findBy` is the same thing with
a better error message and no callback to get wrong. For disappearance, use
`waitForElementToBeRemoved`, which additionally fails if the element was never there.

**★ Why does `await waitFor(() => screen.queryAllByRole('row').length === 3)` not work?**
Because the retry signal is a thrown error, not a falsy return. The callback returns `false`,
`waitFor` treats that as success, and it resolves on the first immediate run. The correct
form puts an `expect` inside so a mismatch throws.

**★ What is wrong with putting a `user.click` inside a `waitFor` callback?**
The callback is re-run immediately, then on an interval and on DOM mutations, so the click
can happen several times — producing duplicate submits and assertions that are impossible to
reason about. Interactions go outside the wait; only assertions go inside.

**★ Why is `waitForElementToBeRemoved` better than asserting `queryBy…` is null after a wait?**
Because it throws if the element is not present when the wait starts. A `queryBy` absence
assertion passes when the element never rendered at all — a wrong query, a failed render, a
misspelled role — so it can pass on a completely broken component.

**What are `waitFor`'s default timeout and interval?**
1000 ms and 50 ms, with the callback also run immediately before the intervals begin, so a
condition that is already true resolves without waiting.

**A test is flaky, so a colleague raises the `waitFor` timeout to 5000 ms. What is your view?**
It hides the cause. Something real is slow — usually an un-mocked network call or timer work
— and the higher timeout only makes the eventual failure slower to arrive. Mock the network,
control the timers, and keep the timeout at the default so a genuine regression is loud.

---

← Index: [Async testing and what `act()` means](README.md) ·
Next → [`act()`, and what the warning means](02-act-and-the-warning.md)
