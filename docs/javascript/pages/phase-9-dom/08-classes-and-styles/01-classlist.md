---
title: "01 · classList and the class-first rule"
sidebar_label: "01 · classList and the class-first rule"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`Element.classList`](https://developer.mozilla.org/en-US/docs/Web/API/Element/classList), [`DOMTokenList`](https://developer.mozilla.org/en-US/docs/Web/API/DOMTokenList), [`DOMTokenList.toggle()`](https://developer.mozilla.org/en-US/docs/Web/API/DOMTokenList/toggle), [`DOMTokenList.replace()`](https://developer.mozilla.org/en-US/docs/Web/API/DOMTokenList/replace), [`Element.className`](https://developer.mozilla.org/en-US/docs/Web/API/Element/className), [`HTMLElement.dataset`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dataset). Documentation-validated; **no timings**.

`classList` is a **live `DOMTokenList`** — a view of the `class` attribute, parsed into tokens.
Every method mutates the attribute, and reading it always reflects the attribute as it is now.

## The whole API, and what each one is for

```js
el.classList.add('is-open');                 // one or many: add('a', 'b', 'c')
el.classList.remove('is-open', 'is-busy');   // missing tokens are ignored, no throw
el.classList.toggle('is-open');              // flips; returns the new boolean state
el.classList.contains('is-open');            // boolean
el.classList.replace('theme-dark', 'theme-light');  // returns true if it replaced
el.classList.length;                         // token count
[...el.classList];                           // a real array of the tokens
```

Two of these are worth more than the rest.

### `toggle` takes a second argument, and it is the one you want

```js
el.classList.toggle('is-open', isOpen);
```

With a second argument, `toggle` **forces** the token on (`true`) or off (`false`) rather than
flipping it. That is not a small convenience — it makes the DOM a *function of your state*
instead of a running tally of how many times something was clicked.

🔴 **The bug the one-argument form causes is drift.** A plain `toggle('is-open')` on every click
means the class and the variable can disagree the moment anything else opens or closes the panel
— a keyboard handler, a route change, a "close all" button. The forced form cannot drift, because
it re-derives the class from the state every time it runs.

```js
// ⚠️ flips, whatever the truth is
button.addEventListener('click', () => panel.classList.toggle('is-open'));

// ✅ state is the source of truth; the DOM follows it
let isOpen = false;
button.addEventListener('click', () => {
  isOpen = !isOpen;
  panel.classList.toggle('is-open', isOpen);
  button.setAttribute('aria-expanded', String(isOpen));
});
```

⚠️ The second argument is **not** a truthiness shortcut you should feed anything to. Pass a real
boolean — `Boolean(x)` or `!!x` — because the argument is converted, and passing `undefined`
(from a missing property) makes it behave as the one-argument flip.

### `replace` returns whether it did anything

`el.classList.replace(old, new)` returns `true` only if `old` was present. That return value is
the cheap way to write "swap the theme class, and tell me whether this element had one" without a
separate `contains` call.

## `className` is a string, and on SVG it is not even that

`className` sets the whole attribute at once, which means it **destroys every class already
there** — including ones another part of the app, or a framework, put on:

```js
el.className = 'is-open';        // ⚠️ every other class on the element is now gone
el.className += ' is-open';      // ⚠️ "works", and breaks the day the attribute is empty
```

The `+=` form is the real trap: with no existing class it produces `" is-open"` with a leading
space, which happens to parse, so it survives review — and it will happily add the same class
twice.

🔴 **On SVG elements, `className` is not a string at all.** MDN documents it as returning an
`SVGAnimatedString`, so `svg.className.includes('x')` throws or silently misbehaves, and
`svg.className = 'x'` does not do what you expect. **`classList` works on SVG elements**, which is
one more reason it is the only one of the two worth using.

## What throws

Two documented errors, and both come from constructing token names dynamically:

- An **empty string** token throws a `SyntaxError`.
- A token containing **whitespace** throws an `InvalidCharacterError`.

```js
el.classList.add(`theme-${theme}`);   // ⚠️ blows up when theme is '' or 'dark mode'
```

If a class name is built from data, validate it or normalise it first. This is the same class of
bug as the selector built from a variable in [07 · Traversal](../07-traversal/README.md).

## Classes, or a `data-*` attribute?

Both put state on the element, and both are stylable — `[data-state="open"]` is as valid a CSS
selector as `.is-open`. The useful split:

| Use | When |
|---|---|
| **a class** | A boolean the design cares about — `is-open`, `is-busy`, `has-error`. Multiple can be on at once |
| **a `data-*` attribute** | A value from a **fixed set of mutually exclusive states** — `data-state="idle | loading | error"` |

The attribute version is better exactly when the states are exclusive, because it is impossible
to be in two of them at once. With classes you have to remember to remove `is-loading` when you
add `is-error`, and one day you will not.

```js
el.dataset.state = 'loading';    // one assignment replaces the previous state
```

`dataset` is covered properly in
[05 · Attributes versus properties](../05-attributes-vs-properties/README.md); the point here is
only that it is the alternative to a fourth and fifth boolean class.

⚠️ **Neither replaces ARIA.** `aria-expanded`, `aria-selected` and `aria-disabled` are state *for
assistive technology* and must be set alongside the class — a screen reader cannot see
`.is-open`. They are also stylable (`[aria-expanded="true"]`), which sometimes lets one attribute
do both jobs.

## Gotchas

**Symptom:** A panel's class and its state variable disagree after a while
**Cause:** One-argument `toggle` flips rather than setting, so any other code path desynchronises it.
**Fix:** `toggle(name, Boolean(state))` — re-derive from state every time.

**Symptom:** `toggle(name, someValue)` flipped instead of forcing
**Cause:** The second argument was `undefined` (a missing property), which is the same as omitting it.
**Fix:** Pass a real boolean.

**Symptom:** Setting a class removed all the others
**Cause:** `className` replaces the whole attribute.
**Fix:** `classList.add`.

**Symptom:** The same class appears twice in the attribute
**Cause:** `className += ' x'` with no de-duplication.
**Fix:** `classList.add` — a `DOMTokenList` is a set of tokens.

**Symptom:** `className` misbehaves on an `<svg>` or `<path>`
**Cause:** On SVG elements it is an `SVGAnimatedString`, not a string.
**Fix:** `classList`, which works on both.

**Symptom:** `classList.add` threw `InvalidCharacterError`
**Cause:** The token was built from data and contained a space (or was empty → `SyntaxError`).
**Fix:** Normalise or validate the value before using it as a class name.

**Symptom:** An old state class stayed on after a new one was added
**Cause:** Mutually exclusive states modelled as independent booleans.
**Fix:** One `data-state` attribute, so setting a new value clears the old one.

**Symptom:** A screen reader announces a collapsed panel as expanded
**Cause:** Only the class was updated; `aria-expanded` was not.
**Fix:** Set the ARIA state in the same place you set the class.

## Interview questions

**★ Why `classList` over `className`?**
`className` is the whole attribute as one string, so setting it wipes every other class and
appending duplicates tokens. `classList` is a live `DOMTokenList` with set semantics — and on SVG
elements `className` is an `SVGAnimatedString`, not a string, so `classList` is the only one that
works everywhere.

**★ What does `toggle`'s second argument do?**
Forces the class on or off instead of flipping it. It is what makes the DOM a function of your
state, so the class cannot drift out of sync when some other code path also opens or closes the
thing.

**★ When would you use a `data-*` attribute instead of a class?**
When the states are **mutually exclusive** — `data-state="idle | loading | error"`. One
assignment replaces the previous state, so you cannot end up in two states at once, which is the
failure mode of modelling them as separate booleans.

**★ Why not just set `style` from JavaScript?**
An inline style beats every stylesheet rule short of `!important`, so the look ends up split
across two files and stops responding to media queries, themes and
`prefers-reduced-motion`. Classes keep the look in CSS; JavaScript only says which state applies.

**Does `classList.remove` throw if the class is not there?**
No — missing tokens are ignored. It throws only on an empty-string token (`SyntaxError`) or one
containing whitespace (`InvalidCharacterError`).

**Is `classList` live?**
Yes — it is a view of the `class` attribute, so reading it always reflects the current attribute,
and mutating it rewrites the attribute.

---

[Topic index](./README.md) · Next → [02 · Inline styles, custom properties and computed values](./02-styles-and-custom-properties.md)
