---
title: "01 · The four moments JavaScript owns"
sidebar_label: "01 · The four moments"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [ARIA live regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions), [`aria-busy`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-busy), [`HTMLElement.focus()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus), [`HTMLElement.inert`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/inert), [`<dialog>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog), [ARIA roles](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles), [Keyboard-navigable JavaScript widgets](https://developer.mozilla.org/en-US/docs/Web/Accessibility/Guides/Keyboard-navigable_JavaScript_widgets). Documentation-validated; **no timings and no console output**.

⚠️ **The mechanics live in phase 9.** What can hold focus, how to move it, how to write ARIA from
script and how live regions behave are
[Phase 9 · 15 · Focus and accessibility](../../phase-9-dom/15-focus-and-accessibility/README.md),
in four chunks. **This page is the decision layer**: the four moments where JavaScript takes over
a job the browser used to do, and what it owes at each.

## 🔴 The rule everything else hangs off

**A real page navigation, a real `<button>`, a real `<dialog>` and a real form control already do
this work.** Every accessibility bug in this topic exists because script replaced one of them.
So, in order:

1. **Use the native element.** A `<button>` is focusable, announced, keyboard-operable and
   clickable by voice control. A `<div onclick>` is none of those, and ARIA does not add them.
2. **If you must build it, you now own** focus, keyboard, state announcement and the accessible
   name.
3. **ARIA describes; it never implements.** `role="button"` tells assistive tech what something
   claims to be. It does not add Enter/Space handling or tab order — those are still yours.

## Moment 1 · A client-side route change

A real navigation resets focus to the top of the document, sets the accessible page name and
announces it. `pushState` does none of these ([08 · 02 · Building a router](../08-history-and-routing/02-building-a-router.md)).

| The browser used to | Now you must |
|---|---|
| set the page title | `document.title = …` |
| move focus to the document | focus the new `<h1>` or `<main>` with `tabindex="-1"` |
| announce the new page | write the new title into a pre-existing live region |
| reset scroll | `scrollTo(0, 0)`, or restore on Back |

```js
const heading = view.querySelector('h1');
heading.tabIndex = -1;
heading.focus({ preventScroll: true });   // 🔴 preventScroll, or it fights your scroll restoration
```

🔴 **Without the focus move, a keyboard user's next Tab continues from a link that no longer
exists** — usually meaning focus resets to the top of the browser chrome, and the user has to
re-traverse the whole page. This is the single most common accessibility failure in
single-page apps.

**The Navigation API does it for you** — `intercept({ focusReset: 'after-transition' })` is the
default and it fires after the handler resolves
([08 · 03](../08-history-and-routing/03-the-navigation-api.md)). That is the strongest practical
argument for adopting it.

## Moment 2 · Content that arrives later

Anything that appears without a user action needs to be *announced*, and the politeness level is
a real decision:

| Situation | Live region |
|---|---|
| Search results updated, item added to cart | `aria-live="polite"` — waits for a pause |
| An error the user must act on now | `aria-live="assertive"` — interrupts |
| A form validation error | ⚠️ prefer `aria-describedby` on the field + `aria-invalid` |
| A whole region being rebuilt | `aria-busy="true"` while it churns, `false` when settled |

```html
<!-- 🔴 in the DOM from the start, empty -->
<div id="announcer" aria-live="polite" aria-atomic="true" class="visually-hidden"></div>
```

```js
announcer.textContent = `${results.length} results`;
```

⚠️ **A live region inserted together with its text is frequently not announced.** The region must
already exist so the accessibility tree is watching it; only the *text* changes. That single fact
explains most "the announcement works sometimes" reports.

**`assertive` interrupts whatever the user is listening to** — including their own typing being
read back. Use it for errors and nothing else. Behaviour details and the timing traps are
[Phase 9 · 15 · 04 · Live regions](../../phase-9-dom/15-focus-and-accessibility/04-live-regions.md).

**Loading states are announcements too.** A spinner is invisible to a screen reader unless
something says "loading" — `aria-busy` on the region, or a polite message. Silence for three
seconds reads as a broken page.

## Moment 3 · Modals, menus and anything on top

The native answers exist and they are better than the hand-rolled ones:

| Need | Native |
|---|---|
| A modal dialog | `<dialog>` + `showModal()` — focus trap, `Escape`, top layer, backdrop |
| A popover, menu, tooltip | the Popover API |
| Making the rest of the page unreachable | `inert` |

All three are [Phase 9 · 16 · Dialog, popover and inert](../../phase-9-dom/16-dialog-popover-inert/README.md).
🔴 **`showModal()` gives you the focus trap for free**, which is the part hand-rolled modals get
wrong — usually by trapping Tab but not Shift+Tab, or by forgetting the browser UI.

**Two things remain yours even with `<dialog>`:**

- **Restore focus on close** to the control that opened it. Store the element, focus it after
  closing, and check it is still in the document.
- **An accessible name** — `aria-labelledby` pointing at the dialog's heading.

## Moment 4 · Removing something that has focus

```js
if (row.contains(document.activeElement)) nextFocusTarget().focus();
row.remove();
```

🔴 **Deleting the focused element sends focus to `<body>`** — the keyboard user is dropped at the
start of the page with no announcement. Any "delete this row", "dismiss this toast", "close this
tab" needs to decide where focus goes next: the following row, the list container, or the control
that triggered the removal.

The same applies to a control that becomes `disabled` while focused, and to content replaced
during an async update.

## Custom widgets: the keyboard contract

If you build a tabs, menu, combobox or tree widget, the keyboard behaviour is not optional and it
is not arbitrary — the ARIA Authoring Practices define it per pattern. The recurring mechanism is
a **roving `tabindex`**: exactly one item in the group is `tabindex="0"`, the rest are `-1`, and
the arrow keys move both the focus and that zero.

```js
function moveTo(next) {
  current.tabIndex = -1;
  next.tabIndex = 0;
  next.focus();
  current = next;
}
```

**Tab enters and leaves the widget; arrows move inside it.** A widget where Tab visits all twenty
tabs is a widget that has not implemented the pattern. Keyboard handling detail is
[Phase 10 · 06 · Keyboard events](../../phase-10-events/06-keyboard-events/README.md).

⚠️ **Never remove a focus outline without replacing it.** `:focus-visible` is how the platform
distinguishes a keyboard focus from a mouse click — style that, do not delete it.

## Gotchas

**Symptom: after a route change, Tab starts from the top of the browser.**
Cause — focus was on a link in the old view, which was removed.
Fix — move focus into the new view (`tabindex="-1"` on the heading, `focus({preventScroll:true})`).

**Symptom: the announcement works in one browser and not another.**
Cause — the live region was inserted along with its text.
Fix — ship the empty region in the initial HTML; change only its text.

**Symptom: a screen reader interrupts the user constantly.**
Cause — `aria-live="assertive"` on routine updates.
Fix — `polite` for everything except errors that block the user.

**Symptom: Tab escapes the modal to the page behind it.**
Cause — a hand-rolled trap, or a `<div>` modal.
Fix — `<dialog>.showModal()`, or `inert` on the rest of the page.

**Symptom: after closing a dialog, focus is at the top of the page.**
Cause — nothing restored it.
Fix — store the opener, focus it on close, and verify it is still connected.

**Symptom: deleting a list item leaves the keyboard user lost.**
Cause — the focused element was removed.
Fix — decide the next target before removing.

**Symptom: `role="button"` on a `<div>` does not respond to Enter or Space.**
Cause — ARIA describes; it does not implement.
Fix — a `<button>`. If truly impossible, add `tabindex="0"` and the key handling yourself.

## Interview questions

**★ What does a client-side router owe an assistive-technology user?**
A new document title, focus moved into the new view, an announcement through a pre-existing live
region, and a sensible scroll position. A real navigation does all four; `pushState` does none.

**★ Why must a live region already be in the DOM?**
The accessibility tree has to be observing it before the change. Inserting a region and its text
together frequently produces no announcement at all — the reason "it announces sometimes".

**★ `polite` versus `assertive`?**
`polite` waits for a pause; `assertive` interrupts, including the user's own typing being read
back. Errors that block progress are assertive; everything else is polite.

**★ What is a roving `tabindex` and when do you need one?**
One item in a composite widget is `tabindex="0"` and the rest are `-1`, with arrow keys moving
focus and the zero together. It is what makes Tab enter and leave the widget while arrows navigate
inside it — the ARIA-defined behaviour for tabs, menus, listboxes and trees.

**★ You remove the row the user was focused on. What happens, and what should you do?**
Focus falls to `<body>` and the keyboard user is silently dropped at the top of the page. Decide
the next target — the following row, the list, or the triggering control — and focus it before or
immediately after removal.

**Why is a `<button>` better than `<div role="button">`?**
Because the native element is focusable, keyboard-operable, announced, and reachable by voice
control, for free. ARIA only relabels; it never adds behaviour.

---

[Topic index](./README.md) · [02 · User preferences and testing](./02-preferences-and-testing.md) →
