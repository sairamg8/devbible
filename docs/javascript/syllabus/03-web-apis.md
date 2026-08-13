---
title: "Part 3 — Web APIs"
sidebar_label: "3 · Web APIs"
sidebar_position: 3
---

> **Phases 9–12 · 75 topics · 18 Master**
> The platform, not the language. Everything here is provided by the **browser**,
> and none of it exists in Node.

The brief names **Web APIs** as one of the three JavaScript tracks. This part is
deliberately framework-free: it is what React, Vue and every UI library are built
on top of, and it is what you fall back to when the framework is in the way.

Tiers here are set for a fullstack developer who mostly ships React. Someone
building a component library or working without a framework would raise several
<span className="db-tier t-know">Know</span> rows to
<span className="db-tier t-master">Master</span>.

---

## Phase 9 — The DOM

*19 topics.* The document as a data structure you can mutate. The sanitising row
is the one security bug a frontend developer is most likely to ship personally.

| Topic | Tier |
|---|---|
| **What the DOM is** — the document as a tree, nodes versus elements, and the line between markup and JavaScript | <span className="db-tier t-master">Master</span> |
| **Selecting elements** — `querySelector`/`querySelectorAll`, `getElementById`, and live `HTMLCollection` versus static `NodeList` | <span className="db-tier t-master">Master</span> |
| **Creating and inserting** — `createElement`, `append`/`prepend`, `before`/`after`, `insertAdjacentHTML`, and building a subtree before attaching it | <span className="db-tier t-master">Master</span> |
| **`textContent` vs `innerText` vs `innerHTML`** — the XSS boundary, and the layout cost `innerText` quietly pays | <span className="db-tier t-master">Master</span> |
| **Attributes versus properties** — `getAttribute` versus `.value`, boolean attributes, and `data-*` through `dataset` | <span className="db-tier t-master">Master</span> |
| **Sanitising HTML** — why `innerHTML` with user data is *the* frontend bug, DOMPurify, Trusted Types, and the sinks to grep for | <span className="db-tier t-master">Master</span> |
| **Traversal** — `parentElement`, `children`, `closest`, `matches`, `nextElementSibling`, and why `closest` beats manual walking | <span className="db-tier t-understand">Understand</span> |
| **Classes and styles from JavaScript** — `classList`, inline `style` versus stylesheets, and reading/writing CSS custom properties | <span className="db-tier t-understand">Understand</span> |
| **Forms** — `FormData`, the constraint-validation API, `input` versus `change`, and reading a whole form in one line | <span className="db-tier t-understand">Understand</span> |
| **Removing and replacing** — `remove`, `replaceChildren`, `replaceWith`, and the listeners you must clean up with them | <span className="db-tier t-understand">Understand</span> |
| **Batching DOM work** — `DocumentFragment`, `<template>`, `cloneNode`, and building a 1 000-row table without freezing the page | <span className="db-tier t-understand">Understand</span> |
| **Layout thrashing** — the read-after-write pattern that forces synchronous reflow, and the property list that triggers it | <span className="db-tier t-understand">Understand</span> |
| **Measuring elements** — `getBoundingClientRect`, the offset/client/scroll families, and device pixel ratio | <span className="db-tier t-understand">Understand</span> |
| **Scrolling** — `scrollTo`, `scrollIntoView`, scroll containers, sticky positioning from JS, and restoring scroll position | <span className="db-tier t-understand">Understand</span> |
| **Focus and accessibility from JavaScript** — `tabindex`, focus traps in modals, `aria-*` set from code, and live regions | <span className="db-tier t-understand">Understand</span> |
| **`<dialog>`, the popover API and `inert`** — the platform features that replace three libraries | <span className="db-tier t-know">Know</span> |
| **`MutationObserver`** — reacting to DOM changes you do not control, without polling | <span className="db-tier t-know">Know</span> |
| **Shadow DOM and custom elements** — encapsulation, slots, lifecycle callbacks, and where style boundaries help or hurt | <span className="db-tier t-know">Know</span> |
| Selection, `Range` and `contenteditable` — the surface area behind every rich-text editor | <span className="db-tier t-when">When Needed</span> |

**Gate — move on when:** you can render a list from an array into the DOM with no
framework, update one row without rebuilding the list, and explain which parts
are XSS-safe.

---

## Phase 10 — Events and user input

*14 topics.* Delegation is the row that pays for the phase — it is the difference
between one listener and a thousand.

