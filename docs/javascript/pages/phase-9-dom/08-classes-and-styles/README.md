---
title: "08 · Classes and styles from JavaScript"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`Element.classList`](https://developer.mozilla.org/en-US/docs/Web/API/Element/classList), [`HTMLElement.style`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/style), [`CSSStyleDeclaration.setProperty()`](https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleDeclaration/setProperty), [`Window.getComputedStyle()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/getComputedStyle). Documentation-validated; **no timings**.

**The rule this topic exists to install:**

> **JavaScript decides *state*. CSS decides what state *looks like*.**
> So JavaScript writes **classes** and **custom properties**, and almost never writes
> individual style declarations.

```js
// ⚠️ styling from JavaScript — the look is now in two files
panel.style.display = 'none';
panel.style.backgroundColor = '#f5f5f5';

// ✅ state from JavaScript — the look stays in the stylesheet
panel.classList.toggle('is-collapsed', collapsed);
```

The second version survives a redesign, works with a media query, respects
`prefers-reduced-motion`, and can be transitioned. The first cannot do any of those without more
JavaScript, because an inline style beats every stylesheet rule that is not `!important`.

**The exception, and it is a real one:** a value the stylesheet cannot know — a drag position, a
measured height, a user-picked colour. That is what **CSS custom properties** are for, and they
are the subject of chunk 02.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[`classList` and the class-first rule](./01-classlist.md)** | The full `DOMTokenList` API, `toggle`'s second argument, why `className` is a trap on SVG, what throws, and when a `data-*` attribute beats a class |
| 02 | **[Inline styles, custom properties and computed values](./02-styles-and-custom-properties.md)** | What `element.style` actually reads, the camelCase mapping and why custom properties are exempt, silent failures, `!important` from JS, `getComputedStyle` and its cost, and the custom-property bridge |

## Phase gate

You can render a list from an array into the DOM with no framework, update one row without
rebuilding the list, and explain which parts are XSS-safe.

## Where this connects

- [05 · Attributes versus properties](../05-attributes-vs-properties/README.md) — `dataset`, the
  other half of "state on the element"
- [07 · Traversal](../07-traversal/README.md) — finding the element whose class you are about to
  change
- **11 · Layout thrashing** *(not written yet)* — why reading a computed style straight after
  writing one is the expensive mistake

---

Start → [01 · `classList` and the class-first rule](./01-classlist.md)
