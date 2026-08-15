---
title: "01 · window and document"
sidebar_label: "01 · window and document"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Window`](https://developer.mozilla.org/en-US/docs/Web/API/Window), [`globalThis`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/globalThis), [`Document`](https://developer.mozilla.org/en-US/docs/Web/API/Document), [`Document.readyState`](https://developer.mozilla.org/en-US/docs/Web/API/Document/readyState), [`Window.open()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/open), [`Window.matchMedia()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia), [`isSecureContext`](https://developer.mozilla.org/en-US/docs/Web/API/isSecureContext), [`Document.write()`](https://developer.mozilla.org/en-US/docs/Web/API/Document/write). Documentation-validated; **no timings and no console output**.

`window` is two things at once — **the global object** and **the browsing context** — and that
double life explains most of its oddities. `document` is the page itself. Both accumulated
twenty-five years of API, and the useful part is a small fraction of what is on them.

## `window` as the global object

Every `var` and every function declaration at top level becomes a property of `window`; `let`,
`const` and `class` do not ([Phase 0 · 06 · Hosts and globals](../../phase-0-how-javascript-runs/06-hosts-and-globals.md)).

🔴 **Write `globalThis`, not `window`.** It is the same object in a page and the correct name
everywhere else — a worker, Node, a Deno script. Code that says `window` is code that cannot move
([07 · Web Workers](../07-web-workers/01-starting-and-talking.md)).

⚠️ **Named access is real and it is a trap.** Every element with an `id` (and every `name` on
forms, images and iframes) becomes a property of `window`:

```html
<div id="config"></div>
<script>
  console.log(config);       // the <div>, not undefined
  var config = loadConfig(); // 🔴 depending on order, one silently wins
</script>
```

That is why a variable named `name`, `top`, `status`, `length`, `origin`, `closed` or `history`
behaves strangely at top level — those are pre-existing window properties, and some of them
(`window.name` is a string) coerce whatever you assign. **Declare with `const`/`let` inside a
module and none of this can reach you.**

## The `window` members worth knowing

| Member | What it is for |
|---|---|
| `location` | the URL, and `assign`/`replace`/`reload` — a real navigation ([08](../08-history-and-routing/01-the-history-api.md)) |
| `matchMedia(q)` | evaluate a media query in JS, with a `change` event |
| `getComputedStyle(el)` | resolved styles — read-only, and forces layout |
| `devicePixelRatio` | CSS pixels → device pixels; **changes** with zoom and monitor |
| `innerWidth` / `innerHeight` | viewport **including** the scrollbar |
| `scrollX` / `scrollY` | current scroll position |
| `isSecureContext` | whether the powerful APIs are even available |
| `crypto`, `structuredClone`, `queueMicrotask`, `requestAnimationFrame` | platform utilities, all also present in workers |
| `frames`, `parent`, `top`, `opener` | the browsing-context relationships |

⚠️ **`innerWidth` includes the scrollbar and a media query does not**, so a JavaScript breakpoint
disagrees with the stylesheet by a scrollbar's width at the boundary. `matchMedia` with the same
query string is the fix ([Phase 9 · 13 · 02 · Viewports and device pixels](../../phase-9-dom/13-measuring-elements/02-viewports-and-device-pixels.md)).

**`devicePixelRatio` has no event.** The documented way to be told when it changes is a media
query on resolution, re-registered each time it fires:

```js
function watchDPR(onChange) {
  const mq = matchMedia(`(resolution: ${devicePixelRatio}dppx)`);
  mq.addEventListener('change', () => { onChange(devicePixelRatio); watchDPR(onChange); }, { once: true });
}
```

### `window.open`, and the popup rules

```js
const child = window.open(url, '_blank', 'noopener,popup');
if (!child) showFallbackLink();          // blocked — plan for it
```

- **Popups are blocked unless the call is in a user gesture**, and `open()` returns `null` when it
  is blocked. Never assume a window object came back.
- 🔴 **`noopener` matters.** Without it the opened page can reach back through `window.opener` and
  navigate the opener — the classic tabnabbing vector. Modern browsers imply `noopener` for
  `target="_blank"` links, but not for `window.open`. The security argument is
  [02 · Client-side security](../02-client-side-security/README.md).
- `window.close()` only works on a window your script opened.

### `alert`, `confirm`, `prompt`

They **block the event loop entirely** — no timers, no rendering, no messages. They are also
suppressed inside cross-origin iframes and increasingly restricted. Use them for a throwaway
debug check, never in a product; a dialog is `<dialog>`
([Phase 9 · 16 · Dialog, popover, inert](../../phase-9-dom/16-dialog-popover-inert/README.md)).

## `document`, and the states it moves through

| `readyState` | Meaning |
|---|---|
| `'loading'` | still parsing HTML |
| `'interactive'` | parsed; `DOMContentLoaded` fires here |
| `'complete'` | subresources finished; `load` fires |

```js
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();                                   // 🔴 already past it — the event will never come
}
```

**That branch is the whole point.** A deferred or dynamically-inserted script often runs *after*
`DOMContentLoaded`, and a listener registered then never fires. The lifecycle in full is
[Phase 10 · 10 · Page lifecycle](../../phase-10-events/10-page-lifecycle/01-startup.md).

### The `document` members worth knowing

| Member | Note |
|---|---|
| `documentElement`, `head`, `body` | `body` is `null` while `readyState === 'loading'` |
| `activeElement` | what has focus right now |
| `visibilityState` | `'visible'` / `'hidden'` — the throttling signal ([03 · Timers](../03-timers-and-frames/01-timers.md)) |
| `title` | must be updated by a client-side router ([08](../08-history-and-routing/02-building-a-router.md)) |
| `referrer` | where this document came from — empty when the referrer policy suppresses it |
| `cookie` | a string API over cookies — **Phase 11 · 09 · Cookies** *(not written yet)* |
| `characterSet`, `contentType` | what the parser decided |
| `document.forms`, `images`, `links` | live `HTMLCollection`s — legacy, but occasionally handy |

### The legacy corner, and why it is dangerous

| Legacy | Why to avoid it |
|---|---|
| `document.write()` | after load it **replaces the whole document**; browsers may block it for cross-origin scripts on slow connections |
| `document.all` | a falsy object kept alive purely for old scripts |
| `document.designMode` | whole-document editing; `contenteditable` is the real feature |
| `document.domain` | deprecated and being removed — it weakened same-origin |
| `document.execCommand` | deprecated; the Clipboard API and Selection API replace it |

## Frames, and the boundary between them

`window.parent`, `window.top` and `window.frames` reach across frames — and **cross-origin those
references are almost entirely inert**. What survives is `postMessage`, and only with an origin
check on both ends:

```js
iframe.contentWindow.postMessage(data, 'https://widget.example.com');   // target origin, not '*'

