---
title: "Resets and normalisers"
sidebar_label: "07 · Resets and normalisers"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 in **Firefox 153.0.3** via `sandbox/css/ex04-ua-styles-and-resets.mjs`.

**A reset is the first thing in your stylesheet, and every line in it should be
one you can justify.** The old advice — drop in a 300-line library — is worse
than a dozen lines you understand.

## The reset, and exactly what each line buys

```css
/* 1 — predictable sizing, everywhere, inherited into components */
*, *::before, *::after { box-sizing: border-box; }

/* 2 — remove all default margin; add it back deliberately */
* { margin: 0; }

/* 3 — a sane line-height that the whole page inherits */
body { line-height: 1.5; -webkit-font-smoothing: antialiased; }

/* 4 — media behaves like a block, never overflows its container */
img, picture, video, canvas, svg { display: block; max-width: 100%; }

/* 5 — form controls join the page's typography */
input, button, textarea, select { font: inherit; }

/* 6 — long words break instead of blowing out the layout */
p, h1, h2, h3, h4, h5, h6 { overflow-wrap: break-word; }
```

Measured against the same page with no reset at all:

```console
$ node ex04-ua-styles-and-resets.mjs
=== What the reset actually changed ===
  body      {"margin":"8px","lineHeight":"normal",...}
              →  {"margin":"0px","lineHeight":"24px",...}
  h1        {"fontSize":"32px","marginBlockStart":"21.44px",...}
              →  {"fontSize":"32px","marginBlockStart":"0px",...}
  h2        {"marginBlockStart":"19.92px"}   →  {"marginBlockStart":"0px"}
  p         {"marginBlockStart":"16px","marginBlockEnd":"16px"}
              →  {"marginBlockStart":"0px","marginBlockEnd":"0px"}
  ul        {"paddingInlineStart":"40px","marginBlockStart":"16px",...}
              →  {"paddingInlineStart":"40px","marginBlockStart":"0px",...}
  button    {"fontFamily":"sans-serif","fontSize":"13.3333px",...}
              →  {"fontFamily":"serif","fontSize":"16px",...}
  input     {"fontFamily":"sans-serif","fontSize":"13.3333px",...}
              →  {"fontFamily":"serif","fontSize":"16px",...}
  img       {"display":"inline","maxWidth":"none"}
              →  {"display":"block","maxWidth":"100%"}
  box-sizing  content-box  →  border-box
```

Two things in that diff are worth pausing on.

**`button` went from 13.3333px sans-serif to 16px serif.** `font: inherit` made
the control inherit from `body`, and `body` in this test had no `font-family`,
so it inherited the UA's `serif`. The reset did its job — it connected the
control to the page's typography. It is your job to then *set* that typography.

**`ul`'s `padding-inline-start` is still 40px.** `* { margin: 0 }` does not
touch padding, and the list indent is padding. If you want it gone you must say
so, which is deliberate: most lists should keep their markers and indent.

## Reset vs normalise vs nothing

| Approach | What it does | Cost |
|---|---|---|
| **Hard reset** (`* { margin: 0; padding: 0 }`, unstyle everything) | flattens every default | you re-declare things the browser had right, and can strip semantics people rely on |
| **Normalise** (normalize.css) | levels *differences between browsers*, keeps sensible defaults | large, mostly patching browsers you no longer support |
| **Modern small reset** (above) | fixes the specific defaults that fight modern layout | you must know why each line is there |
| **Nothing** | UA defaults everywhere | `content-box`, 8px body margin and inline images fight everything you write |

The modern small reset is the default recommendation in 2026. Normalize.css was
solving 2012's problem — the engines have converged, and most of what it patches
no longer differs.

## Lines people add that you should think twice about

```css
/* removes list semantics in some screen-reader/browser pairings */
ul, ol { list-style: none; }

/* strips the focus ring — an accessibility bug unless replaced */
*:focus { outline: none; }

/* forces a scrollbar always; fine, but it is a design decision, not a reset */
html { overflow-y: scroll; }
```

The second one is not a trade-off, it is a defect. If you dislike the default
focus ring, **replace** it — `:focus-visible { outline: 2px solid; outline-offset:
2px; }` — never remove it (**Phase 12**).

## Where the reset goes

At the very top, and — once you have cascade layers — in the lowest layer, so
nothing in it can ever out-specify your components:

```css
@layer reset, base, components, utilities;

@layer reset {
  *, *::before, *::after { box-sizing: border-box; }
  * { margin: 0; }
  /* … */
}
```

That is a Phase 13 concern, but the placement decision is made here: a reset
that can accidentally beat a component rule is a reset that will.

## Gotchas

**Symptom:** after adding a reset, all vertical spacing between paragraphs and
headings is gone and the page looks like a wall of text.
**Cause:** `* { margin: 0 }` did exactly what it says.
**Fix:** that is the intent — add spacing deliberately, ideally with a flow
utility such as `.flow > * + * { margin-block-start: 1em; }` rather than
per-element margins.

**Symptom:** buttons still do not match the page font after adding
`font: inherit`.
**Cause:** they now inherit from an ancestor that has no font set, so they
inherit the UA default — measured, `serif`.
**Fix:** set the font on `body` (or `:root`). `font: inherit` connects the
control; it does not choose the font.

**Symptom:** `* { margin: 0 }` did not remove list indentation.
**Cause:** the indent is `padding-inline-start: 40px` on `ul`, not margin.
**Fix:** set the padding explicitly on lists you want unindented.

**Symptom:** the reset is overriding a component's styles.
**Cause:** it is later in the file than the component, or more specific.
**Fix:** put it first, and in the lowest cascade layer.

## Interview questions

**★ What does `box-sizing: border-box` change, and why is it applied with the
universal selector plus pseudo-elements?**
It makes `width` and `height` include padding and border instead of only the
content box, so a 200px-wide element stays 200px when you add padding. It is
applied to `*, *::before, *::after` so no element — including generated content
— is left on `content-box`, which would make its sizing behave differently from
everything around it.

**★ Reset or normalise — which, and why?**
A small modern reset. Normalize.css exists to level *differences between
browsers*, and the engines have largely converged, so most of it patches
problems that no longer occur. A dozen lines you can justify — border-box,
zeroed margins, block media, `font: inherit` on controls — solves the actual
friction without shipping rules you have never read.

**Why does every reset contain `font: inherit` for form controls?**
Because the UA stylesheet sets an explicit font on them — measured, 13.3333px
sans-serif — and an explicit declaration beats inheritance, so they never pick
up the page's typography on their own.

**Why is `img { display: block }` in the reset?**
Images are `display: inline` by default, so they sit on a text baseline and
leave descender space beneath them, which looks like an unexplained few pixels
of gap. `display: block` removes it. `max-width: 100%` beside it stops an image
overflowing its container.

**What is wrong with `*:focus { outline: none }` in a reset?**
It removes the only visible indication of keyboard focus, which makes the site
unusable without a mouse. If the default ring is unwanted, replace it with a
`:focus-visible` style — never delete it.

**Where should the reset sit once you use cascade layers?**
In the first, lowest-priority layer. Layer order beats specificity, so a reset
in the bottom layer can never accidentally override a component rule no matter
how its selectors are written.

---

← [06 · User-agent stylesheets](./06-user-agent-stylesheets.md) · Next: [08 · The at-rule map](./08-the-at-rule-map.md) →
