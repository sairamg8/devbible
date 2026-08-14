---
title: "getBy, queryBy, findBy"
sidebar_label: "01 · get, query, find"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **Testing Library DOM 10.x / RTL 16.x**, from documentation —
> [Queries · About](https://testing-library.com/docs/queries/about) — the query-type table,
> the `findBy` default timeout of **1000 ms**, `TextMatch` and the `exact` / `normalizer` /
> `trim` / `collapseWhitespace` defaults, and the note on manual queries.
> No sandbox script backs this page; claims are cited, not measured.

There are six query functions, and they are one grid: three *variants* crossed with
single-or-all. Learn the grid once and every query name in the library becomes readable on
sight.

## The grid

| Query | 0 matches | 1 match | >1 matches | Retries |
|---|---|---|---|---|
| `getBy…` | **throw** | return element | **throw** | No |
| `queryBy…` | return **`null`** | return element | **throw** | No |
| `findBy…` | **throw** (after timeout) | return element | **throw** | **Yes** |
| `getAllBy…` | **throw** | return array | return array | No |
| `queryAllBy…` | return **`[]`** | return array | return array | No |
| `findAllBy…` | **throw** (after timeout) | return array | return array | **Yes** |

Three details in that table do most of the work in practice:

- **`getBy` and `queryBy` both throw on multiple matches.** `queryBy` is not "the safe
  one" — it is safe about *absence* only. Two matching elements is an error either way,
  because the test asked for *the* element and there is no such thing.
- **`findBy` throws too.** It is not a softer `getBy`; it is `getBy` with patience. The
  only variant that returns nothing quietly is `query*`.
- **The `All` variants never throw on duplicates**, which is the whole reason they exist —
  and also why reaching for `getAllBy…[0]` to silence a duplicate error is such a common
  way to hide a real bug.

## `getBy` — the default

Use it for everything that should already be on screen when you look.

```jsx
render(<Invoice status="paid" />);
expect(screen.getByRole("heading", { name: /invoice #1024/i })).toBeInTheDocument();
```

Its value is the failure message. When the element is missing, `getBy` throws with the
query, the suggestion where it can make one, and **a printout of the DOM it searched** —
usually enough to see the problem without touching a debugger. `queryBy` in the same
position gives you `expect(null).toBeInTheDocument()`, which tells you nothing about why.

**So the rule is: assert presence with `getBy`, never with `queryBy`.**

```jsx
// Good — failure prints the query and the DOM
expect(screen.getByText("Saved")).toBeInTheDocument();

// Bad — failure prints "received: null"
expect(screen.queryByText("Saved")).toBeInTheDocument();
```

## `queryBy` — for proving a thing is absent

There is exactly one job that `getBy` cannot do: asserting something is *not* there.
`getBy` throws before your assertion runs, so the test fails with an error rather than a
clean expectation.

```jsx
// The only reason queryBy exists
expect(screen.queryByRole("alert")).not.toBeInTheDocument();
expect(screen.queryByText(/deleting/i)).toBeNull();
```

⚠️ **The absence trap.** A `queryBy` assertion passes if the element is missing *for any
reason* — including because it has not rendered yet, or because you misspelled the text, or
because the role is wrong. An absence assertion that has never been seen to fail is
approximately worthless. Two ways to keep it honest:

1. **Anchor it to something present.** Assert the loaded state exists in the same test,
   then assert the spinner does not. If the render silently produced nothing, the first
   assertion fails and tells you.
2. **For something that must *disappear*, wait for the disappearance** rather than querying
   after a guess: `await waitForElementToBeRemoved(() => screen.queryByRole('progressbar'))`
   ([topic 05](../05-async-testing-and-act.md)). Querying too early is how "it's gone!"
   becomes a false pass.

## `findBy` — the async one, and why it beats the alternatives

`findBy` retries until the element appears or the timeout expires — **1000 ms by default**
— and returns a promise. It is a `getBy` wrapped in `waitFor`, and it is what you want any
time the element depends on something asynchronous: a fetch resolving, a transition
committing, a lazy chunk arriving, an Action finishing.

```jsx
await user.click(screen.getByRole("button", { name: /load orders/i }));
expect(await screen.findByRole("row", { name: /A-1001/ })).toBeInTheDocument();
```

**Never do this instead:**

```jsx
// ❌ arbitrary sleep — slow when it passes, flaky when it fails
await new Promise((r) => setTimeout(r, 500));
expect(screen.getByText("A-1001")).toBeInTheDocument();
```

A fixed sleep is wrong in both directions at once: it wastes half a second on every run,
and it still fails on the CI machine that was 600 ms slow. `findBy` returns the instant the
element exists and only spends the full timeout when the test is genuinely failing.

**And prefer `findBy` over hand-rolling `waitFor`:**

```jsx
// ⚠️ works, but noisier and easier to get wrong
await waitFor(() => expect(screen.getByText("A-1001")).toBeInTheDocument());

// ✅ same thing, and the failure message is better
await screen.findByText("A-1001");
```

`findBy` is a single call, carries the query's own error output, and cannot accidentally be
given a callback with several assertions in it — a `waitFor` body with three expectations
retries all three, so a failure tells you only that the *last* one never came true.

⚠️ **The most common `findBy` bug is a missing `await`.** Without it you have a pending
promise, the assertion runs against it, and the test either passes for the wrong reason or
fails with something incomprehensible about a promise not being in the document. Worse, the
un-awaited retry keeps updating state after the test ends, which is a leading cause of the
`act()` warning appearing in the *next* test ([topic 05](../05-async-testing-and-act.md)).
`eslint-plugin-testing-library`'s `await-async-queries` rule catches this and is worth
enabling for that reason alone.

## The `All` variants

Use them when the plural genuinely is the assertion:

```jsx
expect(screen.getAllByRole("listitem")).toHaveLength(3);
```

That is a real test of a list's contents. What is not a real test:

```jsx
// ❌ "there were two matches, so I took the first"
screen.getAllByRole("button", { name: /delete/i })[0];
```

That silences a duplicate-match error rather than answering it, and it binds the test to
document order — which changes when sorting changes, when a row is added, or when a modal
renders a second Delete button. The honest fixes are to **scope the query** with `within`
so only one match is in range, or to **give the buttons distinguishable accessible names**
("Delete invoice A-1001"), which is usually an accessibility improvement in its own right
([topic 11](../11-roles-as-the-query-surface.md)).

## `TextMatch` — how strings are actually compared

Every `…ByText`, `…ByLabelText`, `name` option and friends take a `TextMatch`: a string, a
regex, or a function.

```jsx
screen.getByText("Save");                       // string — exact by default
screen.getByText("save", { exact: false });     // substring, case-insensitive
screen.getByText(/^save$/i);                    // regex — the readable middle ground
screen.getByText((content, element) =>          // function — full control
  element.tagName === "SPAN" && content.startsWith("Save"));
```

| Option | Default | What it does |
|---|---|---|
| `exact` | **`true`** | full-string, case-sensitive match. `false` makes it a case-insensitive substring match. **Strings only — it has no effect on a regex or a function** |
| `trim` | **`true`** | trims leading and trailing whitespace before matching |
| `collapseWhitespace` | **`true`** | collapses runs of inner whitespace to a single space |
| `normalizer` | — | replaces the default normaliser entirely; call `getDefaultNormalizer` to extend rather than replace it |

**The normalisation defaults are why queries usually just work** on markup that JSX has
split across several lines. They are also why a test looking for a literal double space, or
for text with meaningful leading whitespace, fails until you supply a normaliser.

⚠️ **The one that costs an afternoon:** `getByText` matches against a *single element's*
text content. Markup like

```jsx
<p>Deleted <strong>3</strong> invoices</p>
```

has no element whose text is "Deleted 3 invoices" in the way the matcher looks at it, and
`getByText('Deleted 3 invoices')` fails while the phrase is plainly on screen. Options, in
order of preference: query the meaningful part (`getByText(/3 invoices/)`), use a matcher
function that inspects the whole element, or restructure the markup if the sentence really
is one thing.

## Manual queries, and where the docs draw the line

`container.querySelector` is available and the documentation does not forbid it — but it is
explicit that using it *"as an escape hatch to query by class or id is not recommended
because they are invisible to the user"*. Class names and ids are implementation details in
the exact sense of [topic 01](../01-what-to-test/README.md): they change under refactors the
user never notices, and they survive breakages the user very much does.

## Gotchas

**Symptom:** `expect(received).toBeInTheDocument()` with `received: null`, and no clue why.
**Cause:** presence was asserted with `queryBy`, which returns null instead of throwing.
**Fix:** use `getBy` for presence — its error prints the query and the searched DOM.
`queryBy` is only for absence.

**Symptom:** "Found multiple elements with the role button and name /delete/i".
**Cause:** the query is genuinely ambiguous — several matching elements exist.
**Fix:** scope with `within(row)`, or make the accessible names distinct. Do **not** switch
to `getAllBy…[0]`; that pins the test to document order and hides the ambiguity.

**Symptom:** a test passes locally and fails on CI with "unable to find an element".
**Cause:** a synchronous `getBy` for something that arrives asynchronously; the local
machine happened to be fast enough.
**Fix:** `await screen.findBy…`. Never a fixed `setTimeout` — it is slow when it works and
still flaky when it does not.

**Symptom:** an `act()` warning appears in a *later*, unrelated test.
**Cause:** a `findBy` was not awaited, so its retries and the resulting state updates
outlive the test.
**Fix:** await every `find*` call; enable `eslint-plugin-testing-library`'s
`await-async-queries`.

**Symptom:** the text is visibly on screen and `getByText` cannot find it.
**Cause:** the phrase is split across elements by an inline `<strong>` or `<span>`, so no
single element's text matches.
**Fix:** query a contiguous fragment, or pass a matcher function. Adjusting the markup is
sometimes right too, but not just to please a test.

**Symptom:** a "does not exist" assertion passes even though the feature is broken.
**Cause:** the element was absent for the wrong reason — never rendered, misspelled query,
wrong role.
**Fix:** pair it with a positive assertion in the same test, or use
`waitForElementToBeRemoved`, which fails if the element was never there to begin with.

## Interview questions

**★ What is the difference between `getBy`, `queryBy` and `findBy`?**
`getBy` throws when there is no match and returns the element when there is one — the
default, and the one with the useful error message. `queryBy` returns `null` instead of
throwing, which makes it the only way to assert absence. `findBy` returns a promise and
retries until the element appears or the default 1000 ms timeout expires, for anything
asynchronous. All three throw on multiple matches.

**★ Why should you assert presence with `getBy` rather than `queryBy`?**
Because of the failure output. `getBy` throws from inside the query and prints what it was
looking for plus the DOM it searched; `queryBy` hands `null` to your matcher, so the test
fails with "received: null" and you learn nothing. `queryBy` earns its place only when the
expected answer is "nothing".

**★ Why prefer `findByText` over `waitFor(() => getByText(…))`?**
It is one call rather than two, it carries the query's own error message, and it cannot be
handed a multi-assertion callback — a `waitFor` body containing several expectations retries
all of them, so a failure only tells you that the last one never became true. `findBy` is
literally `getBy` plus `waitFor`, with better ergonomics.

**★ Someone writes `getAllByRole('button')[0]` to fix a "multiple elements" error. What is
wrong with that?**
It suppresses the error instead of answering it, and it pins the test to document order, so
sorting or an extra row silently changes which element is tested. The ambiguity is
information: either scope the query with `within`, or give the elements distinct accessible
names — which usually improves the app for screen-reader users too.

**What does `exact: false` do, and what doesn't it do?**
It turns a string match into a case-insensitive substring match. It has no effect when the
matcher is a regex or a function, which is a common source of confusion — with a regex you
control case and anchoring yourself.

**Why does `getByText('Deleted 3 invoices')` fail on markup that clearly shows it?**
Because the query matches a single element's normalised text, and an inline `<strong>` has
split the phrase across elements. Query a contiguous fragment, or pass a matcher function
that looks at the whole element.

**How long does `findBy` wait, and what happens then?**
1000 ms by default, retrying as the DOM changes; on expiry it rejects with the query's
error, including the DOM at that moment. The timeout is configurable per call, but a test
that needs a much longer one is usually waiting on something that should have been mocked.

---

← Index: [The query families](README.md) ·
Next → [The priority order](02-the-priority-order.md)
