---
title: "Snapshot tests"
sidebar_label: "12 · Snapshot tests"
sidebar_position: 12
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against **Jest 30.x**, **Vitest 3.x** and **RTL 16.x**, from
> documentation —
> [Jest · Snapshot testing](https://jestjs.io/docs/snapshot-testing) — the workflow,
> `toMatchInlineSnapshot`, asymmetric property matchers (*"checked before the snapshot is
> written or tested, and then saved to the snapshot file instead of the received value"*),
> *"Commit snapshots and review them as part of your regular code review process"*, the
> `-u` / `--updateSnapshot` flag, and that since Jest 20 *"snapshots in Jest are not
> automatically written when Jest is run in a CI system without explicitly passing
> `--updateSnapshot`"*;
> [RTL · API](https://testing-library.com/docs/react-testing-library/api) (`asFragment`) and
> [RTL · FAQ](https://testing-library.com/docs/react-testing-library/faq) (the
> `cloneNode(true)` caveat — the DOM is mutable, so a snapshot diff will not see changes
> unless you clone first).
> No sandbox script backs this page; claims are cited, not measured.

A snapshot test records output and fails when it changes. That is the whole mechanism, and it
explains both why snapshots are so easy to add and why so many suites are full of ones nobody
reads.

## The mechanics

```jsx
const { asFragment } = render(<PriceTag amount={4200} currency="GBP" />);
expect(asFragment()).toMatchSnapshot();
```

First run writes a `.snap` file; later runs compare against it. `-u` (`--update`) rewrites
it. `asFragment()` returns a `DocumentFragment` with no live bindings, which is what makes it
safe to store ([topic 02](02-the-rtl-model/README.md)).

⚠️ **If you snapshot a live DOM node instead, and then interact, the "before" snapshot has
mutated too** — the FAQ's `cloneNode(true)` caveat. Two snapshots of the same node compare
equal no matter what happened in between.

## Why most snapshot tests are worthless

**1 · They assert everything, so they mean nothing.** A snapshot of a component's whole
output fails when a class name changes, when a wrapper `<div>` is added, when the copy is
tweaked. Every one of those is a *diff*, not a *defect* — and after the third false alarm the
team stops reading and starts running `-u`.

**2 · `-u` is one keystroke.** The reviewing step the technique depends on has no friction to
protect it. A `.snap` diff of 300 lines in a pull request gets scrolled past, and a real
regression rides along with the noise.

**3 · The failure message tells you nothing about intent.** `toBeDisabled()` failing says
"the button should be disabled and is not". A snapshot failure says "line 47 differs" and
leaves you to work out whether that matters.

**4 · They test the render, not the behaviour.** The state a snapshot captures is whatever
the component produced with the props you gave it — not that clicking Save disables the
button, that the error appears, that the payload is right.

🔴 **The reliable tell that a suite has this problem:** snapshot files change in most pull
requests, and nobody can say from the diff whether the change was intended.

## Where they genuinely earn their place

**1 · Pure, deterministic formatting output.** A function or tiny component whose entire job
is producing a specific string or small tree:

```jsx
expect(formatMoney(420050, "GBP")).toMatchInlineSnapshot(`"£4,200.50"`);
```

Here the output *is* the behaviour, it is small, and a change to it is genuinely something to
review.

**2 · Design-system primitives with a deliberate DOM contract.** A `<Button>` whose rendered
attributes and structure are part of its public API. A change should be noticed.

**3 · Error and log formatting.** The shape of a serialised error or a CLI message, where the
exact text matters and there is nothing behavioural to assert.

**4 · Locking in a bug fix while refactoring.** A short-lived snapshot that pins current
output while you restructure internals, deleted when the work lands. Honest scaffolding, not
a permanent test.

## Rules that make them tolerable

**Prefer inline snapshots.** `toMatchInlineSnapshot()` writes the value into the test file
itself, so the expected output is visible at the point of assertion and shows up in the diff
where a reviewer is already looking. That single change fixes most of the review problem.

**Keep them small.** A snapshot worth having fits on a screen. If it does not, snapshot a
part — `asFragment().querySelector('[data-testid="price"]')` — or assert directly instead.

**Use property matchers for anything variable.** Dates, ids and random values otherwise make
the test fail on every run:

```jsx
expect(user).toMatchSnapshot({ id: expect.any(String), createdAt: expect.any(Date) });
```

**Commit them and review them like code.** They are only a test if someone reads the diff.

**Never run `-u` across the suite to make it green.** Update the snapshots for the change you
made, and read each one.

## The decision, in one line

**If you can name what should be true, assert that instead.** "The button is disabled while
saving" is a better test than a snapshot that happens to contain `disabled=""` — it survives
markup changes, it fails for one reason, and its failure message names the problem. Reach for
a snapshot when the output itself is the contract and there is nothing more specific to say.

## Gotchas

**Symptom:** the `.snap` file changes in almost every pull request.
**Cause:** snapshots covering whole components, so cosmetic changes fail them.
**Fix:** replace them with behavioural assertions; keep snapshots for small, deliberate
outputs.

**Symptom:** a snapshot test fails on every run with a different date or id.
**Cause:** non-deterministic values in the output.
**Fix:** property matchers, or fix the clock and the id generator for the test.

**Symptom:** two snapshots of the same node compare equal after an interaction that clearly
changed the DOM.
**Cause:** both reference the same live, mutable node.
**Fix:** `asFragment()`, or `cloneNode(true)` before storing.

**Symptom:** a regression shipped even though the snapshot changed.
**Cause:** the diff was large, so it was updated rather than read.
**Fix:** smaller and inline snapshots. A test nobody reads is not a test.

**Symptom:** a new snapshot is written on CI and the build passes.
**Cause:** it should not be — since Jest 20, *"snapshots in Jest are not automatically
written when Jest is run in a CI system without explicitly passing `--updateSnapshot`"*. If it
happened, `-u` is in the CI command.
**Fix:** remove it. A missing snapshot must fail the build; otherwise a test writes its own
expectation and passes for the first time in CI.

## Interview questions

**★ When is a snapshot test the right tool?**
When the output *is* the contract and there is nothing more specific to assert: a formatting
function's string, a design-system primitive's deliberate DOM shape, serialised error or log
output, or temporary scaffolding to pin behaviour during a refactor. If you can name the
property that should hold, assert that property instead — it survives cosmetic changes and
fails with a message that says what is wrong.

**★ Why do large snapshot tests fail in practice?**
Because they assert everything, so any cosmetic change fails them; because `-u` makes
updating cost nothing; and because a 300-line snapshot diff does not get read in review. The
combination means real regressions get committed inside noise, which is worse than having no
test — the suite is green and nobody trusts it.

**★ What does `asFragment()` give you that a DOM node does not?**
A `DocumentFragment` with no live bindings, so it is a genuine point-in-time copy. Snapshotting
a live node and then interacting mutates the "before" value too — the RTL FAQ's `cloneNode(true)`
caveat — so before-and-after comparisons silently pass.

**Why prefer inline snapshots?**
They put the expected value in the test file, so the assertion is readable where it is written
and shows up in the diff a reviewer is already reading. That addresses the main failure mode,
which is unreviewed updates.

**How do you snapshot output containing dates or generated ids?**
Property matchers — `expect.any(String)`, `expect.any(Date)` — or control the source by fixing
the clock and the id generator for the test. Otherwise the snapshot fails on every run and gets
updated reflexively, which trains the team to ignore it.

---

← Prev: [Roles are the query surface](11-roles-as-the-query-surface.md) ·
Index: [Phase 14](README.md) ·
Next → [Testing Server Components](13-testing-server-components.md)
