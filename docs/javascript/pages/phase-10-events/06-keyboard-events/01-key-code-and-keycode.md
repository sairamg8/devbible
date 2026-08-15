---
title: "01 · key, code and keyCode"
sidebar_label: "01 · key, code and keyCode"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`KeyboardEvent.key`](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key), [`KeyboardEvent.code`](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code), [`KeyboardEvent.keyCode`](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/keyCode), [`KeyboardEvent.isComposing`](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/isComposing), [`keydown` event](https://developer.mozilla.org/en-US/docs/Web/API/Element/keydown_event). Documentation-validated; **no timings**.

Three properties describe "which key", they answer different questions, and picking the wrong one
is why a shortcut works on your keyboard and not on someone else's.

| Property | Answers | Layout-aware | Modifier-aware |
|---|---|---|---|
| **`key`** | *what character was produced* | **yes** | **yes** |
| **`code`** | *which physical key was pressed* | no | no |
| ⚠️ **`keyCode`** | a legacy number | no | no |

```js
// pressing the key marked B on a US layout
event.key   // 'b'  — or 'B' with Shift
event.code  // 'KeyB' — with or without Shift
```

## `key` — use it for text and for named keys

`key` gives the character the key produced, so it accounts for Shift, for AltGr, and for the user's
layout. It also names every non-printing key: `'Enter'`, `'Escape'`, `'Tab'`, `'ArrowDown'`,
`'Backspace'`, `'Home'`, `'PageUp'`, and `' '` — a single space — for the space bar.

```js
window.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'Escape': closeDialog(); break;
    case 'ArrowDown': moveSelection(1); break;
    case ' ': toggle(); break;          // note: a space, not 'Space'
  }
});
```

📌 Space is `' '` in `key` and `'Space'` in `code` — the single most common typo in shortcut code.

Two special values MDN documents:

- **`'Dead'`** — a dead key, the first half of an accented character (`´` then `e` → `é`). It is
  not a character yet.
- **`'Unidentified'`** — the browser could not identify the key.

## `code` — use it for positions

`code` is the physical key, named after its position on a **US** layout regardless of the user's
actual layout: `'KeyW'`, `'KeyA'`, `'KeyS'`, `'KeyD'`, `'Digit1'`, `'Space'`, `'ShiftLeft'`,
`'ShiftRight'`.

That is exactly right for game controls — WASD stays a physical diamond under the left hand on an
AZERTY keyboard, where `key` would report `'z'`, `'q'`, `'s'`, `'d'`.

```js
if (e.code === 'KeyW') moveForward();     // the key above A, whatever it prints
```

🔴 **And exactly wrong for text shortcuts.** `code === 'KeyZ'` for undo means the user of a
Dvorak or AZERTY layout presses a key marked something else. **Text-meaning shortcuts use `key`;
position-meaning shortcuts use `code`.** That single sentence resolves most of the confusion.

⚠️ `code` also distinguishes left and right modifiers (`'ShiftLeft'` / `'ShiftRight'`), which `key`
does not — both report `'Shift'`.

## `keyCode` is deprecated

MDN marks it deprecated: do not use it in new code. It survives in old codebases as magic numbers —
13 for Enter, 27 for Escape, 32 for space — and the sensible move when you meet them is to
translate to `key`, not to keep the table.

There is one place the number still matters, and only as a symptom: **during IME composition the
`keyCode` may be `229`**. If you find a `=== 229` check in old code, it is an IME guard, and the
modern spelling is `event.isComposing`.

## The event sequence

For one key press, with nothing prevented:

1. **`keydown`** — fires; repeats while the key is held, with `event.repeat === true`.
2. **`beforeinput`** and **`input`** — only for keys that produce a character, and only in editable
   elements ([05 · Form and input events](../05-form-and-input-events/01-the-event-set.md)).
3. **`keyup`** — on release.

⚠️ **`keypress` is deprecated.** It only ever fired for character keys and got the details wrong;
`keydown` plus `beforeinput` covers everything it did.

`event.repeat` is what stops a held key from firing an action thirty times:

```js
if (e.repeat) return;      // act once per physical press
```

## IME composition: the guard nobody writes first

While an IME is composing, keystrokes belong to the composition, not to your shortcuts.

```js
input.addEventListener('keydown', (e) => {
  if (e.isComposing) return;          // ← the whole guard
  if (e.key === 'Enter') submit();
});
```

🔴 **Without it, Enter-to-confirm submits the form while a CJK user is still choosing a
candidate** — one of the most common ways an app is quietly broken for a large fraction of the
world. It is the same rule as the formatter guard in
[05 · 02](../05-form-and-input-events/02-a-controlled-input.md), and it costs one line.

## Modifier state

```js
e.shiftKey; e.ctrlKey; e.altKey; e.metaKey;    // booleans, on every key and mouse event
e.getModifierState('CapsLock');                // also 'NumLock', 'ScrollLock', …
```

`metaKey` is Command on macOS and the Windows key elsewhere — which is why the platform check in
[02 · Building a shortcut](./02-building-a-shortcut.md) exists.

`getModifierState('CapsLock')` is the honest way to tell someone their password is being typed in
caps, and it works without recording anything.

## Gotchas

**Symptom: the space-bar case in your `switch` never matches.**
Cause — `key` for space is `' '`, not `'Space'` (that is `code`).
Fix — `case ' ':`.

**Symptom: WASD controls move the wrong way on a French keyboard.**
Cause — the handler uses `key`, which is layout-dependent.
Fix — `code` for position-based controls.

**Symptom: Ctrl+Z does nothing on a Dvorak layout.**
Cause — the handler uses `code === 'KeyZ'`, a physical position.
Fix — `key === 'z'` for meaning-based shortcuts.

**Symptom: a held key fires the action repeatedly.**
Cause — `keydown` repeats while held.
Fix — `if (e.repeat) return;`.

**Symptom: pressing Enter to confirm submits while a CJK user is mid-composition.**
Cause — no IME guard.
Fix — `if (e.isComposing) return;` — and note the legacy equivalent was `keyCode === 229`.

**Symptom: accented characters arrive as two events and your filter rejects them.**
Cause — dead keys report `key === 'Dead'` before producing the character.
Fix — do not filter on `keydown` for text; use `beforeinput`, which sees the resulting edit.

**Symptom: a `keypress` handler stopped firing for some keys.**
Cause — `keypress` is deprecated and never fired for non-character keys.
Fix — `keydown`, plus `beforeinput` when you care about the text.

## Interview questions

**★ What is the difference between `key` and `code`?**
`key` is the character produced, so it respects layout and modifiers; `code` is the physical key,
named for its US-layout position, and never changes with layout or Shift. Use `key` for
text-meaning shortcuts and named keys, `code` for positional controls like WASD.

**★ Why is `keyCode` deprecated, and where does the number 229 still appear?**
It is a legacy numeric encoding that `key` and `code` replaced. 229 shows up as the `keyCode`
during IME composition — the modern check is `event.isComposing`.

**★ How do you stop a held key from repeating your action?**
`event.repeat` is `true` for the auto-repeat events; return early when it is set.

**★ Why does Enter-to-submit break Japanese input, and how do you fix it?**
Because Enter is also how the user accepts an IME candidate. Guard the handler with
`if (e.isComposing) return;`.

**★ Which events fire for one key press?**
`keydown` (repeating while held), then `beforeinput` and `input` if the key produces a character in
an editable element, then `keyup` on release. `keypress` is deprecated.

**How do you detect Caps Lock without logging keys?**
`event.getModifierState('CapsLock')` on any key event.

---

[Topic index](./README.md) · [02 · Building a shortcut](./02-building-a-shortcut.md) →
