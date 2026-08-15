---
title: "02 · Progressive enhancement, and degrading without breaking"
sidebar_label: "02 · Progressive enhancement"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [Progressive enhancement (glossary)](https://developer.mozilla.org/en-US/docs/Glossary/Progressive_Enhancement), [Graceful degradation (glossary)](https://developer.mozilla.org/en-US/docs/Glossary/Graceful_degradation), [Polyfill (glossary)](https://developer.mozilla.org/en-US/docs/Glossary/Polyfill), [`@supports`](https://developer.mozilla.org/en-US/docs/Web/CSS/@supports), [`<script type="module">` and `nomodule`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script), [Dynamic import](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import), [Baseline](https://developer.mozilla.org/en-US/docs/Glossary/Baseline/Compatibility). Documentation-validated; **no timings and no console output**.

Detection tells you what the browser can do. **Progressive enhancement is the architecture that
makes the answer survivable** — a page whose core works before the enhancement arrives, and still
works if it never does.

## The layers, and what belongs in each

| Layer | Owns | Fails to |
|---|---|---|
| **HTML** | content, semantics, forms, links | a page that still reads and submits |
| **CSS** | layout, theme, motion | an unstyled but usable document |
| **JavaScript** | interaction that genuinely needs script | the layer below |

🔴 **The test is not "does it work without JavaScript" — it is "what does the user get while
JavaScript is loading, or when it fails".** Scripts fail for ordinary reasons: a flaky connection,
a blocked CDN, an extension, a syntax error in one bundle, a browser two versions older than your
transpile target. Progressive enhancement is a reliability strategy first and a philosophy second.

**Progressive enhancement** builds up from a working core. **Graceful degradation** starts from
the full experience and patches the gaps. Both are legitimate; the first tends to produce a
smaller, more testable fallback, because the fallback is the thing you built first.

## The shape, concretely

```html
<!-- works with no JS: a real link to a real page -->
<a href="/products/42" data-enhance="modal">View details</a>
```

```js
if (supports.dialog) {
  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-enhance="modal"]');
    if (!link || e.metaKey || e.ctrlKey || e.button !== 0) return;   // 🔴 the router guards again
    e.preventDefault();
    openInModal(link.href);
  });
}
```

**The enhancement attaches to markup that already worked.** Contrast with the common inversion:
rendering `<div onclick>` from script, which has no fallback because there was never anything to
fall back to.

**Three patterns worth naming:**

- **Enhance forms, do not replace them.** A `<form action method>` that posts works everywhere;
  intercept `submit` to do it with `fetch` and stay on the page. The failure mode is a full page
  load — inconvenient, not broken.
- **Custom elements upgrade in place.** Ship real content inside the element; `connectedCallback`
  enhances it when (and if) the script arrives. Nothing is blank in the meantime.
- **`@supports` in CSS for layout**, so the enhancement decision lives beside the code it affects
  rather than in a class toggled from JavaScript.

⚠️ **The failure that undoes all of it: an enhancement that hides content.** `opacity: 0` waiting
for a reveal, `display: none` until hydration, a list rendered only after a fetch — each turns a
script failure into a blank page. Start visible; let the script animate, not reveal
([04 · 02 · The patterns](../04-intersectionobserver/02-the-patterns.md)).

## Polyfill, ponyfill, or neither

| | What it is | Cost |
|---|---|---|
| **Polyfill** | patches the global so standard code works | global mutation; wrong in a shared page; ships to everyone if unconditional |
| **Ponyfill** | exports the behaviour as a normal function you import | no global effects; call sites must use it |
| **Neither** | detect and degrade | zero bytes, and the honest option more often than people expect |

🔴 **Load polyfills conditionally, with `await import()`:**

```js
if (!('at' in Array.prototype)) await import('./polyfills/array-at.js');
```

The check must be **cheap and synchronous**, and the import only runs for browsers that need it —
so the modern majority pays nothing. A polyfill bundle imported unconditionally is a tax on every
user for the benefit of a few.

⚠️ **Some things cannot be polyfilled**, and pretending otherwise is worse than degrading: real
threads, `SharedArrayBuffer` without the isolation headers, codecs, WebCrypto primitives, anything
requiring a permission or a new rendering behaviour. For those the answer is a different design,
not a shim.

**`<script type="module">` with `nomodule`** is still the cleanest way to serve two builds: modern
browsers ignore `nomodule`, old ones ignore the module script. Whether the legacy build is worth
building at all is a question about your actual traffic, not about principle.

## Deciding what to enhance with: Baseline

The practical question is not "is this supported" but "is it supported *for my users*". Two inputs:

- **Baseline** — MDN and the web platform community classify features as *newly available*
  (in all major engines now) or *widely available* (for long enough that adoption is safe). It is
  the closest thing to a shared rule of thumb.
- **Your own analytics.** They beat any general chart, because they describe the browsers that
  actually visit you.

**A feature that is newly available is a fine enhancement and a poor foundation.** Use it behind a
check where it improves things; do not make the core depend on it until it is widely available.

## Testing both paths

**Whatever the fallback is, it must be exercised in CI.** The capability module from
[01 · Detecting a capability](./01-detecting-a-capability.md) exists for exactly this: stub it, run
the suite twice, and the "no `IntersectionObserver`" path stops being theoretical.

Three cheap manual checks worth doing once per feature:

1. **Block the script** in DevTools and reload — does the page still work?
2. **Throttle to slow 3G** — what does the user see before the enhancement lands?
3. **Force the fallback** via the stub — is it usable, or merely present?

## Gotchas

**Symptom: the page is blank when one bundle fails to load.**
Cause — content is rendered by script that never ran, or hidden until hydration.
Fix — ship content in HTML; enhance in place; never use `display: none`/`opacity: 0` as a "until
JS" state.

**Symptom: polyfills bloat the bundle for everyone.**
Cause — unconditional imports at the top of the entry file.
Fix — a cheap check plus `await import()`; the modern path downloads nothing.

**Symptom: a polyfill breaks another script on the page.**
Cause — it patched a global that something else depended on.
Fix — a ponyfill you import, unless the whole page is yours.

**Symptom: the fallback breaks the first time it runs in production.**
Cause — nobody ever ran it.
Fix — stub the capability module and run the suite with the feature off.

**Symptom: modified-click and middle-click break after "enhancing" links.**
Cause — the click handler intercepted everything.
Fix — the same guard list a router needs ([08 · 02](../08-history-and-routing/02-building-a-router.md)).

**Symptom: a new API works in your browser and nowhere else.**
Cause — a newly-available feature used as a foundation rather than an enhancement.
Fix — check Baseline and your analytics; keep the core on widely-available features.

## Interview questions

**★ What is progressive enhancement, and why does it matter when everyone has JavaScript?**
Building from a working HTML core and layering CSS and JS on top. It matters because scripts fail
for ordinary reasons — a flaky network, a blocked CDN, an extension, one bad bundle — and because
something has to be on screen while they load. It is a reliability strategy, not nostalgia.

**★ Polyfill versus ponyfill?**
A polyfill patches the global so standard code works; a ponyfill exports the behaviour as a
function you import. The polyfill is invisible to call sites but mutates a shared environment; the
ponyfill is explicit and safe in a page you do not fully own.

**★ How do you ship a polyfill without taxing modern browsers?**
A cheap synchronous check followed by `await import()`. The module is fetched only by the browsers
that fail the check.

**★ What cannot be polyfilled?**
Anything that needs new engine or platform capability: real threads, codecs, cryptographic
primitives, permissioned APIs, new rendering behaviour. There the answer is a different design.

**★ How do you decide whether to use a new API?**
Baseline status plus your own analytics: newly available is fine as an enhancement behind a check,
widely available before it becomes a foundation. And whichever you choose, the fallback path gets
tested in CI.

**What is the most common way progressive enhancement is broken in practice?**
An enhancement that hides content — `opacity: 0` or `display: none` until script runs. A script
failure then produces a blank page instead of a plain one.

---

← [01 · Detecting a capability](./01-detecting-a-capability.md) · [Topic index](./README.md)
