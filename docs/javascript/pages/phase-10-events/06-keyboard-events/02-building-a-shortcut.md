---
title: "02 · Building a shortcut"
sidebar_label: "02 · Building a shortcut"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`KeyboardEvent.key`](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key), [`KeyboardEvent.metaKey`](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/metaKey), [`KeyboardEvent.isComposing`](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/isComposing), [`Event.preventDefault()`](https://developer.mozilla.org/en-US/docs/Web/API/Event/preventDefault), [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal), [`accesskey`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/accesskey). Documentation-validated; **no timings**.

A keyboard shortcut is five lines of event handling and a long list of things that make it wrong
for somebody. This chunk is the list.

## The shape

```js
const controller = new AbortController();

document.addEventListener('keydown', (e) => {
  if (e.isComposing || e.repeat) return;         // IME, and auto-repeat
  if (isTyping(e.target)) return;                // the user is in a field
  if (!matches(e, { key: 'k', mod: true })) return;

  e.preventDefault();                            // only once we are sure we handled it
  openCommandPalette();
}, { signal: controller.signal });

// teardown, whole-listener, no identity juggling
controller.abort();
```

`{ signal }` is the cleanest teardown the platform offers — one `abort()` removes every listener
registered with it, sidestepping the `removeEventListener` identity trap from
[02 · `addEventListener`](../02-addeventlistener/README.md).

## `mod`: Command on macOS, Control everywhere else

```js
const isMac = navigator.platform.startsWith('Mac')
  || navigator.userAgentData?.platform === 'macOS';

function matches(e, { key, mod = false, shift = false, alt = false }) {
  const modPressed = isMac ? e.metaKey : e.ctrlKey;
  const wrongMod   = isMac ? e.ctrlKey : e.metaKey;   // don't fire on the OTHER one
  return e.key.toLowerCase() === key
    && modPressed === mod
    && !wrongMod
    && e.shiftKey === shift
    && e.altKey === alt;
}
```

Three details that matter more than they look:

- **Compare every modifier explicitly.** `if (e.ctrlKey && e.key === 's')` also fires for
  Ctrl+Shift+S and Ctrl+Alt+S, quietly stealing two more shortcuts.
- **Lower-case the key.** With Shift held, `e.key` is `'K'`, so a `=== 'k'` test silently fails for
  every shifted shortcut.
- ⚠️ **`navigator.platform` is deprecated.** It still works and is the most reliable check
  available; `navigator.userAgentData` is not universally supported. Use the pair, and treat the
  result as a hint, not a fact — which is another argument for letting users rebind.

## When not to fire

```js
function isTyping(el) {
  return el.matches?.('input, textarea, select, [contenteditable], [contenteditable=""]')
    ?? false;
}
```

Beyond typing, three more cases where a global shortcut must stand down:

- **A modal is open.** The shortcut should not act on the page behind it — which is one more reason
  the background is `inert`
  ([Phase 9 · 16 · 03](../../phase-9-dom/16-dialog-popover-inert/03-inert-and-the-top-layer.md)).
- **Focus is inside a component that owns its keys** — a code editor, a grid, a canvas app. Let the
  component handle the event and call `stopPropagation()`.
- **The event was already handled.** `e.defaultPrevented` tells you somebody downstream took it.

## Do not steal the browser's shortcuts

`preventDefault()` on the wrong combination breaks something the user relies on and cannot get
back:

| Reserved in practice | Why |
|---|---|
| Ctrl/⌘+T, W, N, Q, Tab | browser and OS level — many are not even delivered to the page |
| Ctrl/⌘+L, D, R | address bar, bookmark, reload |
| Ctrl/⌘ +/- and 0 | zoom — an accessibility control |
| **Tab and Shift+Tab** | 🔴 focus navigation — never repurpose |
| Escape | closing dialogs, cancelling — the platform expectation |

🔴 **Tab is the one that turns a shortcut into an accessibility failure.** A "Tab moves to the next
cell" grid that does not also provide a way out traps a keyboard user in the widget.

Ctrl/⌘+S, F, P and K are commonly overridden by apps that genuinely replace the underlying
function — save, find, print, search. Overriding them is defensible; overriding zoom is not.

**Call `preventDefault()` only inside the branch that actually handled the key**, never at the top
of the handler. A blanket `preventDefault()` in a `keydown` listener on `document` is how a page
ends up eating Tab and Ctrl+F.

## Making shortcuts discoverable and reachable

A shortcut nobody knows about is decoration:

- **Show it where the action is.** `<kbd>⌘K</kbd>` in the menu item, and in the tooltip.
- **Provide a list.** A "keyboard shortcuts" panel — conventionally on `?`.
- **Let users rebind.** The only real fix for layout conflicts, screen-reader key collisions and
  users who cannot press two keys at once.
- **Never make a shortcut the only route.** Every action needs a clickable control too.

📌 The HTML `accesskey` attribute exists for single-key access, but browser and platform key
combinations for it are inconsistent and it frequently collides with assistive-technology
shortcuts, so it is rarely the right answer.

## Sequences, and why to be careful

Gmail-style two-key sequences (`g` then `i`) need a short-lived buffer:

```js
let buffer = [];
let timer;

document.addEventListener('keydown', (e) => {
  if (e.isComposing || isTyping(e.target) || e.metaKey || e.ctrlKey) return;
  buffer.push(e.key.toLowerCase());
  clearTimeout(timer);
  timer = setTimeout(() => { buffer = []; }, 800);

  if (buffer.join('') === 'gi') { buffer = []; goToInbox(); }
});
```

⚠️ Unmodified single-letter shortcuts are the most hostile kind: they fire whenever focus is not in
a field, and they collide with screen-reader browse-mode keys, which use plain letters for
navigation. If you ship them, make them rebindable and switchable off.

## Gotchas

**Symptom: the shortcut fires while the user types in a search box.**
Cause — a `document`-level handler with no target check.
Fix — bail when `e.target` is an input, textarea, select or `[contenteditable]`.

**Symptom: Ctrl+Shift+S triggers the Ctrl+S handler.**
Cause — the condition checks `ctrlKey` and the key, but not the other modifiers.
Fix — compare all four modifier flags explicitly.

**Symptom: a shifted shortcut never matches.**
Cause — `e.key` is upper-case when Shift is held.
Fix — `e.key.toLowerCase()`.

**Symptom: the shortcut works on Windows and not on macOS.**
Cause — macOS uses `metaKey` for ⌘ while Windows and Linux use `ctrlKey`.
Fix — pick the modifier per platform, and reject the other one.

**Symptom: Tab stops moving focus after your handler ships.**
Cause — a blanket `preventDefault()` at the top of a `keydown` listener.
Fix — call it only in the branch that handled the key.

**Symptom: the shortcut fires twice.**
Cause — the listener is registered on two ancestors, or registered again on re-render.
Fix — register once and tear down with an `AbortController` signal.

**Symptom: a single-letter shortcut fires while a screen-reader user browses.**
Cause — browse mode uses plain letters for navigation.
Fix — require a modifier, allow rebinding, and provide an off switch.

## Interview questions

**★ How do you write a shortcut that works on both macOS and Windows?**
Detect the platform and use `metaKey` for ⌘ or `ctrlKey` for Control, rejecting the other so
Ctrl+K on macOS does not trigger the ⌘K handler. And compare every modifier flag, or you catch
combinations you did not intend.

**★ Why compare all four modifier flags?**
Because `e.ctrlKey && e.key === 's'` also matches Ctrl+Shift+S and Ctrl+Alt+S, stealing shortcuts
you never claimed.

**★ When should a global keyboard handler do nothing?**
When `e.isComposing` (IME), when `e.repeat` and you want one action per press, when focus is in a
field or a component that owns its keys, when a modal is open, and when `e.defaultPrevented` says
something already handled it.

**★ Which keys should you never intercept?**
Tab and Shift+Tab above all — they are focus navigation — plus zoom, and the browser/OS
combinations users depend on. Escape has a platform meaning you should honour rather than
repurpose.

**★ Where does `preventDefault()` belong in a shortcut handler?**
Inside the branch that actually handled the key, never at the top. A blanket call is how a page
ends up eating Tab and Ctrl+F.

**What makes a shortcut accessible?**
It is discoverable (shown in the UI and in a shortcuts panel), rebindable, never the only way to
perform the action, and it does not collide with assistive-technology keys — which unmodified
single-letter shortcuts routinely do.

---

← [01 · `key`, `code` and `keyCode`](./01-key-code-and-keycode.md) · [Topic index](./README.md) ·
**07 · Pointer events** *(not written yet)* →
