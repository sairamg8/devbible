---
title: "A role is a promise the browser will not keep for you — ARIA changes what a control is announced as and supplies none of the behaviour that announcement implies, which is why no ARIA is better than bad ARIA"
sidebar_label: "04c · ARIA and its four rules"
sidebar_position: 115
description: "The four rules of ARIA use verbatim, roles as promises, ARIA cloaking and the tree it destroys, aria-label versus aria-labelledby versus aria-describedby, hidden versus aria-hidden versus inert, live regions, and the state attributes worth knowing."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against [*Using ARIA*](https://www.w3.org/TR/using-aria/) (W3C Working
> Group Note — the four rules quoted verbatim), the
> [WAI-ARIA Authoring Practices Guide, *Read Me First*](https://www.w3.org/WAI/ARIA/apg/practices/read-me-first/),
> **WCAG 2.2** criteria 4.1.2 and 4.1.3
> ([w3.org/TR/WCAG22](https://www.w3.org/TR/WCAG22/)), and MDN's
> [`inert`](https://developer.mozilla.org/docs/Web/HTML/Global_attributes/inert) reference.
> Version spine: **Next.js 16.3.4** · React 19.2.8. `next` is **not installed in this checkout** —
> documentation-verified only, **no sandbox run**.

**ARIA is not an accessibility layer you add to markup to make it accessible. It is a set of overrides on the accessibility tree, and every override is a claim about behaviour that you are then responsible for implementing. The APG puts a whole section under the heading "No ARIA is better than Bad ARIA", and the reason is measurable: a `<div>` with no role announces as nothing and a user works around it, while a `<div role="button">` that does not respond to Space announces as a button and is *trusted*. The first is a gap. The second is a lie, and the user has no way to detect it.**

## The four rules, verbatim

W3C states them as rules, not guidelines, and each one closes a specific failure.

**Rule 1 — do not use ARIA when HTML exists.**

> *"If you can use a native HTML element or attribute with the semantics and behavior you require already built in, instead of re-purposing an element and adding an ARIA role, state or property to make it accessible, then do so."*

The exceptions it allows are narrow: the feature is not in HTML, or it is but is not accessibility-supported, or *"the visual design constraints rule out the use of a particular native element, because the element cannot be styled as required."* That third one is the honest reason most custom controls exist, and it is much rarer now than it was — `<select>`, `<dialog>` and `<details>` are all far more styleable than the folklore suggests.

**Rule 2 — do not change native semantics.**

> *"Do not change native semantics, unless you really have to."*

The note's own example is precise:

```tsx
// 🔴 the heading is no longer a heading
<h2 role="tab">Overview</h2>

// ✅ the tab wraps the heading; both semantics survive
<div role="tab"><h2>Overview</h2></div>
```

**Rule 3 — ARIA controls must work from the keyboard.**

> *"All interactive ARIA controls must be usable with the keyboard."*
> *"if using role=button the element must be able to receive focus and a user must be able to activate the action associated with the element using both the enter (on WIN OS) or return (MAC OS) and the space key."*

**Rule 4 — never hide a focusable element.**

> *"Do not use role="presentation" or aria-hidden="true" on a focusable element."*
> *"Using either of these on a focusable element will result in some users focusing on 'nothing'."*

🔴 **Rule 4 is the one violated most often in React code**, and almost always by accident: a modal implementation sets `aria-hidden="true"` on the page behind it while a link in that page is still in the tab sequence. A screen-reader user tabs into a control that the tree says does not exist, and the announcement is silence. The fix is `inert`, below.

## A role is a promise

The APG's framing, which is worth carrying around:

**"Principle 1: A role is a promise."** Applying `role="button"` promises a user that this element behaves like a button — focusable, activated by Enter and Space, announced as a button. **ARIA does not supply any of that.** It changes what the accessibility tree reports and nothing else: no keyboard behaviour, no focus management, no styling, no state.

The corollary is that ARIA can only ever make things worse *or* better, never neutral. Every attribute you add is a claim, and an unkept claim is a defect that automated tools mostly cannot see — axe can tell you a `role="tab"` has no `aria-selected`, but it cannot tell you your arrow keys do not work.

## ARIA cloaks as well as enhances

The APG's second principle is the one people do not expect: ARIA **hides** the semantics of what it is applied to.

- `<a role="menuitem">` is perceived as a menu item, **not as a link** — the user loses the ability to open it in a new tab in their mental model, and their screen reader will not announce it as a link.
- `aria-label` **replaces** the element's perceivable content entirely. An `aria-label` on a wrapper hides every piece of text inside it from the accessible name computation.
- `<ul role="navigation">` destroys the list semantics of its own `<li>` children, because they are no longer inside a list.

That last one is a genuinely surprising cascade: applying a role to a container can invalidate the roles of its children, because many child roles are only valid inside a specific parent. The safe habit is to add a wrapper rather than repurpose an existing element — the same shape as Rule 2's example.

## Naming: three attributes, one winner

| Attribute | Does | Precedence |
|---|---|---|
| `aria-labelledby` | names the element from other elements' text, by id | **highest** |
| `aria-label` | names the element from a string | beats content |
| content | the element's own text | lowest |
| `aria-describedby` | adds a *description*, read after the name | separate channel |

```tsx
// A named region — the heading is the name, no duplication
<section aria-labelledby="filters-heading">
  <h2 id="filters-heading">Filters</h2>
  {/* … */}
</section>

// A dialog named by its own title
<div role="dialog" aria-modal="true" aria-labelledby="dlg-title" aria-describedby="dlg-desc">
  <h2 id="dlg-title">Delete task</h2>
  <p id="dlg-desc">This cannot be undone.</p>
</div>
```

**Prefer `aria-labelledby` over `aria-label`** whenever the name is already visible on the page. It keeps one source of truth, it stays translated automatically, and it cannot drift from the visible text — which is the WCAG 2.5.3 failure covered in [04b](04b-links-buttons-forms-and-the-alt-decision.md).

⚠️ `aria-labelledby` and `aria-describedby` reference **ids in the same document**, and an id that does not exist is silently ignored. In a component rendered more than once per page, those ids must be unique — which is `useId`, and its hydration constraints are [04d](04d-hydration-safe-accessible-markup.md).

## Hiding things: three mechanisms that are not interchangeable

| | Removed from tree | Removed from tab order | Visually hidden |
|---|---|---|---|
| `hidden` / `display: none` | ✅ | ✅ | ✅ |
| `aria-hidden="true"` | ✅ | 🔴 **no** | ❌ |
| `inert` | ✅ | ✅ | ❌ |
| off-screen CSS (`.sr-only`) | ❌ | ❌ | ✅ |

Each row is the right answer to a different question:

- **Not rendered at all** → `hidden`, or do not render it.
- **Decorative, in the way of the tree** → `aria-hidden="true"`, and *only* on something that is not focusable and contains nothing focusable.
- **A whole region temporarily out of play** — the page behind a modal, a collapsed panel that is still in the DOM → `inert`.
- **Available to screen readers, invisible on screen** → the off-screen CSS pattern, never `display: none`.

MDN on what `inert` does: inert elements and their flat-tree descendants receive no click events, cannot be focused, are excluded from find-in-page, are not selectable or editable, and are **removed from the tab order and the accessibility tree**. It is exactly rule 4's fix, because unlike `aria-hidden` it takes the focusability away too.

```css
/* The .sr-only pattern — visible to assistive tech, not on screen.
   Never `display: none`, which removes it from the tree as well. */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
```

🔴 One more note on `inert`: a modal `<dialog>` opened with `showModal()` **escapes** ancestor inertness. Nothing else does. That is the mechanism that makes the native dialog the easiest correct modal to build — see [04e](04e-keyboard-first-interactive-components.md).

## Live regions

> *"In content implemented using markup languages, status messages can be programmatically determined through role or properties such that they can be presented to the user by assistive technologies without receiving focus."*
> — **4.1.3 Status Messages (Level AA)**

A live region announces changes to its contents without moving focus. Three practical forms:

```tsx
// Polite: announced when the user is idle. Filter results, save confirmations.
<p role="status">{count} tasks match</p>

// Assertive: interrupts. Errors and only errors.
<p role="alert">{error}</p>

// Explicit, when you need atomic or relevant control
<div aria-live="polite" aria-atomic="true">{statusText}</div>
```

**The region must exist in the DOM before the content changes.** Rendering `{message && <p role="alert">{message}</p>}` inserts the region and its content in the same commit, and whether that is announced is implementation-dependent. The reliable pattern is a permanently-present empty region whose *contents* change:

```tsx
// components/live-region.tsx — 'use client'
'use client'

export function LiveRegion({ message }: { message: string }) {
  return (
    <p role="status" aria-live="polite" className="sr-only">
      {message}
    </p>
  )
}
```

⚠️ **Do not narrate everything.** A live region on a list that updates as the user types produces continuous interruption. Announce outcomes — "12 tasks match", "Saved" — not intermediate states.

## The state attributes worth knowing

These are the ones that appear in nearly every custom component, and each has a rule:

| Attribute | On | Rule |
|---|---|---|
| `aria-expanded` | the **trigger**, not the panel | `true` / `false`; absent means "not expandable" |
| `aria-controls` | the trigger | id of the controlled element; support is uneven, harmless to include |
| `aria-current` | the active item in a set | `"page"` for the current nav link, `"step"`, `"true"` |
| `aria-selected` | tabs, options | not a substitute for `aria-checked` on checkboxes |
| `aria-disabled` | anything | **announces** disabled; does **not** prevent activation |
| `aria-busy` | a region being updated | suppresses noisy live announcements during a batch |

Two of those are traps.

🔴 **`aria-disabled` does not disable anything.** It changes the announcement; the click handler still fires. Use the native `disabled` attribute when the control should genuinely be inoperable — and use `aria-disabled` deliberately when you want the control to stay *focusable* (so a keyboard user can find it and be told why it is unavailable) while you refuse the action in the handler.

🔴 **`aria-current="page"` on the active nav link is the piece almost every design system forgets.** The active state is styled and conveyed to nobody:

```tsx
// components/nav-link.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname()
  const active = pathname === href

  return (
    <Link href={href} aria-current={active ? 'page' : undefined}>
      {children}
    </Link>
  )
}
```

Note `undefined` rather than `false` — `aria-current="false"` is a valid but pointless announcement on every other link.

## Gotchas

**★ A modal sets `aria-hidden="true"` on the page behind it and a keyboard user tabs into nothing.** Rule 4 exactly: `aria-hidden` removes elements from the tree but leaves them focusable. Fix: `inert` on the background container, which removes both — or a native `<dialog>` with `showModal()`, which handles it for you.

**★ `role="tab"` was added and arrow keys do nothing.** A role is a promise; ARIA supplies no behaviour. Fix: implement the keyboard interface the pattern requires (roving tabindex, [04e](04e-keyboard-first-interactive-components.md)) or drop the role — announcing a tablist that does not behave like one is worse than a set of buttons.

**★ `<ul role="navigation">` silently destroys the list.** A role on the container invalidates child roles that are only valid inside a list. Fix: wrap — `<nav><ul>…</ul></nav>`.

**★ An `aria-label` on a card wrapper hides all the text inside it.** `aria-label` replaces the perceivable content of the element it is on. Fix: name the region with `aria-labelledby` pointing at its heading, or do not name it at all.

**★ `aria-labelledby` points at an id that is not on the page.** Silently ignored — the element falls back to its content or has no name. Fix: generate ids with `useId` and keep the reference in the same component that renders the target.

**★ The same `id` appears twice because a component renders twice.** Every `aria-labelledby` and `aria-describedby` in the second instance resolves to the first instance's element. Fix: `useId` per instance ([04d](04d-hydration-safe-accessible-markup.md)).

**★ `aria-disabled` button still fires its handler.** It is an announcement, not a behaviour. Fix: native `disabled` when it should be inoperable, or guard the handler explicitly when you want it focusable.

**★ Nothing is announced when the "Saved" toast appears.** The live region was inserted at the same moment as its content. Fix: render an empty `role="status"` region permanently and change its text.

**★ The screen reader will not stop talking.** An `aria-live="polite"` region wrapping a list that re-renders on every keystroke. Fix: announce outcomes only, debounce the message, and consider `aria-busy` while a batch is in flight.

**★ `role="alert"` is used for a success message.** Assertive live regions interrupt whatever is being read. Fix: `role="status"` for anything that is not an error.

**★ Every nav link is styled active and none is announced active.** `aria-current` was never added. Fix: `aria-current={active ? 'page' : undefined}`.

**★ `role="presentation"` on a focusable element.** Rule 4's other half — the element keeps its tab stop and loses its identity. Fix: if it should not be reachable, remove it from the tab sequence; if it should, leave its semantics alone.

**★ You added `aria-required="true"` beside the `required` attribute.** Redundant, and the two can drift when someone removes one. Fix: the HTML attribute alone.

## Interview questions

**★ What does the APG mean by "a role is a promise", and why is bad ARIA worse than none?**
Applying a role changes only what the accessibility tree reports — it supplies no keyboard handling, no focus management and no state. So `role="button"` on a div tells a user "this behaves like a button", and if it does not respond to Space, the user has been given false information they cannot verify. Without the role, the element announces as generic text and the user works around it or gives up quickly; with the role, they spend time trying to operate something that has told them it works. That asymmetry — a gap versus a lie — is why the APG's own section heading is "No ARIA is better than Bad ARIA".

**★ Explain the difference between `hidden`, `aria-hidden="true"` and `inert`, and give the case for each.**
`hidden` (and `display: none`) removes the element visually, from the accessibility tree, and from the tab order — use it when the content genuinely should not exist right now. `aria-hidden="true"` removes it from the tree **only**: it is still visible and still focusable, which is why W3C's fourth rule forbids it on focusable elements; use it for decorative content like an icon inside a labelled button. `inert` removes it from the tree, the tab order, click handling and find-in-page while leaving it visible — which is exactly what you want for the page behind a modal, and is the correct fix for the `aria-hidden` mistake. The one special case worth remembering is that a `<dialog>` opened with `showModal()` escapes ancestor inertness; nothing else does.

**★ Why prefer `aria-labelledby` to `aria-label`?**
Because it keeps a single source of truth. The name comes from text that is already on the page, so it stays in sync when the heading changes, it is translated by whatever translates the rest of the page, and it satisfies WCAG 2.5.3's requirement that the accessible name contain the visible text — which an independently-written `aria-label` frequently violates and thereby breaks voice control. `aria-label` is for controls with no visible text at all, typically icon-only buttons, and even then it should begin with any text that *is* visible.

**★ You are asked to announce "12 results" when a filter changes, without moving focus. How?**
A live region that is already in the DOM: a `role="status"` element rendered permanently, whose text content you update. The requirement comes from WCAG 4.1.3, which asks that status messages be programmatically determinable *without receiving focus*. The mistake to avoid is conditionally rendering the region along with its message — inserting the region and its content in the same commit is unreliable across screen readers. The second mistake is announcing every keystroke: the region should carry the settled outcome, which usually means debouncing and announcing "12 tasks match" rather than each intermediate count.

**★ A colleague adds `role="navigation"` to a `<ul>`. What breaks, and what is the general principle?**
The list breaks. `<li>` elements are meaningful because they are children of a list; changing the container's role means the browser no longer exposes the list, so the "list, 5 items" announcement disappears and the items lose their position-in-set information. The general principle is the APG's second one: ARIA both enhances and *cloaks* — a role replaces the native semantics of the element it is on, and it can invalidate the roles of its children as a consequence. The fix is always the same shape as W3C's own rule-2 example: wrap rather than repurpose, `<nav><ul>…</ul></nav>`.

**★ When would you deliberately choose `aria-disabled` over the native `disabled` attribute?**
When you want the control to remain focusable so that a keyboard or screen-reader user can find it and be told why it is unavailable. A natively `disabled` button is skipped in the tab sequence entirely, so a user tabbing through a form never encounters it and cannot discover that a "Submit" exists but is blocked. With `aria-disabled` the control is reachable, announced as disabled, and typically described by an `aria-describedby` explaining the blocker — but because `aria-disabled` announces rather than enforces, you must also refuse the action in the handler. It is a deliberate trade of enforcement for discoverability, not a synonym.

{/* FOOTER */}
