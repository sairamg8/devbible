---
title: "The controlled contract"
sidebar_label: "01 · The controlled contract"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`<input>`](https://react.dev/reference/react-dom/components/input) (*Controlling an
> input with a state variable*, the Pitfall, the full Caveats list, and the troubleshooting
> entry *My text input doesn't update when I type into it*).
> No sandbox script backs this page; claims are cited, not measured.

**"Controlled" is not a style of writing forms — it is a contract with React that you will
supply the value on every render and update it synchronously on every change. Break either
half and the input does not misbehave slightly; it stops working.**

## What controlled means

> An input like `<input />` is **uncontrolled.** Even if you pass an initial value like
> `<input defaultValue="Initial text" />`, your JSX **only specifies the initial value. It
> does not control what the value should be right now.**

> **To render a _controlled_ input, pass the `value` prop to it (or `checked` for checkboxes
> and radios).** React will **force the input to always have the `value` you passed.**

```jsx
function Form() {
  const [firstName, setFirstName] = useState(''); // Declare a state variable...
  // ...
  return (
    <input
      value={firstName} // ...force the input's value to match the state variable...
      onChange={e => setFirstName(e.target.value)} // ... and update the state variable on any edits!
    />
  );
}
```

Read *"force the input to always have the `value` you passed"* literally, because it is
the whole mechanism. React is not observing the input; it is overwriting it. The DOM node's
value after every render is whatever your state says — which is exactly why the second half
of the contract is mandatory.

## 🔴 The Pitfall

> **If you pass `value` without `onChange`, it will be impossible to type into the input.**
> When you control an input by passing some `value` to it, you *force* it to always have
> the value you passed. So if you pass a state variable as a `value` but **forget to update
> that state variable synchronously during the `onChange` event handler**, React will
> **revert the input after every keystroke** back to the `value` that you specified.

The symptom is unmistakable once you know it: typing appears to do nothing. Not "the value
is wrong" — nothing happens at all, because every keystroke is immediately undone.

> Every controlled input needs an `onChange` event handler that **synchronously updates its
> backing value.**

**Synchronously** is the word that catches people. Updating the state in a `setTimeout`, a
`.then`, or after an `await` is too late — the render that follows the keystroke will use
the old value and revert the input. This is also why a controlled input's own update must
stay urgent and cannot be a transition
([Phase 8 · 07](../../phase-8-concurrent-suspense/07-urgent-vs-transition.md)); the docs
say plainly that *"Transition updates can't be used to control text inputs."*

The docs give the two fixes, and which one you want is a real decision:

```jsx
// 🔴 Bug: controlled text input with no onChange handler
<input value={something} />
```

```jsx
// ✅ Good: uncontrolled input with an initial value
<input defaultValue={something} />
```

```jsx
// ✅ Good: controlled input with onChange
<input value={something} onChange={e => setSomething(e.target.value)} />
```

**If you only ever wanted an initial value, `defaultValue` is the correct answer, not a
workaround.** Chunk 02 and [topic 05](../05-uncontrolled-and-formdata.md) make the case
that this is more often right than the React habit suggests.

There is also a third, deliberate case: `readOnly`. An input with `value` and no
`onChange` that is genuinely not meant to be edited should say so with `readOnly`, which
communicates the intent to the browser and to assistive technology rather than leaving a
field that silently refuses input.

## The caveats that decide architecture

> - **Checkboxes need `checked` (or `defaultChecked`), not `value` (or `defaultValue`).**
> - If a text input receives a **string `value` prop**, it will be treated as controlled.
> - If a checkbox or a radio button receives a **boolean `checked` prop**, it will be
>   treated as controlled.
> - **An input can't be both controlled and uncontrolled at the same time.**
> - **An input cannot switch between being controlled or uncontrolled over its lifetime.**

The last two are the ones that produce real bugs, and they have one common cause.

### 🔴 `undefined` is what flips an input to uncontrolled

An input is controlled *because it received a `value`*. So a `value` that is `undefined`
on the first render and a string later means the input started uncontrolled and became
controlled — the transition the docs forbid.

```jsx
// 🔴 user is undefined while loading, so `value` is undefined on the first render
<input value={user?.name} onChange={…} />
```

```jsx
// ✅ always a string
<input value={user?.name ?? ''} onChange={…} />
```

The same trap in the other direction: setting state back to `undefined` or `null` to
"clear" a field converts a controlled input to uncontrolled mid-life. **Clear to `''`, not
to nothing.**

For checkboxes it is `undefined` versus a boolean, with the same fix — default to `false`.

This is the single most common controlled-input bug in real codebases, and it is
structural: the value arrives asynchronously, and the first render happens before it does.

### Checkboxes take `checked`, not `value`

Worth stating separately because the mistake is quiet: a checkbox given `value={true}`
is not controlled at all — `value` on a checkbox is the string submitted when it is ticked,
which is a different concept entirely. It will simply not respond to state, and there is no
error.

## Controlled or not: the honest trade

> It is common to call a component with some local state **"uncontrolled"** … In contrast,
> you might say a component is **"controlled"** when the important information in it is
> driven by props rather than its own local state.
> — [Sharing State Between Components](https://react.dev/learn/sharing-state-between-components),
> quoted in [Phase 7 · 03 · 03](../../phase-7-custom-hooks/03-share-logic-not-state/03-when-you-wanted-shared-state.md)

For form fields specifically:

| Control it when | Leave it uncontrolled when |
|---|---|
| The value drives other UI as you type — a live preview, a filter, a character count | You only read it on submit |
| Another control depends on it — enabling a button, revealing a field | Nothing else needs it until submission |
| You must format or constrain input as it is typed | The browser's own behaviour is fine |
| The value can be set from elsewhere — a "use my saved address" button | It is only ever edited by the user |

**The React reflex is to control everything, and it is usually wrong for large forms.** A
controlled field re-renders the form on every keystroke; twenty of them re-render twenty
times per character unless carefully split. `FormData` reads the whole form at submit time
with no state at all ([topic 05](../05-uncontrolled-and-formdata.md)), and Actions
([topic 02](../02-actions.md)) are built around exactly that.

## Gotchas

**Symptom:** typing into an input does nothing at all.
**Cause:** `value` was passed without an `onChange` that synchronously updates it, so React
reverts the input after every keystroke.
**Fix:** add the handler, or use `defaultValue` if you only wanted an initial value, or
`readOnly` if it genuinely should not be edited.

**Symptom:** a console warning that a component is changing an uncontrolled input to
controlled.
**Cause:** `value` was `undefined` on the first render — usually data that had not loaded
yet — and became a string later.
**Fix:** `value={x ?? ''}`. An input cannot switch over its lifetime.

**Symptom:** clearing a field breaks it permanently.
**Cause:** state was set to `undefined` or `null`, flipping it to uncontrolled.
**Fix:** clear to `''`.

**Symptom:** a checkbox ignores its state entirely, with no error.
**Cause:** it was given `value` instead of `checked`; `value` on a checkbox is the string
submitted when ticked.
**Fix:** `checked` and `defaultChecked`.

**Symptom:** an input lags or drops characters in a large form.
**Cause:** every keystroke re-renders the whole form.
**Fix:** leave fields uncontrolled and read `FormData` on submit, or split the form so a
field's state lives with the field.

**Symptom:** a controlled input is updated in an async handler and reverts.
**Cause:** the update must be synchronous within `onChange`.
**Fix:** set state synchronously; do any async work afterwards.

## Interview questions

**★ What does "controlled" actually mean?**
That React forces the input to have the value you passed. It is not observing the field —
it overwrites the DOM node's value on every render to match your state. That is why the
contract has two halves: supply `value` (or `checked`), and update it synchronously in
`onChange`. Uncontrolled means React supplies at most an initial value with `defaultValue`
and then leaves the DOM to own it.

**★ Why does typing do nothing when you pass `value` without `onChange`?**
Because the input is forced to the value you passed, so each keystroke is immediately
reverted on the next render. The docs are explicit that it will be impossible to type. If
you only wanted an initial value, `defaultValue` is the right prop; if it should not be
edited, `readOnly` says so properly.

**★ What causes the "changing an uncontrolled input to be controlled" warning?**
A `value` of `undefined` on the first render — almost always data that had not loaded yet
— followed by a string later. An input is controlled *because* it received a value, so
`undefined` means uncontrolled, and an input cannot switch over its lifetime. The fix is
`value={x ?? ''}`, and the same trap in reverse is clearing a field to `null` instead of
`''`.

**★ Should every field be controlled?**
No, and the React reflex to control everything is usually wrong for large forms. Control a
field when its value drives other UI as you type, when another control depends on it, when
you must format input as it is typed, or when it can be set from elsewhere. Otherwise leave
it uncontrolled and read the whole form from `FormData` on submit — which is what Actions
are built around, and which costs no re-renders at all.

**Why must a controlled input's update be synchronous, and why can't it be a transition?**
Because the render following the keystroke uses whatever the state says; if the update has
not happened yet, that render reverts the input. It is the same reason React documents that
transition updates cannot control text inputs — a non-blocking update cannot promise the
value tracks the keystrokes.

**What is wrong with `value={true}` on a checkbox?**
It does not control it. Checkboxes are controlled by `checked` (or `defaultChecked`);
`value` on a checkbox is the string submitted when it is ticked, which is a different
concept. The checkbox will simply ignore your state, and nothing warns you.

---

← Index: [Controlled inputs](README.md) ·
Prev: [Phase 9](../README.md) ·
Next → [Every input type, and the one you cannot control](02-every-input-type.md)
