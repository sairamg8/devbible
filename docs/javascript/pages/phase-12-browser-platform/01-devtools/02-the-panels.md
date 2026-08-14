---
title: "01.2 · The panels"
sidebar_label: "02 · The panels"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against the Chrome DevTools documentation — [Coverage](https://developer.chrome.com/docs/devtools/coverage), [Fix memory problems](https://developer.chrome.com/docs/devtools/memory-problems) — and MDN — [`console.timeStamp()`](https://developer.mozilla.org/en-US/docs/Web/API/console/timeStamp_static), [`PerformanceObserver`](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver). Documentation-validated; **no screenshots or measured numbers**, because no session produced them.

**Each panel answers a different question, and using the wrong one is why debugging stalls.**
The skill is not knowing where the buttons are — it is knowing which question you are asking.

| Question | Panel |
|---|---|
| "What did the server actually send?" | **Network** |
| "Why is this value wrong here?" | **Sources** (breakpoints) |
| "Why is this slow / janky?" | **Performance** |
| "Why does memory keep growing?" | **Memory** |
| "How much of this bundle do we even use?" | **Coverage** |
| "Why does this element look like that?" | **Elements** |

## Network — the panel that settles arguments

It is the only place that can tell you whether a bug is client-side or server-side, and it does
it in one look. The things worth knowing:

- **The request you care about is often not the one you wrote.** For anything cross-origin and
  non-simple, read the **`OPTIONS`** preflight — [Phase 11 · 05 · Simple versus
  preflighted](../../phase-11-network-storage/05-cors-client-side/02-simple-vs-preflighted.md).
- **Response headers are the evidence for CORS, caching and content type.** "The server is not
  sending it" and "the browser is not exposing it to script" look identical from JavaScript and
  are trivially distinguished here.
- **Disable cache** while debugging, or you will spend an hour on a fixed bug.
- **Throttling** — the presets simulate slow networks and are the only honest way to see a
  loading state that never appears on localhost. CPU throttling in the Performance panel is the
  equivalent for rendering.
- **Copy as fetch / copy as cURL** turns a browser request into a reproducible command — the
  fastest way to prove a failure is or is not CORS, since curl has none
  ([Phase 11 · 05 · 01](../../phase-11-network-storage/05-cors-client-side/01-what-the-browser-is-doing.md)).
- **Initiator** tells you which code made the request — the answer to "where is this call even
  coming from?" in a large app.

## Sources — breakpoints beyond the line breakpoint

`console.log`-driven debugging is a habit, not a necessity. The breakpoint types that replace it:

- **Conditional breakpoint** — pause only when `user.id === 42`. Replaces
  `if (id === 42) console.log(…)` and the rebuild it costs.
- **Logpoint** — logs an expression and does **not** pause. This is `console.log` without
  editing the file, which means it works in production code and in third-party bundles.
- **DOM breakpoints** — break on subtree modification, attribute change, or node removal. The
  answer to "what is removing my element?", which no amount of logging in *your* code will find.
- **Event listener breakpoints** — break on any `click`, or any `XHR`, without knowing where the
  handler is.
- **`fetch`/XHR breakpoints** — break when a URL matching a substring is requested. The fastest
  route from "something calls this endpoint" to the stack that does.
- **Blackboxing / "Ignore list"** — hide framework frames so the stack shows your code. Without
  it, a React or bundler stack is unreadable and people conclude stack traces are useless.

🔴 **`debugger;` in source is still the most reliable breakpoint** when a file is transformed
beyond recognition — but remember it does nothing with DevTools closed, and shipping one to
production halts every user who has it open.

## Performance — for jank, not for micro-benchmarks

A recording gives you the main thread over time: scripting, rendering, painting, and the long
tasks that block input.

- **Long tasks are the unit that matters.** A task over 50 ms blocks input for its duration; the
  user experiences that as a dead click, not as "slow JavaScript".
- **`console.timeStamp()`** — MDN: *"Adds a marker to the browser performance tool's timeline"* —
  correlates your code with the recording, so a flame chart region gets a name you recognise.
  `performance.mark()`/`measure()` do the same more durably, and are readable by
  `PerformanceObserver` in production.
- **CPU throttling** is essential. Your machine is not your users' phone, and a 4×/6× slowdown is
  the difference between "fine" and "unusable" for the same code.
- ⚠️ **Do not use the Performance panel as a benchmark.** DevTools instrumentation itself costs
  time and distorts what it measures — which is the same trap as any confounded benchmark. It is
  for finding *where* the time goes, not for proving that A is 1.2× B.

## Memory — three tools, three questions

- **Heap snapshot** — Chrome's docs: *"Heap snapshots show you how memory is distributed among
  your page's JS objects and DOM nodes at the point of time of the snapshot."* Take one, do the
  suspect action, take another, and compare — the objects that grew between them are the
  candidates.
- **Allocation Timeline** — *"another tool that can help you track down memory leaks in your JS
  heap"*, where during recording *"blue bars represent new memory allocations. Those new memory
  allocations are your candidates for memory leaks."* Bars that never disappear are retained
  allocations.
- **Detached DOM nodes** are the classic browser leak: an element removed from the document but
  still referenced by a closure, an array or a listener, so it can never be collected. A heap
  snapshot filtered for "Detached" finds them, and no amount of reading code reliably does
  ([Phase 8 · 04 · Leaks](../../phase-8-modules-errors/04-leaks/README.md)).

⚠️ **A growing heap is not automatically a leak.** Garbage collection is not scheduled by your
expectations, and caches are supposed to grow. The signal is memory that grows across repeated
identical cycles and never returns after collection — not a single upward line.

## Coverage — how much of the bundle is dead

Chrome's docs describe it plainly:

> The Coverage panel "helps you find unused JavaScript and CSS code. Removing unused code can
> speed up your page load and save the mobile data of your users."

> "The gray section of the bar is unused bytes. The green section is used bytes."

It works by reloading the page, capturing what is needed for load, and continuing to record while
you interact.

🔴 **The caveat is structural: it can only report code that *did not run during your recording*,
which is not the same as code that is never used.** Every route you did not visit and every modal
you did not open counts as unused. Coverage is a strong signal for "this whole library loads on
first paint and is only needed on the settings page" — and a terrible basis for deleting code.

## Elements — for the questions that are not JavaScript

Worth knowing even from a JavaScript seat:

- **Computed styles** answer "which rule won", instead of guessing at specificity.
- **Event Listeners** on the selected node lists what is actually bound, including listeners
  attached by libraries — the fastest check for a double-bound handler.
- **`$0`** in the console refers to the selected element, and `$0.value`, `$0.dataset` or
  `getEventListeners($0)` (Chrome) turn a click into an inspection.
- **`$_`** is the last evaluated expression, and **`$$('sel')`** is `querySelectorAll` returning
  a real array. These are DevTools **console utilities**, not language features — they do not
  exist in your code, and pasting a snippet that uses them into a source file fails.

## Gotchas

**Symptom:** A CORS error with no obvious cause
**Cause:** The failing request is the `OPTIONS` preflight, not the one in your code.
**Fix:** Find the `OPTIONS` entry in the Network panel and read its response headers.

**Symptom:** A fix appears not to work
**Cause:** A cached response or bundle.
**Fix:** Disable cache while DevTools is open; hard reload.

**Symptom:** The stack trace is entirely framework frames
**Cause:** No ignore list configured.
**Fix:** Blackbox `node_modules`/framework scripts so your frames surface.

**Symptom:** "Something removes my element and I cannot find what"
**Cause:** Logging only covers code you thought to instrument.
**Fix:** A DOM breakpoint on node removal.

**Symptom:** A performance measurement is not reproducible
**Cause:** The Performance panel instruments what it measures, and machines differ.
**Fix:** Use it to locate cost, not to compare implementations; benchmark separately.

**Symptom:** The app is fine locally and janky for users
**Cause:** No CPU or network throttling in testing.
**Fix:** Throttle both; a 4–6× CPU slowdown approximates a mid-range phone.

**Symptom:** Coverage says 70% unused, and deleting it breaks the settings page
**Cause:** Coverage reports what did not run *during the recording*.
**Fix:** Read it as a code-splitting signal, never as a delete list.

**Symptom:** Memory grows during a session
**Cause:** Not necessarily a leak — GC timing and legitimate caches both look like growth.
**Fix:** Compare heap snapshots across repeated identical cycles; look for detached DOM nodes.

**Symptom:** A snippet using `$0` or `$$()` fails in a source file
**Cause:** Those are DevTools console utilities, not JavaScript.
**Fix:** Use `document.querySelectorAll` in real code.

## Interview questions

**★ A request fails in the browser and works in curl. What does that tell you, and where do you
look?**
That the server is fine and the browser is enforcing something the command line does not —
almost always CORS. Look at the Network panel, specifically the `OPTIONS` preflight's response
headers, not the request you wrote.

**★ Something removes a DOM node and you cannot find what. How do you find it without reading
every file?**
A DOM breakpoint on node removal in the Elements panel. It breaks in whatever code does it,
including third-party code you would never have thought to instrument.

**★ What is a logpoint, and why is it better than `console.log`?**
A breakpoint that logs an expression without pausing and without editing the source. It works in
production bundles and third-party code, needs no rebuild, and leaves nothing to remove later.

**★ Can you use the Performance panel to prove one implementation is faster?**
Not reliably — the instrumentation itself costs time and machines vary. It is for locating where
time goes; a benchmark is for comparing implementations.

**★ Coverage reports 70% of your bundle unused. Do you delete it?**
No. Chrome's docs describe it as recording while you interact, so it reports code that did not
run *in that session* — every unvisited route counts as unused. It is a code-splitting signal,
not a delete list.

**★ How do you confirm a memory leak rather than normal growth?**
Repeat an identical cycle several times and compare heap snapshots — *"how memory is distributed
among your page's JS objects and DOM nodes at the point of time of the snapshot"*. Look for
objects, and especially **detached DOM nodes**, that accumulate and are never released. The
Allocation Timeline's *"blue bars represent new memory allocations"* that persist are the same
signal.

**Why does CPU throttling matter more than it seems?**
Because a developer machine is several times faster than the median device. A long task that is
20 ms for you is 100 ms for a user — the difference between a responsive click and a dead one.

---

← [01 · The console API](./01-the-console-api.md) · [Topic index](./README.md) ·
Next → [Phase index](../README.md)
