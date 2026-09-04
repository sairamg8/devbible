---
title: "The tab sequence is your DOM order and nothing else you can safely change, and a composite widget contributes exactly one tab stop — nine buttons in a toolbar should be one Tab press and eight arrow presses"
sidebar_label: "04e · Keyboard-first components"
sidebar_position: 117
description: "tabindex semantics and why positive values are forbidden, DOM order as both tab sequence and reading order, where focus lands on entering each widget class, the roving tabindex algorithm in full, and what aria-activedescendant makes you implement yourself."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the WAI-ARIA Authoring Practices Guide —
> [*Developing a Keyboard Interface*](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)
> quoted verbatim, and **WCAG 2.2** criteria 2.1.1 and 2.4.3
> ([w3.org/TR/WCAG22](https://www.w3.org/TR/WCAG22/)).
> Version spine: **Next.js 16.3.4** · React 19.2.8. `next` is **not installed in this checkout** —
> documentation-verified only, **no sandbox run**.

**Keyboard access is not a feature you add to a component; it is a property of the whole page that any one component can destroy. There is exactly one tab sequence, it is derived from DOM order, and every interactive thing you build either fits into it correctly or breaks it for everything downstream. Two rules carry most of the weight: a composite widget — a menu, a tab set, a grid — contributes **one** tab stop and manages the rest internally with arrow keys, and any component that takes focus away must give it back. Neither is discoverable from a screenshot, and neither is caught by an automated audit.**

## `tabindex`, exactly

The APG states the default:

> *"In HTML, only form controls and anchors with an HREF attribute are included in the tab sequence."*

and then the three values:

| Value | Behaviour | Use |
|---|---|---|
| absent | default focus behaviour for the element | almost always |
| `0` | *"included in the tab sequence based on its position in the DOM"* | a genuinely custom control |
| `-1` | *"not included in the tab sequence but is focusable with `element.focus()`"* | a programmatic focus target |
| `≥ 1` | *"Authors are strongly advised NOT to use these values"* | never |

The reason `tabindex="1"` is forbidden rather than discouraged: elements with a positive `tabindex` come **before** everything with `0` or default focusability, so a single positive value anywhere reorders the entire page's tab sequence. It is a page-wide side effect from a component-local attribute.

And the underlying fact that makes DOM order load-bearing:

> *"The DOM order also determines screen reader reading order."*

> *"The most robust method of manipulating the order of the tab sequence while also maintaining alignment with the reading order that is currently available in all browsers is rearranging elements in the DOM."*

🔴 **This is why CSS that reorders content is an accessibility decision.** `flex-direction: row-reverse`, `order`, and `grid-area` placement all change the visual order and leave the tab order alone, producing focus that jumps around the screen. WCAG **2.4.3 Focus Order** requires that *"focusable components receive focus in an order that preserves meaning and operability"* — so a visually-reversed row of buttons is a criterion failure, not a style choice.

## Composites get one tab stop

> *"the tab sequence should include only one focusable element of a composite UI component."*

A toolbar with nine buttons should be one Tab press to enter and arrow keys within — not nine Tab presses. The APG documents where focus should land on entry, and it varies by widget class:

| Widget | Focus lands on |
|---|---|
| grid, treegrid | the element that had focus last time, else the first |
| radio group, tabs, listbox, tree | the selected element, else the first |
| menubar, toolbar | the first element |

Two implementation strategies, and the choice between them has a concrete consequence.

### Roving tabindex

> *"When using roving tabindex to manage focus in a composite UI component, the element that is to be included in the tab sequence has `tabindex="0"` and all other focusable elements contained in the composite have `tabindex="-1"`."*

The algorithm, as documented: on a navigation key, set `tabindex="-1"` on the element that has `0`, set `tabindex="0"` on the element that will receive focus, then call `element.focus()` on it.

```tsx
'use client'
import { useRef, useState } from 'react'

type Tab = { id: string; label: string }

export function Tabs({ tabs }: { tabs: Tab[] }) {
  const [selected, setSelected] = useState(0)
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  function move(next: number) {
    const i = (next + tabs.length) % tabs.length
    setSelected(i)
    refs.current[i]?.focus() // the third step of the algorithm — do not omit it
  }

  return (
    <div>
      <div role="tablist" aria-label="Task views">
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[i] = el
            }}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={i === selected}
            aria-controls={`panel-${tab.id}`}
            tabIndex={i === selected ? 0 : -1}
            onClick={() => move(i)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') move(selected + 1)
              if (e.key === 'ArrowLeft') move(selected - 1)
              if (e.key === 'Home') move(0)
              if (e.key === 'End') move(tabs.length - 1)
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab, i) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`panel-${tab.id}`}
          aria-labelledby={`tab-${tab.id}`}
          hidden={i !== selected}
          tabIndex={0}
        >
          {/* … */}
        </div>
      ))}
    </div>
  )
}
```

Three details in there that are easy to lose:

- **`refs.current[i]?.focus()` is not optional.** Changing `tabIndex` moves the tab stop; it does not move focus. Omit the call and the keyboard user's focus stays on the old tab while the selection visibly changes.
- **Wrapping with modulo** is the tab pattern's convention; a grid would not wrap.
- **`tabIndex={0}` on the panel** so a user can Tab from the tab into the panel's content even when the panel contains no focusable elements.

### `aria-activedescendant`

The alternative keeps DOM focus on the container and names the active child by id:

> *"Assistive technologies will consider the element referred to as active to be the focused element even though DOM focus is on the element that has the aria-activedescendant property."*

The trade the APG names explicitly:

> *"One benefit of using roving tabindex rather than aria-activedescendant to manage focus is that the user agent will scroll the newly focused element into view."*

With `aria-activedescendant` **you** must scroll the active item into view and **you** must draw the focus indicator, because nothing has real focus. That is why a long virtualised listbox often uses it — you were managing scroll anyway — and why a nine-button toolbar should not.

## Dialogs, focus restoration and focus visibility

Everything about *taking* focus and *giving it back* — the APG modal contract, the native
`<dialog>`, `inert`, `:focus-visible`, the two new WCAG 2.2 criteria and focus after a route
change — is [04f](04f-dialogs-focus-restoration-and-focus-visibility.md).

## Gotchas

**★ `tabindex="1"` on one element reorders the whole page.** Positive values sort before every `0` and default-focusable element. Fix: only ever `0` or `-1`; the APG's wording is "strongly advised NOT to".

**★ A visually-reversed row of buttons focuses in the wrong order.** `flex-direction: row-reverse` or `order` changes the paint order and not the DOM order, and DOM order is both the tab sequence and the screen-reader reading order. Fix: reorder in the DOM; WCAG 2.4.3 is a criterion, not a preference.

**★ A toolbar takes nine Tab presses to get past.** Every child is in the tab sequence. Fix: roving tabindex — one child at `0`, the rest at `-1`, arrows to move.

**★ Arrow keys change the selected tab and focus stays behind.** `tabIndex` was updated but `element.focus()` was never called; that call is the third step of the documented algorithm. Fix: keep refs to the children and focus the new one.

**★ `aria-activedescendant` is used and the active option scrolls out of view.** Nothing has real DOM focus, so the user agent will not scroll it into view — which the APG names as the specific advantage of roving tabindex. Fix: scroll it yourself with `scrollIntoView({ block: 'nearest' })`, and draw the active style yourself too.

## Interview questions

**★ Why is DOM order, and not CSS order, the thing you have to get right?**
Because two separate things are derived from it and neither reads your stylesheet: the tab sequence, and — as the APG states — the screen reader's reading order. `order`, `row-reverse` and grid placement change what a sighted mouse user perceives and change nothing else, so a page can look coherent and focus in an order that makes no sense, which is exactly what WCAG 2.4.3 rules out. The APG's own conclusion is that rearranging elements in the DOM is the most robust method available in all browsers for changing the sequence — meaning if the order matters, it is a markup change, not a style change.

**★ What is `tabindex="-1"` actually for, given it removes the element from the tab sequence?**
For elements that must be focusable *programmatically* but must not be tab stops. The two canonical cases are the target of a skip link — `<main tabIndex={-1}>`, so `focus()` on it works and the next Tab continues from there — and the non-active children of a composite under a roving tabindex, which are focused by your arrow-key handler and must not each be a stop. It is the only way to make a non-interactive element a valid focus target, and pairing it with a `[tabindex="-1"]:focus { outline: none }` rule is the usual companion, because a ring around a whole region is startling.

**★ How many tab stops should a nine-button toolbar have, and how do you implement that?**
One. The APG states that the tab sequence should include only one focusable element of a composite component; the rest are reached with arrow keys. The standard implementation is a roving tabindex: the currently-active child has `tabindex="0"`, every other has `tabindex="-1"`, and on an arrow key you set `-1` on the old, `0` on the new, then call `focus()` on the new one. The step people omit is the third — changing the attribute moves the tab *stop* but not the focus, so the selection appears to change while the user's focus is still on the previous button.

**★ When would you use `aria-activedescendant` instead, and what do you take on?**
When DOM focus needs to stay somewhere else — the classic case is a combobox where focus must remain in the text input while the user arrows through options, and a virtualised list where the "focused" option may not be in the DOM as a stable element. What you take on is everything the user agent was doing for you: the APG notes that with roving tabindex the browser scrolls the newly focused element into view, and with `aria-activedescendant` nothing has real focus, so you must scroll the active item into view and draw the focus indicator yourself.

{/* FOOTER */}
