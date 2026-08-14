---
title: "Diagnosing it in a real layout"
sidebar_label: "02 · Diagnosing it"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against the **W3C CSS Flexible Box Layout Level 1**
> specification ([§4.5](https://www.w3.org/TR/css-flexbox-1/#min-size-auto))
> and **MDN — [`min-content`](https://developer.mozilla.org/en-US/docs/Web/CSS/min-content)**
> and [`overflow-wrap`](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-wrap).

**Recognising the automatic minimum size in a layout you did not write is a
different skill from knowing the fix.** The symptom rarely appears on the item
that is actually at fault, and three unrelated-looking bugs share this one cause.

## The tell: the container overflows and one item is at its content width

Work backwards from the overflow:

1. **Is the container overflowing, or is one item too wide?** Overflow of the
   container points at a floor somewhere inside it.
2. **Which item is exactly as wide as its longest word?** That is the frozen one.
   Its width will match its min-content size precisely — not approximately.
3. **Does it have `flex-shrink` greater than 0?** If yes, it *should* have
   shrunk. It did not, so something stopped it.
4. **Is `min-width` unset on it?** Then it is `auto`, and that is your answer.

The confirmation, without changing any source, is to set `min-width: 0` on the
suspect item in DevTools. If the layout snaps into place, the diagnosis is done.

## Reading it in DevTools

Two things are worth knowing because neither is obvious:

- **The computed value shows as `auto`, not as a number.** DevTools reports
  `min-width: auto` and does not tell you what that resolved to, so you cannot
  read the floor directly — you infer it from the rendered width.
- **The flexbox inspector helps more than the box model.** Firefox's flex
  inspector labels each item with why it is the size it is, and an item stopped
  by its minimum is reported as clamped rather than as flexed. That label is the
  fastest confirmation available.

You can also measure the floor directly by asking for it:

```css
.suspect { inline-size: min-content; }   /* temporarily — this is the floor */
```

If that width matches the width the item is stuck at, the automatic minimum is
confirmed.

## Three bugs, one cause

These present completely differently and are all the same thing.

### 1. The truncating label that will not truncate

Covered in [chunk 01](./01-why-items-refuse-to-shrink.md). The nav item, the
breadcrumb, the file name.

### 2. The panel that will not scroll

```css
.app   { display: flex; flex-direction: column; block-size: 100dvh; }
.list  { flex: 1; overflow-y: auto; }     /* grows instead of scrolling */
```

The column's main axis is vertical, so `min-height: auto` applies. `.list` grows
to its content height, the container overflows, and the *page* scrolls rather
than the panel. Add `min-block-size: 0` to `.list`.

This one is worth internalising because the symptom — "my scroll container
doesn't scroll" — sounds like an `overflow` problem and is not.

### 3. The grid or flex track blown out by one long string

A single unbroken string — a URL, a hash, a base64 fragment — sets a
min-content size as wide as the whole string, because there is no break
opportunity inside it. The item's floor becomes enormous.

Here `min-width: 0` fixes the *layout* but leaves the string overflowing its own
box. The complete fix pairs it with a break rule:

```css
.cell {
  min-inline-size: 0;
  overflow-wrap: break-word;   /* break the string when it cannot fit */
}
```

`overflow-wrap: break-word` allows breaking inside a word only as a last resort,
which is what you want. `word-break: break-all` breaks eagerly at any character
and makes ordinary prose look wrong — reach for it only for genuinely
unstructured strings.

## The interaction with `flex-basis`

A subtlety that produces "I set `min-width: 0` and it still does not shrink":

```css
.item { flex: 0 0 300px; min-inline-size: 0; }   /* still 300px */
```

`flex-shrink: 0` means the item was never a candidate for shrinking in the first
place. `min-width: 0` removes the floor but does not grant permission to shrink.
Both are needed:

```css
.item { flex: 0 1 300px; min-inline-size: 0; }   /* now it shrinks */
```

Check the shrink factor before concluding the minimum is still in play.

## A defensive base rule, and its limits

Some codebases adopt:

```css
.flex-min > * { min-inline-size: 0; }
```

as an opt-in utility rather than a blanket reset. That is a reasonable middle
ground: it makes the intent visible at the call site, and it does not silently
remove the protection from every flex item in the application.

What to avoid is the global form:

```css
* { min-inline-size: 0; }        /* ⚠️ don't */
```

It removes a protection the layout engine provides for good reason, and the
resulting collapses appear only at narrow widths where they are least likely to
be tested.

## Trade-off

**Diagnosis is cheap once you know the pattern and expensive when you do not.**
The cost of this topic is entirely front-loaded: the behaviour is invisible in
the cascade, absent from the computed styles as a number, and attributed to the
wrong element by the symptom. Someone who has not met it can lose an afternoon;
someone who has recognises it in seconds.

The mitigation is not more CSS but a habit — when a flex container overflows,
check for a content floor *before* adjusting any flex factors. Tuning
`flex-shrink` on a frozen item cannot work, and time spent there is time spent on
the wrong stage of the algorithm.

## Gotchas

**`min-width: 0` did not help.**
*Symptom:* the item is still at its basis width.
*Cause:* `flex-shrink: 0` — usually from `flex: 0 0 <size>` or `flex: none`.
*Fix:* allow shrinking as well: `flex: 0 1 <size>`.

**The fix works in one browser and not another.**
*Symptom:* inconsistent overflow.
*Cause:* almost always a missing `min-width: 0` at one nesting level, which
different engines surface at different widths — not an engine difference in the
rule itself.
*Fix:* apply it at every flex level between the container and the text.

**A long URL still overflows after the fix.**
*Symptom:* the layout is correct but the string escapes its box.
*Cause:* `min-width: 0` allows the box to be narrow; it does not make the string
breakable.
*Fix:* add `overflow-wrap: break-word`.

**Everything collapses at narrow widths after adding a global reset.**
*Symptom:* buttons and labels crush on small screens.
*Cause:* a blanket `min-width: 0` removed the content floor everywhere.
*Fix:* scope it to the items that are meant to absorb the squeeze.

**DevTools shows `min-width: auto` and no number.**
*Symptom:* you cannot see what the floor is.
*Cause:* the computed value is genuinely `auto`; the resolved content minimum is
not exposed.
*Fix:* set `inline-size: min-content` temporarily to measure it, or use the
flexbox inspector, which reports the item as clamped.

## Interview questions

**★ A flex container overflows its parent. What do you check first?**
Whether any item is sitting exactly at its min-content width despite having a
non-zero `flex-shrink`. That combination means the item hit its automatic minimum
size, was frozen, and pushed its share of the deficit onto its siblings. Confirm
by setting `min-width: 0` on it.

**★ A scrollable panel inside a column flex layout grows instead of scrolling.
Why?**
The column's main axis is vertical, so `min-height: auto` gives the panel a
content-based floor. It grows to its content height and the container overflows.
`min-block-size: 0` on the flexible child fixes it — the `overflow` property was
never the problem.

**★ You added `min-width: 0` and the item still will not shrink. What else?**
Check `flex-shrink`. `flex: 0 0 300px` or `flex: none` means the item was never
shrinkable; removing the floor does not grant permission to shrink. It needs
`flex: 0 1 300px`.

**How do you find out what the automatic minimum actually resolved to?**
It is not exposed as a computed number — DevTools reports `auto`. Set
`inline-size: min-content` temporarily and compare, or use the flexbox inspector,
which reports the item as clamped rather than flexed.

**Why does a single long URL blow out a layout?**
It has no break opportunity, so its min-content size is the width of the entire
string, which becomes the item's floor. `min-width: 0` lets the box narrow;
`overflow-wrap: break-word` is what actually lets the string break.

**Is a global `* { min-width: 0 }` a good idea?**
No. It removes a protection the engine provides deliberately, and the resulting
collapses show up only at narrow widths. Scope it to the specific item intended
to absorb the squeeze, paired with truncation in the same rule.

---

← [01 · Why items refuse to shrink](./01-why-items-refuse-to-shrink.md) · Back to [the topic index](./README.md)
