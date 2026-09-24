---
name: devbible-javascript-concepts-phase9
description: Load-bearing claims and their MDN sources for JavaScript phase 9 (The DOM), Understand tier onward — written by lane B
metadata:
  type: reference
---

Per-phase concept record for **JavaScript phase 9 · The DOM**, Understand tier onward
(lane B, session `b4ffc223`). Master topics 01–06 predate this file. Every claim below is
**documentation-validated against MDN** — no sandbox, no timings, no console blocks.

Progress and cursor: [[devbible-javascript-lane-b]].

## 07 · Traversal

**The two families.** Every traversal property exists twice — a `Node` version seeing all node
types (`parentNode`, `childNodes`, `firstChild`, `nextSibling`) and an `Element` version seeing
elements only (`parentElement`, `children`, `firstElementChild`, `nextElementSibling`,
`childElementCount`). Default to the `Element` column.

- **Whitespace between tags is parsed into text nodes**, so `firstChild` is usually `#text` in
  formatted HTML while `firstElementChild` is not. The failure mode worth naming: it depends on
  **how the HTML is formatted**, so minification changes the answer — works in one build, breaks
  in the other, invisible in the DOM inspector (which collapses whitespace).
- `document.documentElement.parentNode` is the **document**; `.parentElement` is **null**.
  That is the *only* place the two differ for an in-body element, and the `null` is what
  terminates an up-walk cleanly.
- `children` (live `HTMLCollection`) and `childNodes` (live `NodeList`) are **both live** —
  a forward removal loop skips every other child. Snapshot with `[...el.children]`;
  `el.replaceChildren()` clears in one call without an HTML sink.
- `HTMLCollection` is array-**like**, not an array — no `filter`/`map`.
- Manual walking is right only for text/comment nodes or document-order-with-a-filter; the
  platform answer is `document.createTreeWalker()` / `NodeIterator`, not recursion.

**The selector API.**

- `Element.closest(sel)` — MDN: "traverses the element **and its parents** (heading toward the
  document root) until it finds a node that matches". Three load-bearing details: it **starts at
  the element itself** (which is why delegation works when the click lands on a nested icon), it
  takes a **full CSS selector**, and it returns **`null`** on no match. Invalid selector →
  `SyntaxError` (bites when built from a variable; use an attribute selector or `CSS.escape`).
- `Element.matches(sel)` — boolean, also `SyntaxError` on an invalid selector. `matches` on a
  nested structure is the *"handler broke when a designer added an icon"* bug; prefer `closest`.
- **`:scope`** — a descendant selector passed to `el.querySelectorAll()` is matched against the
  **whole document** and only the *results* are filtered to descendants, so
  `s.querySelectorAll('div p')` can return a `<p>` whose `<div>` is outside `s`. `:scope` anchors
  it; `:scope > *` expresses "direct children matching X".