addEventListener('message', (e) => {
  if (e.origin !== 'https://widget.example.com') return;                // 🔴 always
  handle(e.data);
});
```

That is **Phase 11 · 14 · Same-origin and `postMessage`** *(not written yet)*; the security
framing is [02 · Client-side security](../02-client-side-security/README.md).

**`window.top !== window.self` is the frame-busting check**, and it is advisory — the real
protection against being framed is a `X-Frame-Options` or CSP `frame-ancestors` header from the
server.

## Gotchas

**Symptom: a top-level variable mysteriously holds a DOM element.**
Cause — named access: an element `id` became a window property, and declaration order decided the
winner.
Fix — write modules; declare with `const`/`let`; do not use bare top-level `var`.

**Symptom: an initialisation function never runs.**
Cause — the script ran after `DOMContentLoaded` had already fired.
Fix — branch on `document.readyState` before adding the listener.

**Symptom: `document.body` is `null`.**
Cause — the script ran during parsing, before `<body>` existed.
Fix — `defer`, a module script, or the `readyState` branch.

**Symptom: `window.open` returned `null`.**
Cause — the popup was blocked because the call was not in a user gesture.
Fix — open from a click handler; always handle `null` with a visible fallback link.

**Symptom: a canvas is blurry after moving the window to another monitor.**
Cause — `devicePixelRatio` changed and nothing recomputed.
Fix — the resolution `matchMedia` watcher, or `ResizeObserver` with `device-pixel-content-box`
([05 · 01](../05-resizeobserver/01-element-level-responsiveness.md)).

**Symptom: a JS breakpoint disagrees with the stylesheet by a few pixels.**
Cause — `innerWidth` includes the scrollbar.
Fix — `matchMedia` with the stylesheet's own query.

**Symptom: the page goes blank when a late script runs.**
Cause — `document.write()` after load replaces the document.
Fix — DOM insertion instead; there is no case for `document.write` in new code.

## Interview questions

**★ What is `window`, exactly?**
Both the global object for the page's scripts and the browsing context (its viewport, history,
frames and location). `globalThis` is the portable name for the first role, and the one to write.

**★ Why can a global variable collide with the DOM?**
Named access: elements with an `id` or `name` become properties of the window object. Combined
with `var` hoisting at top level, that produces a variable that is silently a DOM node — and it is
one of the reasons module scope exists.

**★ How do you initialise safely no matter when your script runs?**
Check `document.readyState`: if it is still `'loading'`, listen for `DOMContentLoaded`; otherwise
call the initialiser directly. A listener added after the event has fired never runs.

**★ What is wrong with `window.open(url, '_blank')` without `noopener`?**
The opened page gets `window.opener` and can navigate the page that opened it — tabnabbing.
Links with `target="_blank"` get `noopener` implicitly in modern browsers; `window.open` does not.

**★ How do you detect a change in `devicePixelRatio`?**
There is no event. Register a `matchMedia('(resolution: Xdppx)')` listener at the current value
and re-register when it fires — because after the change the old query no longer matches.

**Why avoid `document.write`?**
After the document has loaded it replaces the whole document, and browsers may block it for
cross-origin scripts on slow connections. Nothing needs it.

---

[Topic index](./README.md) · [02 · navigator and screen](./02-navigator-and-screen.md) →
