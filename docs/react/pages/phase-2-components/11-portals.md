---
title: "Portals"
sidebar_label: "11 · Portals"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13 against **react-dom 19.2.8**, from documentation —
> react.dev [`createPortal`](https://react.dev/reference/react-dom/createPortal),
> including its accessibility pitfall, and the
> [WAI-ARIA Modal Authoring Practices](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal)
> it links to. No sandbox script backs this page; claims are cited, not
> measured.

**A portal moves the DOM node and leaves everything else where it was. That
sentence contains the whole feature and both of its surprises.**

## The API

```js
import {createPortal} from 'react-dom';

createPortal(children, domNode, key?)
```

| Parameter | What it is |
|---|---|
| `children` | Anything renderable — JSX, a fragment, a string, a number, an array of these |
| `domNode` | An existing DOM node. **"The node must already exist."** |
| `key` (optional) | A unique string or number, used as the portal's key |

```jsx
function Modal({children, onClose}) {
  return createPortal(
    <div className="backdrop" onClick={onClose}>
      <div role="dialog" onClick={e => e.stopPropagation()}>{children}</div>
    </div>,
    document.body
  );
}
```

`createPortal` is called *in the return position* — it produces something
renderable, so it goes where JSX would go. It is not a component and not a hook,
so it has no rules about where it may be called.

## The rule that makes portals useful

react.dev states it twice, once for the DOM and once for events:

> **A portal only changes the physical placement of the DOM node. In every other
> way, the JSX you render into a portal acts as a child node of the React
> component that renders it.**

> **Events from portals propagate according to the React tree rather than the
> DOM tree.**

Which means everything except the DOM position behaves as if there were no
portal at all:

| | Follows |
|---|---|
| DOM position | The `domNode` you passed |
| Event bubbling | The **React** tree |
| Context | The React tree — providers above still reach it |
| State preservation | The React tree — its position is where it was written |
| Error boundaries | The React tree — an error propagates to the boundary above the caller |
| Suspense | The React tree |
| Unmounting | Its React parent unmounting removes it |

The event row is the one that makes modals work rather than merely render.
react.dev's example:

> if you click inside a portal, and the portal is wrapped in `<div onClick>`,
> that `onClick` handler will fire.

So a modal portalled to `document.body` still triggers the click handlers of the
component that rendered it. You do not have to rewire anything.

## Why portals exist

One problem, and it is a CSS problem rather than a React one.

A modal, dropdown, tooltip or toast must escape its container. Three CSS
mechanisms trap it:

- **`overflow: hidden`** on any ancestor clips it.
- **`z-index` stacking contexts.** An ancestor with `transform`, `filter`,
  `opacity < 1`, `will-change`, `contain` or `position` plus a `z-index` creates
  a stacking context, and a descendant cannot paint above it however large its
  own `z-index` is. This is the failure that produces "my `z-index: 99999` does
  not work".
- **`position: fixed` inside a transformed ancestor**, which positions relative
  to the ancestor rather than the viewport.

Portalling to `document.body` sidesteps all three, because the node is no longer
a descendant of the problem.

**The modern alternative is worth knowing before reaching for a portal.** The
top layer — `<dialog>` with `showModal()`, and CSS anchor positioning / popover
— escapes stacking contexts natively, without moving anything in the tree. For a
genuinely modal dialog, `<dialog>` also brings focus trapping, `Escape` handling
and inertness for free, which is most of the accessibility work below. A portal
is still the general answer for arbitrary overlays and for cases where you need
the content in a specific container.

## The accessibility obligation

This is the part that gets skipped, and react.dev marks it as a pitfall rather
than a note:

> It's important to make sure that your app is accessible when using portals.
> For instance, you may need to manage keyboard focus so that the user can move
> the focus in and out of the portal in a natural way. Follow the WAI-ARIA Modal
> Authoring Practices when creating modals.

The DOM move is exactly what creates the problem. Screen readers and keyboard
navigation follow the DOM, and the portal's content is now somewhere else
entirely — usually at the end of `<body>`, far from the button that opened it.
So the things a user expects stop happening by default:

- **Focus does not move into the dialog** when it opens.
- **Tab escapes it**, landing on page content behind the overlay.
- **`Escape` does nothing.**
- **Focus does not return** to the trigger on close, so a keyboard user is
  dropped at the top of the document.
- **The background is still reachable** by screen reader and by tab.

None of these is React's to solve. The WAI-ARIA pattern that react.dev links is
the specification of correct behaviour, and it is why using a tested library —
or the native `<dialog>` element — is the recommended path rather than
hand-rolling.

## Event bubbling: the other direction

Following the React tree is usually what you want. When it is not, react.dev
gives both remedies:

> If this causes issues, either stop the event propagation from inside the
> portal, or move the portal itself up in the React tree.

The classic case is a dropdown portalled out of a clickable row: clicking a menu
item bubbles up through the React tree to the row's `onClick` and selects the
row as well. `e.stopPropagation()` in the menu handler fixes it, and moving the
portal higher fixes it structurally.

One asymmetry to keep in mind: **React events follow the React tree, native
events follow the DOM.** A `document.addEventListener('click', …)` used for
click-outside detection sees the portal's clicks as coming from `<body>` — not
from inside your component. Click-outside logic must compare against the
portal's node, not the trigger's container. This is a common source of a dropdown
that closes the instant it opens.

## Where to portal to

`document.body` is the default and is right most of the time. Two alternatives
matter:

**A dedicated container.** `<div id="portal-root">` as a sibling of `#root`
keeps overlays out of `body`'s direct children, which matters if anything (an
analytics script, a CSS `body > *` selector) is opinionated about them.

