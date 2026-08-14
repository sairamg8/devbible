---
title: "What a real interaction is"
sidebar_label: "01 · What an interaction is"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **`@testing-library/user-event` 14.x**, from documentation —
> [user-event · Intro](https://testing-library.com/docs/user-event/intro) (`fireEvent`
> dispatches DOM events, `user-event` simulates interactions *"which may fire multiple
> events and do additional checks along the way"*; the visibility and interactability
> checks; `setup()` required in v14; APIs return promises and must be awaited) and
> [setup](https://testing-library.com/docs/user-event/setup) (the instance shares input
> device state; the clipboard stub).
> No sandbox script backs this page; claims are cited, not measured.

## One event is not a click

Ask what happens in a browser when someone clicks a button, and the honest answer is a
sequence. The pointer moves onto the element, hover state applies, the button goes down,
focus moves, the button comes up, and only then does `click` fire. Each step dispatches
events, and real components listen to several of them.

`fireEvent.click(button)` produces exactly one of those events. Nothing else in the chain
happened: nothing was hovered, nothing was focused, no pointer event was dispatched, and
crucially **nothing checked whether the click was possible at all.**

The docs describe the same asymmetry for typing: a browser focuses the element, fires
keyboard and input events, and manipulates DOM selection and values.
`fireEvent.change(input, { target: { value: 'hello' } })` sets a value and fires one event —
a state no sequence of human actions can produce, since a person cannot type five
characters simultaneously without ever focusing the field.

## The checks are the point

`user-event` performs *"visibility and interactability checks"* and manipulates the DOM the
way a browser interaction would. In practice that means a `user-event` call **fails** in
situations where `fireEvent` silently succeeds:

| Situation | `fireEvent.click` | `await user.click` |
|---|---|---|
| button is `disabled` | dispatches; your handler may run | does nothing — a disabled control receives no click |
| element has `pointer-events: none` | dispatches | throws, per the documented pointer-events check |
| element is hidden / `display: none` | dispatches | fails the visibility check |
| element is covered by a modal overlay | dispatches | the overlay is what gets clicked |
| typing into a `readonly` or `disabled` input | sets the value directly | no value change, as in a browser |

**Every row is a real bug class.** A test suite built on `fireEvent` will happily prove
that a disabled Submit button submits the form — and the app ships with the double-submit
bug the disabled attribute was added to prevent.

## The v14 ceremony: `setup()`, and `await`

Two things changed in v14 and both are non-negotiable in practice.

```jsx
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";

test("saves the draft", async () => {
  const user = userEvent.setup();      // 1. before render
  render(<Editor />);

  await user.type(screen.getByRole("textbox", { name: /title/i }), "Q3 report");
  await user.click(screen.getByRole("button", { name: /save/i }));   // 2. always awaited

  expect(await screen.findByText(/draft saved/i)).toBeInTheDocument();
});
```

**1 · `setup()` before `render`.** It returns an instance whose methods *"share unified
input device state"* — so consecutive interactions behave like one continuous session
rather than a series of unrelated events. That is what makes a held Shift apply to the next
click, and a second click in quick succession register as a double-click. It also applies
the document-level workarounds the library needs, and replaces
`window.navigator.clipboard` with a stub so clipboard behaviour is testable outside a
secure context. Calling `userEvent.click()` directly still works and is documented as
supported, but the instance methods are the recommended form.

**2 · `await` every call.** The APIs return promises. This is the single most common
`user-event` mistake, and its symptoms are misleading:

```jsx
user.click(button);                 // ❌ no await
expect(screen.getByText("Saved")).toBeInTheDocument();   // fails: not there yet
```

Missing the `await` means the assertion runs before the interaction's effects are flushed,
so you get "unable to find an element" on something that appears microseconds later, or an
`act()` warning when the update lands after the test has finished
([topic 05](../05-async-testing-and-act.md)). `eslint-plugin-testing-library` has a rule for
this and it is worth turning on.

⚠️ **`setup()` goes before `render`, not after.** The documented reason is that setup
applies workarounds to the document and installs shared state; establishing it first is the
pattern the docs show. It is also the ordering that keeps the clipboard stub in place for
everything the component does on mount.

## What the sequences actually look like

Knowing roughly what each call dispatches explains a lot of otherwise-mysterious component
behaviour.

- **`await user.click(el)`** — pointer moves over the element (`pointerover`,
  `pointerenter`, `mouseover`, `mouseenter`, `pointermove`, `mousemove`), then
  `pointerdown`, `mousedown`, **focus**, `pointerup`, `mouseup`, `click`. A component that
  reacts to `mousedown` — a dropdown that opens on press rather than click — works under
  `user-event` and does nothing under `fireEvent.click`.
- **`await user.type(el, 'ab')`** — clicks the element first (so it is focused), then for
  each character `keydown`, `keypress`, `input`, `keyup`, updating the value and the
  selection as it goes. Validation that runs per keystroke sees each keystroke, exactly as
  in the app.
