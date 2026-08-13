---
title: "Attributes vs props"
sidebar_label: "04 · Attributes vs props"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against **react-dom 19.2.8** in **Firefox 153.0**. Every
> markup line is the `innerHTML` React produced, and every warning is quoted
> from a development bundle — both printed by
> `sandbox/react-p1/ex03-attributes.mjs`.

**What you write in JSX is always a *prop*. For a host element like `div`,
React then decides what that prop becomes in the DOM: a renamed attribute, a
DOM property, a passthrough, or nothing at all. Those four outcomes explain
every "why isn't my attribute there" question.**

## The four outcomes

```console
$ node ex03-attributes.mjs
=== markup React produced (production build) ===
  --- renamed by React ---
  className                     <div class="card"></div>
  htmlFor                       <label for="a"></label>
  tabIndex                      <div tabindex="-1"></div>
  readOnly                      <input readonly="">
  maxLength                     <input maxlength="4">
  crossOrigin                   <img crossorigin="anonymous" src="x.png">
  SVG strokeWidth               <svg><line stroke-width="2" stroke-linecap="round"></line></svg>
  --- passed straight through ---
  data-*                        <div data-test-id="x" data-userid="7"></div>
  aria-*                        <div aria-label="Close" aria-hidden="true"></div>
  lowercase custom              <div myattr="v"></div>
  role/id/title                 <div role="button" id="b" title="t"></div>
```

### 1. Renamed

`className` and `htmlFor` exist because `class` and `for` are reserved words in
JavaScript, and React's props object is a JavaScript object. Everything else in
that first block is camelCase→lowercase or camelCase→hyphenated: React holds a
table of the DOM's own property names, and SVG's hyphenated attributes are
derived by rule.

### 2. Passed through

`data-*` and `aria-*` go to the DOM verbatim. They are the two namespaces where
hyphens are correct in JSX, because they are hyphenated in HTML too.

Note `data-userId` became `data-userid` — **HTML attribute names are
case-insensitive and the DOM lowercases them.** React warns about it, because
`element.dataset.userId` will not find `data-userid`:

```console
  [error] React does not recognize the `data-userId` prop on a DOM element. If
          you intentionally want it to appear in the DOM as a custom attribute,
          spell it as lowercase `data-userid` instead. …
```

### 3. Dropped

```console
  --- camelCased unknowns ---
  myAttr (camel)                <div myattr="v"></div>
  onFoo (camel)                 <div></div>

  [error] React does not recognize the `myAttr` prop on a DOM element. …
  [error] Unknown event handler property `onFoo`. It will be ignored.
```

An unknown camelCase prop is lowercased and rendered — but an unknown
`on*` prop is **dropped entirely**, because React parses it as an event handler
and finds no such event.

A second dropping rule, measured on the [spread page](10-spreading-props.md):
an unknown attribute whose value is a **boolean** is dropped rather than
stringified. `isActive={true}` produced `<input name="n">` with no `isactive`
attribute at all, while `myattr="v"` survived. Strings and numbers land;
booleans do not.

### 4. What React 19 does with `class` and `for`

```console
  --- what React 19 does with class/for ---
  class (raw)                   <div class="card"></div>
  for (raw)                     <label for="a"></label>
  onclick (raw)                 <button></button>

  [error] Invalid DOM property `class`. Did you mean `className`?
  [error] Invalid DOM property `for`. Did you mean `htmlFor`?
  [error] Invalid event handler property `onclick`. Did you mean `onClick`?
```

**`class` and `for` now work.** The markup is correct; only a development
warning distinguishes them. This surprises people who learned that `class` was
forbidden — it was, until React 16 loosened unknown-attribute handling.

`onclick` is different. It is silently **dropped** — no attribute, no handler,
nothing. A lowercased event handler is a dead handler, and in production there
is no warning at all. This is the single highest-cost typo in this whole page.

## Booleans

```console
  --- booleans ---
  disabled={true}               <button disabled=""></button>
  disabled={false}              <button></button>
  disabled="false"              <button disabled=""></button>
  hidden={true}                 <div hidden=""></div>
  aria-hidden={false}           <div aria-hidden="false"></div>
  data-x={false}                <div data-x="false"></div>

  [error] Received the string `false` for the boolean attribute `disabled`. The
          browser will interpret it as a truthy value. Did you mean disabled={false}?
```

Three distinct rules in six lines:

- For a **known boolean attribute**, `true` emits the empty attribute and
  `false` removes it. That is HTML's own rule: presence is truth.
- `disabled="false"` is the **string** `"false"`, which is present, which is
  true. The button is disabled. React warns; the DOM does what HTML says.
- **`aria-*` and `data-*` are not boolean attributes.** `aria-hidden={false}`
  correctly renders `aria-hidden="false"` — ARIA needs the literal word.
  `data-x={false}` renders `data-x="false"` for the same reason.

The practical rule: `disabled={cond}` — never `disabled={cond ? 'true' :
'false'}`, and never `disabled="true"` with quotes.

## Empty values

```console
  --- empty values ---
  title={null}                  <div></div>
  title={undefined}             <div></div>
  title={0}                     <div title="0"></div>
  title={NaN}                   <div title="NaN"></div>
  width={100}                   <img width="100" src="x.png">

  [error] Received NaN for the `title` attribute. If this is expected, cast the
          value to a string.
```

