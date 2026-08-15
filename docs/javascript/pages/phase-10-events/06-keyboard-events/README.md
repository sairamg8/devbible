---
title: "06 · Keyboard events"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`KeyboardEvent.key`](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key), [`KeyboardEvent.code`](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code), [`KeyboardEvent.keyCode`](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/keyCode), [`KeyboardEvent.isComposing`](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/isComposing), [`keydown` event](https://developer.mozilla.org/en-US/docs/Web/API/Element/keydown_event). Documentation-validated; **no timings**.

The syllabus row is *`key` versus `code` versus deprecated `keyCode`, modifier state, IME
composition, and implementing a shortcut* — and those four are in dependency order: the first
decides whether your shortcut works on other people's keyboards, and the third decides whether it
works in other people's languages.

🔴 **The one-line rule:** **`key` for shortcuts that mean a character, `code` for controls that mean
a position.** `keyCode` is deprecated; the only reason to recognise it is the `229` that used to
mean "IME is composing".

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[`key`, `code` and `keyCode`](./01-key-code-and-keycode.md)** | What each property answers, the named key values (and space being `' '`), `'Dead'` and `'Unidentified'`, the event sequence and `repeat`, deprecated `keypress`, `isComposing`, and modifier state |
| 02 | **[Building a shortcut](./02-building-a-shortcut.md)** | The handler shape with `AbortController`, ⌘-versus-Ctrl, comparing every modifier, when to stand down, the keys you must not steal, discoverability and rebinding, and key sequences |

## Three facts worth carrying out of this topic

- **Space is `' '` in `key` and `'Space'` in `code`.** The most common typo in shortcut code.
- **`if (e.isComposing) return;`** — one line, and without it Enter-to-confirm fires while a CJK
  user is choosing an IME candidate.
- **Never intercept Tab.** It is focus navigation, and repurposing it traps keyboard users.

## Phase gate

You can attach one listener to a table and handle clicks on any button in any row, including
buttons added later.

## Where this connects

- [05 · Form and input events](../05-form-and-input-events/01-the-event-set.md) — why a global
  handler must bail when the user is typing, and `beforeinput` for text rather than key filtering
- [02 · `addEventListener`](../02-addeventlistener/README.md) — the `signal` option that makes
  teardown one `abort()`
- [Phase 9 · 15 · Focus and accessibility](../../phase-9-dom/15-focus-and-accessibility/02-managing-focus.md)
  — roving tabindex, the arrow-key pattern composite widgets use
- [Phase 9 · 16 · `inert`](../../phase-9-dom/16-dialog-popover-inert/03-inert-and-the-top-layer.md)
  — why shortcuts should not act on a page behind a modal

---

Start → [01 · `key`, `code` and `keyCode`](./01-key-code-and-keycode.md)
