---
title: "01 · Moving the scroll position"
sidebar_label: "01 · Moving the scroll position"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`Window.scrollTo()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/scrollTo), [`Window.scrollBy()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/scrollBy), [`Element.scrollTop`](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollTop), [`Document.scrollingElement`](https://developer.mozilla.org/en-US/docs/Web/API/Document/scrollingElement), [`scroll-behavior`](https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-behavior), [`prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion). Documentation-validated; **no timings**.

There are exactly **three** ways to move a scroll position from JavaScript, and they differ in what
you have to know to use them.

| You know | Use | Shape |
|---|---|---|
| the pixel offset you want | `scrollTop` / `scrollLeft`, or `scrollTo()` | absolute |
| how far to move from here | `scrollBy()` | relative |
| **which element** you want on screen | `scrollIntoView()` | declarative |

🔴 **Prefer the third**, covered in [02 · Landing on an element](./02-landing-on-an-element.md).
Pixel offsets go stale the moment a font loads, an image reflows, or a banner appears above the
content — `scrollIntoView()` re-asks the layout engine at call time and cannot drift. This chunk is
the other two: the offset APIs, and the `behavior` setting that all of them share.

## `scrollTo`, `scrollBy` and `scroll`

`window.scroll()` and `window.scrollTo()` are the **same method** under two names; `scrollBy()` is
the relative one. Every one of them takes two forms:

```js
window.scrollTo(0, 800);                              // x, y — both required
window.scrollTo({ top: 800, left: 0, behavior: 'smooth' });

window.scrollBy({ top: 400, behavior: 'smooth' });    // 400px further down
```

The two forms are not interchangeable:

- The **coordinate form** takes both axes as plain numbers and has no way to ask for smooth
  scrolling.
- The **options form** treats `top` and `left` as optional — omit one and that axis is left
  alone. This is the only form that accepts `behavior`.

Elements have the identical trio: `el.scrollTo()`, `el.scrollBy()`, `el.scroll()`. The window
methods scroll the viewport; the element methods scroll that element's own scroll box, and do
nothing at all if it is not a scroll container — see
[03 · Scroll containers and sticky](./03-scroll-containers-and-sticky.md).

### The return value is a Promise now

`scrollTo()`, `scrollBy()` and `scrollIntoView()` return a **`Promise`** that fulfils with
`{ interrupted: boolean }` — `true` when another programmatic scroll cut this one short. That is
how you wait for a smooth scroll to land:

```js
const { interrupted } = await window.scrollTo({ top: 0, behavior: 'smooth' });
if (!interrupted) heading.focus({ preventScroll: true });
```

⚠️ MDN flags that not every browser returns the promise yet and recommends feature detection. On a
browser that returns `undefined`, `await` resolves **immediately** — your code runs before the
animation finishes rather than failing loudly, which is the worst kind of gap. Detect it:

```js
const result = window.scrollTo({ top: 0, behavior: 'smooth' });
if (result?.then) await result;
else await waitForScrollEnd();          // the scrollend fallback, in chunk 02
```

## `scrollTop` and `scrollLeft` — the writable properties

Reading them gives the current offset; assigning moves the scroll box.

```js
list.scrollTop = 0;                      // back to the top
list.scrollTop = list.scrollHeight;      // to the bottom — over-large values clamp
```

Four documented behaviours worth knowing:

- **The value is fractional.** MDN describes it as subpixel-precise in modern browsers, so
  `scrollTop` is not necessarily a whole number. Comparing it for equality against an integer
  height is the bug behind every "load more never fires" report — see the ~1 px tolerance in
  [13 · Measuring elements](../13-measuring-elements/01-the-four-families.md).
- **Assigning too much clamps** to the maximum instead of throwing, which is why
  `el.scrollTop = el.scrollHeight` is a safe idiom for "go to the bottom" even though the true
  maximum is `scrollHeight - clientHeight`.
- **It can be negative** — in a `column-reverse` flex container that grows upwards, `0` is the
  *bottom* and scrolling towards the older content makes it increasingly negative. Chat logs hit
  this constantly. Safari also lets it exceed the range during overscroll bounce, unless
  `overscroll-behavior: none` is set.
- **A non-scrollable element reports `0`** and silently ignores assignment. Nothing throws; the
  scroll just does not happen.

MDN specifies the setter as behaving like `scroll()` with `behavior: "auto"` — and `auto` means
*use the computed `scroll-behavior`*, not *scroll instantly*. Under
`html { scroll-behavior: smooth }` an assignment **animates**. That surprises people restoring a
saved position.

### Reading the page's offset

For the viewport, the read side has its own names:

```js
window.scrollY;                          // pixels scrolled down — fractional
window.scrollX;
document.scrollingElement.scrollTop;     // the same number, element-style
```

`pageYOffset` / `pageXOffset` are aliases of `scrollY` / `scrollX`, kept for compatibility; prefer
the short names in new code.

🔴 **`document.body.scrollTop` is `0` in standards mode** — the **root** element scrolls, not the
body. `document.scrollingElement` exists precisely so you never have to branch on that: it returns
`documentElement` in standards mode, and handles the quirks-mode case (`body`, or `null`) for you.

## `behavior`: `auto` is not `instant`

Every scrolling method takes the same three values:

- **`'auto'`** — defer to the computed CSS `scroll-behavior` of the scrolling box.
- **`'instant'`** — jump, *whatever* the CSS says.
- **`'smooth'`** — animate, *whatever* the CSS says.

`scroll-behavior` is a CSS property with `auto` (instant) and `smooth` as its values, and it only
affects **navigation and the CSSOM scrolling APIs — never the user's own scrolling**. To make it
apply to the page it must be set on the **root element**; MDN states plainly that setting it on
`body` does **not** propagate to the viewport.

```css
html { scroll-behavior: smooth; }        /* anchor links and scrollTo() now animate */
```

🔴 **The trap that follows:** once that rule exists, *every* programmatic scroll animates —
including the one restoring a scroll position on page load, which now visibly slides down the page
instead of starting there. Pass `behavior: 'instant'` explicitly for restores.

## Respect `prefers-reduced-motion`

A smooth scroll is motion, and for some readers motion is a vestibular trigger. Handle it in CSS
for anchor links:

```css
html { scroll-behavior: smooth; }
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
}
```

…and at the call site for anything you scroll from code:

```js
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
const behavior = () => (reduce.matches ? 'instant' : 'smooth');

button.addEventListener('click', () => {
  panel.scrollIntoView({ behavior: behavior(), block: 'nearest' });
});
```

Read it **per call**, not once at module load — the preference can change while the page is open.

**The trade-off:** the CSS route is one rule and covers anchor navigation, which JavaScript cannot
intercept cleanly; the JavaScript route is per call and lets one animation stay smooth while
another does not. Most codebases need both, because `scroll-behavior` on the root does not reach
scroll containers deeper in the page.

## Gotchas

**Symptom: `scrollTo()` does nothing on the page, but works in DevTools.**
Cause — you called it on an element that is not the scroll container. `document.body.scrollTop`
stays `0` in standards mode because the root element scrolls.
Fix — use `window.scrollTo()`, or `document.scrollingElement` when you need the element form.

**Symptom: the restored scroll position slides down the page instead of starting there.**
Cause — `html { scroll-behavior: smooth }` applies to `scrollTo()` and to `scrollTop` assignment,
because both default to `behavior: 'auto'`, and `auto` means *whatever the CSS says*.
Fix — pass `behavior: 'instant'` explicitly on restores.

**Symptom: `window.scrollTo({ top: 500 })` scrolls, but `window.scrollTo(500)` does nothing.**
Cause — the coordinate form takes **two** required arguments; one number is not a valid call, and
it is not interpreted as `top`.
Fix — use the options form when you only care about one axis.

**Symptom: an "at the bottom" check never becomes true.**
Cause — `scrollTop` is fractional while `scrollHeight` and `clientHeight` are rounded integers.
Fix — compare with a tolerance: `scrollHeight - scrollTop - clientHeight < 1`.

**Symptom: `await window.scrollTo(...)` continues before the animation ends.**
Cause — that browser does not return the promise yet, so you awaited `undefined`.
Fix — feature-detect (`result?.then`) and fall back to `scrollend` with a timeout.

**Symptom: a chat log's `scrollTop` is negative and your "scrolled up?" check is inverted.**
Cause — `flex-direction: column-reverse`, where `0` is the bottom.
Fix — test against the direction you actually have, or read `scrollTop` relative to
`scrollHeight - clientHeight` instead of assuming `0` means the top.

## Interview questions

**★ What is the difference between `behavior: 'auto'` and `behavior: 'instant'`?**
`'auto'` defers to the computed CSS `scroll-behavior`, so under `html { scroll-behavior: smooth }`
it animates. `'instant'` always jumps. They are only equivalent when the CSS is left at its
default.

**★ Why does `document.body.scrollTop` return `0`?**
In standards mode the root element is the scrolling element, not `body`. Use `window.scrollY` /
`window.scrollTo()`, or `document.scrollingElement` for the element form — it returns the right
element in both standards and quirks mode.

**★ Does assigning `scrollTop` respect `scroll-behavior: smooth`?**
Yes. MDN defines the setter as equivalent to `scroll()` with `behavior: 'auto'`, and `auto` means
"use the computed `scroll-behavior`" — so under a smooth root rule the assignment animates.

**★ How do you make smooth scrolling accessible?**
Turn it off under `prefers-reduced-motion: reduce` — as a CSS media query for anchor navigation,
and by choosing `behavior` per call for scripted scrolls. Query the media list at call time, since
the preference can change mid-session.

**Can `scrollTop` be negative?**
Yes — in a `column-reverse` container that grows upwards, `0` is the bottom and the value goes
negative towards the start of the content. Safari also reports values beyond the range during
overscroll bounce, unless `overscroll-behavior: none` is set.

**What does `scrollBy()` add over `scrollTo()`?**
Only relativity — it applies a delta to the current position, so you do not have to read
`scrollY` first. That read would otherwise force layout, which is the concern in
[12 · Layout thrashing](../12-layout-thrashing/01-the-forced-reflow.md).

---

[Topic index](./README.md) · [02 · Landing on an element](./02-landing-on-an-element.md) →
