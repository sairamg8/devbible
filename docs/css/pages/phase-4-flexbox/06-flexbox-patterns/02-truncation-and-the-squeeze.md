---
title: "The truncating row, and deciding what gives way"
sidebar_label: "02 · Truncation and the squeeze"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against the **W3C CSS Flexible Box Layout Level 1**
> specification and **MDN — [`text-overflow`](https://developer.mozilla.org/en-US/docs/Web/CSS/text-overflow)**
> and [Typical use cases of flexbox](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout/Typical_use_cases_of_flexbox).

**Every real bar eventually contains more than fits, and the layout's quality is
decided by what gives way.** This page is the pattern that ties the whole phase
together — and the phase gate.

## The phase-gate layout

A row where the **middle item truncates** while the right-hand group keeps its
size:

```html
<div class="bar">
  <span class="bar__icon">📄</span>
  <span class="bar__title">A very long document title that will not fit</span>
  <div class="bar__actions"><button>Share</button><button>Delete</button></div>
</div>
```

```css
.bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.bar__icon,
.bar__actions {
  flex: none;                    /* neither may shrink */
}

.bar__title {
  flex: 1;                       /* takes the remaining space */
  min-inline-size: 0;            /* ← permits shrinking below content width */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

Four decisions, each from an earlier topic:

| Line | Why |
|---|---|
| `flex: none` on icon and actions | they are not candidates for the squeeze — [03 · The `flex` shorthand](../03-the-flex-shorthand/README.md) |
| `flex: 1` on the title | it absorbs all remaining space and all of the deficit |
| `min-inline-size: 0` | removes the content floor — [02 · The automatic minimum size](../02-the-automatic-minimum-size/README.md) |
| the three truncation properties | `white-space: nowrap` prevents wrapping, `overflow: hidden` clips, `text-overflow` draws the ellipsis |

**All three truncation properties are required.** Without `nowrap` the text wraps
instead of truncating; without `overflow: hidden` there is nothing for
`text-overflow` to act on. Dropping any one produces no ellipsis and no error.

## Nominating the item that gives way

The generalisation is worth stating explicitly, because it is the design decision
underneath every bar:

> **Exactly one item should absorb the squeeze. Everything else gets
> `flex: none`.**

The alternative — leaving several items shrinkable — produces a layout where
everything degrades a little and nothing degrades gracefully. Icons go
elliptical, buttons truncate their labels, and the result is worse than any
single item truncating cleanly.

```css
.bar > *          { flex: none; }              /* default: nothing shrinks */
.bar > .flexible  { flex: 1; min-inline-size: 0; }   /* one nominated victim */
```

That two-rule idiom scales to bars of any complexity, and it makes the intent
legible: a reader can see at a glance which element is expected to lose.

## Two flexible items: weighting the loss

Occasionally two items should both give way — a title and a subtitle, say — but
not equally. Because shrinking is weighted by the base size
([01 · Grow and shrink](../01-the-flex-sizing-algorithm/02-grow-and-shrink.md)),
the reliable lever is `flex-shrink`:

```css
.bar__title    { flex: 1 1 auto; min-inline-size: 0; }   /* shrinks readily */
.bar__subtitle { flex: 1 3 auto; min-inline-size: 0; }   /* shrinks 3× faster */
```

The subtitle absorbs three times as much of the deficit per unit of base size, so
it disappears first and the title survives longer. This is a genuinely useful
dial, and it is the only common case where a `flex-shrink` other than `0` or `1`
earns its place.

## Truncating in the middle

`text-overflow: ellipsis` only clips at the end, which is wrong for filenames —
`really-long-report-2026-final.pdf` truncates to
`really-long-report-2026-f…` and loses the extension, the most informative part.

CSS has no middle-truncation. The workable approach splits the string and pins
the tail:

```html
<span class="trunc">
  <span class="trunc__head">really-long-report-2026-final</span>
  <span class="trunc__tail">.pdf</span>
</span>
```

```css
.trunc       { display: flex; min-inline-size: 0; }
.trunc__head { min-inline-size: 0; overflow: hidden;
               text-overflow: ellipsis; white-space: nowrap; }
.trunc__tail { flex: none; }
```

The head truncates; the extension always survives. It needs the split in markup,
which is the honest cost — but it is the only approach that does not require
measuring text in JavaScript.

## Wrapping as the alternative failure mode

Truncation is not always right. When the content is genuinely needed, wrapping is
the better degradation:

```css
.bar { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.bar__title { flex: 1 1 12rem; min-inline-size: 0; }   /* wraps below 12rem */
```

The basis acts as a wrap threshold: while the title can have 12rem it stays on
the line; below that the row wraps and the title gets a full line to itself.

**Choose by what the content is for.** A document title in a list can truncate —
the user can open it to see the rest. An error message must not; wrap it.

## Trade-off

**Truncation makes layouts stable and hides information.** A bar that truncates
never breaks, never reflows, and never tells the user that something was cut
beyond a three-pixel ellipsis. On a dense list that is the right call. On
anything where the hidden text carries meaning — an error, a permission, a
warning — it is a genuine usability failure that testing with short sample data
will never reveal.

The mitigation costs little and is almost always skipped: put the full text in a
`title` attribute or an accessible tooltip so the truncated content remains
reachable. A truncating element with no way to see the full value is an
information loss, not a layout decision.

## Gotchas

**No ellipsis appears.**
*Symptom:* the text is clipped abruptly, or overflows.
*Cause:* one of the three required properties is missing — usually
`white-space: nowrap`.
*Fix:* all three together: `overflow: hidden`, `text-overflow: ellipsis`,
`white-space: nowrap`.

**The ellipsis appears but the row still overflows.**
*Symptom:* the truncating item is fine, the container is not.
*Cause:* another item is frozen at its own content minimum.
*Fix:* `flex: none` is not enough — find the item at its min-content width and
give it `min-inline-size: 0`, or accept its size and let the nominated item
absorb more.

**Everything shrinks a little instead of one thing truncating.**
*Symptom:* icons and buttons squash.
*Cause:* every item is shrinkable by default.
*Fix:* `flex: none` on everything, then nominate one flexible item.

**A filename loses its extension.**
*Symptom:* `…-final` instead of `….pdf`.
*Cause:* `text-overflow` clips at the end only.
*Fix:* split head and tail into two elements and pin the tail with `flex: none`.

**Truncated text is unreachable.**
*Symptom:* users cannot see the full value.
*Cause:* no fallback for the hidden content.
*Fix:* add a `title` attribute or a tooltip.

## Interview questions

**★ Build a row where the middle item truncates and the right group stays fixed.
What is required?**
`flex: none` on the items that must not shrink; `flex: 1` on the middle item so
it takes the remaining space; `min-inline-size: 0` on it to remove the automatic
minimum size; and the three truncation properties — `overflow: hidden`,
`text-overflow: ellipsis`, `white-space: nowrap`. Missing the `min-inline-size`
is what usually breaks it.

**★ Why is `min-width: 0` needed when `text-overflow: ellipsis` is already set?**
Because the truncation properties only act on overflow, and without
`min-width: 0` the item never shrinks below its content width — so there is no
overflow to truncate. The properties are correct but unreachable.

**★ Two items should both shrink, but one should give way first. How?**
Different `flex-shrink` factors — `flex: 1 3 auto` on the one that should
disappear first. Since shrinking is weighted by `flex-shrink × base size`, the
higher factor absorbs proportionally more of the deficit.

**How would you truncate the middle of a filename?**
CSS cannot. Split the string into a head and a tail in markup, truncate the head
with the usual three properties, and give the tail `flex: none` so the extension
always survives.

**When is wrapping the better failure mode than truncating?**
When the hidden content carries meaning the user needs — errors, warnings,
permissions. Truncation suits dense lists where the full value is reachable by
another route.

**What should accompany any truncating element?**
A way to reach the full text — a `title` attribute or tooltip. Otherwise
truncation is silent information loss.

---

← [01 · Bars and shells](./01-bars-and-shells.md) · Back to [the topic index](./README.md)
