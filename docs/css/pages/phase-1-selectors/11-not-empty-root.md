---
title: ":not(), :empty, :root and the logical set"
sidebar_label: "11 · :not(), :empty, :root"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 in **Firefox 153.0.3** via `sandbox/css/ex09-selector-families.mjs`.

**The remaining pseudo-classes: negation, emptiness, the root, and language.**
Small individually, and two of them carry specificity behaviour that catches
people out.

## `:not()`

```console
$ node ex09-selector-families.mjs
  input:not([required])          1  not()              input[]
```

Modern `:not()` accepts a **selector list** and complex selectors, which the
original version did not:

```css
:not(.a, .b)              /* neither a nor b — same as :not(.a):not(.b) */
:not(.card > .title)      /* complex selectors are allowed now          */
li:not(:last-child)       /* everything but the last                    */
```

**Its specificity is that of its most specific argument** — like `:is()` and
`:has()`. `:not()` itself adds nothing:

```css
:not(.a)     /* 0,1,0 */
:not(#a)     /* 1,0,0 — the id counts, even though you are excluding it */
:not(:where(#a))  /* 0,0,0 — neutralised */
```

That last trick matters: `:where()` inside `:not()` is how you exclude something
without inheriting its weight.

### The double-negative trap

`:not()` with a list is `AND`, not `OR`:

```css
/* elements that are neither .a nor .b */
:not(.a, .b)

/* NOT "elements that are not .a, or not .b" — that would match everything,
   since any element fails at least one of the two */
```

Reading `:not(.a):not(.b)` aloud as "not a and not b" is the reliable way to keep
it straight.

## `:empty`

Matches an element with **no children at all** — no elements, no text, not even
whitespace:

```css
.message:empty { display: none; }
```

```html
<p class="message"></p>        <!-- matches -->
<p class="message"> </p>       <!-- does NOT match — a space is a text node -->
<p class="message"><!-- x --></p>  <!-- matches — comments do not count -->
```

That whitespace rule is why `:empty` disappoints so often: server-rendered and
templated HTML is full of newlines and indentation between tags. In practice,
`:empty` is reliable only for elements a script emptied, or markup you generate
without pretty-printing.

When it fails, `:has()` is usually the better tool:

```css
.list:not(:has(li)) { display: none; }   /* a list with no list items */
```

## `:root`

The document's root element — `<html>` in HTML. Identical in what it matches to
the `html` type selector, but with class-level specificity (`0,1,0` vs `0,0,1`):

```css
:root {
  --accent: #0b6e5b;
  color-scheme: light dark;
}
```

**Convention is to declare global custom properties on `:root`**, because it is
the top of the inheritance chain and every element inherits from it
(**Phase 3**).

`:root` also composes with attribute selectors for theming:

```css
:root[data-theme="dark"] { --surface: #161f27; }
```

## `:scope`

Refers to the element a selector is being evaluated against. In a stylesheet it
is equivalent to `:root`; its real use is from script:

```js
// only direct children, without needing a parent selector
container.querySelectorAll(':scope > .item');
```

Inside [`@scope`](./14-scope.md) it means the scoping root, which is where it
becomes genuinely useful in CSS.

## `:lang()` and `:dir()`

```css
:lang(fr) q { quotes: "«\00a0" "\00a0»"; }
:lang(ja)   { line-break: strict; }
:dir(rtl) .chevron { scale: -1 1; }
```

`:lang()` matches on the *inherited* language, so `:lang(en)` matches an element
inside `<html lang="en">` without that element carrying a `lang` attribute
itself. It also matches subtags — `:lang(en)` matches `en-GB` — which is the same
behaviour as the `[lang|="en"]` attribute selector but reading inheritance rather
than the attribute.

`:dir()` matches the resolved text direction and is more reliable than
`[dir="rtl"]`, because direction inherits and can come from the `dir=auto`
algorithm rather than an explicit attribute.

## Gotchas

**Symptom:** `:not(#id)` unexpectedly beats other rules.
**Cause:** `:not()` takes the specificity of its argument — an id inside it
contributes `1,0,0`.
**Fix:** `:not(:where(#id))` to exclude without the weight.

**Symptom:** `:empty` does not match an element that looks empty.
**Cause:** whitespace between the tags is a text node. `<p> </p>` is not empty.
**Fix:** remove the whitespace, or use `:not(:has(*))` / a class set by the
code that renders it.

**Symptom:** `:not(.a, .b)` matched more than expected.
**Cause:** reading it as "or". It means "neither", equivalent to
`:not(.a):not(.b)`.
**Fix:** say it aloud as "not a **and** not b".

**Symptom:** a custom property declared on `body` is not available to an element
outside `body`.
**Cause:** custom properties inherit downward; anything above `body` never sees
it.
**Fix:** declare globals on `:root`.

**Symptom:** `:lang(en)` does not match, though the page is English.
**Cause:** no `lang` attribute anywhere — the language is unknown, not assumed.
**Fix:** put `lang` on `<html>`. It is also a genuine accessibility requirement,
since screen readers choose pronunciation from it.

## Interview questions

**★ What specificity does `:not(.foo)` have?**
`0,1,0` — the specificity of its argument. `:not()` itself contributes nothing,
but its most specific argument does, so `:not(#id)` is `1,0,0`. Wrapping the
argument in `:where()` neutralises it.

**★ Why does `:empty` so often fail to match?**
Because whitespace counts. `:empty` requires no child nodes at all, and a newline
or indentation between the opening and closing tags is a text node. Comments do
not count, but whitespace does — which makes it unreliable on
pretty-printed server-rendered HTML.

**What is the difference between `:root` and `html`?**
They match the same element in an HTML document, but `:root` has class-level
specificity (`0,1,0`) against the type selector's `0,0,1`. Convention puts global
custom properties on `:root` because it is the top of the inheritance chain.

**Does `:not(.a, .b)` mean "not a or not b"?**
No — it means "neither a nor b", equivalent to `:not(.a):not(.b)`. The "or"
reading would match essentially every element.

**When would you use `:dir(rtl)` instead of `[dir="rtl"]`?**
When the direction is inherited or resolved rather than written on the element.
`:dir()` matches the computed direction, including one set by an ancestor or by
`dir="auto"`; the attribute selector only matches an explicit attribute on that
element.

---

← [10 · Pseudo-elements](./10-pseudo-elements.md) · Next: [12 · CSS Nesting](./12-nesting.md) →
