---
title: "02 · A controlled input by hand"
sidebar_label: "02 · A controlled input by hand"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`input` event](https://developer.mozilla.org/en-US/docs/Web/API/Element/input_event), [`beforeinput` event](https://developer.mozilla.org/en-US/docs/Web/API/Element/beforeinput_event), [`HTMLInputElement.setSelectionRange()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/setSelectionRange), [`compositionstart` event](https://developer.mozilla.org/en-US/docs/Web/API/Element/compositionstart_event), [`HTMLInputElement.value`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/value). Documentation-validated; **no timings**.

The syllabus row ends with *building a controlled input by hand* — which is worth doing once,
because it explains every controlled-input bug you will ever meet in a framework.

## What "controlled" means

An input is **uncontrolled** when the DOM owns the value: the user types, the element remembers, you
read it when you need it.

```js
form.addEventListener('submit', (e) => {
  e.preventDefault();
  send(new FormData(form));        // ask the DOM at the last moment
});
```

An input is **controlled** when your state owns the value: the element only ever displays what your
state says, and every keystroke is a request to change that state.

```js
let value = '';

input.addEventListener('input', (e) => {
  value = e.target.value;          // 1. the user's edit becomes a state change
  render();                        // 2. state decides what the input shows
});

function render() {
  if (input.value !== value) input.value = value;   // ← the guard that matters
}
```

🔴 **The `if` in `render()` is the whole trick.** Assigning `input.value` unconditionally — even the
same string — resets the caret to the end of the field in most browsers. Every "the cursor jumps to
the end when I type in the middle" bug is a missing version of that comparison.

**The trade-off:** uncontrolled is less code and never fights the browser; controlled is what you
need when the value must be transformed, validated live, or kept in sync with something else. Reach
for controlled only when one of those is true.

## Transforming as the user types

The moment you rewrite the value, you own the caret:

```js
input.addEventListener('input', () => {
  const start = input.selectionStart;
  const before = input.value;
  const after = before.toUpperCase();
  if (after === before) return;

  input.value = after;
  input.setSelectionRange(start, start);   // put the caret back where it was
});
```

For a formatter that inserts characters — a phone number, a card number, a thousands separator —
restoring the raw offset is wrong, because the inserted separators shift everything after the
caret. The technique that works is to count only the characters that matter:

```js
function digitsBefore(text, index) {
  return text.slice(0, index).replace(/\D/g, '').length;
}

input.addEventListener('input', () => {
  const digitIndex = digitsBefore(input.value, input.selectionStart);
  const formatted = format(input.value.replace(/\D/g, ''));

  input.value = formatted;

  // walk forward until we have passed the same number of digits
  let pos = 0, seen = 0;
  while (pos < formatted.length && seen < digitIndex) {
    if (/\d/.test(formatted[pos])) seen++;
    pos++;
  }
  input.setSelectionRange(pos, pos);
});
```

The principle generalises: **anchor the caret to something stable in the user's model** — the nth
digit, the nth word — not to a raw string offset that your own formatting has invalidated.

## Do not fight the IME

For Chinese, Japanese and Korean input, an IME composes characters over several keystrokes, and the
intermediate value is **not** something to transform, validate or upper-case.

```js
let composing = false;
input.addEventListener('compositionstart', () => { composing = true; });
input.addEventListener('compositionend', () => { composing = false; onInput(); });
input.addEventListener('input', () => { if (!composing) onInput(); });
```

🔴 **A formatter without this guard makes the field unusable in CJK input** — every partial
composition is rewritten and the composition breaks. It costs three lines and is almost always
missing.

## Rejecting input instead of transforming it

To block a kind of edit rather than fix it up afterwards, cancel it before it happens:

```js
input.addEventListener('beforeinput', (e) => {
  if (e.inputType.startsWith('insert') && e.data && /\D/.test(e.data)) {
    e.preventDefault();                  // digits only, paste included
  }
});
```

This beats `keydown` filtering, which cannot see paste or drop, and beats stripping in `input`,
which has already moved the caret.

⚠️ Rejection is a poor primary strategy for validation: silently refusing keystrokes with no
explanation is hostile, and the same values arrive by paste, autofill or a script anyway. Use
`type="number"`, `inputmode`, `pattern` and the constraint-validation API
([Phase 9 · 09 · 02](../../phase-9-dom/09-forms/02-constraint-validation.md)) as the real
validation, and treat `beforeinput` rejection as a convenience.

## Debouncing without losing the last keystroke

```js
let timer;
input.addEventListener('input', (e) => {
  const value = e.target.value;          // capture NOW
  clearTimeout(timer);
  timer = setTimeout(() => search(value), 300);
});
```

Reading `input.value` inside the timeout instead is the common bug: it reads whatever the field
holds when the timer fires, which is usually the same, and is wrong the moment the field is cleared
or re-rendered in between. Also clear the pending timer on `submit`, or the search fires after the
form has already been sent.

## Gotchas

**Symptom: the caret jumps to the end when typing in the middle of a controlled input.**
Cause — `input.value` is assigned on every render, even when the string is unchanged.
Fix — assign only when `input.value !== state`.

**Symptom: the caret jumps after a formatter inserts a separator.**
Cause — the old numeric offset no longer points at the same character.
Fix — count stable units (digits, words) before the caret and re-derive the offset after
formatting.

**Symptom: Japanese or Chinese input is broken or duplicated in a formatted field.**
Cause — the formatter runs during IME composition.
Fix — a `composing` flag from `compositionstart` / `compositionend`, and skip `input` while it is
set.

**Symptom: the debounced search runs with a stale or empty value.**
Cause — the value is read inside the timeout rather than captured in the handler.
Fix — capture `e.target.value` synchronously and close over it.

**Symptom: pasting bypasses your digits-only filter.**
Cause — the filter is on `keydown`, which knows nothing about paste.
Fix — `beforeinput` with `inputType` / `data`, or sanitise in `input` as a backstop.

**Symptom: a controlled input rejects the user's own typing intermittently.**
Cause — the render is asynchronous, so a keystroke arrives between the state update and the
re-render and gets overwritten.
Fix — write state synchronously in the handler, and only ever assign the element's value from the
latest state.

## Interview questions

**★ What makes an input "controlled", and what does it cost?**
Your state is the source of truth and the element only displays it, so every keystroke is a state
update followed by a render. The cost is that you now own caret position, IME composition and
re-render timing — all of which the DOM handled for you when it owned the value.

**★ Why does the caret jump to the end of a controlled input?**
Because assigning `input.value` resets the selection, even when the new string is identical. Guard
the assignment with a comparison against the current value.

**★ How do you preserve the caret through a formatter that inserts characters?**
Do not restore the raw offset. Count a stable unit — digits before the caret, for instance — then
walk the formatted string until you have passed the same count.

**★ Why does a formatted input break for CJK users?**
The formatter runs on intermediate IME composition states. Track `compositionstart` /
`compositionend` and skip processing while composing.

**★ When is an uncontrolled input the better choice?**
Whenever you only need the value at submit time. Let the DOM own it and read it with `FormData` —
less code, and none of the caret or composition problems.

**Why capture `e.target.value` before debouncing?**
Because the field can change or be re-rendered before the timer fires, so reading it inside the
callback gives you a value that no longer corresponds to the keystroke you were reacting to.

---

← [01 · The event set](./01-the-event-set.md) · [Topic index](./README.md) ·
**06 · Keyboard events** *(not written yet)* →
