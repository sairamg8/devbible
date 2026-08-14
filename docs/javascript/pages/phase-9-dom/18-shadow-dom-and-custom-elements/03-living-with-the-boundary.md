---
title: "03 · Living with the boundary"
sidebar_label: "03 · Living with the boundary"
sidebar_position: 3
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against MDN — [Using shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM), [`Event.composed`](https://developer.mozilla.org/en-US/docs/Web/API/Event/composed), [`Event.composedPath()`](https://developer.mozilla.org/en-US/docs/Web/API/Event/composedPath), [`Node.getRootNode()`](https://developer.mozilla.org/en-US/docs/Web/API/Node/getRootNode), [`Element.attachShadow()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/attachShadow). Documentation-validated; **no timings**.

The boundary is not only a style scope — it changes selectors, events, focus and forms. This chunk
is what breaks when you cross it, and what to do instead.

## Events are retargeted

An event that bubbles out of a shadow tree is **retargeted**: outside the boundary, `event.target`
becomes the **host**, not the internal node that was clicked. The page sees "something in the
component happened" without learning its structure.

```js
document.addEventListener('click', (e) => {
  e.target;              // <status-pill>, never the <span> inside its shadow root
  e.composedPath()[0];   // the real innermost node — crosses the boundary
});
```

`composedPath()` returns the full path including shadow internals, which is the tool for debugging
and for delegation that genuinely needs the inner node. Inside the component, listeners on shadow
nodes see the real target — retargeting only applies as the event leaves.

### `composed` decides whether it escapes at all

| Event | Escapes the shadow root? |
|---|---|
| `click`, `focus`, most UI events | yes — `composed: true` |
| custom events, by default | **no** |

```js
this.dispatchEvent(new CustomEvent('pill-change', {
  detail: { state },
  bubbles: true,
  composed: true,        // ← without this the page never hears it
}));
```

🔴 **`bubbles: true` alone is not enough.** A custom event that bubbles but is not composed stops
at the shadow root, and the page's listener never fires — the most common "my component's events
don't work" report. The pair matters: `bubbles` moves it up, `composed` lets it out.

⚠️ Some events deliberately do not cross even when they bubble in the light DOM. `focus` and `blur`
do not bubble at all ([15 · 01](../15-focus-and-accessibility/01-what-can-hold-focus.md)), and the
composed ones are retargeted the same way clicks are.

## Selectors stop at the boundary

- `document.querySelector` does **not** descend into shadow roots.
- `shadowRoot.querySelector` does not escape upward.
- `closest()` stops at the shadow root — the walk from
  [07 · Traversal](../07-traversal/02-closest-matches-and-scope.md) ends there.
- `getRootNode()` returns the `ShadowRoot` instead of the `Document`, and `getRootNode().host`
  climbs out one level.

```js
function ownerHost(node) {
  const root = node.getRootNode();
  return root instanceof ShadowRoot ? root.host : null;
}
```

`getRootNode({ composed: true })` walks all the way to the document — the correct "am I in the
document at all" check for code that may run inside a component.

## Focus and forms across the boundary

- **`document.activeElement` reports the host**, not the focused node inside. Each shadow root has
  its own `activeElement`; the recursive walk is in
  [15 · 01](../15-focus-and-accessibility/01-what-can-hold-focus.md).
- **`delegatesFocus`** — `attachShadow({ mode: 'open', delegatesFocus: true })` makes focusing the
  host focus the first focusable element inside, and makes `:focus` match the host. It is the
  simplest way to make a component behave like a native control.
- **Form controls inside a shadow root do not participate in the outer form.** They are not
  successful controls, so they contribute nothing to `FormData`
  ([09 · Forms](../09-forms/01-formdata.md)). `ElementInternals` with `formAssociated` and
  `setFormValue()` is the supported route ([01 · Custom elements](./01-custom-elements.md)) — not a
  hidden input, which is the workaround people reach for first.
- **Labels do not cross either.** A `<label for="x">` in the page cannot reference an input inside
  a shadow root; the component owns its own labelling.

## Accessibility across the boundary

- `aria-labelledby` and `aria-describedby` take **ids**, and ids are scoped to their tree — so they
  cannot point across the boundary. A component labelled by page content needs the text passed in
  (a slot, an attribute) or `ElementInternals`' ARIA properties.
- The `role` and ARIA state of the *component* belong on the host or in internals, so the page sees
  one coherent element rather than an opaque box.
- Everything in [15 · 03 · ARIA from JavaScript](../15-focus-and-accessibility/03-aria-from-javascript.md)
  still applies **inside** the component; the shadow root hides structure from CSS and selectors,
  not from assistive technology.

## When to use shadow DOM, and when to skip it

**Use it** when the component will be dropped into pages whose CSS you do not control — a design
system shipped to other teams, an embeddable widget, anything third-party.

**Skip it** when you own the whole page. A custom element with **no** shadow root still gives you
the lifecycle callbacks, the tag name, and `ElementInternals` — while leaving your global styles,
your utility classes and your dev tools working normally. That is often the better trade for an
in-house component.

**The cost, stated plainly:** encapsulation means your design tokens must be deliberate contracts
(custom properties, `::part`), your events must be explicitly `composed`, your forms need
`ElementInternals`, and every debugging session has an extra hop. It buys immunity from other
people's CSS. If nobody else's CSS is a threat, you are paying for insurance you do not need.

## Gotchas

**Symptom: a custom event from inside a component never reaches the page.**
Cause — it bubbles but is not `composed`, so it stops at the shadow root.
Fix — `{ bubbles: true, composed: true }`.

**Symptom: `event.target` is the whole component instead of the button that was clicked.**
Cause — retargeting at the boundary.
Fix — `event.composedPath()[0]` for the real node, or listen inside the component.

**Symptom: a form submits without the component's value.**
Cause — controls inside a shadow root are not successful controls of the outer form.
Fix — `static formAssociated = true` plus `attachInternals()` and `setFormValue()`.

**Symptom: `document.activeElement` is the component, so focus logic misbehaves.**
Cause — focus inside a shadow root reports the host.
Fix — walk `shadowRoot.activeElement` recursively, or `delegatesFocus: true` if you just need the
host to behave like a control.

**Symptom: `aria-labelledby` pointing at a page element does nothing.**
Cause — ids do not resolve across a shadow boundary.
Fix — pass the label in as text or an attribute, or set it through `ElementInternals`.

**Symptom: a click handler using `closest('.row')` returns `null` inside a component.**
Cause — `closest()` stops at the shadow root.
Fix — `getRootNode().host` to step out, or delegate inside the component where the tree is
continuous.

## Interview questions

**★ What is event retargeting?**
As an event crosses a shadow boundary, its `target` is rewritten to the host, so outside code sees
the component rather than its internals. `composedPath()` still exposes the full path when you
genuinely need the inner node.

**★ Why doesn't the page receive my component's custom event?**
`bubbles: true` moves it up the tree, but `composed: true` is what lets it leave the shadow root.
Custom events default to `composed: false`.

**★ How does a custom element participate in a form?**
`static formAssociated = true`, `attachInternals()`, and `setFormValue()`. Controls inside a shadow
root are not successful controls of the outer form, so they contribute nothing to `FormData` on
their own.

**★ Why can't `aria-labelledby` reference across the shadow boundary?**
It takes an id, and ids are scoped per tree. Pass the label in, or use `ElementInternals`' ARIA
properties.

**★ When would you deliberately not use shadow DOM?**
When you own the page. A custom element without a shadow root keeps the lifecycle and the tag name
while leaving global styles, utility classes and tooling working normally. Encapsulation is
insurance against other people's CSS — worth paying for only when that risk is real.

**What does `delegatesFocus` do?**
Focusing the host focuses the first focusable element inside it, and `:focus` matches the host — so
the component behaves like a native control from the outside.

---

← [02 · Shadow DOM](./02-shadow-dom.md) · [Topic index](./README.md) ·
**19 · Selection, `Range` and `contenteditable`** *(not written yet)* →
