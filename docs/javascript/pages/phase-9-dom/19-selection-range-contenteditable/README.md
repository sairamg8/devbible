---
title: "19 · Selection, Range and contenteditable"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-14 against MDN — [`Selection`](https://developer.mozilla.org/en-US/docs/Web/API/Selection), [`Range`](https://developer.mozilla.org/en-US/docs/Web/API/Range), [`contenteditable`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/contenteditable), [`Document.execCommand()`](https://developer.mozilla.org/en-US/docs/Web/API/Document/execCommand), [`beforeinput` event](https://developer.mozilla.org/en-US/docs/Web/API/Element/beforeinput_event). Documentation-validated; **no timings**.

The syllabus calls this *the surface area behind every rich-text editor* — and tiers it **When
Needed** deliberately. Learn the model when a project actually requires it; the honest default is
to use a maintained editor library and `contenteditable="plaintext-only"` for everything simpler.

🔴 **The one-line summary:** a `Range` is two boundary points of *container + offset*, a `Selection`
is the user's one range plus a direction, and `contenteditable` is one attribute followed by every
hard problem in text editing.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[Selection and Range](./01-selection-and-range.md)** | Boundary points and what `offset` means, building and mutating ranges, `surroundContents` and when it throws, anchor/focus versus start/end, `selectionchange`, and why inputs use a different API |
| 02 | **[contenteditable](./02-contenteditable.md)** | The four values and why `plaintext-only` is underused, why `execCommand` is deprecated *and* non-standard, `beforeinput` with `inputType` and `getTargetRanges()`, and the list of problems that make editors libraries |

## Three facts worth carrying out of this topic

- **`offset` counts characters in a text node and child nodes in an element.** Most Range confusion
  is this one ambiguity.
- **`anchor`/`focus` record direction; `start`/`end` are document order.** Backwards selections
  break code that assumes otherwise.
- **`execCommand` is deprecated and non-standard**, produces different markup per browser, may not
  fire input events, and its `insertHTML` is an XSS sink.

## Phase gate

You can render a list from an array into the DOM with no framework, update one row without
rebuilding the list, and explain which parts are XSS-safe.

## Where this connects

- [13 · Measuring elements](../13-measuring-elements/01-the-four-families.md) — a `Range` has
  geometry, which is how a selection toolbar positions itself
- [11 · Batching DOM work](../11-batching-dom-work/01-build-off-document.md) —
  `extractContents()` returns a `DocumentFragment`, with all its properties
- [06 · Sanitising HTML](../06-sanitising-html/README.md) — `createContextualFragment()` and
  `execCommand('insertHTML')` are both injection sinks
- [15 · Focus and accessibility](../15-focus-and-accessibility/01-what-can-hold-focus.md) —
  programmatic selection changes can move focus, and nested editable regions are not tab stops
- [18 · Shadow DOM](../18-shadow-dom-and-custom-elements/03-living-with-the-boundary.md) —
  `getComposedRanges()` is the selection API's boundary-crossing view

---

Start → [01 · Selection and Range](./01-selection-and-range.md)
