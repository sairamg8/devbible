---
title: "Selector lists, forgiving and not"
sidebar_label: "04 · Selector lists"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 in **Firefox 153.0.3** via `sandbox/css/ex02-error-recovery.mjs`.

**A comma in a selector is not a safe separator.** One invalid selector in a
plain list destroys the entire rule — every other selector in it included. This
is the most under-known failure mode in CSS, and it has a one-character fix.

## The failure

```css
/* one bad selector, and .c loses its styling too */
.c, ::nonsense { color: green; }

/* the same list inside :is() — the bad member is dropped, .d survives */
:is(.d, ::nonsense) { color: green; }
```

```console
$ node ex02-error-recovery.mjs
=== An invalid SELECTOR discards the whole rule ===
  selectors that survived parsing        [".a",".b",":is(.d, ::nonsense)",".e"]
  .c color (rule was discarded)          rgb(0, 0, 0)
  .d color (:is() forgave the bad half)  rgb(0, 128, 0)
  green is                               rgb(0, 128, 0)
```

**`.c` is black.** The rule containing it is not in the CSSOM at all — it does
not appear in the surviving selector list. `.d` is green, because `:is()`
dropped only the invalid member.

And, as always, nothing was reported. No console message, no warning.

## Why this is a production problem, not a curiosity

The dangerous version is not a typo — it is a *new* selector added to an old
list:

```css
/* worked for two years */
.btn, .link, .tab, .chip, .pill, .badge { font: inherit; cursor: pointer; }

/* someone adds a selector an older engine does not know */
.btn, .link, .tab, .chip, .pill, .badge, :popover-open { font: inherit; cursor: pointer; }
/* in an engine without :popover-open, ALL SIX lose their styling */
```

The engine that supports the new selector is the one you tested in. The engines
that do not are where six unrelated components silently break.

## The fix

**Wrap anything uncertain in `:is()`** — its argument list is *forgiving*:

```css
.btn, .link, .tab, .chip, .pill, .badge { font: inherit; cursor: pointer; }
:is(:popover-open, [data-open]) { /* the risky one, alone */ }
```

Or, if grouping is the point, put the whole list in `:is()` — but note that
changes specificity ([page 05](./05-is-and-where.md)), so `:where()` is often the
better choice for a list of equal-weight selectors.

The general rule: **an uncertain selector gets its own rule.** Then the blast
radius of it failing is exactly itself.

## The other list: `@supports selector()`

When you need the fallback branch, test explicitly rather than relying on
forgiveness:

```css
.row { background: var(--surface); }

@supports selector(:has(*)) {
  .row:has(input:checked) { background: var(--accent-soft); }
}
```

## What a list is and is not

A selector list is **not** a combinator — it is `OR`. These are different rules:

```css
h1, h2 { margin: 0 }      /* every h1, and every h2 */
h1 h2  { margin: 0 }      /* an h2 inside an h1 */
```

And a list does not affect specificity in a plain rule: each selector in the
list is evaluated with its own specificity, independently. `#a, p { }` is
`1,0,0` for `#a` and `0,0,1` for `p` — not one shared value. This is the
opposite of `:is()`, which takes the specificity of its most specific argument
for *all* of them.

## Gotchas

**Symptom:** several unrelated components lost their styling at once, after one
commit.
**Cause:** a new selector was added to a shared comma-separated list, and it is
invalid in some engine — taking the whole rule with it.
**Fix:** give risky selectors their own rule, or wrap them in `:is()`. Check
what changed in the list rather than in the components.

**Symptom:** a rule works in one browser and does nothing in another, with no
error anywhere.
**Cause:** the same thing — an unforgiving list containing a selector the second
engine does not parse.
**Fix:** `:is()` for forgiveness, `@supports selector()` when you need a genuine
fallback.

**Symptom:** `h1, h2 { }` styled something unexpected.
**Cause:** you meant a descendant relationship and wrote a list, or vice versa.
**Fix:** a comma is `OR`; a space is "inside".

**Symptom:** wrapping a list in `:is()` changed which rules win.
**Cause:** `:is()` takes the specificity of its most specific argument and
applies it to every match.
**Fix:** use `:where()` (specificity zero) when the members should stay
low-weight, or keep the plain list when the members' individual weights matter.

## Interview questions

**★ What happens if one selector in a comma-separated list is invalid?**
The entire rule is discarded — every selector in the list loses its styling, not
just the invalid one. Measured, `.c, ::nonsense { color: green }` left `.c`
unstyled and the rule absent from the CSSOM, with no console output.
`:is(.d, ::nonsense)` kept `.d` styled, because `:is()`'s argument list is
forgiving.

**★ How do you safely add a new or experimental selector to an existing shared
rule?**
Do not add it to the list. Give it its own rule, or wrap it in `:is()`, so that
an engine which cannot parse it drops only that selector rather than the entire
shared rule. This is a real regression pattern: the engine you test in is the one
that supports the new selector.

**Does a selector list share one specificity?**
No. In a plain list each selector keeps its own specificity and is matched
independently. Inside `:is()` they do share one — the highest among the
arguments — which is a meaningful behavioural difference.

**Which pseudo-classes have forgiving argument lists?**
`:is()` and `:where()`. `:not()` and `:has()` are unforgiving in their original
definitions, so an invalid selector inside them invalidates the whole thing.

**How would you use a selector only if the browser supports it?**
`@supports selector(...)` around the rule, with the base styling outside it. The
`selector()` wrapper is required — a bare selector inside `@supports` is parsed
as a declaration test and is always false.

---

← [03 · Attribute selectors](./03-attribute-selectors.md) · Next: [05 · :is() and :where()](./05-is-and-where.md) →
