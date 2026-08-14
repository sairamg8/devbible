---
title: "Implementation details, and the two ways a test lies"
sidebar_label: "01 · Implementation details"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **React Testing Library 16.x**, from documentation —
> Testing Library [Guiding Principles](https://testing-library.com/docs/guiding-principles)
> and the [React Testing Library FAQ](https://testing-library.com/docs/react-testing-library/faq)
> (shallow rendering, and why Enzyme's instance access is rejected); plus Kent C. Dodds,
> ["Testing Implementation Details"](https://kentcdodds.com/blog/testing-implementation-details)
> (17 August 2020) for the false-negative / false-positive framing, cited as the RTL
> author's rationale. No sandbox script backs this page; claims are cited, not measured.

## The definition

> **Implementation details are things which users of your code will not typically use,
> see, or even know about.**

That is the whole test, and it is deliberately about *users* rather than about
*correctness*. A state variable's name is an implementation detail. The number of
`useState` calls is an implementation detail. Whether a value is derived during render or
stored in state is an implementation detail. None of them are unimportant — they are
simply invisible from outside, so an assertion about one is an assertion about something
nobody depends on.

## A component has exactly two users

This is the part that makes the rule usable, because "the user" is ambiguous for a
component that is never rendered on its own.

| User | Interacts through | What they can observe |
|---|---|---|
| **The end user** | the rendered DOM, in a browser | text, roles, labels, what appears and disappears, what happens when they click and type |
| **The developer user** | the props (and the rendered children) | that passing these props produces that output and calls these callbacks |

Everything either of those two can observe is **the contract**. Everything else is an
implementation detail. A test that asserts on the contract survives any refactor that
keeps the contract; a test that asserts on anything else is asserting on your freedom to
change your own code.

```jsx
// The contract of this component, in full:
//  - renders a button labelled with `label`
//  - after a click, the button is disabled and reads "Saving…"
//  - calls `onSave` once per click, and not while saving
//
// NOT the contract:
//  - that it uses useState rather than useReducer
//  - that the flag is called `isSaving` rather than `pending`
//  - that it renders exactly one <span> inside the button
function SaveButton({ label, onSave }) {
  const [isSaving, setIsSaving] = useState(false);

  async function handleClick() {
    if (isSaving) return;
    setIsSaving(true);
    await onSave();
    setIsSaving(false);
  }

  return (
    <button onClick={handleClick} disabled={isSaving}>
      {isSaving ? "Saving…" : label}
    </button>
  );
}
```

Rewriting the body of `SaveButton` with `useReducer`, or renaming `isSaving` to `pending`,
or wrapping the text in a different element, changes nothing either user can see. If a
test goes red for one of those edits, the test was wrong before the edit.

## The two ways an implementation-detail test lies

A test has one job: **be red when the software is broken, and green when it is not.**
Testing implementation details breaks that in both directions at once, which is why the
practice is worth naming rather than just discouraging.

### False negative — red when nothing is broken

> **Tests which test implementation details can give you a false negative when you
> refactor your code.**

You rename a state variable, extract a helper, replace two `useState` calls with one
object, or swap a `<div>` for a `<section>`. The application behaves identically. Twelve
tests go red.

The damage is not the twenty minutes spent fixing them. The damage is what the team learns
from it: **that refactoring is expensive.** After a few rounds of this, the component that
needed restructuring does not get restructured, because touching it means touching its
tests, and everyone has something better to do. The suite that was supposed to make change
safe has made it costly instead.

The second-order damage is worse. When red is routinely meaningless, people stop reading
failures and start fixing them mechanically — update the snapshot, change the expected
string, delete the assertion. That reflex eventually gets applied to a real failure.

### False positive — green when something is broken

The mirror case, and the more dangerous one because nobody notices it.

A test that reaches inside and asserts "after clicking, the `isSaving` state is `true`"
passes as long as the state is set. It keeps passing if you forget to pass `disabled` to
the button. The state is correct; the user can click again and double-submit; the test is
green. The thing being asserted was never what mattered.

This is the failure mode of every test written against a mock of the thing under test, and
of every test that calls a handler directly instead of clicking:

```jsx
// Green even if the button is never wired to handleClick at all.
const { result } = renderSomehow();
act(() => result.handleClick());
expect(onSave).toHaveBeenCalled();
```

A test can only catch a bug in the path it actually exercises. Calling the handler
yourself removes the wiring — which is exactly where the bug usually is.

## Why RTL will not let you do it

RTL's refusals are a design position, not missing features. From the FAQ and the intro:

- **No shallow rendering.** Shallow rendering asserts on the element tree a component
  *returned* rather than on the DOM a user *gets*. It is the fastest way to write a test
  that passes while the page is broken.
- **No access to component instances.** The intro says the library does not deal with
  "instances of rendered React components" — your tests work with actual DOM nodes.
- **No reading of internal state or internal methods.** The FAQ names exactly this as the
  reason Enzyme is not recommended: instance access, constructor selection and shallow
  rendering all encourage testing internals instead of behaviour.

So the API gives you a rendered document and a set of queries that find things the way a
person would. **The wrong test is not forbidden — it is just awkward to write.** That is
the strongest form of guidance a library can offer, and it is why "how do I read state in
a test?" has no good answer: the question is the problem.

## The drill that settles any argument

When two people disagree about whether an assertion is legitimate, do not argue about it.
Run the refactor drill:

> **Rename every internal function and state variable in the component. Reorder its
> hooks where the rules allow. Change nothing a user can see. Now run the tests.**

- **Still green** → the suite tests behaviour. Keep it.
- **Red** → each red test has just told you it depends on something no user depends on.
  Rewrite it against the DOM, or delete it.

This drill is also the Phase 14 gate for a reason: it is objective, it takes ten minutes,
and it cannot be argued with. It is the same drill in reverse for a new suite — write the
tests, then refactor the component before you trust them.

## The one honest exception

**A custom hook exported from a package has developer-users who consume its return value
directly.** For that hook, the returned object *is* the contract, and `renderHook` is
testing behaviour, not internals — the shape it returns is exactly what its users see.

The exception is narrow and it is about **who consumes the thing**, not about convenience.
A hook used by three components inside your own app is still best tested through one of
them, because its real contract is what those components render.
[Topic 09](../09-testing-hooks.md) draws that line properly.

## Gotchas

**Symptom:** every PR that touches a component also touches its test file, and the test
edits are mechanical.
**Cause:** the tests assert on structure — element counts, nesting, class names, state
shape — so any structural edit invalidates them.
**Fix:** treat mechanical test edits as a defect report about the test. Rewrite the
assertion in terms of what the user sees before you make it pass again.

**Symptom:** a bug ships that the suite "covers" — there is a test named for exactly that
behaviour.
**Cause:** the test drives the component through something other than the DOM (calling a
handler, setting state, rendering a mock of the component under test), so the wiring where
the bug lives is never exercised.
**Fix:** drive the test through the same surface the user uses — find the control by role
and click it. If that is hard, the difficulty is a finding about the component.

**Symptom:** a test asserts a component "re-rendered" or a memoised child "did not
re-render".
**Cause:** render counts are the definition of an implementation detail — React is allowed
to render whenever it likes, and [Phase 6](../../phase-6-performance/README.md) is about
exactly that freedom.
**Fix:** assert on output, not on renders. If performance is the actual requirement,
measure it as performance; a render-count assertion is not a performance test.

**Symptom:** "I can't test this without reaching into it."
**Cause:** usually true, and usually a finding about the component rather than the test —
state that no rendered output reflects is state the user cannot observe.
**Fix:** either render the observable consequence, or accept that the value is internal
and stop asserting on it.

## Interview questions

**★ What is an implementation detail, in one sentence?**
Something the users of your code will not typically use, see or even know about — for a
component, anything neither the end user (through the DOM) nor the developer user
(through props and rendered output) can observe.

**★ Why is testing implementation details bad in *both* directions?**
It produces **false negatives** — tests go red on a refactor that broke nothing, which
teaches the team that refactoring is expensive and that red failures can be fixed
mechanically. And it produces **false positives** — a test that asserts internal state
passes even when the state is never wired to the DOM, so a real bug ships under a green
test named after it.

**★ Who are a component's users?**
Two: the end user, who interacts with the rendered DOM, and the developer user, who
renders it with props and consumes its rendered output and callbacks. The union of what
those two can observe is the component's contract; everything else is internal.

**★ Why does React Testing Library refuse to support shallow rendering?**
Because shallow rendering asserts on what a component returned rather than on the DOM a
user receives, which makes it easy to write a test that passes while the rendered page is
broken. The same reasoning is why RTL exposes no component instances, no internal state
and no internal methods — the guiding principle is that a test should resemble the way the
software is used.

**How do you settle an argument about whether an assertion is legitimate?**
Run the refactor drill: rename the component's internal functions and state variables
without changing anything observable, then run the suite. Anything that turns red depends
on something no user depends on.

**Is `renderHook` a violation of this rule?**
Not for a hook whose consumers are developers calling it directly — there the returned
value *is* the contract. It is a violation when the hook is an internal detail of your own
components, because then its real contract is what those components render.

---

← Index: [What to test, and what not to](README.md) ·
Next → [What earns a test](02-what-earns-a-test.md)
