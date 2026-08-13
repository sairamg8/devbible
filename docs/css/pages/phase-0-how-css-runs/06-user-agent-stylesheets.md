---
title: "User-agent stylesheets"
sidebar_label: "06 · User-agent stylesheets"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 in **Firefox 153.0.3** via `sandbox/css/ex04-ua-styles-and-resets.mjs`.

**A page with no CSS is not unstyled.** Every browser ships a stylesheet, and
every default you have ever fought — the margin around the body, the bullets on
a list, the tiny font in a `<button>` — comes from it.

## The actual defaults

Measured on a page containing no CSS whatsoever:

```console
$ node ex04-ua-styles-and-resets.mjs
=== The user-agent stylesheet — a page with no CSS at all ===
  html font-size            16px
  body                      {"margin":"8px","lineHeight":"normal","fontFamily":"serif"}
  h1                        {"fontSize":"32px","marginBlockStart":"21.44px","fontWeight":"700"}
  h2                        {"fontSize":"24px","marginBlockStart":"19.92px"}
  p                         {"marginBlockStart":"16px","marginBlockEnd":"16px"}
  ul                        {"paddingInlineStart":"40px","marginBlockStart":"16px",
                             "listStyleType":"disc"}
  button                    {"fontFamily":"sans-serif","fontSize":"13.3333px",
                             "padding":"1px 4px","borderWidth":"2px","cursor":"default"}
  input                     {"fontFamily":"sans-serif","fontSize":"13.3333px",
                             "borderWidth":"2px"}
  a                         {"color":"rgb(0, 0, 238)","textDecorationLine":"underline"}
  em                        {"fontStyle":"italic"}
  strong                    {"fontWeight":"700"}
  td                        {"padding":"1px"}
  img                       {"display":"inline","maxWidth":"none"}
  box-sizing (any element)  {"boxSizing":"content-box"}
```

Several of these explain things you have already run into:

- **`body { margin: 8px }`** — the reason a full-bleed background has a white
  border around it before you touch anything.
- **`button { font-size: 13.3333px; font-family: sans-serif }`** — form
  controls do **not** inherit typography. This is why every reset contains
  `input, button, textarea, select { font: inherit; }`.
- **`ul { padding-inline-start: 40px }`** — it is padding, not margin, which is
  why setting `margin: 0` on a list does not remove the indent.
- **`img { display: inline }`** — inline elements sit on a text baseline, which
  is the origin of the mysterious few pixels of space under an image.
- **`box-sizing: content-box`** — the default that every modern stylesheet
  immediately overrides (**Phase 4**).
- **`h1 { margin-block-start: 21.44px }`** — a fractional number, because it is
  `0.67em` of a 32px font. UA defaults are relative, so they scale with the font
  size.

## Where they sit in the cascade

The UA stylesheet is its own **origin**, and it is the weakest one:

```
user-agent  <  user  <  author        (normal declarations)
```

So any rule you write beats any UA default, at any specificity — you never need
to "win" against the browser. `p { margin: 0 }` beats the UA's `p { margin-block:
1em }` even though both are a single type selector.

The order **inverts for `!important`**, so a user's `!important` accessibility
override beats your `!important`. That is deliberate and covered in
**Phase 2**.

## Inspect them, do not guess them

Every default above came from a measurement, and you can get the same answer in
two ways:

```js
// from the console, on any page
getComputedStyle(document.querySelector('button')).fontSize;   // "13.3333px"
```

In DevTools, tick **Show browser styles** (Firefox) / **Show user agent
styles** (Chrome) in the Styles pane, and the UA rules appear alongside yours.
Firefox's UA sheets are also readable at `resource://gre/res/html.css`.

The habit worth forming: when something has a value you did not set, look it up
rather than adding a rule to cancel a value you have guessed at.

## They differ between browsers — but less than you think

The big ones (`display` roles, heading sizes, list indentation, `body` margin)
are effectively identical across engines because the HTML specification suggests
them. The differences that actually bite are concentrated in:

- **form controls** — sizing, padding, borders, and what is styleable at all
- **focus rings** — thickness, colour, offset
- **scrollbars** — width and whether they occupy layout space
- **`<table>`** — border spacing and collapsing defaults

Which is exactly the list a reset does *not* fully solve, and why form controls
get their own topic in **Phase 12**.

:::note One engine
These numbers are Firefox 153.0.3. Chromium and WebKit are not installed on this
machine, so cross-engine comparison is not measurable here — the differences
above are structural claims about *which categories* differ, not measured
values for other browsers.
:::

## Gotchas

**Symptom:** a white gap around the page that no element seems to own.
**Cause:** `body { margin: 8px }` from the UA stylesheet.
**Fix:** `body { margin: 0 }` — normally via a reset
([page 07](./07-resets-and-normalisers.md)).

**Symptom:** your carefully chosen font applies everywhere except buttons and
inputs.
**Cause:** form controls have their own UA font — 13.3333px sans-serif — and
typography does not inherit into them.
**Fix:** `input, button, textarea, select { font: inherit; }`.

**Symptom:** `ul { margin: 0 }` does not remove the list indentation.
**Cause:** the indent is `padding-inline-start: 40px`, not margin.
**Fix:** set `padding-inline-start: 0`, or `list-style: none` plus padding
if you are removing the markers too.

**Symptom:** a few pixels of space under an image inside a container.
**Cause:** `img` is `display: inline`, so it sits on the text baseline and the
descender space below it is part of the line box.
**Fix:** `img { display: block }` — in every modern reset for this reason —
or `vertical-align: middle`.

## Interview questions

**★ Where do default styles come from, and how do you override them?**
From the browser's user-agent stylesheet, which is its own cascade origin and
the weakest one. Any normal author declaration beats any normal UA declaration
regardless of specificity, so overriding never requires escalation — a plain
type selector is enough.

**★ Why do buttons not inherit the page font?**
Because the UA stylesheet sets a font on form controls explicitly — measured,
13.3333px sans-serif in Firefox 153 — and an explicit declaration beats
inheritance. Inheritance only supplies a value when nothing sets one. The fix is
`font: inherit`.

**Is a page with no CSS unstyled?**
No. It is styled by the UA stylesheet: block and inline display roles, heading
sizes and weights, list markers and indentation, link colour and underline, form
control appearance, table spacing.

**Why is `h1`'s default top margin a fractional pixel value like 21.44px?**
Because it is specified in `em` — `0.67em` of a 32px font size. UA defaults are
mostly relative, so they scale with the font.

**How does `!important` interact with the UA origin?**
It inverts the order. Normally author beats user beats user-agent; for
`!important` declarations the order reverses, so a user stylesheet's `!important`
rule beats an author's `!important` rule. This exists so accessibility overrides
cannot be defeated by a site.

---

← [05 · CSS fails silently](./05-css-fails-silently.md) · Next: [07 · Resets and normalisers](./07-resets-and-normalisers.md) →