`null` and `undefined` **remove** the attribute. That is how you conditionally
omit one:

```jsx
<a href={isExternal ? url : undefined} target={isExternal ? '_blank' : undefined}>
```

rather than building the props object with an `if`. Numbers are stringified;
`NaN` is stringified too, and warned about, because it is almost always a bug
upstream.

## `style` is not a string

```console
  --- style must be an object ---
  style="color:red" THROWS  The `style` prop expects a mapping from style
                            properties to values, not a string. For example,
                            style={{marginRight: spacing + 'em'}} when using JSX.
```

A hard error, not a warning — the one attribute where copy-pasting HTML fails
loudly. See [Inline style](11-inline-style.md).

## The reference table

| You write | The DOM gets | Note |
|---|---|---|
| `className` | `class` | `class` also works, with a dev warning |
| `htmlFor` | `for` | same |
| `tabIndex` | `tabindex` | camelCase → the DOM's own property name |
| `readOnly`, `maxLength`, `autoComplete`, `crossOrigin` | `readonly`, `maxlength`, `autocomplete`, `crossorigin` | same rule |
| `strokeWidth`, `strokeLinecap` (SVG) | `stroke-width`, `stroke-linecap` | SVG hyphenates |
| `data-*`, `aria-*` | verbatim, lowercased | keep them lowercase yourself |
| `onClick`, `onChange` | *no attribute* — a React listener | `onclick` is dropped silently |
| `style` | `style` | must be an object |
| `dangerouslySetInnerHTML` | element content | see [page 12](12-dangerously-set-inner-html.md) |
| `key`, `ref` | nothing | `key` is compiled out; `ref` is a real prop in React 19 |
| unknown, string value | lowercased attribute | dev warning |
| unknown, boolean value | *nothing* | dropped |
| unknown `on*` | *nothing* | dropped |

## Props on a component are just props

Everything above applies to **host elements** — lowercase tags. A prop on your
own component is an ordinary object key with no rules at all:

```jsx
<Row isActive onSelect={fn} data={row} />
// Row receives {isActive: true, onSelect: fn, data: {...}}
```

`isActive` with no value is `true` — that shorthand is JSX's, not HTML's. The
DOM only becomes involved if `Row` forwards those props onto a host element,
which is exactly where the unknown-attribute warnings usually come from. See
[Spreading props](10-spreading-props.md).

## Gotchas

**Symptom:** a click handler never fires, and there is no error.
**Cause:** `onclick` instead of `onClick`. React drops unknown `on*` props
entirely; production prints nothing.
**Fix:** camelCase every handler. A lint rule catches this in a second.

**Symptom:** `element.dataset.userId` is `undefined` though the attribute is on
the page.
**Cause:** the DOM lowercased `data-userId` to `data-userid`.
**Fix:** write `data-userid` (or `data-user-id`, which `dataset` maps back to
`userId`).

**Symptom:** a button is disabled when it should be enabled.
**Cause:** `disabled="false"` — a non-empty string, so the attribute is
present.
**Fix:** `disabled={false}`, or just `disabled={cond}`.

**Symptom:** a screen reader ignores `aria-hidden={false}`… or honours it when
it should not.
**Cause:** `aria-*` is not boolean-collapsed. `aria-hidden={false}` renders the
literal `"false"`, which is correct; `aria-hidden={undefined}` removes it.
**Fix:** use `undefined` to remove an ARIA attribute, `false` to say "false".

**Symptom:** "React does not recognize the `X` prop on a DOM element".
**Cause:** a prop meant for your component was spread onto a host element.
**Fix:** destructure it out of the rest before spreading.

**Symptom:** `style` throws on a pasted HTML snippet.
**Cause:** `style="…"` is a string.
**Fix:** convert to an object, or move it to a class.

## Interview questions

**★ Why is it `className` and not `class`?**
Because JSX props become keys in a JavaScript object and `class` is a reserved
word — as is `for`, hence `htmlFor`. Since React 16 the raw `class` and `for`
spellings also reach the DOM correctly, but React warns in development, so
`className` remains the right thing to write.

**★ What happens to an attribute set to `null` or `undefined`?**
React removes it. That is the idiomatic way to omit an attribute
conditionally — `href={isExternal ? url : undefined}` — rather than assembling
the props object with branches.

**★ How does React handle boolean attributes?**
For known booleans like `disabled`, `true` renders the attribute with an empty
value and `false` removes it. `aria-*` and `data-*` are not treated as boolean:
they render the literal string `"false"`, which is what ARIA requires.

**What does React do with an attribute it does not recognise?**
If the value is a string or number it is lowercased and rendered, with a
development warning. If the value is a boolean it is dropped. If the name looks
like an event handler (`on*`) it is dropped as an unknown event.

**Why does a lowercase `onclick` silently do nothing?**
React binds events by its own camelCase names; `onclick` matches no known
event, so it is discarded as an unknown handler rather than set as an HTML
attribute. Development warns, production does not.

**What is the difference between an attribute and a prop here?**
A prop is what you pass in JSX — always a plain object key. An attribute is
what ends up in the DOM. For host elements React maps one to the other; for
your own components there is no mapping at all, and nothing reaches the DOM
unless you forward it.

---

← Prev: [What can be rendered](03-what-can-be-rendered.md) · Index: [Phase 1](README.md) · Next → [Capitalization](05-capitalization.md)