**A container that must exist first.** The docs are explicit that the node must
already exist. In a component that portals to a node it creates itself, the node
must be created before the first render that uses it — a `useState` initialiser
or a module-level element, not an effect, since the effect runs after the render
that needed it.

Server rendering deserves a flag: portals target a DOM node, and there is no DOM
on the server. `createPortal` is a client-only API. In an SSR app, render the
portal only after mount, or use a framework's own portal-aware component.

## Gotchas

**Symptom:** `Target container is not a DOM element.`
**Cause:** the node did not exist when `createPortal` ran — usually
`document.getElementById` for an element created in an effect, or a
`document.*` call during server rendering.
**Fix:** create the container before first render, or guard until mounted.

**Symptom:** clicking inside a portalled menu also triggers the row behind it.
**Cause:** events follow the React tree, so the click bubbles to the React
parent regardless of where the DOM node is.
**Fix:** `stopPropagation` inside the portal, or move the portal higher in the
React tree.

**Symptom:** a click-outside handler closes the dropdown immediately.
**Cause:** the native listener sees the portal's clicks as originating outside
the trigger's container, because in the DOM they are.
**Fix:** compare `event.target` against the portal's node, not the trigger's
parent. Or use `pointerdown` with a capture-phase check that accounts for both.

**Symptom:** a modal appears behind the page.
**Cause:** an ancestor stacking context — or portalling into a container that is
itself inside one.
**Fix:** portal to `document.body` or a top-level container. Raising `z-index`
does not cross a stacking context.

**Symptom:** a keyboard user tabs from the modal into the page behind it.
**Cause:** no focus management. Portals do not provide any.
**Fix:** implement the WAI-ARIA dialog pattern — move focus in, trap it, restore
it on close, make the background inert — or use `<dialog showModal>`, which does
this natively.

**Symptom:** context is `undefined` inside a portal.
**Cause:** this is not a portal problem — context follows the React tree, so a
provider above the caller does reach it. The provider is genuinely not above the
component that called `createPortal`.
**Fix:** check where the portal is *written*, not where it renders.

## Interview questions

**★ What does `createPortal` change, and what does it leave alone?**
It changes the physical DOM placement and nothing else. The content still
behaves as a child of the component that rendered it: events bubble through the
React tree, context from providers above still reaches it, error boundaries and
Suspense boundaries above still catch it, and it unmounts when its React parent
does.

**★ Why do events bubble through the React tree rather than the DOM tree?**
Because that is what makes portals composable. A modal portalled to
`document.body` still triggers handlers on the component that rendered it, so
you can wrap a portalled subtree in an `onClick` and have it work. If bubbling
followed the DOM, every portal would need its events rewired by hand.

**★ What problem do portals actually solve?**
A CSS one: `overflow: hidden` clipping an overlay, and stacking contexts created
by `transform`, `filter`, `opacity` or `position` preventing a descendant from
painting above them no matter what its `z-index` is. Moving the node out of that
subtree is the fix. The native top layer — `<dialog showModal()>` and popover —
solves the same problem without moving anything, and brings focus management
with it.

**What accessibility work does a portal require?**
All of it — React provides none. Focus must move into the dialog on open, be
trapped while it is open, return to the trigger on close, `Escape` must close
it, and the background must be made inert. react.dev flags this as a pitfall and
points at the WAI-ARIA Modal Authoring Practices, which is the reason to use
`<dialog>` or a tested library rather than hand-rolling.

**A dropdown closes as soon as it opens. Why?**
Almost always click-outside detection. The native document listener sees the
portal's clicks as originating outside the trigger's container — which in the
DOM they are — so the "outside" check passes and the dropdown closes. Compare
against the portal's own node instead.

**Can you use a portal during server rendering?**
No. It targets a real DOM node and there is no DOM on the server. Render it
after mount, or use a framework component that handles the SSR case.

---

← Prev: [Component boundaries](10-component-boundaries.md) · Index: [Phase 2](README.md) · Next → [Render props and function-as-children](12-render-props/README.md)
