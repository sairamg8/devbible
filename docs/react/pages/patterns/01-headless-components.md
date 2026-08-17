---
title: "Headless components"
sidebar_label: "01 · Headless components"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-17 against **react 19.2.8**, from documentation — react.dev
> [Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks),
> [`useId`](https://react.dev/reference/react/useId) and
> [`useContext`](https://react.dev/reference/react/useContext), plus the W3C
> [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/) for the
> keyboard and attribute contracts quoted below.
> ⚠️ **"Headless component" is a community convention, not a React API.** React's
> documentation does not use the term or endorse the pattern. What is documented
> is the machinery it is built from — hooks, context and `children` — and the
> accessibility contracts it exists to protect. Everything here that is a
> judgement rather than a documented fact is marked as one.
> No sandbox script backs this page; claims are cited, not measured.

**A headless component ships behaviour, state and accessibility, and renders
nothing you can see. You supply every element and every class name.**

## The problem it solves

You build a `<Dropdown>` for your design system. It works. Then:

- The marketing site needs it with different markup.
- One team needs the trigger to be a `<button>`, another needs an `<a>`.
- Someone needs an icon between the label and the chevron.
- The mobile view needs the list rendered into a sheet instead of a popover.

Each request is small, so each is answered with a prop: `variant`,
`triggerAs`, `renderIcon`, `mobileLayout`. This is the
[configuration trap](../phase-2-components/03-composition/01-the-configuration-trap.md)
arriving one commit at a time, and it ends with a component nobody can change
safely because no one knows which prop combinations are still legal.

The headless move is to notice that **two entirely different things got bundled
together**:

| | Changes per design | Genuinely hard |
|---|---|---|
| **Markup and styling** | constantly | no |
| Open/closed state, focus management, keyboard navigation, `aria-*` wiring, click-outside, typeahead | almost never | **yes** |

Ship the second, let the caller own the first.

## Building one

A disclosure is the smallest honest example. The behaviour is a boolean; the
accessibility contract is not.

The APG's disclosure pattern requires that the trigger carries `aria-expanded`
reflecting the state and `aria-controls` pointing at the id of the region it
reveals. Those two attributes are the part that gets forgotten, and they are
exactly what a headless hook can refuse to let you forget.

```jsx
import { useId, useState, useCallback } from 'react';

function useDisclosure({ defaultOpen = false } = {}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentId = useId();

  const toggle = useCallback(() => setIsOpen((o) => !o), []);
  const close = useCallback(() => setIsOpen(false), []);

  return {
    isOpen,
    toggle,
    close,
    triggerProps: {
      onClick: toggle,
      'aria-expanded': isOpen,
      'aria-controls': contentId,
    },
    contentProps: {
      id: contentId,
      hidden: !isOpen,
    },
  };
}
```

The caller writes every element:

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

Two things to notice.

**`useId` is doing real work.** The trigger and the panel must agree on an id,
that id must be unique across the page even with fifty FAQ items, and it must
match between the server and client render or hydration breaks.
[`useId`](../phase-5-refs-context-reducers/14-useid.md) is the documented
solution to exactly that problem, and hand-rolled counters are not.

**`triggerProps` is a prop getter in its simplest form** — one object the caller
spreads rather than four attributes they might mis-wire. See **04 · Prop
getters** *(not written yet)* for what happens when the caller also needs their
own `onClick`, which this version silently discards.

## The three shapes headless comes in

The behaviour is the same; only the delivery differs.

**1 — A hook.** What we just wrote. The right default: it composes with other
hooks, it adds no elements to the tree, and it has no opinion about structure at
all. This is what react.dev's
[custom hooks](https://react.dev/learn/reusing-logic-with-custom-hooks) guidance
points at, though it never calls it "headless".

**2 — Children as a function.** The hook's return value handed back through
`children`, for when the caller wants a component rather than a hook call:

```jsx
<Disclosure>
  {({ isOpen, triggerProps, contentProps }) => ( /* … */ )}
</Disclosure>
```

This is a [render prop](../phase-2-components/12-render-props.md) and inherits
its trade-offs — including that nesting several of them reproduces the wrapper
hell hooks were introduced to kill.

**3 — Compound components over context.** The parts are real components that
find shared state implicitly:

```jsx
<Disclosure>
  <Disclosure.Trigger>Shipping</Disclosure.Trigger>
  <Disclosure.Panel>Free over $50.</Disclosure.Panel>
</Disclosure>
```

Nothing is styled, but the *structure* is now fixed by the library. This is the
shape most published headless kits use, and
[children patterns § pattern 3](../phase-2-components/08-children-patterns.md)
is where the mechanism is taught. Note the honest trade-off: this is the least
headless of the three, because the caller can no longer choose the tree.

## The argument that actually justifies it

Not reuse. **Accessibility.**

The APG's contracts for a combobox, a menu, a modal or a tab list run to dozens
of requirements — roving `tabindex`, `aria-activedescendant`, typeahead, focus
return on close, `Escape` and arrow-key handling, focus trapping. Teams do not
get these right by hand, and they do not get them right the second time either,
because each new dropdown starts from zero.

A headless component is a way to write that contract **once** and have every
future design inherit it. That is the case for the pattern, and it is a strong
one. "It saves duplication" is the weak version of the same argument, and if
duplication is your only problem, a plain
[custom hook](../phase-7-custom-hooks/02-writing-a-custom-hook.md) already solved
it without any of this ceremony.

## When it is the wrong answer

**One consumer.** A headless layer with a single caller is
[extracting too early](../phase-7-custom-hooks/12-extracting-too-early.md) with
extra steps. You have paid for indirection and bought nothing.

**The markup genuinely does not vary.** If every use of your `<Card>` looks the
same, a styled component is simpler, more discoverable, and easier to change
later. Headless is a bet that the design will fork — do not place it before you
have seen it fork.

**Your team wants a design system, not a toolkit.** Headless deliberately gives
the caller freedom to produce something off-brand. If the goal is consistency,
that freedom is the bug. The usual resolution is two layers: a headless core, and
a styled component built on it that most people actually import.

## Gotchas

**A "headless" component that renders a wrapper `<div>` is not headless.** It is
a component with no styles. The difference matters the moment the caller needs
that element to be a `<li>`, or needs it gone for a grid layout to work.

**Returning `triggerProps` invites the caller to overwrite your handlers.**
`<button {...triggerProps} onClick={mine}>` silently replaces yours — JSX spread
follows object spread order, so the later key wins. This is the entire reason
**prop getters** *(not written yet)* take an argument.

**Consuming the same hook twice gives you two independent states.** Two
`useDisclosure()` calls are two disclosures. This is not a bug in the hook, it is
the rule from
[share logic, not state](../phase-7-custom-hooks/03-share-logic-not-state/README.md) —
and it is the single most common misunderstanding of the whole approach.

**Object identity changes every render.** `triggerProps` is a fresh object each
time, so a `memo`'d child receiving it re-renders regardless. Whether that
matters is a Phase 6 question, and under the React Compiler it usually stops
mattering — but do not assume it away without reading
[Phase 6](../phase-6-performance/README.md).

**Context is required for the compound shape, with the cost that implies.** Every
consumer re-renders when the provider value's identity changes, and `useContext`
has no selector —
[the context re-render problem](../phase-5-refs-context-reducers/05-context-re-render-problem.md).

## Interview questions

**What is a headless component?**
One that provides behaviour, state and accessibility wiring while rendering no
markup of its own — the caller supplies every element and class. It is a
community convention built from hooks, context and `children`, not a React
feature.

**Why not just use a custom hook?**
Usually you should; a hook is the simplest headless shape. The compound-component
and children-as-a-function shapes exist for callers who want components rather
than a hook call, and for state that several sibling parts must share
implicitly.

**What is the strongest argument for the pattern?**
Accessibility. The keyboard and ARIA contracts for widgets like comboboxes and
menus are long and easy to get wrong, so encoding them once and inheriting them
across every future design is worth real indirection. Avoiding duplicated markup
is a much weaker justification.

**What does `useId` have to do with it?**
Headless widgets have to wire `aria-controls`, `aria-labelledby` and friends to
real element ids, those ids must be unique per instance, and they must match
between server and client or hydration fails. `useId` is React's documented
answer to that.

**When would you not build one?**
With a single consumer, when the markup does not vary, or when your goal is
brand consistency rather than flexibility — headless hands the caller freedom
that a design system may specifically not want to give.

---

← Index: [React patterns](README.md) · Next → **02 · The state reducer pattern** *(not written yet)*
