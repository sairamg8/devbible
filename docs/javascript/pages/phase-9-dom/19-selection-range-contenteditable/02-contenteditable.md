---
title: "02 · contenteditable"
sidebar_label: "02 · contenteditable"
sidebar_position: 2
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-14 against MDN — [`contenteditable`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/contenteditable), [`Document.execCommand()`](https://developer.mozilla.org/en-US/docs/Web/API/Document/execCommand), [`beforeinput` event](https://developer.mozilla.org/en-US/docs/Web/API/Element/beforeinput_event), [`InputEvent`](https://developer.mozilla.org/en-US/docs/Web/API/InputEvent), [`Clipboard API`](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API). Documentation-validated; **no timings**.

One attribute turns any element into an editor. The attribute is easy; everything after it is why
rich-text editing is a library-sized problem.

## The values

`contenteditable` is an **enumerated** attribute, not a boolean:

| Value | Behaviour |
|---|---|
| `true` or `""` | editable, rich text — pasted content keeps its formatting |
| `false` | not editable |
| `plaintext-only` | editable, **formatting stripped** — paste arrives as plain text |
| absent / invalid | **inherits** from the parent |

```html
<div contenteditable="plaintext-only">Type here — no bold, no lists, no pasted markup.</div>
```

🔴 **`plaintext-only` is the value most projects actually want** and few know exists. A single-line
"editable title", a comment box that must not accept markup, a code cell — all of them get the
paste-sanitising problem solved by the attribute rather than by a paste handler.

Two details that catch people:

- **It inherits.** `contenteditable="false"` inside an editable region carves out a non-editable
  island — how editors implement mentions and embedded widgets.
- **Nested editable elements are not tab stops.** MDN notes that nested `contenteditable` elements
  are not added to the tab sequence by default; add `tabindex="0"` if they should be reachable
  ([15 · 01](../15-focus-and-accessibility/01-what-can-hold-focus.md)).

Style the caret with `caret-color`, which is often the only styling an editable region needs beyond
the usual.

## `document.execCommand()` is deprecated *and* non-standard

MDN carries both banners, and the wording matters because this is still the first thing every
tutorial reaches for:

> The `execCommand()` method is "not implemented consistently or fully by user agents, and it is
> not expected that this will change in the foreseeable future."

Four documented consequences:

- **The markup differs per browser.** The same `execCommand('bold')` produces `<b>`, `<strong>` or
  a styled `<span>` depending on the engine — which is why an editor built on it cannot round-trip
  its own output reliably.
- **It may not fire `beforeinput` / `input`** — "depending on the browser and configuration". So
  your change tracking silently misses edits.
- **`insertHTML` is an injection sink.** MDN names it as such: a live XSS vector, the same class as
  `innerHTML` ([06 · Sanitising HTML](../06-sanitising-html/README.md)).
- **The return value is not feature detection.** It returns `true` only when invoked as part of a
  user interaction, so you cannot test support with it.

MDN's own suggested replacements: the **Clipboard API** for clipboard work, and `contenteditable`
plus your own DOM manipulation for editing. In practice: intercept `beforeinput`, apply the change
yourself with `Range` methods, and keep your own model of the document.

## `beforeinput` — the modern control point

`beforeinput` fires **before** the editable region changes, and it is the only place you can
intervene.

```js
editor.addEventListener('beforeinput', (event) => {
  if (event.inputType === 'formatBold') {
    event.preventDefault();
    applyBoldYourself(event.getTargetRanges());
  }
});
```

| Property | Gives |
|---|---|
| `inputType` | what kind of edit — `insertText`, `deleteContentBackward`, `insertFromPaste`, `formatBold`, … |
| `data` | the text being inserted, when there is one |
| `dataTransfer` | the payload for paste and drop |
| `getTargetRanges()` | the **static ranges** the edit will affect |

`getTargetRanges()` is the piece that makes non-`execCommand` editing possible: it tells you
*exactly* what the browser is about to change, before it changes it, so you can implement the
operation against your own model instead.

⚠️ **It is not a complete hook, and MDN says so:** "Not every user modification results in
`beforeinput` firing. Also the event may fire but be non-cancelable" — autocomplete, a spell-check
correction, password-manager autofill and IME composition are named cases. **Never rely on
`beforeinput` alone as your source of truth.** Reconcile with `input`, and treat the DOM as
authoritative afterwards.

For `contenteditable`, the event target is the **editing host** — the nearest ancestor whose parent
is not editable — not the innermost node the caret is in.

## Why editors are libraries

Everything above is the easy half. What a real editor also has to solve:

- **A document model.** The DOM the browser produces is not a clean representation of the document;
  editors keep their own model and render to the DOM, precisely so browser differences stop
  mattering.
- **Caret preservation across re-renders.** Any re-render throws the caret away, and a `Range`
  captured beforehand is invalidated by the same re-render
  ([01 · Selection and Range](./01-selection-and-range.md)). The position has to be stored as
  something re-derivable, not as a node reference.
- **IME composition.** `compositionstart` / `compositionupdate` / `compositionend`. During
  composition, intermediate DOM states are not real edits, and treating them as such breaks input
  in Japanese, Chinese and Korean — the most common way an editor is unusable for a large fraction
  of the world without anyone on the team noticing.
- **Paste sanitisation.** Pasting from a word processor brings hostile markup; `plaintext-only`
  solves this outright when you do not need rich text, and a sanitiser is required when you do.
- **Undo.** Native undo tracks the browser's own edits. Once you `preventDefault()` and apply
  changes yourself, the undo stack is yours to maintain.
- **Accessibility.** An editable region needs an accessible name and a role; a screen reader
  announces a bare editable `<div>` poorly.

**The recommendation, stated plainly:** use `contenteditable="plaintext-only"` for simple editable
text, and a maintained editor library for anything with formatting. Building the rich-text case
from these primitives is a multi-month project, and the interesting bugs are all in the list above.

## Gotchas

**Symptom: pasted content arrives with fonts, colours and `<span>` soup.**
Cause — `contenteditable="true"` preserves formatting.
Fix — `plaintext-only` when you do not want rich text; otherwise sanitise the `insertFromPaste`
payload from `dataTransfer` in `beforeinput`.

**Symptom: `execCommand('bold')` produces `<b>` in one browser and a `<span style>` in another.**
Cause — it is non-standard and inconsistently implemented, and MDN says that is not expected to
change.
Fix — apply the change yourself via `beforeinput` and `Range`, or use an editor library.

**Symptom: your change tracking misses some edits.**
Cause — `execCommand` may not fire `beforeinput`/`input`, and `beforeinput` itself does not fire
for every modification (autofill, spell-check, IME).
Fix — reconcile against the DOM on `input`; never treat `beforeinput` as the complete record.

**Symptom: the caret jumps to the start after every keystroke.**
Cause — re-rendering the editable region on `input` destroys and recreates the nodes the caret was
in.
Fix — do not re-render on every input; if you must, save a re-derivable position and restore it
after.

**Symptom: typing in Japanese produces broken or duplicated text.**
Cause — IME composition treated as ordinary input events.
Fix — track `compositionstart` / `compositionend` and ignore intermediate states.

**Symptom: an editable region inside another one cannot be reached by keyboard.**
Cause — nested editable elements are not in the tab sequence by default.
Fix — `tabindex="0"`.

**Symptom: `event.target` in `beforeinput` is not the element you expected.**
Cause — for `contenteditable` the target is the editing host, not the innermost node.
Fix — use `getTargetRanges()` for the affected nodes.

## Interview questions

**★ What does `contenteditable="plaintext-only"` do, and why is it useful?**
It makes the element editable while stripping formatting, so paste arrives as plain text. It solves
the paste-sanitisation problem declaratively for every case that does not genuinely need rich text.

**★ What is wrong with `document.execCommand()`?**
MDN marks it both deprecated and non-standard: inconsistent across browsers with no expectation of
that changing, it may not fire `beforeinput`/`input`, its `insertHTML` is an XSS injection sink,
and its return value cannot be used for feature detection.

**★ What replaces it?**
`beforeinput` to intercept the edit — `inputType` says what it is, `getTargetRanges()` says what it
will touch — then apply the change yourself with `Range` methods, against your own document model.
Clipboard work goes to the Clipboard API.

**★ Why can't you rely on `beforeinput` alone?**
MDN documents that not every user modification fires it, and that it can fire non-cancelably —
autocomplete, spell-check corrections, autofill and IME among them. Reconcile with `input` and the
DOM.

**★ Why do rich-text editors ship as large libraries?**
Because the DOM is not a document model: caret preservation across re-renders, IME composition,
paste sanitisation, undo once you take over the edits, cross-browser markup, and accessibility all
have to be solved on top of `contenteditable`.

**What breaks input for CJK users, and how do you avoid it?**
Treating IME composition states as real edits. Track `compositionstart`/`compositionend` and ignore
the intermediate DOM.

---

← [01 · Selection and Range](./01-selection-and-range.md) · [Topic index](./README.md) ·
[Phase 9 index](../README.md) →