- `Node.contains(other)` — true for a descendant **or the node itself** (MDN's wording), and
  `contains(null)` is `false`, never a throw. This is exactly why `!panel.contains(e.target)` is
  the correct click-outside test.
- `Node.compareDocumentPosition()` returns a **bitmask**, tested with `&` — a node inside another
  sets **both** `DOCUMENT_POSITION_CONTAINED_BY` and `DOCUMENT_POSITION_FOLLOWING`, so `===`
  against one constant is wrong for the first case anyone tries.
- **Shadow boundaries end the up-walk**: a `ShadowRoot` is a `DocumentFragment`, not an element,
  so `closest` stops there. Cross deliberately via `getRootNode().host`, or
  `getRootNode({ composed: true })` to reach the document through nested shadow trees.
- **Detached subtrees traverse normally** and `getRootNode()` returns the top of *that* tree, so
  traversal cannot tell you whether you are in the page — **`node.isConnected`** can.

Sources: MDN `Element.closest`, `Element.matches`, `Element.querySelectorAll`, `:scope`,
`Node.parentNode`, `Element.parentElement`, `Element.children`, `Node.childNodes`,
`Element.firstElementChild`, `Element.nextElementSibling`, `Element.replaceChildren`,
`Node.contains`, `Node.compareDocumentPosition`, `Node.getRootNode`, `Node.isConnected`,
`Document.createTreeWalker`, `CSS.escape`.

## 08 · Classes and styles from JavaScript

**Spine:** JavaScript decides *state*, CSS decides what state *looks like* — so JS writes
**classes** and **custom properties**, essentially never individual declarations. The reason it
matters: an inline style beats every stylesheet rule short of `!important`, so styling from JS
opts the element out of media queries, themes and `prefers-reduced-motion`.

**`classList` (a live `DOMTokenList`).**

- `add`/`remove` take many tokens; `remove` ignores missing ones. `replace(old,new)` returns
  whether it replaced. `contains`, `length`, spreadable.
- 🔴 **`toggle(name, force)`'s second argument** forces on/off instead of flipping. That is what
  makes the DOM a function of state — the one-argument form **drifts** the moment another code
  path also opens/closes the thing. Pass a real boolean: `undefined` degrades to the flip.
- `className` is the whole attribute — assigning wipes every other class, and `+= ' x'`
  duplicates tokens and leaves a leading space. **On SVG elements `className` is an
  `SVGAnimatedString`, not a string** (MDN), while `classList` works on both.
- Throws: **empty-string token → `SyntaxError`**, **token with whitespace →
  `InvalidCharacterError`** — both come from building class names from data.
- **Class vs `data-*`**: a class per independent boolean; **one `data-state` for mutually
  exclusive states**, because one assignment replaces the previous state and you cannot be in two
  at once. Neither replaces ARIA (`aria-expanded` etc.), which is also stylable.

**Inline styles and the CSSOM.**

- 🔴 **`element.style` is the inline `style` attribute and nothing else** — an element styled
  purely by a stylesheet reads back `''` for every property. This is the most misunderstood line
  in DOM styling.
- Dashed → camelCase (`backgroundColor`, `cssFloat` for `float`). 🔴 **Custom properties are
  exempt**: no camelCase form, and `style['--x']` does nothing — `setProperty('--x', v)` /
  `getPropertyValue` / `removeProperty` are required (they also accept ordinary dashed names).
- **Nothing throws.** CSS drops what it cannot parse, so `el.style.width = 100` (no unit) and
  `color = 'tomatoe'` are silently ignored. Unitless exceptions are the usual CSS ones
  (`opacity`, `z-index`, `line-height`, `flex-grow`, `order`).
- `style.cssText = …` **replaces the whole inline block**. `removeProperty(n)` or `''` deletes a
  declaration; **`'initial'`/`'unset'` do not** — they are real values that still override the
  cascade.
- `!important` is only expressible as `setProperty(name, value, 'important')`.
- `getComputedStyle(el)`: read-only, values come back **resolved** (`rgb(…)`, px — do not
  string-compare against what you authored), **reading after a write forces synchronous style and
  layout** (layout thrashing — batch reads then writes), and 🔴 **custom properties come back
  essentially as written, with possible leading whitespace → `.trim()` is required**. A custom
  property is not validated at declaration: `--gap: banana` computes fine and fails only at use.
- **The custom-property bridge** is the sanctioned exception to class-first: JS writes one value
  (`setProperty('--tilt', `${a}deg`)`), CSS owns `transform: rotate(var(--tilt))`, the transition
  and the reduced-motion query. Custom properties **inherit**, so setting one on
  `documentElement` themes the page in one assignment.
- Styling many elements: toggle **one class on an ancestor**, or install a real rule with a
  constructable stylesheet (`new CSSStyleSheet()`, `replaceSync`, `adoptedStyleSheets`) — which
  is also how you style inside a shadow root. `styleSheets[0].insertRule` is the older form.

Sources: MDN `Element.classList`, `DOMTokenList`, `DOMTokenList.toggle`, `DOMTokenList.replace`,
`Element.className`, `HTMLElement.dataset`, `HTMLElement.style`, `CSSStyleDeclaration`,
`CSSStyleDeclaration.setProperty`/`getPropertyValue`/`cssText`, `Window.getComputedStyle`,
Using CSS custom properties, `Document.adoptedStyleSheets`.

## 09 · Forms

**Spine:** the platform already does forms — accessible errors, keyboard behaviour, autofill,
encoding. Read the form in one line, validate with the constraint API, submit through the
platform's own event.

**`FormData` — what a *successful control* is.**

- **In:** named, non-disabled controls; `readonly` fields; checked checkboxes/radios; `File`
  objects from file inputs. **Out:** 🔴 **anything without a `name`** (an `id` is not a name —
  silent, and the field still shows up in `form.elements`), disabled controls and everything in a
  disabled `<fieldset>`, **unchecked checkboxes** (no key at all, not `false`), and submit buttons.
- A checked checkbox with no `value` attribute submits the string **`"on"`**.
- **`new FormData(form, submitter)`** includes the pressed button — the way one form does
  Save / Save-and-publish with `<button name="intent" value="publish">`.
- 🔴 **`Object.fromEntries(fd)` loses data**: `FormData` is a **multimap** and only the last value
  for a repeated key survives — checkbox groups, `<select multiple>`, multi-file inputs. Rule:
  `fromEntries` for scalars, **`getAll`** for anything repeatable.
- `form.elements` named access matches **`name` OR `id`** — the asymmetry that makes a field look
  present in the console and be missing from the request. A radio group is a `RadioNodeList`
  whose `.value` is the checked radio's.
- Sending: pass the `FormData` straight to `fetch` and 🔴 **never set `Content-Type` yourself** —
  the browser must generate it because it carries the multipart **boundary**.
  `new URLSearchParams(fd)` for urlencoded (no File entries). Everything out of a form is a
  **string**; `valueAsNumber` / `valueAsDate` for conversion.

**Constraint validation.**

- `checkValidity()` — boolean, **no UI**. `reportValidity()` — same boolean, shows the browser
  bubble and focuses the first invalid control. Both fire `invalid`.
- ⚠️ **The `invalid` event does not bubble** — a form-level listener misses it; listen per control
  or in the capture phase.
- `ValidityState` flags: `valueMissing`, `typeMismatch`, `patternMismatch`, `tooLong`/`tooShort`,
  `rangeOverflow`/`rangeUnderflow`, `stepMismatch`, **`badInput`**, `customError`, `valid`.
  🔴 **`badInput`**: letters in `<input type="number">` leave the text visible on screen while
  **`.value` reads `''`** — the "required field is empty but I filled it in" report.
- `setCustomValidity(msg)` — non-empty ⇒ invalid, `''` clears. 🔴 **The bug is never clearing it**:
  the control stays invalid forever. Assign **unconditionally** on every re-check.
- **`novalidate` disables the browser's blocking and bubbles, not the API** — `checkValidity`,
  `validity` and `validationMessage` still work. That is what makes a custom-styled form possible.
- **`:user-invalid`** matches only after interaction; plain `:invalid` matches every empty
  required field from first paint, which is why people hand-roll blur-based classes.
- 🔴 Client validation is a **UX feature, not a security control** — the server re-validates.

**The events.**

- **`input`** fires on every value change; **`change`** on commit — **blur** for text/textarea
  (and only if the value changed), **immediately** for checkbox/radio/select, on release for
  `range`. Default to `input`.
- ⚠️ **Setting `.value` from code fires neither.** Dispatch
  `new Event('input', {bubbles: true})` if a listener must run. Both events **bubble**, so
  delegation works; `blur` does not — use **`focusout`**.
- **`beforeinput`** is cancelable and carries `inputType`/`data`, so it covers paste, drag-drop
  and IME that key events never see — the right masking tool (though masking is usually the wrong
  product call).
- `submit` fires on the **form** (so a button `click` listener misses Enter and `requestSubmit`),
  carries **`e.submitter`** (`null` for a bare `requestSubmit()`), and native validation runs
  **before** it.
- 🔴 **`form.submit()` skips validation AND the `submit` event**; **`form.requestSubmit()`** does
  both, exactly as a user press would. Also: a control named `submit` **shadows the method**, so
  `form.submit()` throws "not a function".
- `form.reset()` restores **attribute defaults**, not blank. Double submission: disable the
  **button**, not the form — disabled controls leave the `FormData` and disabling steals focus;
  restore in `finally`.

Sources: MDN `FormData` (+ constructor, `getAll`), Using FormData objects, `HTMLFormElement.elements`,
`RadioNodeList`, `URLSearchParams`, Constraint validation guide, `ValidityState`, `checkValidity`,
`reportValidity`, `setCustomValidity`, `:user-invalid`, the `input`/`change`/`beforeinput`/`submit`/`reset`
event pages, `SubmitEvent.submitter`, `HTMLFormElement.requestSubmit`/`submit`.

## 10 · Removing and replacing

**Spine:** removing a node **detaches** it, it does not destroy it — listeners, data and behaviour
survive, and the node is collected only when nothing reachable references it. What removal does
*not* clean up is the whole topic.

**The API.**

- `el.remove()` — **no-op if the node has no parent**, where legacy `parent.removeChild(el)`
  throws **`NotFoundError`**. `old.replaceWith(nodes…)` replaces `replaceChild` (whose argument
  order is reversed). `parent.replaceChildren(…)` swaps all children; **with no arguments it
  clears** — one call, no loop, and **no HTML sink** (unlike `innerHTML = ''`).
- `replaceWith`/`replaceChildren` accept **strings, inserted as text**, never parsed as markup.
- 🔴 **Insertion MOVES**: a node has exactly one parent, so appending an already-parented node
  removes it from where it was. Reordering is `append` in the new order. `cloneNode(true)` is the
  copy.
- 🔴 **`cloneNode` does not copy listeners added with `addEventListener`** (MDN). It *does* copy
  attributes — including inline `onclick` — so a clone can look like it kept its behaviour. A
  cloned `<input>` carries the `value` **attribute** (the default), not the typed value.
- Update **the smallest subtree that changed** — `row.replaceWith(newRow)`. A full rebuild
  discards focus, text selection, scroll position inside the list and in-progress transitions;
  it only wins when most rows changed.
- `querySelectorAll` returns a **static** NodeList (safe to iterate while removing); `children`
  is live and is not.

**What removal does not clean up.**

- **Detached-node leak**: the node is out of the document and still referenced — by a `Map`/cache,
  by a closure held by a listener on a **surviving** target (`window`, `document`, a parent), by
  an observer, or by a timer. A listener on the removed node itself is *not* the leak; it goes
  when the node becomes unreachable. DevTools has a **Detached elements** view.
- 🔴 **`AbortController` is the teardown**: `addEventListener(…, { signal })`, then one
  `controller.abort()` removes **every** listener registered with that signal on any number of
  targets — and the same signal cancels a `fetch`. It also sidesteps the **`removeEventListener`
  identity trap** (an inline arrow or a fresh `.bind()` is a different reference, so removal
  silently does nothing). `{ once: true }` is the other self-removing form.
  `AbortSignal.timeout(ms)` for a deadline.
- Observers hold their targets: `unobserve`/`disconnect` for `IntersectionObserver`,
  `ResizeObserver`, `MutationObserver` — disconnect where you remove.
- Timers and `requestAnimationFrame` loops need explicit stops; **`node.isConnected`** is a
  reasonable rAF stop condition.
- **Delegation removes the problem structurally** — one listener on a container that outlives the
  children means nothing to attach, detach, or capture per row. Give this answer first.
- **`WeakMap`, not `Map`, for per-node data** — weak keys, so the entry vanishes with the node.
- ⚠️ **Removing the focused element sends focus to `<body>`**, destroying the keyboard position
  (and a screen-reader user's place). Capture `row.contains(document.activeElement)` *before*
  (`contains` counts the node itself) and move focus deliberately afterwards.

Sources: MDN `Element.remove`, `Node.removeChild`, `Element.replaceWith`, `Node.replaceChild`,
`Element.replaceChildren`, `Node.cloneNode`, `Node.appendChild`, `EventTarget.addEventListener`,
`AbortController`, `AbortSignal`, `IntersectionObserver.disconnect`, `ResizeObserver`,
`MutationObserver.disconnect`, `WeakMap`, `Node.isConnected`.

## 11 · Batching DOM work

**Spine:** the syllabus row is **two** problems — (a) touch the live document as few times as
possible, and (b) do not hold the main thread so long the page stops responding. Batching solves
only (a). ⚠️ Page carries **no timings** by design.

**Building off-document.**

- `DocumentFragment` is a parentless node with the `ParentNode` API. Inserting it **moves its
  children and leaves it empty** — it is **one-use**. Its children have **no layout**:
  `isConnected` is `false` and `getBoundingClientRect()` returns zeros, so **you cannot measure
  before insertion**.
- `<template>`: content is parsed into a **separate inert fragment** — **images are not fetched,
  scripts do not run, nothing is styled or rendered** until cloned into a live document (a hidden
  `<div>` does fetch). 🔴 **`tpl.content` is the live fragment** — using it directly moves the
  template's children out and only the first row ever appears. **Always `cloneNode(true)`**
  (shallow clone gives an empty fragment). Templates also sidestep the HTML parser's
  **table-context** restrictions on `<tr>`.
- `append`/`prepend` are **variadic and accept strings as text**; `replaceChildren(...nodes)` is
  the one-call full render (fragment when *adding*, `replaceChildren` when *replacing*).
- `insertAdjacentHTML` is a **sink**. And **`innerHTML +=` serialises and re-parses the whole
  container**, destroying and recreating every existing node — losing listeners, focus and
  identity.
- ⚠️ Do **not** claim a fragment is faster with a number: engines already coalesce and do not lay
  out per statement. The honest framing used on the page is "the shape that cannot go wrong"; the
  version that genuinely hurts is append-then-read-back (layout thrashing, topic 12).

**Not freezing the page.**

- JS and rendering share one thread. **Long task = more than 50 ms** on the main thread
  (Long Tasks API, observable via `PerformanceObserver` `entryTypes: ['longtask']`).
- 🔴 **Batching does not fix the JavaScript cost** — 10,000 rows into a fragment is still one
  uninterrupted task.
- Answer order: **(1) do not build what nobody sees** — paginate/virtualise,
  **`content-visibility: auto`** (+ `contain-intrinsic-size` or the scrollbar jumps), an
  `IntersectionObserver` sentinel; **(2) chunk and yield**; **(3) coalesce** repeated events.
- 🔴 **`await Promise.resolve()` is NOT a yield** — a microtask resumes in the same task, before
  rendering. Yields: `setTimeout(…,0)` (universal), `requestAnimationFrame` (frame-aligned work),
  `requestIdleCallback` (**support not universal**), `scheduler.postTask()` (prioritised,
  **check support**).
- Scroll/resize: coalesce into at most one `rAF` per frame with a **queued flag** and register
  `{ passive: true }`; better, use `ResizeObserver`/`IntersectionObserver`, already frame-aligned.
- **Web Workers cannot touch the DOM** — they do the computation and return data; the main thread
  still renders it in chunks.

Sources: MDN `DocumentFragment` (+ constructor), `<template>`, `HTMLTemplateElement.content`,
`Node.cloneNode`, `Element.append`, `Element.replaceChildren`, `Node.isConnected`,
`PerformanceLongTaskTiming`, `Window.requestAnimationFrame`, `Window.requestIdleCallback`,
`Scheduler.postTask`, `IntersectionObserver`, CSS `content-visibility`, Web Workers API.

## 12 · Layout thrashing

**Spine:** the browser **batches writes and lays out once**; reading a geometry property while
writes are pending forces layout **now**. Alternating them in a loop turns `n` iterations into `n`
layout passes. 🔴 **Independent of batching** — you can build off-document, insert once, and still
thrash.

**What forces it.** Anything returning a geometry, a resolved style or a scroll position:

- element: `offsetTop/Left/Width/Height`, `offsetParent`; `clientTop/Left/Width/Height`;
  `scrollTop/Left/Width/Height`; `getBoundingClientRect()`, `getClientRects()`;
  `scrollBy/scrollTo/scrollIntoView`; 🔴 **`innerText`** and **`focus()`**.
- window/document: `getComputedStyle()`, `scrollX/Y`, `innerWidth/Height`, `visualViewport`,
  `document.scrollingElement`, `document.elementFromPoint()`.
- **Not** forcing: reading `el.style.*` (the inline attribute you wrote), `className`, `dataset`,
  `textContent`, attributes.
- 🔴 **`innerText` vs `textContent`** is a *performance* boundary as well as a safety one —
  `innerText` returns text **as rendered** (honours `display:none`, line breaks), so it needs
  layout.
- Style and layout invalidate **separately**: geometric writes dirty layout; paint-only writes
  (`color`, `background`, `box-shadow`) do not; `transform`/`opacity` on a composited element can
  skip both.

**Recognising it.** DevTools performance panel: a **Layout / Recalculate Style block inside a
scripting task**, flagged *forced reflow*, **with a stack trace**. Visual signature is a
**sawtooth**. ⚠️ The forcing read is often several frames of the stack away from the write — do
not guess. (Deliberate use: `void el.offsetWidth` between `classList.remove` and `add` to restart
a CSS animation, because both writes otherwise coalesce; modern alternative
`el.getAnimations().forEach(a => a.cancel())` / WAAPI.)

**Fixing it.**

- **Read phase, then write phase**, never alternate. 🔴 Batching "not working" is almost always a
  **callee** in the write phase that reads geometry (a helper, a `measure()`, a `console.log` of a
  rect).
- `requestAnimationFrame` runs **before** that frame's style/layout/paint — right place for
  writes, and **not a barrier**: a read after a write inside the same callback still forces.
  **Double-`rAF`** to measure what your writes did.
- **`ResizeObserver` / `IntersectionObserver` deliver after layout**, so reading their entries
  costs nothing — they replace "measure everything on scroll/resize", which is the most common
  real-world thrash. ⚠️ *"ResizeObserver loop completed with undelivered notifications"* means the
  callback changes the size it observes.
- **Animate `transform`/`opacity`** (compositor) — animating `left/top/width/height/margin`
  invalidates layout every frame. `will-change`: MDN says **sparingly, as a last resort**.
  `Element.animate()` (WAAPI) runs off the main thread for compositor-friendly properties.
- **CSS `contain: layout paint`** bounds the blast radius; `content-visibility: auto` +
  `contain-intrinsic-size` skips off-screen rendering entirely — the fix needing **no JavaScript**.
- Order to try: don't measure → don't animate layout properties → batch → contain → profile.

Sources: MDN `getBoundingClientRect`, `offsetWidth`, `clientWidth`, `scrollTop`, `getComputedStyle`,
`innerText`, `scrollIntoView`, `requestAnimationFrame`, `ResizeObserver`, `IntersectionObserver`,
CSS `contain`, CSS `will-change`, Web Animations API, `Element.animate`; plus web.dev
*Avoid large, complex layouts and layout thrashing* and Paul Irish's *What forces layout/reflow*
gist for the enumeration.

## 13 · Measuring elements

**Spine:** four ways to ask an element's size, four different answers.
🔴 **`getBoundingClientRect()` tells you what is ON SCREEN; `offset`/`client`/`scroll` tell you
what LAYOUT says** — a transformed element makes them disagree by design. Every read here is on
the forced-layout list (topic 12).

| Family | Box | Type | Transforms |
|---|---|---|---|
| `getBoundingClientRect()` | border box, as rendered | **fractional** `DOMRect` | **yes** |
| `offset*` | border box, as laid out | rounded int | no |
| `client*` | padding box (no border, **no scrollbar**) | rounded int | no |
| `scroll*` | full content incl. overflow | rounded int | no |

- **Margin is in none of them** — read it from `getComputedStyle` if needed.
- Rect coordinates are **viewport-relative**; document position is
  `rect.top + window.scrollY`. 🔴 **Do not sum `offsetTop`** — it is relative to **`offsetParent`**
  (nearest positioned ancestor), so it changes when an ancestor gains `position: relative`.
- **All zeros** for `display:none` or a node still in a `DocumentFragment` (no layout box);
  ⚠️ **`visibility: hidden` DOES have a box** — the trick for measuring something invisible.
- Scrollbar width on an element = `offsetWidth − clientWidth − borders`.
- 🔴 **At-bottom needs a ~1 px tolerance**: `scrollTop` can be fractional while `scrollHeight`/
  `clientHeight` are integers — exact equality fails intermittently (the infinite-scroll bug that
  only reproduces on someone else's machine).
- **`getClientRects()` returns one rect per line box** for a wrapped inline;
  `getBoundingClientRect()` is their union, which covers empty space at line ends (wrong for a
  first-line tooltip).
- ⚠️ `ResizeObserver` `entry.contentRect` is the **content** box — smaller than a bounding rect by
  the padding; `entry.borderBoxSize[0]` is the comparable one.

**Viewports and device pixels.**

- **Two coordinate systems**: viewport (`getBoundingClientRect`, `clientX/Y`, `elementFromPoint`)
  and document (`pageX/Y`, rect + `scrollY`). Which one you need is decided by the CSS —
  **viewport for `position: fixed`, document for `position: absolute`**. A tooltip that drifts on
  scroll is this bug.
- Three widths: `window.innerWidth` (**includes** the classic scrollbar) ·
  `document.documentElement.clientWidth` (**excludes** it) · `visualViewport.width` (after
  pinch-zoom). Their difference **is** the scrollbar width, and it is why the page jumps when a
  modal sets `overflow: hidden` (fix: pad by it, or CSS `scrollbar-gutter: stable`).
- 🔴 **CSS media queries use the `clientWidth` number**, so a JS breakpoint written with
  `innerWidth` disagrees with the stylesheet at the boundary. **Use `matchMedia`** — the same
  evaluation the stylesheet uses.
- **`visualViewport`** is the only API reporting pinch-zoom and the mobile keyboard (`height`,
  `offsetTop`, `scale`, own `resize`/`scroll` events) — `innerHeight` is the *layout* viewport, so
  a fixed bottom bar hides behind the keyboard without it.
- **`devicePixelRatio`**: canvas buffer = CSS size **× dpr**, CSS size kept for display, then
  `ctx.scale(dpr, dpr)` so drawing stays in CSS pixels. ⚠️ **Assigning `canvas.width` resets the
  entire 2D context state**, so `scale` must come after. 🔴 **DPR is not constant** (zoom, moving
  to another monitor) and **there is no change event** — the documented pattern is a
  `matchMedia('(resolution: Ndppx)')` listener with `{ once: true }` that **re-registers itself**
  for the new ratio.

Sources: MDN `getBoundingClientRect`, `DOMRect`, `getClientRects`, `offsetWidth`, `offsetParent`,
`clientWidth`, `scrollWidth`, `scrollHeight`, `ResizeObserver`, `Window.innerWidth`,
`Window.scrollY`, `VisualViewport`, `Window.devicePixelRatio`, `Window.matchMedia`,
`Document.elementFromPoint`.
