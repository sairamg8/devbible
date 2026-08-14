---
title: "What earns a test"
sidebar_label: "02 · What earns a test"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **React Testing Library 16.x**, from documentation —
> Testing Library [Guiding Principles](https://testing-library.com/docs/guiding-principles)
> and [React Testing Library intro](https://testing-library.com/docs/react-testing-library/intro).
> The cost model and the per-shape procedure below are **judgement built on those
> principles**, not quotations from them, and are marked as such where it matters.
> No sandbox script backs this page; claims are cited, not measured.

[Chunk 01](01-implementation-details.md) was the diagnosis. This is the procedure: given a
component in front of you, what do you actually write?

## The question to ask, in order

For each component, work down this list and stop at the first answer that produces
something worth asserting.

1. **What can go wrong here that a user would notice?** Not "what does this code do" —
   what is the *failure*. If you cannot name one, the component may not need a test.
2. **What is the smallest surface that exercises that failure?** Usually a click or a
   keystroke, occasionally just rendering with a particular prop.
3. **What would I look at to know it happened?** That is your assertion, and it should be
   something visible: text on screen, a control's disabled state, an element that appeared
   or vanished, an argument passed to a callback the developer-user supplied.
4. **Would this assertion survive renaming every internal in the component?** If not, go
   back to step 3 — you have described an internal, not an outcome.

That is the whole method. Every rule below is a shortcut for applying it to a shape of
component you have seen before.

## By component shape

### Presentational — props in, markup out

**Test the branches, not the markup.** A component that renders a badge in three colours
depending on `status` has three behaviours a user can see; assert that the right text and
the right accessible role appear for each. Do not assert the class name that produces the
colour — that is styling, and a class rename is a false negative waiting to happen.

If the component has **one** branch and no logic, it usually earns **no test of its own**.
It will be rendered by something else that is tested, and a test that only proves
`<h1>{title}</h1>` renders `title` is a test of React.

### Interactive — state that the user drives

**This is where the value is.** A disclosure, a tab set, a filter, a multi-step form: the
whole point is that acting changes what is on screen. Test the *transitions*, driven by
[`user-event`](../04-user-event-over-fireevent/README.md):

- what is visible initially,
- what is visible after the interaction,
- what happens on the second interaction (toggles are where off-by-one bugs live),
- and the guard — the click that should do nothing, the submit that should be blocked.

### Data-fetching — the four states

A component that talks to the network has **loading, success, empty and error** states,
and most suites test exactly one of them. All four earn a test; the network is mocked at
the transport layer with [MSW](../06-mocking-the-api.md), so all four are cheap to
produce. [Chunk 03](03-the-cases-worth-writing.md) works this through.

### Custom hooks

Test them **through a component that uses them**, unless the hook is exported for other
developers to call — see [topic 09](../09-testing-hooks.md). A hook that is an internal
detail of your own components gets its coverage from their tests, for free, and in the
form that catches wiring bugs.

### Pure functions and reducers

**Test them directly, and heavily.** A reducer is a function from `(state, action)` to
`state`; its return value *is* its contract and there is no DOM in sight. These tests are
fast, stable and worth a lot — which is a good reason to push logic out of components and
into functions in the first place. That refactor makes both the code and the suite better,
and it is the honest answer to "this component is hard to test".

## What not to test at all

**The framework.** That `useState` updates state, that an effect runs after mount, that
React re-renders on a state change. React has its own suite. If your test would still be
meaningful with your component deleted, it is a React test.

**The library.** Date formatting from `date-fns`, validation from `zod`, the router's
matching. Test *your* use of them — that an invalid form shows the error — not their
behaviour.

**Prop plumbing.** "Component A passes `user` to component B" is not a user-visible
outcome. Assert on what B renders as a result, from a test of A that renders both.

**Styling and layout.** Class names, computed styles, pixel positions. jsdom does not do
layout — it has no real box model — so most of what you would want to assert cannot be
measured there anyway, and the parts that can (a literal `style` attribute) are the parts
least worth asserting. Visual regression is a different tool.

**Render counts and memoisation.** Covered in [chunk 01](01-implementation-details.md):
React is free to render when it likes.

**Everything twice.** If a behaviour is covered by an integration-style test of the
feature, it does not also need a unit test of each participant. Duplicate coverage costs
maintenance and buys nothing — when a bug appears, six tests go red and you still have to
find out which one is the cause.

## Why "80% coverage" is the wrong target

Coverage measures **which lines ran**, not **whether anything was checked**. A test that
renders every component and asserts nothing scores beautifully. This is not an argument
against measuring coverage — it is a good *detector*, and an uncovered branch is a real
question. It is an argument against it as a **goal**, because the cheapest way to hit a
coverage number is to write exactly the tests that catch nothing.

Use it the way it works: look at what is *not* covered and ask whether it should be. Do
not ask the team to raise a percentage.

## The cost side, and where the balance sits

Every test costs three things: the time to write it, the time it spends running on every
CI build forever, and — much the largest — the time to fix it when it breaks for the wrong
reason. That third cost is why chunk 01 matters so much: a behaviour test is cheap to own,
and an internals test is expensive for as long as the code lives.

This is why the centre of gravity for React work sits at the **feature** level: render the
component that owns the state, with its real children, and drive it as a user. Those tests
are still fast — jsdom, no browser, no server — but they exercise the wiring, which is
where bugs actually are. Below them, unit tests for pure logic. Above them, a small number
of end-to-end tests for the paths where money or data loss is involved.

⚠️ **The shape of that distribution is a widely held convention, not something the Testing
Library documentation prescribes**, and it is stated here as judgement. What the
documentation does prescribe is the principle underneath it: the more your tests resemble
the way your software is used, the more confidence they can give you.

## The two questions that catch most bad tests

Before committing a test, ask:

> **1. If this assertion failed, would I know what to fix?**
> A failure that says "expected 2 children, received 3" sends you reading the component to
> reconstruct what was meant. A failure that says the "Save" button was not found tells you
> the outcome that broke.

> **2. Would this test have caught the last bug we shipped in this area?**
> This one is uncomfortable and worth asking anyway. Suites drift toward testing what is
> easy to test rather than what breaks.

## Gotchas

**Symptom:** a test file with one `it` per prop, each rendering the component and checking
that the prop appears.
**Cause:** tests written from the component's *interface* rather than from its behaviour —
the props list becomes the test plan.
**Fix:** write the test plan from what a user can do and see. Props that only pass text
through need no test each; props that change behaviour need one test per behaviour.

**Symptom:** coverage is high and bugs still ship in the covered files.
**Cause:** the tests execute the lines without asserting on the outcome — often a
render-only test, or one whose only assertion is that no error was thrown.
**Fix:** for each covered file, ask what failure the test would catch. Coverage is a
detector for missing tests, never evidence of good ones.

**Symptom:** "this component is impossible to test."
**Cause:** it does several unrelated things — fetches, transforms, formats and renders —
so there is no small surface that exercises any one of them.
**Fix:** extract the transformation into a pure function and test it directly; the
component that remains is usually easy to test through the DOM. The difficulty was a
design signal.

**Symptom:** a change to one component turns six test files red.
**Cause:** duplicated coverage — the same behaviour asserted at several levels.
**Fix:** keep the test closest to the user and delete the rest. Overlap is not safety;
it is six places to update for one change.

## Interview questions

**★ How do you decide whether a component needs a test?**
Ask what can go wrong that a user would notice. If you can name a failure, write the
smallest interaction that would produce it and assert on what a user would see. If you
cannot name one — a component that renders a prop and nothing else — it gets its coverage
from the tests of whatever renders it.

**★ What do you deliberately not test?**
The framework and third-party libraries (they have their own suites), prop plumbing
between components, styling and layout (jsdom does no layout), render counts and
memoisation, and anything already covered at a level closer to the user.

**★ Why is a coverage percentage a bad target?**
Because coverage records which lines executed, not whether anything was asserted — a suite
that renders everything and asserts nothing scores well. It is a useful detector of
untested branches and a bad goal, because the cheapest way to hit a number is to write the
tests that catch the least.

**★ Where should the bulk of a React suite sit, and why?**
At the feature level: render the component that owns the state together with its real
children and drive it like a user. That exercises the wiring between components, which is
where bugs concentrate, while still running in jsdom in milliseconds. Pure logic goes
below it in direct unit tests; a handful of end-to-end tests sit above it. ⚠️ That
distribution is convention and judgement, not a rule from the Testing Library docs.

**What is the fastest way to make an untestable component testable?**
Move the logic out of it. A pure function that transforms data is trivially testable and
the remaining component becomes a thin, queryable rendering of the result. "Hard to test"
is usually "doing too much".

**Two questions to ask before committing a test?**
Would the failure message tell me what to fix, and would this test have caught the last
real bug in this area?

---

← Prev: [Implementation details](01-implementation-details.md) ·
Index: [What to test, and what not to](README.md) ·
Next → [The cases worth writing](03-the-cases-worth-writing.md)
