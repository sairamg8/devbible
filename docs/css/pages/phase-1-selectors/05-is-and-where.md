---
title: ":is() and :where()"
sidebar_label: "05 · :is() and :where()"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 in **Firefox 153.0.3** via `sandbox/css/ex09-selector-families.mjs`
> and `ex08-what-devtools-shows.mjs`. Baseline: **Widely available since
> 2021-01-21** (`web-features`).

**Two pseudo-classes that match identically and differ only in specificity.**
That difference is the whole reason both exist, and it is the tool for writing
defaults that are meant to be overridden.

## They match the same things

```console
$ node ex09-selector-families.mjs
  :is(.lead, .title)             3  :is()
                                    h2.title.heading  p.lead[first]  p.lead[nested lead]
  :where(.lead, .title)          3  :where()
                                    h2.title.heading  p.lead[first]  p.lead[nested lead]
```

Same three elements. The difference is invisible until something competes.

## The specificity difference

| | Specificity contributed |
|---|---|
| `:is(a, b, c)` | that of its **most specific** argument |
| `:where(a, b, c)` | **zero**, always |

```css
:is(#app, .card) p   { color: red; }    /* 1,0,1 — the #app wins the argument list */
:where(#app, .card) p { color: blue; }  /* 0,0,1 — the id contributes nothing */
```

`:is()` taking the *maximum* is the part that surprises people: adding one id to
a list of classes raises the weight of every match, including the ones that
matched by class.

Seen in the cascade dump:

```console
$ node ex08-what-devtools-shows.mjs
  #lead              spec 1,0,0   color: green          sets: color
  :where(.note)      spec 0,0,0   color: —              sets: letter-spacing
```

`:where(.note)`'s `letter-spacing` still applied — zero specificity does not mean
no effect. It means **anything else wins**, and nothing else set
`letter-spacing`.

## What `:where()` is actually for

**Defaults you intend to be overridden.** Anything shipped as a base layer,
a library, or a `.prose` content style should weigh nothing:

```css
/* a reset that can never win a fight it shouldn't */
:where(h1, h2, h3, h4, h5, h6) { margin-block: 0; font-size: inherit; }

/* content styling that a component can always override with one class */
:where(.prose) :where(a) { text-decoration-thickness: 2px; }

/* a design-system default that a utility class beats trivially */
:where(.btn) { padding: 0.5em 1em; border-radius: 4px; }
```

Without `:where()`, a library author has to guess a specificity low enough for
consumers to override and high enough to apply. With it, the answer is zero and
the question disappears.

## What `:is()` is for

**Collapsing repetition where the weight should be real:**

```css
/* before */
.card > h1, .card > h2, .card > h3,
.panel > h1, .panel > h2, .panel > h3 { margin-block-start: 0; }

/* after */
:is(.card, .panel) > :is(h1, h2, h3) { margin-block-start: 0; }
```

Six selectors become one, and the specificity is `0,1,1` — exactly what the long
form had.

`:is()` also makes selectors possible that a plain list cannot express, because
lists cannot be nested inside a combinator chain:

```css
/* impossible without :is() — a list on both sides of a combinator */
:is(article, aside, section) :is(h2, h3) + p { margin-block-start: 0.25em; }
```

## Both forgive invalid arguments

Their argument lists are **forgiving** — an unparseable member is dropped and
the rest still work. That is the fix from
[page 04](./04-selector-lists.md), and the second reason to reach for them:

```css
/* an engine without :popover-open still applies the [data-open] half */
:is(:popover-open, [data-open]) { display: block; }
```

## The trade-off

`:is()` and `:where()` make selectors shorter and specificity intentional, at
the cost of readability — `:is(.a, .b) :where(.c, .d) > :is(e, f)` is harder to
scan than the long form, and harder to grep for. Use them where they remove real
repetition or solve a real specificity problem, not everywhere by default.

There is also a matching consideration: a very large `:is()` list still has to
be evaluated, though at realistic sizes this is not measurable
([page 15](./15-selector-performance.md)).

## Gotchas

**Symptom:** adding an id to an `:is()` list made unrelated matches start winning
cascade fights.
**Cause:** `:is()` contributes the specificity of its **most specific**
argument to every match, so one id raised the whole list to `1,0,0`.
**Fix:** split the id into its own rule, or use `:where()` if the weight should
be zero.

**Symptom:** a `:where()` rule "does nothing".
**Cause:** it has zero specificity, so literally any other declaration for that
property beats it — including a type selector.
**Fix:** that is the intent. If it must win sometimes, it is not a default;
use `:is()` or a plain selector.

**Symptom:** `:where()` styles are being overridden by the browser's own
defaults.
**Cause:** not possible — the UA origin is weaker than any author declaration,
whatever its specificity. Something else in your stylesheet is winning.
**Fix:** check Computed in DevTools for the actual source.

**Symptom:** a long `:is()` list stopped working entirely after an edit.
**Cause:** unlikely to be the list — `:is()` forgives invalid members. More
likely a syntax error in the surrounding selector.
**Fix:** check the rule is in the CSSOM at all; forgiveness applies inside the
parentheses, not outside them.

## Interview questions

**★ What is the difference between `:is()` and `:where()`?**
They match identically — measured, both matched the same three elements. They
differ only in specificity: `:is()` contributes the specificity of its most
specific argument, while `:where()` always contributes zero. That makes
`:where()` the tool for defaults meant to be overridden, and `:is()` the tool for
collapsing repetition without changing weight.

**★ Why would you deliberately want a selector with zero specificity?**
So that consumers can override it with anything at all. A reset, a library's
base styles, or `.prose`-style content rules should never win a fight against
component CSS. Wrapping them in `:where()` removes the guessing game about
"specific enough to apply, weak enough to override".

**What specificity does `:is(#app, .card)` have?**
`1,0,0` — the maximum among its arguments, applied to every match, including
elements that matched via `.card`. This surprises people and is the main hazard
of `:is()`.

**Are `:is()` and `:where()` forgiving?**
Yes. An invalid selector inside them is dropped and the remaining arguments still
match, unlike a plain comma-separated list where one invalid selector discards
the whole rule.

**Can `:is()` express selectors a plain list cannot?**
Yes — a plain list cannot be nested inside a combinator chain. `:is(article,
aside) :is(h2, h3) + p` has no single-rule equivalent without writing out every
combination.

---

← [04 · Selector lists](./04-selector-lists.md) · Next: [06 · :has()](./06-has.md) →
