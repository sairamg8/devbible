---
title: "01 · What can hold focus"
sidebar_label: "01 · What can hold focus"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`tabindex`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/tabindex), [`HTMLElement.focus()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus), [`Document.activeElement`](https://developer.mozilla.org/en-US/docs/Web/API/Document/activeElement), [`focusin` event](https://developer.mozilla.org/en-US/docs/Web/API/Element/focusin_event), [`:focus-visible`](https://developer.mozilla.org/en-US/docs/Web/CSS/:focus-visible). Documentation-validated; **no timings**.

Focus is the browser's answer to "where does the next keystroke go". Exactly one element in a
document has it, you can read it, and — the part that goes wrong — you can lose it by accident.

## What is focusable without you doing anything

MDN lists the elements browsers give an implicit `tabindex="0"`:

`<a>` and `<area>` **with an `href`** · `<button>` · `<input>` · `<select>` · `<textarea>` ·
`<object>` · `<frame>`, `<iframe>` · `<summary>` inside `<details>` · the SVG `<a>` element.

🔴 **Do not add `tabindex` to these.** They are already in the tab order, and re-declaring it is
how positive values creep in.

Everything else — `<div>`, `<span>`, `<li>`, a heading — is not focusable until you say so.

## `tabindex`, and the only two values you should write

| Value | In the Tab order? | Focusable from script or a click? |
|---|---|---|
| `-1` (any negative) | **no** | **yes** |
| `0` | **yes**, in source order | yes |
| positive (`1`…`32767`) | yes, **before** every `0` | yes |

- **`tabindex="-1"`** — "focusable, but not a tab stop". This is the one you use for
  scroll-and-focus targets, for the element a modal moves focus to, for an error summary you want
  to announce. It is not reachable by Tab, which is correct: it is not a control.
- **`tabindex="0"`** — "put this in the tab order where it sits". For custom interactive
  components only.
- **Positive values** — MDN's wording is unambiguous:

  > You are recommended to only use `0` and `-1` as `tabindex` values. Avoid using `tabindex` values
  > greater than `0` […] Doing so makes it difficult for people who rely on using keyboard for
  > navigation or assistive technology to navigate and operate page content. Instead, write the
  > document with the elements in a logical sequence.

  One `tabindex="1"` anywhere on the page pulls that element in front of **every** natural tab
  stop, on every screen. It is a whole-document decision made in one component.

### `tabindex` does not make a `<div>` a button

The trap MDN calls out directly: a focusable non-interactive element is **not in the accessibility
tree as a control**. It takes focus, and a screen reader still announces nothing useful — no role,
no state, no name.

```html
<!-- ❌ focusable, but announced as nothing; no Enter/Space, no disabled state -->
<div tabindex="0" onclick="save()">Save</div>

<!-- ✅ -->
<button type="button" onclick="save()">Save</button>
```

A real `<button>` gets you: the role, keyboard activation on both Enter and Space, `disabled`,
form participation, and the platform's own focus ring. Reimplementing that list is the actual cost
of the `<div>`, and it is always underestimated.

## Reading and moving focus

```js
document.activeElement;                 // the focused element — never null in a rendered document
el.focus();                             // move focus here
el.focus({ preventScroll: true });      // …without scrolling it into view
el.blur();                              // remove focus — prefer focusing something else
```

Four behaviours to know:

- **`activeElement` falls back to `<body>`** when nothing specific is focused — including right
  after you remove the focused element from the DOM. That is the tell for the bug in
  [10 · Removing and replacing](../10-removing-and-replacing/02-cleanup.md): destroy the focused
  node and the keyboard user is dumped back at the top of the document.
- **`focus()` scrolls by default.** Pass `preventScroll: true` when you have already positioned
  the page — see [14 · Scrolling](../14-scrolling/02-landing-on-an-element.md).
- **`focus()` on a non-focusable element does nothing** — silently. No throw. If focus did not
  move, the element had no `tabindex` and is not natively focusable.
- **`blur()` is almost always the wrong tool.** It focuses nothing, so the next Tab starts from the
  top of the document. Move focus somewhere deliberate instead.

### Focus inside a shadow root

`document.activeElement` returns the **host** element, not the node inside the shadow tree. To find
the real one you walk down:

```js
function deepActiveElement(root = document) {
  const el = root.activeElement;
  return el?.shadowRoot ? deepActiveElement(el.shadowRoot) : el;
}
```

Each shadow root has its own `activeElement`, which is the same encapsulation boundary that ends
the `closest()` walk in [07 · Traversal](../07-traversal/02-closest-matches-and-scope.md).

## The four focus events

| Event | Bubbles? | Fires |
|---|---|---|
| `focus` | **no** | on gaining focus |
| `blur` | **no** | on losing focus |
| `focusin` | **yes** | on gaining focus, after `focus` |
| `focusout` | **yes** | on losing focus |

🔴 **`focus` and `blur` do not bubble** — which is why delegation for them does not work and people
conclude their listener is broken. Use `focusin` / `focusout` on the container:

```js
// ❌ never fires: focus does not bubble to the form
form.addEventListener('focus', highlightRow);

// ✅
form.addEventListener('focusin', highlightRow);
```

`relatedTarget` tells you the other side of the move — on `focusout` it is the element **gaining**
focus, on `focusin` the one that lost it. It is the correct way to ask "did focus leave this
component entirely?":

```js
menu.addEventListener('focusout', (e) => {
  if (!menu.contains(e.relatedTarget)) closeMenu();   // left the component, not just the item
});
```

⚠️ `relatedTarget` is `null` when focus moves to nothing the page can see — another window, the
browser chrome, or the address bar. Treat `null` as "not inside me", or a click on the browser UI
closes your menu.

📌 MDN notes that the UI Events spec describes an order of focus events **different from what
browsers implement**. Do not build logic that depends on the exact interleaving of
`blur`/`focusout`/`focus`/`focusin`; depend on `relatedTarget` and `activeElement` instead.

### The `document.activeElement` timing trap

Inside a `blur` or `focusout` handler, `document.activeElement` may still be the **old** element —
the move has not completed. Use `event.relatedTarget`, or defer:

```js
el.addEventListener('focusout', () => {
  queueMicrotask(() => console.log(document.activeElement));   // now it is the new one
});
```

## `:focus` versus `:focus-visible`

The focus ring is not decoration; removing it is the most common accessibility regression in front
end code. MDN is blunt: "Removing focus styles makes keyboard navigation inaccessible for sighted
users."

`:focus-visible` is the escape from the old dilemma — it matches only when the browser's own
heuristics say the ring should be shown: keyboard navigation yes, a mouse click on a button
usually no, **script-managed focus generally yes**.

```css
/* the ring appears for keyboard users and scripted focus, not for a mouse click */
.button:focus-visible {
  outline: 3px solid deepskyblue;
  outline-offset: 3px;
}

@supports not selector(:focus-visible) {
  .button:focus { outline: 3px solid deepskyblue; outline-offset: 3px; }
}
```

| Selector | Matches |
|---|---|
| `:focus` | the focused element, whatever moved focus there |
| `:focus-visible` | the focused element **when the browser judges a ring is warranted** |
| `:focus-within` | any ancestor **containing** the focused element |

WCAG 2.1 SC 1.4.11 requires the indicator to have at least **3:1** contrast against its
surroundings — `outline: none` with nothing in its place fails outright, and a 1px light-grey ring
usually fails too. `:focus-within` is the one to reach for when a whole card or form group should
show it holds focus.

## Gotchas

**Symptom: your `focus` listener on a container never fires.**
Cause — `focus` and `blur` do not bubble.
Fix — `focusin` / `focusout`, which do.

**Symptom: `el.focus()` does nothing and no error appears.**
Cause — the element is not focusable: no `tabindex`, not a natively focusable element, or it is
`display: none`, `disabled`, or inside an `inert` subtree.
Fix — add `tabindex="-1"` for a programmatic target; check `document.activeElement` afterwards to
confirm the move actually happened.

**Symptom: after deleting a row, Tab starts from the top of the page.**
Cause — the removed element had focus, so `activeElement` fell back to `<body>`.
Fix — before removing, check `el.contains(document.activeElement)` and move focus to a sensible
neighbour first.

**Symptom: a dropdown closes when the user clicks the browser's address bar.**
Cause — `focusout` fired with `relatedTarget === null`, and the code treated null as "outside".
Fix — decide deliberately: `if (e.relatedTarget && !menu.contains(e.relatedTarget))` keeps the menu
open when focus leaves the page entirely.

**Symptom: `document.activeElement` is the old element inside a `focusout` handler.**
Cause — focus has not finished moving.
Fix — use `event.relatedTarget`, or read it in a `queueMicrotask` / `setTimeout(…, 0)`.

**Symptom: the focus ring shows on mouse clicks and designers ask you to remove it.**
Cause — `:focus` matches every input method.
Fix — style `:focus-visible` instead of removing the outline. Never ship `outline: none` without a
replacement indicator at 3:1 contrast.

**Symptom: Tab order jumps around the page unpredictably.**
Cause — a positive `tabindex` somewhere, or CSS (`order`, `grid-area`, `flex-direction: row-reverse`)
reordering elements visually while the tab order follows the source.
Fix — only `0` and `-1`; fix the order in the DOM, not with numbers.

## Interview questions

**★ What is the difference between `tabindex="0"` and `tabindex="-1"`?**
`0` puts the element in the natural tab order. `-1` makes it focusable **only** programmatically or
by click — the value for elements you send focus to (a modal, an error summary, a scroll target)
that should not be tab stops.

**★ Why are positive `tabindex` values discouraged?**
They jump ahead of every element with `0` or an implicit tab stop, across the entire document. One
component's local decision reorders the whole page, and it is nearly impossible to keep coherent as
the page changes. MDN recommends only `0` and `-1`.

**★ Why doesn't my `focus` event listener on a parent fire?**
`focus` and `blur` do not bubble. `focusin` and `focusout` are the bubbling versions, which is what
makes delegation and "did focus leave this component" checks possible.

**★ How do you tell that focus has left a component entirely?**
Listen for `focusout` and test `!component.contains(event.relatedTarget)`. Handle
`relatedTarget === null` deliberately — it means focus went somewhere the page cannot see, such as
the browser chrome.

**★ Why is `:focus-visible` preferred over `:focus`?**
It shows the indicator when it is needed — keyboard navigation and scripted focus — and suppresses
it after a mouse click, which is the reason teams delete focus rings in the first place. It removes
the excuse for `outline: none`.

**Does adding `tabindex="0"` to a `<div>` make it an accessible button?**
No. It becomes focusable but has no role, no name, no keyboard activation and no disabled state,
and MDN warns it is not exposed as a control in the accessibility tree. Use `<button>`.

**What is `document.activeElement` when nothing is focused?**
`<body>` — including immediately after the focused element is removed from the DOM, which is why
element removal needs a focus-restoration step.

---

[Topic index](./README.md) · [02 · Managing focus](./02-managing-focus.md) →
