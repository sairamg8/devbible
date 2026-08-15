---
title: "09 · window, document, navigator, screen"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Window`](https://developer.mozilla.org/en-US/docs/Web/API/Window), [`Document`](https://developer.mozilla.org/en-US/docs/Web/API/Document), [`Navigator`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator), [`Screen`](https://developer.mozilla.org/en-US/docs/Web/API/Screen), [Browser detection using the user agent](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Browser_detection_using_the_user_agent). Documentation-validated; **no timings and no console output**.

The syllabus row is *the parts that are actually useful, and the parts that are legacy* — which is
the honest description of four objects that have been accumulating API since 1996. This topic is
a map: what to reach for, what to ignore, and which of the old properties are actively harmful.

🔴 **The rule that covers most of it: ask the platform a question it can answer.** `window` is the
global object *and* the browsing context; `document` is the page; `navigator` is capabilities;
`screen` is the display, which is almost never the number a layout wants.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[window and document](./01-window-and-document.md)** | `globalThis` over `window`; named access turning an `id` into a global; the members worth knowing; `innerWidth` versus a media query; watching `devicePixelRatio` without an event; `window.open`, popup blocking and `noopener`; why `alert` blocks everything; `readyState` and the initialise-safely branch; the legacy shelf (`document.write`, `document.all`, `domain`, `execCommand`); frames and `postMessage` origin checks |
| 02 | **[navigator and screen](./02-navigator-and-screen.md)** | Why `userAgent` lies and what `userAgentData` changes; the capability table and the secure-context gate; `onLine` being trustworthy only when false; `connection` and honouring `saveData`; `hardwareConcurrency` and `deviceMemory` as hints; `storage.estimate()`; `screen` versus the viewport; orientation; the legacy shelf and the fingerprinting angle |

## Three facts worth carrying out of this topic

- **Every element `id` is a global.** Named access plus top-level `var` produces variables that
  are silently DOM nodes — one of the concrete reasons to write modules.
- **`navigator.onLine === true` means nothing.** Only `false` is reliable; a captive portal is
  still "online".
- **Secure context gates the good APIs.** Clipboard, media devices, geolocation, service workers
  and `crypto.subtle` are all absent over plain HTTP — the usual cause of "works on localhost".

## Phase gate

You can move a 500 ms computation into a Web Worker, keep the page responsive, and prove it
in the performance panel.

## Where this connects

- [Phase 0 · 06 · Hosts and globals](../../phase-0-how-javascript-runs/06-hosts-and-globals.md)
  — what the global object is, and what `globalThis` standardises
- [Phase 0 · 10 · Feature detection](../../phase-0-how-javascript-runs/10-feature-detection.md) —
  the alternative to sniffing, in full
- [Phase 10 · 10 · 01 · Startup](../../phase-10-events/10-page-lifecycle/01-startup.md) —
  `readyState`, `DOMContentLoaded` and `load` in their proper order
- [02 · Client-side security](../02-client-side-security/README.md) — `opener`, framing and
  `postMessage` origin checks as security problems
- [07 · Web Workers](../07-web-workers/01-starting-and-talking.md) — the same globals seen from a
  context where `window` does not exist
- **12 · Feature detection and progressive enhancement** *(not written yet)* — the phase-12
  treatment of the same rule

---

Start → [01 · window and document](./01-window-and-document.md)
