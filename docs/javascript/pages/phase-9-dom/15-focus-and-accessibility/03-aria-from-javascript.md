---
title: "03 · ARIA from JavaScript"
sidebar_label: "03 · ARIA from JavaScript"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`Element.ariaExpanded`](https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaExpanded) and the ARIA reflection properties, [`aria-hidden`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-hidden), [`aria-label`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-label), [`inert`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inert). Documentation-validated; **no timings**.

ARIA does exactly one thing: it changes what an element is reported as in the **accessibility
tree**. It changes no behaviour — no keyboard handling, no focusability, no styling. Everything
ARIA promises, you have to implement.

🔴 **The first rule of ARIA is not to use ARIA.** A native element with the right semantics beats
any amount of `role` and `aria-*`, because the native one brings the behaviour with it. Reach for
ARIA when there is no native element for what you are building — a tab list, a combobox, a tree —
or when you need to express **state** the platform has no attribute for.

## State is the part JavaScript owns

Roles are usually static markup. **States change**, and every state change is a line of JavaScript
you have to remember to write. These are the ones that come up constantly:

| Attribute | On | Says |
|---|---|---|
| `aria-expanded` | the **trigger**, not the panel | this control's disclosure is open |
| `aria-pressed` | a toggle button | it is currently pressed |
| `aria-selected` | a tab, an option | it is the selected one in its group |
| `aria-checked` | a custom checkbox/radio | checked, unchecked, or `"mixed"` |
| `aria-current` | a nav link, a step | `"page"`, `"step"`, `"true"` — the one you are on |
| `aria-disabled` | any control | announced as disabled but **still focusable** |
| `aria-busy` | a region being updated | do not announce yet, it is mid-update |
| `aria-controls` / `aria-describedby` | a control | which element it drives / describes |

```js
button.addEventListener('click', () => {
  const open = panel.hidden;
  panel.hidden = !open;
  button.setAttribute('aria-expanded', String(open));   // ← the half people forget
});
```

🔴 **`aria-expanded` goes on the control that toggles, not on the thing being toggled.** The most
common ARIA bug in real code is putting it on the panel, where no screen reader user will encounter
it before activating the control.

⚠️ **`aria-disabled` is not `disabled`.** `disabled` removes the control from the tab order and
blocks its events; `aria-disabled="true"` only changes the announcement, and the control still
receives focus and still fires `click` — so you must ignore the click yourself. That is sometimes
exactly what you want (a disabled control a keyboard user can still reach and read), but it is a
deliberate choice, not a synonym.

## Two ways to write it, and when the property form helps

```js
el.setAttribute('aria-expanded', 'true');   // the attribute
el.ariaExpanded = 'true';                   // the reflected property — Baseline since Oct 2023
```

The reflection properties mirror the attributes one-for-one (`ariaLabel` ↔ `aria-label`,
`ariaHidden` ↔ `aria-hidden`, and so on). Two things to hold:

- 🔴 **The values are strings, not booleans.** `el.ariaExpanded = true` stores `"true"`, which
  happens to work — but `el.ariaExpanded = false` stores `"false"`, and `"false"` is *not* falsy
  when you read it back. `if (el.ariaExpanded)` is true for both states. Compare explicitly:
  `el.ariaExpanded === 'true'`.
- **Removing state is `removeAttribute`.** Setting `null` or `''` is not the same as absent for
  every attribute, and "absent" is a meaningful third value for things like `aria-current`.

This is the same attribute-versus-property distinction as
[05 · Attributes versus properties](../05-attributes-vs-properties/README.md) — except here the
property is a plain reflection with no separate live value, so the two never diverge.

## Names: `aria-label` versus `aria-labelledby` versus real text

Every interactive element needs an **accessible name**. In order of preference:

1. **Visible text content** — `<button>Delete invoice</button>`. Free, translated, searchable, and
   it matches what a voice-control user will say.
2. **`aria-labelledby`** pointing at existing visible text, by id. Good for a dialog titled by its
   own heading: `<div role="dialog" aria-labelledby="dlg-title">`.
3. **`aria-label`** — a string with no visible counterpart. The last resort, because it is
   invisible to sighted users, easy to leave stale, and frequently untranslated.

⚠️ **`aria-label` overrides the visible text.** A button labelled `aria-label="Remove"` whose text
says "Delete" is announced as "Remove" — and a voice-control user saying "click Delete" fails. If
there is visible text, let it be the name.

Icon-only buttons are the case that genuinely needs a name from ARIA:

```html
<button type="button" aria-label="Close dialog">
  <svg aria-hidden="true" focusable="false"><!-- … --></svg>
</button>
```

`aria-hidden="true"` on the decorative SVG stops it contributing noise to the name, and
`focusable="false"` keeps old browsers from making the SVG a tab stop.

## `aria-hidden`, and the mistake it invites

`aria-hidden="true"` removes an element and its subtree **from the accessibility tree only**. It
does not hide it visually, does not stop clicks, and — the part that bites — **does not remove it
from the tab order**.

