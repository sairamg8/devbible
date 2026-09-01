---
title: "The flash, and the script that has to run before paint"
sidebar_label: "03 · The flash and the boot"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against MDN —
> [`Window.localStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage),
> [the `color-scheme` meta value](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta/name),
> [render-blocking behaviour of `<script>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script),
> and [CSP `script-src`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/script-src) —
> and the **W3C CSS Color Adjustment Level 1** specification.
> Client build and `index.html` come from
> [Vite](../../../../vite/README.md); the API's security headers are
> [chapter 3·01](../../phase-3-express-api/01-project-structure.md).
> No sandbox, no measured timings.

**Every stored-theme implementation has the same bug on its first day: the page
paints light, then flips to dark.** The cause is structural rather than
careless. The stylesheet resolves against `:root` with no attribute on it, which
is the *system* state from chapter [01](01-three-states-not-two.md) — and the
stored override lives in `localStorage`, which only JavaScript can read. If that
JavaScript is the application bundle, it runs long after first paint, and the
user watches the correction happen.

**The fix is the one piece of render-blocking script this storefront ships on
purpose**, and everything about it — inline, synchronous, in `<head>`, wrapped
in `try`, and hashed in the CSP — follows from that single requirement.

## Why the obvious placements do not work

| Where the theme is applied | What the user sees |
|---|---|
| React effect after hydration | full light paint, then a flip — the worst case |
| Module `<script type="module">` in `<head>` | deferred by definition; still after first paint |
| `<script defer>` | deferred until parsing completes; still after first paint |
| External `<script>` in `<head>` | blocks, but adds a network round trip before *anything* paints |
| **Inline, synchronous, in `<head>`, before the stylesheet** | **no flash, no request** |

A module script is deferred whether or not `defer` is written, which is the trap
in a Vite app where every other script tag is `type="module"`. **The theme
script is the one tag that must be a classic inline script.**

## The script

```html
<!-- index.html, in <head>, BEFORE the stylesheet link -->
<script>
  try {
    var t = localStorage.getItem('theme');
    if (t === 'light' || t === 'dark') {
      document.documentElement.setAttribute('data-theme', t);
    }
  } catch (e) {}
</script>
```

Nine lines, and every one of them is load-bearing.

**`try`/`catch` around the read.** Accessing `localStorage` can *throw* rather
than return `null` — a browser configured to block site data, or a privacy mode
that exposes the property but refuses access. An uncaught throw here is a
parser-blocking error in `<head>`, which is a blank page rather than a wrong
theme. **The catch is deliberately empty**: there is no recovery, and the
correct fallback is exactly what happens if the script does nothing.

**The value is validated, not trusted.** `localStorage` is user-writable.
Passing an arbitrary string into `setAttribute` cannot inject markup, but it can
produce `data-theme="garbage"` — which chapter 01's block 2 guard reads as "not
light", so a garbage value silently pins a dark-system user to dark forever.
Whitelisting the two legal strings closes that.

**Nothing is stamped when there is no stored choice.** This is the *system*
state, and leaving the attribute off is what lets CSS track live OS changes with
no listener at all — see [chunk 05](05-persisting-and-syncing.md).

**It runs before the stylesheet link.** Both orders avoid the flash in practice,
because CSS does not paint until the stylesheet has loaded anyway. Putting the
script first is the version that stays correct if the stylesheet is ever
inlined.

## The meta tag, for the moment before CSS exists

```html
<meta name="color-scheme" content="light dark">
```

`color-scheme` is set in CSS by all three theme blocks, but CSS arrives after
the HTML. In the window before the stylesheet resolves, the browser paints the
canvas — and without this meta it paints white. On a dark-system visitor that is
a white flash the script cannot prevent, because the script sets `data-theme`,
not `color-scheme`.

The meta declares support for both schemes so the UA can pick the system one
immediately. It cannot express the *stored override* — it is static HTML — so a
light-system visitor who chose dark still sees a brief light canvas. Closing
that last gap means having the script set `document.documentElement.style
.colorScheme` too:

```js
if (t === 'light' || t === 'dark') {
  document.documentElement.setAttribute('data-theme', t);
  document.documentElement.style.colorScheme = t;   // beats the meta immediately
}
```

## Content Security Policy

An inline script is exactly what `script-src` exists to block, so shipping one
means saying so explicitly. Two options:

**A hash**, which suits a static bundle with no server templating:

```
script-src 'self' 'sha256-<base64 digest of the exact script text>'
```

**A nonce**, if `index.html` is served through the API and can be templated per
response:

```html
<script nonce="{{cspNonce}}"> … </script>
```

🔴 **A hash pins the script text byte for byte.** Change a space, and the page
loses its theme script — silently, because CSP violations do not stop the page.
The hash therefore has to be *generated by the build* from the file it is
protecting, never pasted. A hand-maintained hash is a flash bug waiting for the
next whitespace edit.

Never reach for `'unsafe-inline'` to make this work. It disables the protection
for every inline script on the page, to save one hash.

## The toggle control cannot render its own state

The script fixes the *page*. The control is a second problem: a button labelled
"Dark" must know the current theme, and on a server-rendered page the server
does not — the choice is in the client's `localStorage`. Rendering a guess
produces a hydration mismatch and a visible label flip.

