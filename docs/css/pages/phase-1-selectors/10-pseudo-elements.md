---
title: "Pseudo-elements"
sidebar_label: "10 · Pseudo-elements"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 in **Firefox 153.0.3** via `sandbox/css/ex10-nesting-scope-pseudo.mjs`.

**A pseudo-element is a box the engine creates that has no element behind it.**
Two of them — `::before` and `::after` — are among the most-used constructs in
CSS, and the rule that governs both is a single required property.

## They are not in the DOM

```css
.quote::before { content: "\201C"; color: red; }
```

```console
$ node ex10-nesting-scope-pseudo.mjs
=== Pseudo-elements are not in the DOM ===
  childNodes of .quote                      1
  querySelector("::before")                 null
  getComputedStyle(el, "::before").content  "“"
  its colour                                rgb(255, 0, 0)
  textContent includes the quote mark?      false
```

The `<blockquote>` has **one** child node — the pseudo-element added none.
`querySelector('.quote::before')` returns **null**; there is nothing to select.
The generated quote mark is **not** in `textContent`. Yet
`getComputedStyle(el, '::before')` reports the content and the colour, because
the engine does have a box — it is just not a DOM node.

Three consequences that matter:

1. **Script cannot reach them** except through `getComputedStyle`'s second
   argument.
2. **Generated content is not selectable or copyable as normal text**, and
   screen-reader support for it is inconsistent — so never put meaning there.
3. **They cannot have children**, cannot be targeted by events, and cannot
   contain HTML.

## `content` is mandatory

`::before` and `::after` do not exist without `content`. The empty string is the
normal value when the pseudo-element is purely decorative:

```css
.card::after {
  content: "";              /* required — without it, nothing renders */
  position: absolute;
  inset: 0;
  background: linear-gradient(transparent, rgb(0 0 0 / 0.6));
}
```

`content` accepts more than strings:

```css
a[href$=".pdf"]::after { content: " (PDF)"; }
li::marker            { content: "→ "; }
.count::before        { content: counter(items) ". "; }
blockquote::before    { content: open-quote; }
.icon::before         { content: url(check.svg); }
.field::after         { content: attr(data-hint); }   /* pull from an attribute */
```

## The full set worth knowing

| Pseudo-element | What it is |
|---|---|
| `::before` / `::after` | generated boxes at the start/end of an element's content |
| `::marker` | a list item's bullet or number |
| `::placeholder` | an input's placeholder text |
| `::selection` | the highlighted range the user has selected |
| `::first-line` / `::first-letter` | typographic — drop caps, lead-in styling |
| `::backdrop` | the layer behind a modal dialog or popover |
| `::details-content` | a `<details>` element's revealed content |
| `::file-selector-button` | the button inside `<input type="file">` |
| `::part()` / `::slotted()` | reaching into shadow DOM ([page 16](./16-shadow-dom-selectors.md)) |

## `::before` and `::after` sit *inside* the element

This trips people up constantly. They are the element's **first and last
children**, not siblings placed outside it:

```
<div class="box">
  ::before          ← here
  actual content
  ::after           ← here
</div>
```

So `padding` on the element pushes them inward, `overflow: hidden` clips them,
and they participate in the element's layout — including as flex or grid items:

```css
/* the pseudo-elements become flex items and can be spaced with gap */
.title { display: flex; align-items: center; gap: 1rem; }
.title::before, .title::after { content: ""; flex: 1; border-block-start: 1px solid; }
```

That is the classic "heading with rules on both sides", and it works precisely
because the pseudo-elements are children.

## What they cannot do

- **Not on replaced elements.** `<img>`, `<input>`, `<br>`, `<video>` have no
  content box to generate into, so `img::before` does nothing. Wrap the element
  if you need decoration around it.
- **`::first-line` and `::first-letter` accept only a subset of properties** —
  font, colour, background, and a few spacing properties. Layout properties are
  ignored.
- **One `::before` per element.** There is no way to have two.

## One colon or two?

`::` is the modern syntax and distinguishes pseudo-**elements** from
pseudo-**classes**. `:before` still works for the original four
(`::before`, `::after`, `::first-line`, `::first-letter`) for legacy reasons.
Write two colons; read one without alarm.

## Gotchas

**Symptom:** `::before` renders nothing at all.
**Cause:** no `content` property. It is required, even when empty.
**Fix:** add `content: ""`.

**Symptom:** `img::before` does nothing.
**Cause:** replaced elements have no content box to generate into.
**Fix:** wrap the image and generate on the wrapper.

**Symptom:** generated text appears in a screen reader, or does not, and you
cannot predict which.
**Cause:** support for announcing generated content varies, and it is not in
`textContent` — measured, `textContent` did not include the generated quote mark.
**Fix:** never put meaning in `content`. Decorative only; real text goes in the
DOM.

**Symptom:** an absolutely positioned `::after` is positioned relative to the
page rather than the element.
**Cause:** the element is not a containing block — it needs `position: relative`
(or `transform`, `filter`, `contain`).
**Fix:** `position: relative` on the parent
(**Phase 7**).

**Symptom:** `content: attr(data-x)` works but `content: attr(data-count) + 1`
does not.
**Cause:** `attr()` returns a string in `content`; there is no arithmetic.
**Fix:** use a CSS counter, or compute the value where you set the attribute.

## Interview questions

**★ Are `::before` and `::after` in the DOM?**
No. They generate boxes the engine renders, but there is no node — measured,
`querySelector('.quote::before')` returns `null`, the element's `childNodes`
count is unchanged, and the generated text is absent from `textContent`. They are
only reachable from script via `getComputedStyle(el, '::before')`.

**★ Why must you set `content` on `::before`?**
Because the pseudo-element does not exist without it. `content: ""` is the normal
value for a purely decorative box — an empty string still creates the box, while
omitting the property creates nothing.

**Where do `::before` and `::after` sit relative to the element's content?**
Inside it, as the first and last children. So the element's padding pushes them
in, `overflow: hidden` clips them, and in a flex or grid container they become
items — which is what makes the "heading with lines either side" pattern work.

**Why does `img::before` not work?**
`<img>` is a replaced element: its content comes from an external resource and
there is no content box to generate into. The same applies to `<input>`,
`<br>` and `<video>`. Wrap the element and generate on the wrapper.

**Should important text go in `content`?**
No. It is not part of `textContent`, cannot be selected or copied reliably, and
screen-reader announcement of generated content is inconsistent. Generated
content should be decorative; anything meaningful belongs in the DOM.

**What is the difference between `:before` and `::before`?**
Only syntax and era. The double colon distinguishes pseudo-elements from
pseudo-classes and is the modern form; the single colon is still accepted for the
four original pseudo-elements for backwards compatibility.

---

← [09 · Form-state pseudo-classes](./09-form-state-pseudo-classes.md) · Next: [11 · :not(), :empty, :root and friends](./11-not-empty-root.md) →
