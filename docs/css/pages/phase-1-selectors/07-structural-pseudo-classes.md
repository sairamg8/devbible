---
title: "Structural pseudo-classes"
sidebar_label: "07 · Structural pseudo-classes"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 in **Firefox 153.0.3** via `sandbox/css/ex09-selector-families.mjs`.

**Selecting by position among siblings.** The whole family reduces to one
formula and one distinction — and the distinction is where nearly every bug
lives.

## `:nth-child(An+B)`

`n` counts from 0 upward; the selector matches every element whose 1-based index
among its siblings satisfies the formula.

```console
$ node ex09-selector-families.mjs        # a <ul> with five <li>
  li:first-child                 1  first-child        li[1]
  li:last-child                  1  last-child         li[5]
  li:nth-child(2n)               2  nth-child even     li[2]  li[4]
  li:nth-child(2n+1)             3  nth-child odd      li[1]  li[3]  li[5]
  li:nth-child(-n+2)             2  first two          li[1]  li[2]
```

| Formula | Matches |
|---|---|
| `2n` / `even` | 2nd, 4th, 6th … |
| `2n+1` / `odd` | 1st, 3rd, 5th … |
| `3` | exactly the 3rd |
| `-n+3` | the **first three** |
| `n+4` | the 4th **onward** |
| `3n+2` | 2nd, 5th, 8th … |

`-n+3` reads badly and is worth memorising as an idiom: as `n` goes 0, 1, 2, 3…
the result is 3, 2, 1, 0 — so it selects indices 3, 2 and 1.

## The distinction that causes the bugs

**`:nth-child` counts every sibling and then checks the type.
`:nth-of-type` counts only siblings of that type.**

```html
<h2 class="title">Heading</h2>
<p class="lead">first</p>
<p>second</p>
```

```console
=== The two that people get wrong ===
  p:nth-child(2)   → ["first"]
  p:nth-of-type(2) → ["second"]
```

`p:nth-child(2)` matched **"first"** — because that paragraph is the second
*child*, and it happens to be a `p`. `p:nth-of-type(2)` matched **"second"** —
the second *paragraph*.

Read `p:nth-child(2)` as "the second child, if it is a `p`". If the second child
were an `h3`, `p:nth-child(2)` would match nothing at all.

## `of S` — counting a filtered set

Modern `:nth-child` takes an `of S` clause, which changes *what is counted*:

```css
.tag:nth-child(2 of .tag) { }   /* the 2nd element that is a .tag */
li:nth-child(odd of :not(.hidden)) { }  /* zebra striping that ignores hidden rows */
```

```console
  .tag:nth-child(2 of .tag)      1  nth-child of S     span.tag[b]
```

**The second example is the reason this exists.** Zebra striping with plain
`:nth-child(odd)` breaks the moment a row is filtered out, because the hidden
rows still count. `of :not(.hidden)` counts only the visible ones, so the
striping stays correct.

## The rest of the family

```css
:first-child     /* no preceding siblings                  */
:last-child      /* no following siblings                   */
:only-child      /* both                                    */
:first-of-type   /* first sibling of its element type       */
:last-of-type
:only-of-type
:nth-last-child(n)   /* counts from the end                 */
:nth-last-of-type(n)
```

`:nth-last-child` is the tool for "the last three" — `:nth-last-child(-n+3)` —
and for the quantity-query trick:

```css
/* apply only when there are exactly 3 children */
li:first-child:nth-last-child(3),
li:first-child:nth-last-child(3) ~ li { flex: 1 1 33%; }
```

That reads as "a first child that is also the third from the end" — which can
only be true when there are exactly three. Grid's `auto-fit`
(**Phase 6**) has made this much less necessary.

## They select by position, not by appearance

`:nth-child` counts DOM order. It does not know about `order` in flexbox, about
grid placement, or about which elements are `display: none`. An element hidden
with `display: none` **still counts** — which is exactly the problem `of S`
solves.

## Gotchas

**Symptom:** `p:nth-child(2)` selects the wrong paragraph, or nothing.
**Cause:** it counts all siblings, not just paragraphs. Measured,
`p:nth-child(2)` matched "first" while `p:nth-of-type(2)` matched "second".
**Fix:** use `:nth-of-type` when you mean "the second paragraph".

**Symptom:** zebra striping goes wrong after filtering rows.
**Cause:** hidden rows still count towards `:nth-child(odd)`.
**Fix:** `:nth-child(odd of :not([hidden]))`.

**Symptom:** `:first-child` does not match the element you think is first.
**Cause:** something precedes it — often a whitespace-insensitive assumption, a
comment node is fine, but any *element* counts.
**Fix:** inspect the parent's children in DevTools; `:first-of-type` may be what
you meant.

**Symptom:** striping is wrong when flexbox `order` is used.
**Cause:** structural pseudo-classes read DOM order and know nothing about
visual reordering.
**Fix:** reorder in the DOM, or accept that visual and structural order differ —
which is also an accessibility signal that the DOM order is wrong.

## Interview questions

**★ What is the difference between `:nth-child(2)` and `:nth-of-type(2)`?**
`:nth-child` counts **all** siblings and then checks whether the match is the
right type; `:nth-of-type` counts only siblings of that type. Measured on
`<h2><p>first</p><p>second</p>`, `p:nth-child(2)` matched "first" and
`p:nth-of-type(2)` matched "second". If the second child were not a `p`,
`p:nth-child(2)` would match nothing.

**★ How do you stripe a table where some rows are hidden?**
`:nth-child(odd of :not([hidden]))`. Plain `:nth-child(odd)` counts hidden rows,
so the striping breaks as soon as anything is filtered. The `of S` clause changes
what is counted, not just what is matched.

**What does `:nth-child(-n+3)` select?**
The first three. As `n` runs 0, 1, 2, 3…, the expression gives 3, 2, 1, 0 — so
it matches indices 3, 2 and 1 and nothing beyond.

**How do you select the last three children?**
`:nth-last-child(-n+3)`, which applies the same formula counting from the end.

**Do structural pseudo-classes respect `display: none` or flexbox `order`?**
No. They count DOM position only. A hidden element still counts, and visual
reordering has no effect on them — which is why `of S` exists and why relying on
`order` for meaningful sequence is an accessibility problem.

---

← [06 · :has()](./06-has.md) · Next: [08 · State pseudo-classes](./08-state-pseudo-classes.md) →
