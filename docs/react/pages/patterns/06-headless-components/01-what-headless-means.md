---
title: "What headless actually means"
sidebar_label: "01 · What headless actually means"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-17 against **react 19.2.8**, from documentation — react.dev
> [Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)
> and [`useId`](https://react.dev/reference/react/useId); widget contracts from
> the W3C [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/).
> ⚠️ Community convention, not a React API — see the topic
> [index](README.md) for the full caveat. Judgements marked as judgements.
> No sandbox script backs this page; claims are cited, not measured.

**The definition people give — "a component with no styles" — is wrong, and the
difference is the whole topic.**

## Unstyled is not headless

Three components, increasingly headless:

```jsx
// 1. Styled. Renders its own markup and its own CSS.
<Dropdown items={items} onSelect={pick} variant="primary" />

// 2. Unstyled. Renders its own markup; you bring the CSS.
<Dropdown items={items} onSelect={pick} className="my-dropdown" />

// 3. Headless. Renders NOTHING. You bring the markup and the CSS.
const { getTriggerProps, getOptionProps } = useDropdown({ items, onSelect: pick });
```

Only the third gives up **structure**. That is the axis that matters, because
structure is what breaks when a design changes: a designer who wants the label
above the trigger instead of inside it can fix version 2 with no CSS in the
world, and can fix version 3 in thirty seconds.

**The test: can the caller decide which HTML elements exist, in what order, and
with what nesting?** If not, it is unstyled, not headless — and a component that
renders even one wrapper `<div>` has already failed it, because the caller who
needs that element to be an `<li>` or needs it gone for a CSS grid is stuck.

## The split it is actually making

Every interactive widget contains two kinds of code, and they have opposite
lifespans.

| | Changes | Hard to get right | Belongs to |
|---|---|---|---|
| Element choice, nesting, class names, animation, copy | **every redesign** | no | the **caller** |
| Open/closed state, which option is active, focus movement, keyboard bindings, ARIA relationships, type-ahead buffering, click-outside, scroll-into-view | **almost never** | **yes** | the **library** |

The bundle is the problem. When both live in one component, every cosmetic
request has to be answered by someone editing the file that also owns focus
management — and the way that gets answered, in practice, is a new prop. That is
the [configuration trap](../../phase-2-components/03-composition/01-the-configuration-trap.md),
and headless is one way out of it.

*(The other way out is [composition](../../phase-2-components/03-composition/README.md) —
passing elements instead of describing them. Headless is what you reach for when
composition alone is not enough because the parts must **coordinate**: the
trigger has to know what the list is doing.)*

## The four capabilities that are genuinely hard

This is the concrete answer to "what does headless actually encapsulate?" —
and chunk 02 shows how much of it the spec demands.

**1 — Focus management.** Which element is focused, when focus moves, and where
it returns to. A menu that opens must move focus into itself or track a virtual
focus; when it closes, focus must return to the trigger, or the user is dumped at
the top of the document. Getting this wrong is invisible to a mouse user and
completely disabling for a keyboard user.

**2 — Keyboard bindings.** Arrow keys, `Home`, `End`, `Enter`, `Space`, `Escape`,
`Tab`, and modifier combinations for multi-select. Each has a specified behaviour
that differs by widget — arrow keys move focus in a listbox and move *selection*
in a radio group.

**3 — ARIA relationships that stay consistent with state.** `aria-expanded`,
`aria-controls`, `aria-activedescendant`, `aria-selected`, `aria-setsize`,
`aria-posinset`. These are not decoration: they are the only thing a screen
reader has. Every one of them must be recomputed on every state change, and the
ones that reference other elements need stable, unique, hydration-safe ids —
which is what [`useId`](../../phase-5-refs-context-reducers/14-useid.md) exists
for.

**4 — Type-ahead.** Typing "b", "r", "o" quickly should land on "Broccoli", and
typing "b" three times slowly should cycle through items starting with "b". That
is a timed buffer with two different behaviours depending on inter-keystroke
delay, and essentially nobody implements it by hand.

**None of the four is visible in a screenshot.** That is why they get skipped, and
why encapsulating them once is worth real indirection.

## The smallest honest example

A disclosure — the least interesting widget that still has a real contract.

```jsx
import { useId, useState, useCallback } from 'react';

function useDisclosure({ defaultOpen = false } = {}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentId = useId();
  const toggle = useCallback(() => setIsOpen((o) => !o), []);

  return {
    isOpen,
    toggle,
    triggerProps: {
      onClick: toggle,
      'aria-expanded': isOpen,
      'aria-controls': contentId,
    },
    contentProps: { id: contentId, hidden: !isOpen },
  };
}
```

```jsx
function FaqItem({ question, children }) {
  const { triggerProps, contentProps } = useDisclosure();
  return (
    <div className="faq-item">
      <h3>
        <button {...triggerProps} className="faq-trigger">{question}</button>
      </h3>
      <div {...contentProps} className="faq-panel">{children}</div>
    </div>
  );
}
```

⚠️ **Be clear about what this does and does not demonstrate.** It shows the
*shape* — behaviour in, markup out, ids wired. It does **not** exercise any of
the four hard capabilities: no focus movement, no keyboard handling beyond the
browser's own `<button>` activation, one ARIA relationship. A disclosure is
almost the only widget where the naive version is also the correct version, which
is exactly why it is a bad advertisement for the pattern. Chunk 03 builds
something that is not.

## Gotchas

**A wrapper `<div>` disqualifies you.** "Headless but it renders a container" is
unstyled. The moment the caller needs that element to be an `<li>`, a `<td>`, or
absent for a grid to work, they are patching around your component.

**`triggerProps` as a plain object silently loses the caller's handlers.**
`<button {...triggerProps} onClick={mine}>` overwrites yours; the reverse order
overwrites theirs. There is no order that keeps both — that is the whole reason
[prop getters](../supporting/prop-getters.md) exist, and chunk 03 uses them from the
start.

**Two calls to the hook are two independent widgets.** `useDisclosure()` twice
gives two disclosures, not one shared one. This surprises people constantly, and
it is not a bug: it is
[share logic, not state](../../phase-7-custom-hooks/03-share-logic-not-state/README.md).
If you wanted one, lift it or put it in context.

**Hand-rolled ids break hydration.** A module-level counter produces different
values on the server and the client, and React will complain — or worse, not
complain and leave `aria-controls` pointing at nothing. Use `useId`.

**`hidden` is not always enough to hide content.** `display: flex` or `grid` on
the element overrides the `hidden` attribute's UA `display: none`, and the panel
stays visible while claiming to be closed. Either add `[hidden] { display: none
!important; }` to your reset or do not rely on the attribute.

**Returning a fresh object every render defeats `memo` downstream.** Not usually
worth fixing, but do not be surprised by it —
[Phase 6](../../phase-6-performance/README.md) has the honest version, including
what the Compiler changes.

**Conditional rendering versus `hidden` is a real decision, not a style.**
`{isOpen && <Panel/>}` unmounts the panel and destroys its state and scroll
position; `hidden` keeps it mounted and in the accessibility tree's "hidden"
state. Neither is right in general, and a headless hook that hard-codes one has
made a structural decision it claimed not to make.

**Naming your return values after elements leaks structure.** `triggerProps` and
`contentProps` assume a trigger and a content region. That is fine for a
disclosure, and it is exactly the assumption that makes some "headless" libraries
impossible to use for a design they did not anticipate.

## Interview questions

**What makes a component headless rather than just unstyled?**
It renders no elements at all. The caller decides which HTML exists, in what
order and with what nesting. An unstyled component still owns its markup and only
gives up its CSS.

**What is the actual test you apply?**
Can the caller change the structure — swap a `<div>` for an `<li>`, reorder the
parts, remove a wrapper? If not, it is unstyled.

**What does headless encapsulate that is worth the indirection?**
Focus management, keyboard bindings, ARIA relationships that must stay consistent
with state, and type-ahead. None of the four shows up in a screenshot, which is
why they get skipped and why encapsulating them once pays.

**Why is a disclosure a bad example of the pattern?**
Because its naive implementation is also its correct implementation — one state
boolean and two ARIA attributes. It demonstrates the shape without demonstrating
the reason, which is how the pattern gets sold as "reuse" instead of
"accessibility".

**If two components need the same behaviour, is headless the answer?**
Not by itself. If they need the same *logic* and each has its own state, a plain
custom hook is enough. Headless is what you add when the caller must also own the
markup, and when several parts have to coordinate.

**Why can't a headless component just return a props object?**
Because a spread cannot merge event handlers — the caller's `onClick` replaces
yours or yours replaces theirs. Prop getters take the caller's props as an
argument and merge them.

**What breaks if you generate the ids yourself?**
Server and client can disagree, so hydration mismatches, and ARIA attributes can
end up referencing ids that do not exist. `useId` produces stable ids that match
across both renders.

**Does headless mean the caller controls everything?**
No. The compound-component delivery shape fixes the structure even though nothing
is styled — see [chunk 05](05-the-delivery-shapes.md). "Headless" describes what
is rendered, not how much freedom the caller has.

---

Index: [Headless components](README.md) · Next → [02 · The contract you are inheriting](02-the-contract-you-are-inheriting.md)
