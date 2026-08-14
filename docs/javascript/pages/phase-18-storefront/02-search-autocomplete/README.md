---
title: "02 · Search with autocomplete"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController), [`aria-activedescendant`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-activedescendant), [`aria-expanded`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-expanded), [`KeyboardEvent.key`](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key), [`Element: focusout` event](https://developer.mozilla.org/en-US/docs/Web/API/Element/focusout_event), [`Element.scrollIntoView()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView). Documentation-validated; **no timings**.

**A search box is four lines of code and three bugs** — and then an interface that is judged
entirely on whether it can be driven from the keyboard.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The three bugs every search box ships with](./01-the-three-bugs.md)** | A request per keystroke → **debounce, not throttle**, created once, with a minimum length; the in-flight request → `AbortController`, with 🔴 **`AbortError` staying silent** because it is the app working correctly; and 🔴 **out-of-order responses, which survive both other fixes** — because aborting is a request to stop, not a guarantee — fixed with a **monotonic request id** rather than comparing the term; plus `encodeURIComponent`, and ⚠️ **cancelling the pending debounce when the box is cleared** |
| 2 | **[The dropdown](./02-the-dropdown.md)** | The keyboard specification, including 🔴 **`Tab` must not commit** and `preventDefault` on the arrows; 🔴 **highlight is not focus** — focus stays in the input and `aria-activedescendant` carries the highlight; the full ARIA wiring, with ⚠️ **`autocomplete="off"` so the browser's own list does not cover yours**; 🔴 **the blur-before-click trap** and its three fixes in order of quality; safe substring highlighting with `textContent`, because ⚠️ **`replace` + `innerHTML` is both an XSS sink and regex-fragile**; and a bounded result cache |

## The three sentences to keep

1. **Three separate bugs need three separate fixes** — debounce reduces requests, abort stops
   work, a sequence check protects the render.
2. **Focus never leaves the input.** The highlight moves via `aria-activedescendant`.
3. **`blur` fires before `click`** — `preventDefault` on the option's `mousedown` is the real fix,
   not a `setTimeout`.

## Phase gate

You are done with this topic when you can name all three network bugs and say why each fix is
insufficient alone, wire the keyboard including `Tab` and `Escape`, explain where focus lives, and
highlight a matched substring without an injection sink.

## Where this connects

- [01 · The product grid](../01-product-grid/README.md) — the same out-of-order race, less sharply
- [Phase 17 · 03 · `debounce` and `throttle`](../../phase-17-machine-coding/03-debounce-throttle/README.md) — the debounce, and why it must be created once
- [Phase 11 · 03 · 05 · Timeouts and cancellation](../../phase-11-network-storage/03-fetch-wrapper/05-timeouts-and-cancellation.md) — `AbortError` vs `TimeoutError`
- [Phase 9 · 06 · Sanitising HTML](../../phase-9-dom/06-sanitising-html/README.md) — why the highlight is built, not interpolated

---

Start → [01 · The three bugs every search box ships with](./01-the-three-bugs.md)