| Topic | Tier |
|---|---|
| **The event model** — capture, target and bubble phases, and how an event reaches a listener that is not on the element you clicked | <span className="db-tier t-master">Master</span> |
| **`addEventListener`** — the options object (`once`, `capture`, `passive`, `signal`), and removing a listener correctly (the identity trap) | <span className="db-tier t-master">Master</span> |
| **The event object** — `target` versus `currentTarget`, `preventDefault`, and `stopPropagation` versus `stopImmediatePropagation` | <span className="db-tier t-master">Master</span> |
| **Event delegation** — one listener for a whole list, why it survives re-renders, and the cases where it fails | <span className="db-tier t-master">Master</span> |
| **Form and input events** — `input`, `change`, `submit`, `focusin`/`focusout`, `beforeinput`, and building a controlled input by hand | <span className="db-tier t-understand">Understand</span> |
| **Keyboard events** — `key` versus `code` versus deprecated `keyCode`, modifier state, IME composition, and implementing a shortcut | <span className="db-tier t-understand">Understand</span> |
| **Pointer events** — the unified model over mouse and touch, capture, and a drag implementation that does not leak listeners | <span className="db-tier t-understand">Understand</span> |
| **Custom events** — `CustomEvent`, the `detail` payload, and decoupling components without a framework | <span className="db-tier t-understand">Understand</span> |
| **Scroll, resize and visibility** — why these need throttling or an observer, and `passive: true` on scroll | <span className="db-tier t-understand">Understand</span> |
| **Page lifecycle** — `DOMContentLoaded`, `load`, `pagehide`, `visibilitychange`, `beforeunload`, and which one to save state in | <span className="db-tier t-understand">Understand</span> |
| **Default actions you should not block** — the passive-listener warning, and what breaks when you `preventDefault` a scroll | <span className="db-tier t-understand">Understand</span> |
| **`EventTarget` as a base class** — building your own emitter on the platform instead of shipping one | <span className="db-tier t-know">Know</span> |
| **Touch and gestures** — multi-touch, the historical 300 ms delay, and why pointer events usually suffice | <span className="db-tier t-know">Know</span> |
| **Debugging events** — `getEventListeners`, `monitorEvents`, event-listener breakpoints, and finding what stole your click | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can attach one listener to a table and handle clicks
on any button in any row, including buttons added later.

---

## Phase 11 — Network, storage and data transfer

*21 topics.* How data gets in and out of the browser. The `fetch` rows and the
CORS row cover the majority of "it works in Postman but not in the browser".

| Topic | Tier |
|---|---|
| **`fetch`** — the request/response shape, and the critical surprise: a 404 or 500 **does not reject** | <span className="db-tier t-master">Master</span> |
| **Request bodies** — JSON, `FormData`, `URLSearchParams`, `Blob`, and the `Content-Type` the browser sets for you | <span className="db-tier t-master">Master</span> |
| **A `fetch` wrapper worth reusing** — status handling, JSON parsing, typed errors, base URL, and auth headers in one place | <span className="db-tier t-master">Master</span> |
| **`URL` and `URLSearchParams`** — building URLs without string concatenation, encoding rules, and relative resolution | <span className="db-tier t-master">Master</span> |
| **CORS from the client side** — simple versus preflighted requests, `credentials`, wildcard-with-credentials, and how to read the console error | <span className="db-tier t-master">Master</span> |
| **`Request`, `Response` and `Headers`** — constructing them directly, cloning, and why a body can only be read once | <span className="db-tier t-understand">Understand</span> |
| **Reading responses** — `json`, `text`, `blob`, `arrayBuffer`, `formData`, and streaming a body as it arrives | <span className="db-tier t-understand">Understand</span> |
| **Aborting and timing out** — `AbortController` with `fetch`, `AbortSignal.timeout`, and cancelling a request when a component unmounts | <span className="db-tier t-understand">Understand</span> |
| **Cookies** — `document.cookie`, `HttpOnly`, `Secure`, `SameSite`, and why an access token in JavaScript-readable storage is a decision, not a default | <span className="db-tier t-understand">Understand</span> |
| **`localStorage` and `sessionStorage`** — the synchronous API and its cost, quotas, JSON round-tripping, and the `storage` event across tabs | <span className="db-tier t-understand">Understand</span> |
| **Uploading files** — `<input type="file">`, `File` and `Blob`, drag-and-drop, progress, and chunked uploads | <span className="db-tier t-understand">Understand</span> |
| **`Blob`, `File`, `FileReader` and object URLs** — reading a file in the browser, previewing it, and revoking the URL | <span className="db-tier t-understand">Understand</span> |
| **WebSocket** — connecting, message framing, reconnection with backoff, heartbeats, and when it is overkill | <span className="db-tier t-understand">Understand</span> |
| **Same-origin policy and `postMessage`** — origins, iframes, cross-window messaging, and always checking `event.origin` | <span className="db-tier t-understand">Understand</span> |
| **Content Security Policy from the JavaScript side** — what a strict policy breaks, `nonce`, `strict-dynamic`, and inline handlers | <span className="db-tier t-understand">Understand</span> |
| **`IndexedDB`** — object stores, transactions, versioning and upgrades, and the cases where it is genuinely the right store | <span className="db-tier t-know">Know</span> |
| **Service workers and the Cache API** — offline, caching strategies, the update lifecycle, and the stale-worker trap | <span className="db-tier t-know">Know</span> |
| **Server-sent events** — `EventSource`, automatic reconnection, and when it beats a WebSocket | <span className="db-tier t-know">Know</span> |
| **Streams** — `ReadableStream`, `WritableStream`, `TransformStream`, and piping a `fetch` body through one | <span className="db-tier t-know">Know</span> |
| **`navigator.sendBeacon` and `keepalive`** — getting analytics out during unload | <span className="db-tier t-know">Know</span> |
| **`XMLHttpRequest`** — what it still does that `fetch` cannot, and why upload progress is the reason it survives | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can write a `fetch` wrapper with timeout,
cancellation and typed errors, and explain the exact request the browser sends
before a cross-origin `PUT`.

