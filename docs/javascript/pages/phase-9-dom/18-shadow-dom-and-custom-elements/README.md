---
title: "18 · Shadow DOM and custom elements"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against MDN — [Using custom elements](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements), [Using shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM), [`Element.attachShadow()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/attachShadow), [`ElementInternals`](https://developer.mozilla.org/en-US/docs/Web/API/ElementInternals), [`Event.composedPath()`](https://developer.mozilla.org/en-US/docs/Web/API/Event/composedPath). Documentation-validated; **no timings**.

The syllabus row asks for *encapsulation, slots, lifecycle callbacks, and where style boundaries
help or hurt* — and that last clause is the honest framing. Web components are two independent
features that are usually taught as one: **custom elements** (lifecycle and a tag name) and
**shadow DOM** (encapsulation). You can take either without the other, and often should.

🔴 **The one-line summary:** custom elements are almost always worth it; shadow DOM is worth it when
somebody else's CSS is a real threat, and a cost you pay in events, forms, focus and debugging when
it is not.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[Custom elements](./01-custom-elements.md)** | `customElements.define()`, the hyphen rule, autonomous versus customized built-in, every lifecycle callback, why the constructor is restricted, upgrade, property/attribute reflection, and `ElementInternals` |
| 02 | **[Shadow DOM](./02-shadow-dom.md)** | `attachShadow()` open versus closed, exactly what crosses the style boundary, `::part()` / `::slotted()` / `:host`, `adoptedStyleSheets`, slots and `slotchange`, and declarative shadow DOM |
| 03 | **[Living with the boundary](./03-living-with-the-boundary.md)** | Event retargeting and `composed`, selectors and `getRootNode()`, focus and `delegatesFocus`, forms and labels, accessibility across the boundary, and when to skip shadow DOM entirely |

## Four facts worth carrying out of this topic

- **The constructor may not look at attributes or children.** Upgrade is why — do that work in
  `connectedCallback`, and make it idempotent, because `connectedCallback` can run more than once.
- **`observedAttributes` has no wildcard.** An attribute you forget to list changes silently.
- **Inherited and custom properties cross the shadow boundary; selectors do not.** Theming is a
  contract you design (custom properties, `::part()`), not something the page can force.
- **`bubbles: true` is not enough for a custom event to leave a shadow root** — it needs
  `composed: true` as well.

## Phase gate

You can render a list from an array into the DOM with no framework, update one row without
rebuilding the list, and explain which parts are XSS-safe.

## Where this connects

- [17 · `MutationObserver`](../17-mutationobserver/02-when-to-use-it.md) — `connectedCallback` and
  `attributeChangedCallback` are the scoped alternative to watching the tree
- [15 · Focus and accessibility](../15-focus-and-accessibility/01-what-can-hold-focus.md) — each
  shadow root has its own `activeElement`, and ARIA ids do not cross the boundary
- [09 · Forms](../09-forms/01-formdata.md) — controls in a shadow root are not successful controls;
  `ElementInternals` is the supported route
- [08 · Classes and styles](../08-classes-and-styles/02-styles-and-custom-properties.md) — custom
  properties and `adoptedStyleSheets`, which do most of the theming work here
- [07 · Traversal](../07-traversal/02-closest-matches-and-scope.md) — where `closest()` stops, and
  `getRootNode().host`

---

Start → [01 · Custom elements](./01-custom-elements.md)