- **`await user.tab()`** — moves focus in real tab order, which is how you test keyboard
  navigation and focus traps without inventing a synthetic `focus` event.

## The bugs only `user-event` can catch

**A disabled control that still acts.** The click never reaches a disabled button, so a
handler wired to the wrong element, or a "disabled" style with no `disabled` attribute,
fails the test. `fireEvent` passes both.

**An element covered by an overlay.** A modal that renders without trapping focus, or a
loading veil that does not block interaction, is invisible to `fireEvent` and visible to
the pointer-events check.

**Keystroke-level behaviour.** Anything driven by `keydown` — Escape closing a dialog,
Enter submitting, an autocomplete filtering per character, a maxlength guard — is testable
only if the keystrokes actually happen. `fireEvent.change` skips all of it.

**Focus consequences.** Blur validation, "save on focus loss", focus rings, and
`onFocus`-triggered data loading. `user-event` moves focus as a side effect of the
interaction; `fireEvent` requires you to remember to fire focus yourself, which means the
test asserts your memory rather than the component.

## Gotchas

**Symptom:** the assertion right after an interaction fails, and adding `await
waitFor(...)` "fixes" it.
**Cause:** the `user-event` call was not awaited, so its effects had not flushed.
**Fix:** `await` the call. A `waitFor` here is a workaround that hides the actual mistake
and slows the suite.

**Symptom:** `Unable to perform pointer interaction as the element has pointer-events: none`.
**Cause:** the element, or an ancestor, has `pointer-events: none` — often a loading overlay
or a CSS-disabled state.
**Fix:** treat it as a finding first — is the element supposed to be interactive right now?
If the state is intentional and you need to bypass the check, `pointerEventsCheck` is
configurable ([chunk 02](02-the-api-in-practice.md)), but that should be rare and deliberate.

**Symptom:** a test using `fireEvent.change` passes, and the same flow is broken in the app.
**Cause:** `fireEvent.change` sets the value and fires one event, skipping focus, keydown
and per-keystroke logic. Validation, masking and autocomplete never ran.
**Fix:** `await user.type(...)`, or `user.clear()` then `user.type()` when replacing a value.

**Symptom:** two `userEvent.setup()` instances in one test behave oddly with modifier keys.
**Cause:** input device state is per-instance; a key held on one instance is not held on the
other.
**Fix:** one `setup()` per test, at the top. Use `user.setup()` on the instance if you
genuinely need a second one sharing device state.

**Symptom:** every interaction test times out after switching to fake timers.
**Cause:** `user-event` inserts delays via `setTimeout`, which fake timers freeze.
**Fix:** pass the runner's advancement function as `advanceTimers`
([chunk 02](02-the-api-in-practice.md)).

## Interview questions

**★ What is the difference between `fireEvent` and `user-event`?**
`fireEvent` dispatches a single DOM event. `user-event` simulates a whole interaction — the
sequence of pointer, focus, keyboard and input events a browser would produce — and performs
visibility and interactability checks along the way. The practical consequence is that
`fireEvent` can "click" a disabled, hidden or covered element, so a suite built on it can
pass while the feature is unusable.

**★ Why does `user-event` v14 require `setup()` and `await`?**
`setup()` returns an instance whose methods share input device state, so consecutive
interactions behave like one continuous session — held modifiers, double-clicks, real focus
order — and it installs the document-level workarounds and the clipboard stub. The APIs are
asynchronous because real interactions involve delays and multiple dispatched events, so each
call returns a promise that must be awaited or the assertions run too early.

**★ Give a bug `fireEvent` cannot catch.**
A Submit button that is styled as disabled but has no `disabled` attribute, or a handler
attached to an element still covered by a loading overlay. `fireEvent.click` dispatches
regardless and the test passes; `user.click` either does nothing or throws on the
pointer-events check, which is the true behaviour.

**★ Why is `fireEvent.change(input, { target: { value: 'hello' } })` a poor way to fill a field?**
Because no user can produce that state: it sets the value in one step without focusing the
field or dispatching any keystrokes. Anything keystroke-driven — per-character validation,
input masking, autocomplete, maxlength, Enter-to-submit — is never exercised, so the test
proves only that the component renders whatever value it is handed.

**What actually happens when you call `await user.click(button)`?**
The pointer moves over the element firing the pointer and mouse enter/over/move events, then
`pointerdown`/`mousedown`, focus moves to the element, then `pointerup`/`mouseup` and finally
`click`. Components that respond to `mousedown` or to focus therefore behave in the test as
they do in the app.

**Where should `setup()` be called?**
Once per test, before `render`. It applies its workarounds to the document and establishes
the shared device state, and the pattern in the docs puts it first.

---

← Index: [`user-event` over `fireEvent`](README.md) ·
Next → [The API, and when `fireEvent` is still right](02-the-api-in-practice.md)