---

## Phase 12 — The browser platform

*21 topics.* Everything else the platform hands you — scheduling, observation,
extra threads, and the security surface. Broad by design: most rows are
<span className="db-tier t-know">Know</span> until a project needs them.

| Topic | Tier |
|---|---|
| **DevTools beyond `console.log`** — network, performance and memory panels, coverage, and the console API in full (`table`, `time`, `group`, `dir`, `trace`) | <span className="db-tier t-master">Master</span> |
| **Client-side security** — XSS sinks, clickjacking, `postMessage` origin checks, `target="_blank"` and dependency risk | <span className="db-tier t-master">Master</span> |
| **Timers and frames** — clamping, throttled background tabs, and `requestAnimationFrame` as the only correct place to animate | <span className="db-tier t-understand">Understand</span> |
| **`IntersectionObserver`** — lazy loading, infinite scroll, and impression tracking without scroll handlers | <span className="db-tier t-understand">Understand</span> |
| **`ResizeObserver`** — element-level responsiveness, and the resize-loop warning | <span className="db-tier t-understand">Understand</span> |
| **`PerformanceObserver` and the metrics that matter** — LCP, INP, CLS, `performance.now`, marks and measures, and the long-task entry | <span className="db-tier t-understand">Understand</span> |
| **Web Workers** — moving CPU work off the main thread, `postMessage`, structured clone cost, and transferables | <span className="db-tier t-understand">Understand</span> |
| **The History API and client-side routing** — `pushState`, `popstate`, scroll restoration, and what the Navigation API changes | <span className="db-tier t-understand">Understand</span> |
| **`window`, `document`, `navigator`, `screen`** — the parts that are actually useful, and the parts that are legacy | <span className="db-tier t-understand">Understand</span> |
| **`WebCrypto`** — `crypto.randomUUID`, `getRandomValues`, hashing with `subtle.digest`, and why you do not write your own crypto | <span className="db-tier t-understand">Understand</span> |
| **Accessibility from JavaScript** — focus management on route change, announcements, and `prefers-reduced-motion`/`prefers-color-scheme` | <span className="db-tier t-understand">Understand</span> |
| **Feature detection and progressive enhancement** — testing for an API rather than a browser, and degrading without breaking | <span className="db-tier t-understand">Understand</span> |
| **What belongs on the server instead** — the honest list of things the client must never be trusted with | <span className="db-tier t-understand">Understand</span> |
| **Yielding to the main thread** — `requestIdleCallback`, `scheduler.yield`, `scheduler.postTask`, and breaking up long tasks | <span className="db-tier t-know">Know</span> |
| **Cross-tab coordination** — `BroadcastChannel`, the `storage` event, and Web Locks | <span className="db-tier t-know">Know</span> |
| **Clipboard, Web Share and File System Access** — the modern replacements for three hacks | <span className="db-tier t-know">Know</span> |
| **Permissions, Geolocation and Notifications** — the permission model, and asking at the right moment | <span className="db-tier t-know">Know</span> |
| **Media from JavaScript** — controlling `<video>`/`<audio>`, `getUserMedia`, and Canvas 2D basics | <span className="db-tier t-know">Know</span> |
| **Page Visibility, Wake Lock and Battery** — the background-tab behaviours that break timers and polling | <span className="db-tier t-know">Know</span> |
| **Internationalisation in the browser** — `navigator.language`, locale negotiation, and `Intl` applied to the DOM | <span className="db-tier t-know">Know</span> |
| **`SharedArrayBuffer` and `Atomics`** — real shared memory, and the COOP/COEP headers you must ship first | <span className="db-tier t-when">When Needed</span> |

**Gate — move on when:** you can move a 500 ms computation into a Web Worker,
keep the page responsive, and prove it in the performance panel.

---

## Where this connects

- **Phase 11 → Express** — CORS, cookies, `SameSite` and CSP each have a server
  half; the [Express syllabus](/docs/expressjs) owns the header side.
- **Phase 9 and 10 → React** — the DOM and event rows are what React's
  synthetic events, refs and keys are *abstracting*. Learn them first and React
  stops being a black box.
- **Phase 12 → CSS** — `prefers-reduced-motion`, container queries and
  `requestAnimationFrame` meet in animation work.
- **Deliberately not here:** HTTP semantics (status codes, caching, REST design)
  — those belong to Express; and anything with `process` or `fs` in it, which is
  Node.

---

← [Part 2 — Data & async](./02-data-and-async.md) · Next: [Part 4 — DSA & machine coding](./04-dsa-and-machine-coding.md) →