🔴 **Never put `aria-hidden="true"` on anything focusable, or on an ancestor of anything
focusable.** The result is a control a keyboard user can Tab to and a screen reader announces as
nothing at all. This is the single most common way "accessible" markup gets worse, and it is why
[02 · Managing focus](./02-managing-focus.md) uses `inert` for backgrounds:

| Want | Use |
|---|---|
| hide a decorative icon from announcement | `aria-hidden="true"` |
| take a whole region out of interaction and announcement | `inert` |
| hide from everyone | `display: none` / `hidden` — already out of both trees |
| visible to screen readers but not on screen | a visually-hidden CSS class, **not** `aria-hidden` |

Note the last row: `display: none` and `visibility: hidden` remove content from the accessibility
tree as well as the screen, so a "screen-reader only" helper must use the clip-and-offset pattern
rather than `display: none`.

## Keep state in the DOM, not in a variable

```js
// ❌ two sources of truth; they drift the first time anything else toggles the panel
let isOpen = false;

// ✅ one source of truth — the attribute you already have to maintain
const isOpen = () => button.ariaExpanded === 'true';
```

Reading state back from the attribute you are already obliged to write means the announcement and
the behaviour cannot disagree. This is the same argument as `classList.toggle(name, force)` in
[08 · Classes and styles](../08-classes-and-styles/01-classlist.md): one write, one truth.

**The trade-off:** attribute reads are a DOM access rather than a variable read, and in a hot loop
that matters — but a toggle handler is not a hot loop, and the drift bug it prevents is real.

## Gotchas

**Symptom: a screen reader announces the button but never says "collapsed" or "expanded".**
Cause — `aria-expanded` is on the panel instead of the trigger, or it is never updated after the
initial render.
Fix — put it on the control, and write it in the same handler that toggles visibility.

**Symptom: `if (el.ariaExpanded)` is true whether the panel is open or closed.**
Cause — the reflected properties are **strings**, and `"false"` is truthy.
Fix — compare explicitly: `el.ariaExpanded === 'true'`.

**Symptom: a keyboard user tabs to a control that is announced as nothing.**
Cause — `aria-hidden="true"` on it or an ancestor, while it is still focusable.
Fix — `inert` for whole regions; never `aria-hidden` on focusable content.

**Symptom: voice control cannot activate a button whose label is right there on screen.**
Cause — an `aria-label` that differs from the visible text overrides it as the accessible name.
Fix — drop the `aria-label`, or make it start with the visible text.

**Symptom: a disabled-looking button still fires its click handler.**
Cause — `aria-disabled="true"` changes the announcement only; it is not `disabled`.
Fix — either use the real `disabled` attribute, or keep `aria-disabled` and return early in the
handler on purpose.

**Symptom: the icon's title is read out as part of every button's name.**
Cause — the decorative SVG contributes to the accessible name.
Fix — `aria-hidden="true"` and `focusable="false"` on the SVG, with the name on the button.

**Symptom: a screen-reader-only hint is never announced.**
Cause — it is hidden with `display: none` or `visibility: hidden`, which remove it from the
accessibility tree too.
Fix — use a visually-hidden class (clip / 1px / absolute), not `display: none`.

## Interview questions

**★ What does ARIA actually change?**
Only what is reported to assistive technology — the accessibility tree. It adds no keyboard
behaviour, no focusability and no styling, so every behaviour a role implies must be implemented in
JavaScript. Hence the first rule: prefer the native element.

**★ Where does `aria-expanded` belong?**
On the control that performs the toggle, not on the panel it toggles — and it must be updated by
the same code that changes visibility, or the announcement drifts from reality.

**★ What is the difference between `disabled` and `aria-disabled`?**
`disabled` removes the control from the tab order and suppresses its events. `aria-disabled` only
changes the announcement; the control stays focusable and still fires `click`, so you must ignore
the interaction yourself. Choosing it is a deliberate "reachable but inactive" decision.

**★ Why is `aria-hidden="true"` dangerous on focusable content?**
It hides from assistive technology without removing it from the tab order, producing a control a
keyboard user reaches and a screen reader cannot describe. `inert` is the correct tool for a whole
region.

**★ When should you use `aria-label` rather than visible text?**
Only when there is no visible text to name the control — an icon-only button, for example. Visible
text is preferred because it is translated, searchable and matches what voice-control users say;
`aria-label` also silently overrides visible text when both exist.

**Are the `element.ariaX` properties booleans?**
No — they are strings that reflect the attributes, Baseline since October 2023. `"false"` is
truthy, so always compare against `'true'`.

**Where should component state live?**
In the ARIA attribute you are already required to maintain, read back with a getter. A separate
JavaScript boolean is a second source of truth and drifts from the announcement.

---

← [02 · Managing focus](./02-managing-focus.md) · [Topic index](./README.md) ·
[04 · Live regions](./04-live-regions.md) →
