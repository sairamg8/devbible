---
title: "Flexbox and text overflow"
sidebar_label: "07 · Flexbox and text overflow"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **MDN — [`text-overflow`](https://developer.mozilla.org/en-US/docs/Web/CSS/text-overflow)**,
> [`overflow-wrap`](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-wrap),
> [`word-break`](https://developer.mozilla.org/en-US/docs/Web/CSS/word-break) and
> [`-webkit-line-clamp`](https://developer.mozilla.org/en-US/docs/Web/CSS/-webkit-line-clamp),
> and the **W3C CSS Overflow Level 3/4** and **CSS Text Level 3** specifications.

**The truncation chain is four properties long and fails silently if any link is
missing.** This page is the chain on its own, separated from the layout patterns
that use it.

## The chain, in order

```css
.truncate {
  min-inline-size: 0;        /* 1. permit the box to be narrower than its content */
  white-space: nowrap;       /* 2. stop the text wrapping to a second line */
  overflow: hidden;          /* 3. clip what does not fit */
  text-overflow: ellipsis;   /* 4. draw … at the clip point */
}
```

Each link depends on the one before it:

| Link | Without it |
|---|---|
| `min-inline-size: 0` | the flex item never shrinks, so nothing ever overflows |
| `white-space: nowrap` | the text wraps to a new line instead of overflowing |
| `overflow: hidden` | the text spills out visibly; `text-overflow` has nothing to act on |
| `text-overflow: ellipsis` | the text is clipped abruptly with no indication |

**`text-overflow` alone does nothing.** It is the most commonly written and least
sufficient of the four — it only styles a clip that `overflow` has already
created.

The first link is flex-specific and is the one people miss: see
[02 · The automatic minimum size](./02-the-automatic-minimum-size/README.md) for
why `min-width` defaults to `auto` in flex layout.

## Single line vs multiple lines

`text-overflow: ellipsis` is a **single-line** mechanism — it requires
`white-space: nowrap`, which by definition means one line.

For a clamp at *n* lines, the property is `line-clamp`, still widely written in
its prefixed form:

```css
.clamp-3 {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
}
```

Two honest caveats:

- **The unprefixed `line-clamp` is not yet Baseline.** `web-features` 3.34.3
  reports `line-clamp` as **limited availability**, so the `-webkit-` prefixed
  form remains required in production — one of the few prefixes still genuinely
  needed in 2026.
- `display: -webkit-box` **replaces** the element's display type, so the clamped
  element cannot also be a flex or grid container. Wrap it if you need both.

## `overflow-wrap` and `word-break` — a different problem

Truncation decides what happens when text *exceeds* its box. These two decide
where text is *allowed to break*, which is what stops a long string setting a
huge min-content size in the first place.

| Property | Effect |
|---|---|
| `overflow-wrap: break-word` | break inside a word **only if** it cannot fit any other way |
| `word-break: break-all` | break at any character, eagerly, ignoring word boundaries |
| `hyphens: auto` | break at valid hyphenation points, with a hyphen (needs `lang`) |

**Prefer `overflow-wrap: break-word`.** It leaves normal prose alone and steps in
only for the unbreakable string — a URL, a hash, a token. `word-break: break-all`
breaks ordinary sentences mid-word and looks wrong; reserve it for content that
is genuinely unstructured, or for CJK text where the rules differ.

```css
.cell {
  min-inline-size: 0;
  overflow-wrap: break-word;   /* long URLs wrap instead of blowing out the track */
}
```

Note this is the *alternative* to truncation, not a companion: the text stays
fully visible and the box grows taller instead of wider.

## Choosing between the three failure modes

When content does not fit, there are exactly three options, and picking one is a
product decision rather than a CSS one:

| Mode | CSS | Right when |
|---|---|---|
| **Truncate** | the four-property chain | dense lists; the full value is reachable elsewhere |
| **Wrap** | `overflow-wrap: break-word` | the content must stay readable — errors, messages |
| **Scroll** | `overflow-x: auto` | tabular or code content where the layout must not reflow |

The failure worth avoiding is picking none of them: content that overflows
invisibly, pushing siblings out of the container. That is what an unset
`min-width` produces, and it is the default.

## Accessibility: truncated text must stay reachable

An ellipsis is a visual signal only. Assistive technology reads the full text
node — which is good for screen readers, and means a **sighted** user is the one
who loses information.

```html
<span class="truncate" title="A very long document title that will not fit">
  A very long document title that will not fit
</span>
```

The `title` attribute is the low-effort fallback. It is not ideal — it does not
appear on touch devices and has inconsistent keyboard behaviour — but it is far
better than nothing, and a truncating element with no fallback is silent
information loss.

Do **not** put the full text in a `title` and a shortened version in the element,
because then the two disagree and the screen reader announces the long one while
the visible one is a different string.

## Trade-off

**Truncation is a layout guarantee bought with an information cost.** The
four-property chain makes a row's height and width completely predictable
regardless of content, which is exactly what a dense table or list needs. It also
means the interface can never tell you it hid something beyond three pixels of
ellipsis, and no amount of testing with short fixture data will reveal what real
data hides.

Wrapping has the opposite profile: nothing is ever hidden, and the layout's height
becomes a function of the content, so rows jump and virtualised lists mis-measure.

Neither is a default. The useful discipline is to decide per surface — lists
truncate, messages wrap, code scrolls — and to write the choice down, because the
next person will otherwise apply whichever they saw last.

## Gotchas

**`text-overflow: ellipsis` does nothing.**
*Symptom:* no ellipsis, text either wraps or overflows.
*Cause:* a missing link in the chain — most often `white-space: nowrap`, or
`min-inline-size: 0` inside a flex container.
*Fix:* all four properties together.

**The ellipsis works outside flexbox but not inside it.**
*Symptom:* the same class behaves differently in a flex row.
*Cause:* the automatic minimum size stops the flex item shrinking, so there is no
overflow to truncate.
*Fix:* `min-inline-size: 0` on the flex item.

**A clamped element stops being a flex container.**
*Symptom:* the layout inside it collapses after adding a line clamp.
*Cause:* `display: -webkit-box` replaced `display: flex`.
*Fix:* wrap the clamped text in its own element.

**`word-break: break-all` makes prose look broken.**
*Symptom:* ordinary sentences break mid-word.
*Cause:* `break-all` breaks eagerly at any character.
*Fix:* `overflow-wrap: break-word`, which only breaks as a last resort.

**Truncated text is invisible to sighted users but read fully by screen readers.**
*Symptom:* an accessibility review flags an information mismatch.
*Cause:* the text node is complete; only the visual rendering is clipped.
*Fix:* add a `title` attribute with the *same* full string, so both experiences
agree.

## Interview questions

**★ What are the four properties needed to truncate text in a flex item, and why
each?**
`min-inline-size: 0` so the flex item can shrink below its content width;
`white-space: nowrap` so the text does not wrap instead; `overflow: hidden` to
clip it; `text-overflow: ellipsis` to draw the indicator. Missing any one
produces no ellipsis and no error.

**★ Why does the same truncation class work outside flexbox but fail inside it?**
Because in flex layout `min-width` defaults to `auto`, giving the item a
content-based floor. The item never shrinks, so nothing overflows, so there is
nothing for `text-overflow` to act on.

**★ What is the difference between `overflow-wrap: break-word` and
`word-break: break-all`?**
`overflow-wrap: break-word` breaks inside a word only when it cannot fit any
other way, leaving normal prose intact. `word-break: break-all` breaks eagerly at
any character, which makes ordinary sentences look wrong. Prefer the former for
long URLs and tokens.

**How do you truncate at three lines instead of one?**
`display: -webkit-box` with `-webkit-box-orient: vertical`,
`-webkit-line-clamp: 3` and `overflow: hidden`. The unprefixed `line-clamp` is
still limited availability, so the prefix remains necessary — and the `-webkit-box`
display replaces any flex or grid display on that element.

**What should accompany truncated text for accessibility?**
A way for sighted users to reach the full value — a `title` attribute or tooltip
containing the same complete string. Screen readers already receive the full text
node, so it is the visual user who loses information.

**What are the three ways content can fail to fit, and how do you choose?**
Truncate, wrap, or scroll. Truncate for dense lists where the value is reachable
elsewhere; wrap when the content must stay readable, such as errors; scroll for
tabular or code content that must not reflow.

---

← [06 · Flexbox patterns](./06-flexbox-patterns/README.md) · Back to [Phase 4 overview](./README.md)
