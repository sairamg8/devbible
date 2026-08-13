---
title: "JavaScript — Syllabus"
sidebar_label: "Overview"
sidebar_position: 0
---

The complete topic inventory for JavaScript, tiered for **mastery in fullstack
application development**. **19 phases, 337 topics**, split into 5 parts to stay
under the 300-line file cap.

Architectural role: **the language itself** — plus the two tracks the brief names
alongside it, **Web APIs** (the browser platform) and **DSA** (data structures,
algorithms, and the from-scratch implementations interviews ask for) — then a
fifth part that composes all of it into a working storefront.

This is the largest syllabus in the bible on purpose. It is three subjects
wearing one name, and every other frontend technology here — TypeScript, React,
and half of Node — assumes all three.

**The bar this syllabus is written against:** you can build the front end of a
real e-commerce application — a Walmart or Flipkart clone — with no gap you have
to go and look up. Part 5 is where that is proved rather than assumed.

## Scope — what this owns, and what it hands off

| Concern | Home |
|---|---|
| The language: values, functions, objects, iteration, promises, modules | **JavaScript** |
| The browser platform: DOM, events, `fetch`, storage, workers, observers | **JavaScript** (Part 3) |
| Data structures, algorithms, complexity, machine-coding rounds | **JavaScript** (Part 4) |
| Composing all of it into a storefront, framework-free | **JavaScript** (Part 5) |
| Types, generics, narrowing, `tsconfig` | TypeScript |
| Components, hooks, rendering, state | React |
| `process`, `fs`, streams, the libuv loop, npm and module *resolution* | Node.js |
| HTTP semantics, status codes, REST design, CORS **headers** | Express |
| Selectors, layout, animation | CSS |

Two boundaries are drawn deliberately rather than by convenience:

1. **The event loop is split.** The *language* half — the job queue, microtasks,
   promise resolution — is Phase 7 here. The *runtime* half — libuv phases,
   `setImmediate`, `process.nextTick` — belongs to Node.js Phase 2. Neither page
   re-explains the other; both link across.
2. **Network is split at the wire.** `fetch`, `AbortController`, `FormData` and
   how CORS *fails in the console* are Phase 11 here. Status-code design and the
   headers a server sends belong to Express.

## Example policy

> **Every page states which host it runs in.** Language pages (Parts 1, 2, 4)
> are verified in **Node 24 LTS**, because that is a scriptable V8. Browser
> pages (Parts 3 and 5) never present Node output as browser output — see the
> verification policy below.

| | |
|---|---|
| The code | Runnable and complete — no `...` elisions, realistic names |
| The output | Actual console output, produced on the stated host |
| The failure mode | What the error message really says, not a paraphrase |
| The trade-off | Named explicitly — every recommendation costs something |

## Parts

| # | Part | Covers | Phases | Topics |
|---|---|---|---|---|
| 1 | **[Language core](syllabus/01-language-core.md)** | How JS runs, values and coercion, operators, functions, objects and prototypes | 0–4 | 84 |
| 2 | **[Data & async](syllabus/02-data-and-async.md)** | The built-in library, iteration and generators, promises and the event loop, modules and errors | 5–8 | 79 |
| 3 | **[Web APIs](syllabus/03-web-apis.md)** | DOM, events, `fetch`/storage/network, the browser platform | 9–12 | 75 |
| 4 | **[DSA & machine coding](syllabus/04-dsa-and-machine-coding.md)** | Complexity, structures, algorithm patterns, DP, and implementing the library yourself | 13–17 | 81 |
| 5 | **[Applied storefront](syllabus/05-applied-storefront.md)** | Every earlier phase composed into a real e-commerce front end, framework-free | 18 | 18 |

## Explanations

The explanations live in **`pages/`** — one page per topic (or tight group), with
runnable code, gotchas written symptom → cause → fix, and interview questions
with answers.

import Progress from '@site/src/components/Progress';

<Progress lang="javascript" compact />

## Tier legend

| Badge | Meaning |
|---|---|
| <span className="db-tier t-master">Master</span> | Use confidently with no documentation open |
| <span className="db-tier t-understand">Understand</span> | Know how it works; look up signatures freely |
| <span className="db-tier t-know">Know</span> | Know what/why/when; details on demand |
| <span className="db-tier t-when">When Needed</span> | Don't study upfront |

## Tier distribution

| Tier | Topics | Share |
|---|---|---|
| <span className="db-tier t-master">Master</span> | 100 | 30% |
| <span className="db-tier t-understand">Understand</span> | 170 | 50% |
| <span className="db-tier t-know">Know</span> | 66 | 20% |
| <span className="db-tier t-when">When Needed</span> | 4 | 1% |
| **Total** | **337** | |

Master by part: Language core 29 · Data & async 26 · Web APIs 18 · DSA 20 ·
Applied 7.

The Master set is deliberately front-loaded: 55 of the 100 are in Parts 1 and 2,
because the language is what you cannot look up mid-task. Part 3 keeps a low
Master count on purpose — the tier is set for someone who mostly ships React. If
you build without a framework, raise the DOM and events rows a tier.

If you only ever finish the <span className="db-tier t-master">Master</span> set,
you can read any JavaScript codebase, debug an async ordering bug from first
principles, build a feature against the DOM with no framework, and pass a
machine-coding round — and Part 5 turns that into a shipped storefront.

## Prerequisites

**None.** Phase 0 starts at "what actually executes this file". This is the
first syllabus in the bible with no prerequisite outside itself — CSS is
independent of it, and everything else in the stack depends on it.

## Reading order

1. **Parts 1 and 2 in order, and do not skip Phase 7.** Every later part assumes
   promises and closures.
2. **Part 3 can start after Phase 4** if you want something on screen early —
   Phases 9 and 10 need objects and functions, not generators.
3. **Part 4 runs in parallel with anything.** It is the track you do in the
   background over months, not a phase you finish once.
4. **Phase 17 before Phase 18.** It is a test of Parts 1–2, and it fails
   honestly if they are shaky.
5. **Phase 18 is the capstone.** Do not start it early — it composes, it does
   not teach primitives.

## Verification policy

Settled 2026-08-13. Writing does **not** block on browser tooling:

| Part | How claims are verified |
|---|---|
| 1, 2, 4 | Run in **Node 24 LTS** in `sandbox/js-*/`. Pages carry `> Verified:`. |
| 3, 5 | Whatever Node can run (`fetch`, `URL`, `AbortController`, streams, `WebCrypto`, `Intl`) is measured and marked. DOM, event and CORS output carries a `VERIFY` marker instead — **no invented console output, and no `> Verified:` line on an unmeasured page.** |

Part 4 gets its own `node:test` suite rather than console transcripts, so each
structure's correctness *and* its complexity claim are asserted.

---

Start → [Part 1 — Language core](syllabus/01-language-core.md)
