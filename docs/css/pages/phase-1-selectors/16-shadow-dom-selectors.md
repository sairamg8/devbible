---
title: "Shadow DOM selectors"
sidebar_label: "16 · Shadow DOM selectors"
sidebar_position: 16
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 in **Firefox 153.0.3**. Shadow DOM behaviour described here is
> specification behaviour; the boundary rules were confirmed against the local
> engine, and no cross-engine claim is made.

**Shadow DOM is the only real style isolation the platform has** — and the
selectors exist because total isolation turns out to be unusable in practice.

## The boundary

A shadow root creates a separate tree. Selectors do not cross it in either
direction:

```css
/* in the page's stylesheet */
.card .title { color: red; }   /* does NOT reach a .title inside a shadow root */
```

```css
/* inside the component's shadow stylesheet */
.title { color: red; }         /* does NOT escape to the light DOM */
```

This is genuine encapsulation, unlike CSS Modules (which renames classes) or
`@scope` (which narrows matching). Nothing leaks either way.

**Inheritance still crosses.** Inherited properties — `color`, `font-family`,
`line-height`, and every custom property — pass through the boundary normally.
That is the mechanism every themable web component relies on.

## The selectors

```css
/* — inside the shadow stylesheet — */

:host              { display: block; }          /* the component element itself */
:host(.compact)    { padding: 0.25rem; }        /* …when it matches a selector  */
:host-context(.dark) { --bg: #161f27; }         /* …when an ANCESTOR matches    */

::slotted(img)     { border-radius: 4px; }      /* light-DOM nodes in a slot    */
::slotted(*)       { margin: 0; }
```

```css
/* — outside, in the page — */

my-card::part(header)  { background: var(--surface-2); }
my-card { --card-padding: 1rem; }   /* custom properties pass through */
```

## The three ways to style a component from outside

**1 — Custom properties (the primary mechanism).** They inherit through the
boundary, so a component exposes a documented set:

```css
/* the component's internal stylesheet */
:host { padding: var(--card-padding, 1rem); background: var(--card-bg, white); }

/* the page */
my-card { --card-padding: 2rem; --card-bg: var(--surface); }
```

**2 — `::part()`.** The component opts specific elements in:

```html
<!-- inside the shadow root -->
<div part="header">…</div>
```

```css
my-card::part(header) { border-block-end: 1px solid; }
```

`::part()` exposes an element for styling but **not** its descendants — you
cannot do `::part(header) .title`. That limit is deliberate: it keeps the
internal structure private.

**3 — `::slotted()`,** for content the page supplied:

```css
::slotted(h2) { font-size: 1.25rem; }
```

`::slotted()` only matches **top-level** slotted nodes, not their descendants,
and page styles win over it — because the nodes belong to the light DOM, where
the page's rules are author-origin rules for that tree.

## `:host` specificity, and the rule that surprises people

`:host` has the specificity of a class (`0,1,0`), and `:host(.x)` adds its
argument. But the significant behaviour is ordering:

**A page rule targeting the host element beats the shadow stylesheet's `:host`
rule**, regardless of specificity. Shadow styles are intended as defaults for
the component's own element, so the page can always override them.

Inside the shadow tree it is the reverse — the page cannot reach in at all.

## Why this matters even if you never write a web component

You will meet shadow DOM whether or not you author it:

- **Native controls** — `<input type="range">`, `<video>`, `<details>` — are
  implemented with shadow trees, which is why parts of them cannot be styled and
  why prefixed pseudo-elements like `::-webkit-slider-thumb` exist.
- **Third-party widgets** — chat launchers, payment fields, embeds — commonly use
  a shadow root specifically so your stylesheet cannot affect them. When a
  vendor's widget ignores your CSS, this is usually why.
- **`::part()` and custom properties are the entire styling API** of such a
  widget. If it exposes neither, it cannot be restyled, and that is by design.

## The trade-off

Shadow DOM gives real isolation and takes away the cascade. Every styling hook
must be designed and documented in advance, and anything the author did not
expose is unreachable. For an application's own components that is usually the
wrong trade — CSS Modules or `@scope` give enough separation without the
ceremony. For a widget embedded in *other people's* pages, it is exactly right.

## Gotchas

**Symptom:** page CSS has no effect on a third-party widget.
**Cause:** it renders inside a shadow root; selectors do not cross the boundary.
**Fix:** check whether it exposes `::part()` or custom properties. If not, it
cannot be restyled from outside.

**Symptom:** a font or colour "leaks" into a component you thought was isolated.
**Cause:** inherited properties cross the boundary by design — that is how
theming works.
**Fix:** if the component must not inherit, reset it explicitly on `:host`.

**Symptom:** `::part(header) .title` does not work.
**Cause:** `::part()` exposes only the part element itself, not its descendants.
**Fix:** the component must expose the inner element as its own part.

**Symptom:** `::slotted(.x .y)` matches nothing.
**Cause:** `::slotted()` matches only top-level slotted nodes, not descendants.
**Fix:** style descendants from the page instead — slotted content is light DOM
and the page's rules reach it.

## Interview questions

**★ Do CSS rules cross the shadow DOM boundary?**
Selectors do not, in either direction — page rules cannot match inside a shadow
root, and shadow rules cannot escape it. **Inherited properties do cross**,
including all custom properties, which is precisely the mechanism used to theme
web components from outside.

**★ How do you style a web component you did not write?**
Through the API it exposes: custom properties it reads, and elements it marks
with `part`, targeted by `::part()`. If it exposes neither, it is not stylable
from outside — that is the intended behaviour of the encapsulation, not a bug.

**What is the difference between `:host` and `:host-context()`?**
`:host` matches the component's own element, optionally filtered by a selector.
`:host-context(.dark)` matches when an **ancestor** of the host matches the
selector, which is how a component adapts to a theme applied further up the page.

**Why can't you style parts of `<input type="range">`?**
Native controls are implemented with shadow trees, so their internals are outside
your selectors' reach. That is why engine-prefixed pseudo-elements such as
`::-webkit-slider-thumb` exist — they are the vendor's escape hatch into their
own shadow tree.

**When is shadow DOM the right choice for your own components?**
When the component is embedded in pages you do not control, where genuine
isolation is worth the loss of the cascade. Inside your own application, CSS
Modules or `@scope` give sufficient separation without requiring every styling
hook to be designed and documented up front.

---

← [15 · Selector performance](./15-selector-performance.md) · Back to [Phase index](./) · Next phase: **Phase 2 · The cascade** →
