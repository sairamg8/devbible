---
title: "12 · Feature detection and progressive enhancement"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [Progressive enhancement](https://developer.mozilla.org/en-US/docs/Glossary/Progressive_Enhancement), [`CSS.supports()`](https://developer.mozilla.org/en-US/docs/Web/API/CSS/supports_static), [Polyfill](https://developer.mozilla.org/en-US/docs/Glossary/Polyfill), [Baseline](https://developer.mozilla.org/en-US/docs/Glossary/Baseline/Compatibility), [Browser detection using the user agent](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Browser_detection_using_the_user_agent). Documentation-validated; **no timings and no console output**.

The syllabus row is *testing for an API rather than a browser, and degrading without breaking*.
Two halves of one job: **ask the right question**, then **have a real answer for "no"**.

⚠️ **The principle is [Phase 0 · 10 · Feature detection](../../phase-0-how-javascript-runs/10-feature-detection.md).**
This topic is the browser-platform version — where presence is not capability, where the registry
APIs live, and where the fallback is an architecture rather than an `else`.

🔴 **The test that matters is not "does it work without JavaScript".** It is *what the user sees
while the script is loading, and what they are left with when it fails* — a blocked CDN, one bad
bundle, an extension, a slow connection.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[Detecting a capability, correctly](./01-detecting-a-capability.md)** | The four check shapes and why the platform's own registries beat all of them; five failure modes — present-but-throws, secure-context, permission, an unsupported *option*, and absent in worker/SSR; `typeof` over `window.X`; one frozen capability module so the fallback is testable; what is capability and what is *state* |
| 02 | **[Progressive enhancement](./02-progressive-enhancement.md)** | The three layers and what each owes; enhancing markup that already worked — links, forms, custom elements, `@supports`; the enhancement-that-hides-content failure; polyfill versus ponyfill versus neither, and conditional `await import()`; what cannot be polyfilled; Baseline as a decision tool; testing both paths |

## Three facts worth carrying out of this topic

- **Presence is not capability.** `localStorage` exists and throws in private mode;
  `navigator.share` exists and refuses your payload. Use the registry, or probe for real.
- **`typeof X !== 'undefined'`, never `window.X`** — the latter throws in a worker and during
  server rendering, which is where feature checks most often run.
- **An enhancement that hides content turns a script failure into a blank page.** Start visible;
  animate, do not reveal.

## Phase gate

You can move a 500 ms computation into a Web Worker, keep the page responsive, and prove it
in the performance panel.

## Where this connects

- [Phase 0 · 10 · Feature detection](../../phase-0-how-javascript-runs/10-feature-detection.md) —
  the principle, and the language-level version
- [09 · 02 · navigator and screen](../09-window-document-navigator/02-navigator-and-screen.md) —
  why UA sniffing fails, and the secure-context gate behind half these checks
- [06 · 01 · The timeline](../06-performanceobserver/01-the-timeline.md) —
  `supportedEntryTypes`, the clearest example of a capability registry
- [11 · 02 · Preferences and testing](../11-accessibility-from-javascript/02-preferences-and-testing.md)
  — the media queries that are *state*, watched rather than detected
- [08 · 02 · Building a router](../08-history-and-routing/02-building-a-router.md) — enhancing
  links without breaking modified clicks

---

Start → [01 · Detecting a capability, correctly](./01-detecting-a-capability.md)