**The storefront renders all three states and lets CSS choose**, so the label is
correct at first paint with no JavaScript state at all:

```html
<button class="theme-toggle" aria-live="polite">
  <span data-when="system">Auto</span>
  <span data-when="light">Light</span>
  <span data-when="dark">Dark</span>
</button>
```

```css
.theme-toggle [data-when]                                { display: none; }
:root:not([data-theme]) .theme-toggle [data-when="system"] { display: inline; }
:root[data-theme="light"] .theme-toggle [data-when="light"] { display: inline; }
:root[data-theme="dark"]  .theme-toggle [data-when="dark"]  { display: inline; }
```

The same three-state selector structure as the tokens, applied to content. The
click handler still lives in React — it writes storage and updates the
attribute — but **the rendered label is never React's state**, so there is
nothing to mismatch.

## If the app is server-rendered

This storefront's client is a static bundle, so the script in `index.html` is
the whole story. Under SSR the constraint changes shape: the server still cannot
know the stored theme on a first visit, so it must render the neutral,
attribute-free markup and let the same inline script correct it before paint.
**What must not happen is the server rendering theme-dependent markup from a
cookie while the client reads `localStorage`** — two sources of truth that
disagree on exactly the visitor who changed the setting in another tab. If the
theme must reach the server, it moves to a cookie and `localStorage` is dropped
entirely; running both is the bug.

## Gotchas

### The theme flips after the page renders
**Symptom.** Light paints, then dark, on every load.
**Cause.** The attribute is applied by application JavaScript — a React effect,
or a `type="module"` script, both of which run after first paint.
**Fix.** A classic inline synchronous script in `<head>`. `type="module"` is
deferred by definition and cannot do this job.

### The page is blank in a browser with site data blocked
**Symptom.** Nothing renders at all for a small subset of users.
**Cause.** `localStorage` access threw in `<head>`, and the throw is
parser-blocking.
**Fix.** `try`/`catch` with an empty catch. Doing nothing is the correct
fallback.

### A dark-system user is stuck in dark after clearing the setting
**Symptom.** The system state stops following the OS.
**Cause.** A junk value in storage — `"Dark"`, `"true"`, a stale
`"system"` string — passed straight into `setAttribute`. Chapter 01's guard
reads any non-`light` value as "not light", so the media block still applies and
the attribute pins it.
**Fix.** Whitelist the two legal values.

### The flash returned after a CSS refactor
**Symptom.** No code change to the theme script, and the flash is back.
**Cause.** The script's CSP hash no longer matches — a formatter reindented the
inline block. The violation is silent.
**Fix.** Generate the hash in the build from the file it protects.

### A white canvas still flashes on a dark-system phone
**Symptom.** Brief white before the dark page, even with the script working.
**Cause.** The script sets `data-theme`, but the canvas colour before CSS
resolves comes from `color-scheme` — which no CSS has applied yet.
**Fix.** The `color-scheme` meta tag, plus setting
`documentElement.style.colorScheme` in the script for the override case.

### The toggle label says the wrong thing for a moment
**Symptom.** "Light" flips to "Dark" after hydration.
**Cause.** The label is React state derived from storage, which is unavailable
during render.
**Fix.** Render all three labels; let the same `data-theme` selectors reveal
one.

### `'unsafe-inline'` was added to make the script work
**Symptom.** Nothing — it works, which is the problem.
**Cause.** Reaching for the blanket allowance instead of a hash or nonce.
**Fix.** Hash for a static bundle, nonce if the HTML is templated per response.

## Interview questions

**Why must the theme script be inline and synchronous?**
Inline because an external script adds a network round trip before first paint;
synchronous because anything deferred — including every `type="module"` script —
runs after first paint, which is precisely the flash being avoided.

**Why is the `catch` block empty?**
Because `localStorage` access can throw outright, and there is no recovery: not
stamping the attribute is exactly the correct fallback. What matters is that the
throw does not escape, since an uncaught error in `<head>` blocks parsing.

**Why validate the stored value before using it?**
It is user-writable. A junk value is not an injection risk through
`setAttribute`, but it *is* read as "not light" by the media-query guard, which
silently pins a dark-system visitor to dark and stops the system state tracking
the OS.

**The script works and there is still a white flash on a dark phone. Why?**
The canvas before CSS resolves is painted from `color-scheme`, which the script
does not set. The `color-scheme` meta covers the system case; setting
`style.colorScheme` in the script covers the override case.

**Why does a CSP hash break more often than a nonce?**
It pins the script text byte for byte, so any reformatting invalidates it — and
CSP violations do not stop the page, so the failure surfaces as a returning
flash rather than an error. Generate it in the build.

**How does the toggle button label avoid a hydration mismatch?**
By not being JavaScript state. All three labels are rendered and the same
`data-theme` selectors that theme the page reveal the right one, so first paint
is already correct.

**Under SSR, why not read the theme from a cookie on the server?**
That is fine — as long as the cookie is then the *only* source. Running a
server-read cookie alongside a client-read `localStorage` gives two sources that
disagree for the visitor who changed the setting elsewhere.

---

← Prev: [Deriving and deduplicating](02b-deriving-and-deduplicating.md) · Index: [Dark mode](README.md) · Next → [Images, media and controls](04-images-media-and-controls.md)
