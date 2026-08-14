---
title: "Stage two — growing and shrinking"
sidebar_label: "02 · Grow and shrink"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against the **W3C CSS Flexible Box Layout Level 1**
> specification ([§9.7 Resolving flexible lengths](https://www.w3.org/TR/css-flexbox-1/#resolve-flexible-lengths))
> and **MDN — [Controlling ratios of flex items](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout/Controlling_ratios_of_flex_items_along_the_main_axis)**.

**Growing and shrinking do not work the same way, and the difference is the
whole point of this page.** Growth is distributed by the raw `flex-grow` factor.
Shrinkage is distributed by `flex-shrink` **multiplied by the flex base size** —
so bigger items give up more. Expecting shrink to behave like grow is the second
most common flexbox mistake, after the automatic minimum size.

## Growing: proportional to the factor alone

When free space is positive, each item receives a share proportional to its
`flex-grow` factor:

```
item's share = free space × (its flex-grow ÷ sum of all flex-grow)
```

600px container, three items with `flex-basis: 100px`, so 300px free:

```css
.a { flex: 1 1 100px; }
.b { flex: 2 1 100px; }
.c { flex: 3 1 100px; }
```

Sum of grow factors is 6, so one unit is 50px:

| Item | Grow factor | Share of 300px | Final size |
|---|---|---|---|
| `.a` | 1 | 50px | **150px** |
| `.b` | 2 | 100px | **200px** |
| `.c` | 3 | 150px | **250px** |

Note what this is *not*: `.c` is not three times `.a`. It received three times as
much of the **surplus**, on top of an equal 100px base. Final sizes are in the
ratio 3:4:5, not 1:2:3.

**Getting a true 1:2:3 requires a zero basis**, so that the whole container is
surplus:

```css
.a { flex: 1 1 0; }  .b { flex: 2 1 0; }  .c { flex: 3 1 0; }
/* 100 / 200 / 300 — a real 1:2:3 */
```

This is the same lesson as `flex: 1` versus `flex: auto` from
[01 · Base sizes](./01-base-sizes.md), and it is worth stating as a rule:
**`flex-grow` ratios describe the surplus, not the result — unless the basis is
zero, in which case they describe both.**

### Grow factors below 1

A sum of grow factors **less than 1** distributes only that fraction of the free
space, leaving the rest unclaimed:

```css
.a { flex-grow: 0.25; }   /* takes 25% of the free space */
.b { flex-grow: 0.25; }   /* takes 25% */
                          /* 50% of the free space stays empty */
```

Once the sum reaches 1 or more, all free space is distributed and the factors act
purely as ratios.

## Shrinking: weighted by the base size

When free space is negative, the specification does **not** use `flex-shrink`
directly. It uses the **scaled flex shrink factor**:

```
scaled flex shrink factor = flex-shrink × flex base size
```

and each item absorbs a share of the deficit proportional to *that*:

```
item's reduction = deficit × (its scaled factor ÷ sum of all scaled factors)
```

The reasoning is straightforward once stated: a 600px item and a 100px item with
the same `flex-shrink: 1` should not each give up the same number of pixels. If
they did, the small item would be crushed to nothing while the large one barely
changed. Weighting by base size means both shrink by the same *proportion*.

### Worked example

A 500px container, two items, 200px deficit:

```css
.a { flex: 0 1 300px; }
.b { flex: 0 1 400px; }
```

Total base 700px in a 500px container → **deficit = 200px**.

| Item | shrink | base | Scaled factor | Share | Reduction | Final |
|---|---|---|---|---|---|---|
| `.a` | 1 | 300px | 300 | 300/700 | 85.7px | **214.3px** |
| `.b` | 1 | 400px | 400 | 400/700 | 114.3px | **285.7px** |

Both lost about 28.6% of their base size. Had the deficit been split evenly at
100px each, `.a` would have finished at 200px and `.b` at 300px — the smaller
item would have given up a third of itself while the larger gave up a quarter.

### Making one item resist

Because the factor multiplies the base size, `flex-shrink: 0` is the clean way
to protect an item:

```css
.sidebar { flex: 0 0 240px; }   /* never shrinks, never grows */
.main    { flex: 1 1 auto; }    /* absorbs everything */
```

`flex: 0 0 240px` has a name worth knowing — it is what `flex: none` plus a width
achieves, and it is the correct spelling for a fixed-width panel.

## The two branches are mutually exclusive

Worth repeating because it explains a lot of confusion: on a given flex line,
either the grow stage runs or the shrink stage runs, never both. `flex: 1 1 200px`
does not mean "grow and shrink" — it means "grow *if* there is surplus, shrink
*if* there is a deficit".

This is why debugging should start with the sign of the free space. If items
overflow, no amount of `flex-grow` tuning changes anything.

## Clamping, and the loop the spec actually runs

The distribution above is the simple case. Items also have min and max sizes,
and once clamping enters, one pass is not enough.

The specification runs a loop: distribute free space, then check whether any item
was pushed outside its min/max bounds. Any item that was is **frozen** at its
clamped size and removed from the calculation, and the remaining free space is
redistributed among the items still flexible. That repeats until nothing more
violates its bounds.

The practical consequence: **one item hitting its minimum changes the sizes of
every other item**, because the deficit it refused to absorb is passed on to the
rest. A single unshrinkable item — very often one with an automatic minimum size
it inherited from a long word — can push the whole line into overflow while
looking innocent itself.

That mechanism is the bridge to the next topic:
[02 · The automatic minimum size](../02-the-automatic-minimum-size/README.md).

## Trade-off

**The base-size weighting is right for content and wrong for equality.** It
keeps proportions stable while a container narrows, which is what you want for a
row of cards or a toolbar. It also means you cannot express "every item gives up
the same number of pixels" through `flex-shrink` at all — the weighting is not
optional, and the only way out is equal base sizes.

There is a second cost: shrink behaviour is genuinely hard to predict by
inspection once three or more items have different bases and factors. Teams that
need predictable narrowing usually stop using `flex-shrink` as a tuning dial —
they set `flex-shrink: 0` on everything that must not move and let one designated
item absorb the whole deficit. That is less elegant and far easier to reason
about, and it is the pattern most production layouts converge on.

## Gotchas

**`flex-grow: 3` does not make an item three times wider.**
*Symptom:* factors of 1, 2, 3 produce sizes in a 3:4:5 ratio.
*Cause:* grow factors divide the *surplus*, which is added on top of each item's
base size.
*Fix:* set `flex-basis: 0` so the entire container is surplus and the factors
describe the final sizes.

**Two items with the same `flex-shrink` shrink by different amounts.**
*Symptom:* the wider item loses more pixels.
*Cause:* intended — shrinkage is weighted by `flex-shrink × flex base size`, so
both lose the same *proportion*.
*Fix:* equal base sizes if you need equal pixel loss, or `flex-shrink: 0` on the
item that must not move.

**One item refuses to shrink and everything else is crushed.**
*Symptom:* a single long item stays full width while its neighbours collapse.
*Cause:* it hit its automatic minimum size, was frozen, and its share of the
deficit was redistributed to the others.
*Fix:* `min-width: 0` on that item — see the next topic.

**Free space is left over despite `flex-grow` being set.**
*Symptom:* a gap remains at the end of the line.
*Cause:* the sum of grow factors is below 1, so only that fraction of the free
space is distributed.
*Fix:* raise the factors so they sum to at least 1.

**Setting both grow and shrink has no visible effect.**
*Symptom:* changing `flex-shrink` changes nothing.
*Cause:* free space is positive, so only the grow branch is running.
*Fix:* check the sign of the free space before tuning either factor.

## Interview questions

**★ How is negative free space distributed between flex items?**
By the **scaled flex shrink factor** — `flex-shrink` multiplied by the item's
flex base size. Each item absorbs a share of the deficit proportional to that, so
items with larger bases give up more pixels and all items lose the same
proportion of themselves.

**★ Why is shrinking weighted by base size when growing is not?**
So that a small item is not crushed alongside a large one. With unweighted
shrinking, a 100px and a 600px item sharing a deficit equally would destroy the
small one first. Weighting equalises the proportional loss instead of the
absolute loss.

**★ Do `flex-grow: 1, 2, 3` produce widths in a 1:2:3 ratio?**
Only if the flex basis is zero. Otherwise the factors divide the surplus on top
of each item's base size, so equal 100px bases with those factors give 150/200/250
— a 3:4:5 ratio.

**What happens when an item hits its min or max size during distribution?**
It is frozen at the clamped size and removed from the calculation, and the
remaining free space is redistributed among the still-flexible items. The loop
repeats until no item violates its bounds — so one clamped item changes every
other item's size.

**What does `flex: 0 0 240px` mean and when is it right?**
No grow, no shrink, a fixed 240px base — a panel that keeps its width whatever
happens to the container. It is the correct spelling for a fixed sidebar.

**Can `flex-grow` and `flex-shrink` both apply at once?**
No. On a given flex line the free space is either positive or negative, so
exactly one branch runs. `flex: 1 1 200px` means "grow if there is surplus,
shrink if there is a deficit", not both.

---

← [01 · Base sizes](./01-base-sizes.md) · Next: [03 · The alignment stage](./03-the-alignment-stage.md) →
