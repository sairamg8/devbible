---
name: devbible-javascript-concepts-phase12
description: Load-bearing claims and sources for JavaScript phase 12 — the browser platform (DevTools, client-side security)
metadata:
  type: reference
---

*Child of [[devbible-javascript-concepts]]. Open when working on phase 12.*

Provenance: **documentation-validated** against MDN, the WHATWG Console specification and the
**Chrome DevTools documentation**. No sandbox and no browser session — **no page prints console
output, a timing or a screenshot**.

Phase 12 has **2 Master topics** (01 DevTools, 02 client-side security). ✅ **Both done.**
Rows 03–21 are Understand/Know/When-Needed and deferred — the syllabus itself says most rows
*"are Know until a project needs them"*.

## Topic 01 · DevTools beyond `console.log` (commit `e709483`, 2 chunks)

**01 · The console API in full**
- Method table with MDN's own one-liners: `table` *"Displays tabular data as a table"*, `dir`
  *"an interactive listing of the properties"*, `group`/`groupCollapsed` *"indenting all
  following output"*, `time`/`timeLog`/`timeEnd`, `count` *"Log the number of times this line has
  been called with the given label"*, `assert` *"if the first argument is `false`"*, `trace`,
  `timeStamp` *"Adds a marker to the browser performance tool's timeline"*.
- 🔴 **`dir` vs `log` on a DOM node**: `log` renders markup, `dir` lists properties. Same
  distinction as the `%o` / `%O` specifiers.
- Six format specifiers quoted (`%s %d/%i %f %o %O %c`); `%c` *"Applies CSS style rules to all
  following text"* → a page can style its console output invisible, so foreign console output is
  not trustworthy evidence.
- 🔴 **The live-reference trap**: the console renders an object's *current* state when expanded,
  not a snapshot. Log `structuredClone(obj)` for a snapshot. This is why mutation bugs look
  impossible.
- Console args are **retained** → logging from a long-lived scope keeps objects alive (a "leak"
  that appears only with logging enabled). Everything logged is visible to any user in DevTools.
- MDN caveat quoted: *"Implementations of the console API may differ between runtimes."* The API
  is specified (WHATWG Console); the **rendering is not**.

**02 · The panels**
- Panel→question table. Network settles client-vs-server; **read the `OPTIONS` entry**, use
  throttling, copy-as-cURL (curl has no CORS, so it isolates the cause).
- Breakpoints that replace logging: conditional, **logpoint** (logs without pausing, works in
  production/third-party bundles), **DOM breakpoints** (the only reliable answer to "what removed
  my element?"), event-listener, fetch/XHR, and blackboxing/ignore-list.
- Performance: **long tasks** (>50 ms blocks input); `console.timeStamp`/`performance.mark` to
  name flame-chart regions; ⚠️ **not a benchmark** — instrumentation distorts what it measures.
- Memory: Chrome docs — heap snapshots *"show you how memory is distributed among your page's JS
  objects and DOM nodes at the point of time of the snapshot"*; Allocation Timeline *"blue bars
  represent new memory allocations. Those new memory allocations are your candidates for memory
  leaks."* **Detached DOM nodes** are the classic browser leak. Growth alone ≠ a leak.
- 🔴 **Coverage**: Chrome docs — *"The gray section of the bar is unused bytes. The green section
  is used bytes."* (**not** red/blue — checked, my first guess was wrong.) It records while you
  interact, so "unused" means *did not run in this session*: a code-splitting signal, **never a
  delete list**.
- `$0`, `$_`, `$$()`, `getEventListeners()` are **DevTools console utilities, not language
  features** — they fail when pasted into a source file.

## Topic 02 · Client-side security (commit `e709483`, 3 chunks)

⚠️ **XSS/sinks/Trusted Types deliberately stay in Phase 9 · 06 · Sanitising HTML.** This topic is
everything else, and cross-links rather than repeating.

**01 · The trust boundary**
- The spine sentence: **a check that runs in the browser is a UX feature, not a security
  control.**
- **Send inputs, not conclusions** — a checkout posting `{total: 4.99}` is a price the user chose.
- No secret survives a bundle (build-time inlining, minification, runtime fetch all end up
  inspectable); obfuscation is not a control; `VITE_`/`NEXT_PUBLIC_` prefixes are the framework
  telling you it is public.
- Hidden UI ≠ access control; **every authorisation decision re-made server-side per request**.
- CORS protects the *user's* data from other sites' scripts; it does **not** protect your API and
  does not stop the request.
- The "never trust the client with" table: authorisation, prices, validation-as-a-filter,
  secrets, rate limiting, identity, money rules.

**02 · Other windows and frames**
- MDN `postMessage`, three clauses quoted: never `"*"` (*"A malicious site can change the location
  of the window without your knowledge"*); *"always verify the sender's identity"* via
  `origin`/`source` because *"Any window … can send a message to any other window"*; and 🔴
  *"you still should always verify the syntax of the received message"* — the origin check alone
  does not prevent XSS through a message.
- `window.opener`: `noopener` *"instructs the browser to navigate to the target resource without
  granting the new browsing context access to the document that opened it"*. The attack is
  **navigation**, not reading — `window.opener.location = phishing` (tab-nabbing).
- 🔴 **MDN note quoted: `target="_blank"` on `<a>`/`<area>`/`<form>` "implicitly provides the same
  `rel` behavior as setting `rel="noopener"`"** — so the classic advice is now the default there,
  **but `window.open()` is NOT covered**; pass `"noopener"` in the features string (and it then
  returns `null`).
- Clickjacking: `X-Frame-Options` *"whether a browser should be allowed to render the document in
  a `<frame>`…"*, `DENY` / `SAMEORIGIN` quoted; `ALLOW-FROM` **obsolete** — MDN points at CSP
  `frame-ancestors`. 🔴 **A server header — client JS cannot fix it**; frame-busting is
  unreliable.
- `sandbox`: ⚠️ `allow-scripts` + `allow-same-origin` on same-origin content **undoes the
  sandbox** (the frame can remove its own attribute).

**03 · Storage, dependencies and depth**
- Token storage stated as a **trade, not a winner**: `HttpOnly` removes token *theft* from the
  XSS blast radius (an attacker can still act while the page is open, but cannot exfiltrate a
  credential for later) at the cost of CSRF; web storage has no CSRF problem and is simpler
  cross-origin but any XSS reads it. Architecture decides: same-origin → cookies; cross-origin →
  short-lived in-memory token + refresh.
- 🔴 **If you have XSS the storage choice is mitigation, not a fix.** "Encrypted in localStorage"
  is not a control — the key ships in the bundle.
- Dependencies run with your origin's full authority. Order of return: lockfile + immutable
  installs → audit in CI → fewer deps → review install-time lifecycle scripts → watch transitive
  depth.
- **SRI** quoted: *"enables browsers to verify that resources they fetch … are delivered without
  unexpected manipulation"*; on mismatch the browser *"will refuse to load the resource, and
  return a network error"*. ⚠️ **`crossorigin` is mandatory** — *"browsers will not allow
  `no-cors` requests to use subresource integrity, so a request like this will always fail."*
  🔴 SRI **cannot pin a "always latest" URL** — self-host a pinned copy instead.
- CSP/Trusted Types as the last layer; **report-only is a migration step with a deadline**, not a
  permanent state.
- Closing ordering: don't create sinks → don't run unvetted code → limit what code can do → limit
  what a stolen credential is worth. Each layer assumes the previous failed.
