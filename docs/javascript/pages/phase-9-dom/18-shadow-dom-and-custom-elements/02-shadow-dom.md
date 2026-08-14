---
title: "02 · Shadow DOM"
sidebar_label: "02 · Shadow DOM"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against MDN — [Using shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM), [`Element.attachShadow()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/attachShadow), [`ShadowRoot`](https://developer.mozilla.org/en-US/docs/Web/API/ShadowRoot), [`::part()`](https://developer.mozilla.org/en-US/docs/Web/CSS/::part), [`::slotted()`](https://developer.mozilla.org/en-US/docs/Web/CSS/::slotted), [`Document.adoptedStyleSheets`](https://developer.mozilla.org/en-US/docs/Web/API/Document/adoptedStyleSheets). Documentation-validated; **no timings**.

A shadow root is a separate DOM tree attached to an element, with its own scope for CSS and its own
boundary for selectors and events. It is the encapsulation half of web components — and it is
optional: plenty of useful custom elements never attach one.

```js
const shadow = host.attachShadow({ mode: 'open' });
shadow.innerHTML = `<style>span { color: red }</style><span>Inside</span>`;
```

## `open` versus `closed`

| Mode | `host.shadowRoot` from outside |
|---|---|
| `'open'` | the `ShadowRoot` |
| `'closed'` | **`null`** |

⚠️ **`closed` is not a security boundary.** MDN says so directly: "you should not consider this a
strong security mechanism, because there are ways it can be evaded, for example by browser
extensions running in the page." What it *does* buy is a hard stop on other people's code reaching
into your internals casually — and it costs you the same access in your own tests and debugging.
**Use `open` unless you have a specific reason.**

## What crosses the style boundary, and what does not

This is the part that surprises people, because it is not total isolation:

| | Crosses? |
|---|---|
| page selectors matching shadow nodes (`span { … }`) | **no** |
| shadow styles leaking out to the page | **no** |
| **inherited** properties — `color`, `font-*`, `line-height`, `visibility` | **yes** |
| **custom properties** (`--brand`) | **yes** |
| `dir` and `lang` from the host | **yes** |

So a component inherits your typography for free, and a page cannot restyle its internals by
accident. The two deliberate escape hatches:

```css
/* the page styles what the component chose to expose */
status-pill::part(label) { font-weight: 700; }

/* the component styles content the PAGE put into its slots */
::slotted(p) { margin: 0; }
```

`::part()` requires the component to mark the element `part="label"` — exposure is opt-in and
deliberate, which is the whole design. `::slotted()` reaches light-DOM nodes projected into a slot,
and only one level deep.

**Custom properties are the primary theming contract.** A component that reads `var(--pill-bg,
#eee)` is themeable from the page without exposing its structure — which is why design systems
prefer them over `::part()` for anything that is really a token.

### Styling the host

```css
:host { display: inline-block; }                 /* the element itself */
:host([state='live']) { --pill-bg: tomato; }     /* conditional on its own attribute */
:host-context(.dark-theme) { --pill-fg: white; } /* depends on an ancestor */
```

⚠️ A custom element defaults to `display: inline` like any unknown element. `:host { display:
block }` is usually the first line of the stylesheet, and forgetting it is why a component
"ignores" width and height.

### Getting styles in

```js
const sheet = new CSSStyleSheet();
sheet.replaceSync(':host { display:block } span { color: red }');
shadow.adoptedStyleSheets = [sheet];
```

Constructable stylesheets are **parsed once and shared** across every instance and root that adopts
them — the right answer for a component used many times. A `<style>` element inside a template is
simpler and fine for a handful of rules, but each instance carries its own copy. The same
`adoptedStyleSheets` mechanism appears in
[08 · Classes and styles](../08-classes-and-styles/02-styles-and-custom-properties.md).

## Slots — the component's content model

```html
<my-card>
  <h2 slot="title">Invoice #42</h2>
  <p>Due next week.</p>              <!-- goes to the default slot -->
</my-card>
```

```html
<!-- inside the shadow root -->
<article>
  <header><slot name="title">Untitled</slot></header>
  <div class="body"><slot></slot></div>
</article>
```

- Content in a slot **stays in the light DOM**. It is the page's node, still matched by the page's
  CSS and by `document.querySelector` — it is only *rendered* in the shadow tree's position. This
  is the single most useful thing to understand about slots.
- A slot's own children are **fallback content**, shown when nothing is assigned.
- `slot.assignedElements()` tells the component what it actually received, and the `slotchange`
  event fires when that changes.

```js
shadow.querySelector('slot[name="title"]')
  .addEventListener('slotchange', (e) => {
    const assigned = e.target.assignedElements();
    host.classList.toggle('has-title', assigned.length > 0);
  });
```

## Declarative shadow DOM

Shadow roots can be written in HTML, which is what makes server-side rendering of components
possible:

```html
<div id="host">
  <template shadowrootmode="open">
    <span>I'm in the shadow DOM</span>
  </template>
</div>
```

The browser replaces the `<template>` with a real shadow root as it parses — **no `<template>`
remains in the tree**. Related attributes: `shadowrootclonable` and `shadowrootdelegatesfocus`.

This closes the last gap in the model: the component's internals arrive with the HTML instead of
waiting for JavaScript, so there is no unstyled interval to hide.

## Gotchas

**Symptom: the page's CSS has no effect on the component's internals.**
Cause — that is the boundary working. Only inherited properties and custom properties cross.
Fix — theme with custom properties, or expose specific elements with `part=` and style them via
`::part()`.

**Symptom: the component ignores `width` and `height`.**
Cause — an undefined tag is `display: inline` by default.
Fix — `:host { display: block }` (or `inline-block`) in the shadow stylesheet.

**Symptom: `document.querySelector` cannot find an element inside the component.**
Cause — the shadow boundary; `querySelector` does not descend into shadow roots.
Fix — `host.shadowRoot.querySelector(...)` for an open root. Slotted content is the exception —
it is light DOM and findable normally.

**Symptom: `host.shadowRoot` is `null`.**
Cause — the root was attached with `{ mode: 'closed' }`.
Fix — use `open` unless you deliberately chose otherwise; `closed` is not security anyway.

**Symptom: `attachShadow()` throws.**
Cause — the element already has a shadow root, or that element type cannot host one.
Fix — check `this.shadowRoot` first; attach in the constructor so it happens exactly once.

**Symptom: slotted content is not styled by the component's own rules.**
Cause — it is light DOM; the shadow stylesheet reaches it only through `::slotted()`, and only one
level deep.
Fix — `::slotted(selector)`, or style it from the page, where it actually lives.

**Symptom: a component looks unstyled for a moment on load.**
Cause — the definition and its styles arrive after the HTML.
Fix — declarative shadow DOM, or hide `:not(:defined)` until upgrade.

## Interview questions

**★ What does a shadow root encapsulate, and what does it not?**
Selectors and styles: page CSS does not match inside, and shadow CSS does not leak out. It does
**not** block inherited properties, custom properties, or `dir`/`lang` from the host — so
typography and theme tokens still flow in, by design.

**★ Is `mode: 'closed'` a security feature?**
No. MDN is explicit that it can be evaded, for example by extensions. It stops casual access from
page scripts, and it costs you the same access in tests and tooling.

**★ How does a page style a component's internals?**
Only where the component allows it: custom properties for tokens, and `::part()` for elements the
component marked with `part=`. Both are opt-in.

**★ Where does slotted content actually live?**
In the light DOM. It is rendered at the slot's position but remains the page's node — matched by
page CSS and found by `document.querySelector`. `::slotted()` is how the shadow stylesheet reaches
it.

**★ What problem does declarative shadow DOM solve?**
Server-side rendering. `<template shadowrootmode="open">` becomes a real shadow root during
parsing, so a component's internals arrive with the HTML rather than after the JavaScript loads.

**Why is `:host { display: block }` almost always needed?**
Because an unknown tag is `display: inline`, so the component ignores width, height and vertical
padding until the host display type is set.

---

← [01 · Custom elements](./01-custom-elements.md) · [Topic index](./README.md) ·
[03 · Living with the boundary](./03-living-with-the-boundary.md) →
