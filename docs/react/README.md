---
title: "React — Syllabus"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-08 against **React 19.2.8** (`npm view react dist-tags`, published
> 2026-07-21). Every version fact and every API list below came from a command run
> on this machine — including the export lists, which are `Object.keys()` on the
> installed package, not recalled from documentation.

The complete topic inventory for React, tiered for **mastery in fullstack
application development**. **15 phases, 244 topics** plus a cross-cutting
**[Patterns](pages/patterns/README.md)** section, split into 5 parts to stay
under the 300-line file cap.

The bar is **no knowledge gaps**: every hook React ships, every rendering API,
the whole server story (Server Components, Server Functions, SSR, streaming,
hydration, prerendering), the Compiler, and the surrounding decisions you cannot
avoid — routing, data, forms, testing, delivery. Nothing is left as "you'll pick
that up later".

Architectural role: **React computes a description of the UI; a renderer applies
it.** That one sentence is what most of this syllabus is downstream of. It is why
`react` and `react-dom` are separate packages, why a Server Component can exist
at all, why keys matter, why a render can be thrown away mid-flight, and why
"just mutate it" never works.

## Scope — what this syllabus owns

**React itself, and the decisions React forces on you.** JavaScript semantics
belong to the JavaScript syllabus; typing belongs to TypeScript; styling belongs
to CSS. The rule is: *if removing React would remove the topic, it is React's.*

| Concern | Home |
|---|---|
| Closures, the event loop, promises, the DOM API, `fetch` | **JavaScript** |
| How to *type* props, hooks, generic components, `ReactNode` | **TypeScript** Phase 8 |
| Flexbox, Grid, container queries, the cascade | **CSS** |
| The rendering model, hooks, Suspense, RSC, hydration | **React** |
| HTTP semantics, status codes, REST design, the API contract | **Express** |
| What the server does with a Server Function's database call | **PostgreSQL** / **Node** |
| Bundling in general | **React** only where it changes React (`'use client'`, Fast Refresh, the Compiler) |

Two deliberate overlaps, both handled by linking rather than re-explaining:

- **Routing** is not React, and the phase that would have covered it (13) was
  **dropped on 2026-08-14**. Routers are still discussed where they intersect
  React — as a framework *choice* in Phase 10 — but this syllabus does not teach
  one.
- **Server Components** (Phase 10) sit on a bundler and usually a framework.
  React owns the model and the directives; the framework owns the plumbing.

## Version facts

All measured on this machine, 2026-08-13:

| | |
|---|---|
| Target | **React 19.2.8** and **react-dom 19.2.8** — the `latest` dist-tag, published **21 Jul 2026** |
| Latest *minor* | **19.2**, released **1 Oct 2025**. There is **no 19.3 stable** as of August 2026 — 19.2.x has been patch-only for ten months |
| Pre-release channels | `canary` **19.3.0-canary-22e4f993-20260811** · `experimental` **0.0.0-experimental-22e4f993-20260811**. Frameworks ship canary; you should not |
| Hooks in stable | `useState` `useReducer` `useContext` `useRef` `useImperativeHandle` `useEffect` `useLayoutEffect` `useInsertionEffect` `useEffectEvent` `useMemo` `useCallback` `useTransition` `useDeferredValue` `useId` `useDebugValue` `useSyncExternalStore` `useActionState` `useOptimistic` — plus `useFormStatus` and `useFormState` from `react-dom` |
| Not a hook, but reads like one | **`use`** — reads a promise or a context, and is the one API allowed inside a condition |
| Components in stable | `Suspense` `StrictMode` `Fragment` `Profiler` **`Activity`** |
| Also in stable `react` | `cache` **`cacheSignal`** `lazy` `memo` `startTransition` `createContext` `forwardRef` `createElement` `cloneElement` `Children` `isValidElement` `act` **`captureOwnerStack`** |
| **Experimental only** — not in 19.2.8 | **`ViewTransition`**, `addTransitionType`, `unstable_startGestureTransition`, `unstable_SuspenseList`, `unstable_getCacheForType`. Confirmed by diffing `Object.keys(require('react'))` on `latest` against `experimental`. Pages must label these, never teach them as shippable |
| `react-dom/client` | `createRoot` · `hydrateRoot` — and nothing else |
| `react-dom/server` | `renderToPipeableStream` `renderToReadableStream` `renderToStaticMarkup` `renderToString` **`resume`** **`resumeToPipeableStream`** |
| `react-dom/static` | `prerender` `prerenderToNodeStream` **`resumeAndPrerender`** **`resumeAndPrerenderToNodeStream`** — Partial Pre-rendering, new in 19.2 |
| React Compiler | **`babel-plugin-react-compiler@1.0.0`**, stable since **7 Oct 2025**. `react-compiler-runtime@1.0.0` is needed only when targeting React 17/18 |
| Compiler lint rules | Ship inside **`eslint-plugin-react-hooks@7.1.1`** (`recommended` preset). The separate `eslint-plugin-react-compiler` stopped at `19.1.0-rc.2` and is superseded |
| Ecosystem, measured | **React Router 8.3.0** (8.0.0 shipped 17 Jun 2026; the 7.x line is at 7.18.2) · **Next.js 16.3.0** (published 3 Aug 2026) · **`@vitejs/plugin-react` 6.0.5** |
| Governance | React moved to the **React Foundation** under the Linux Foundation on **24 Feb 2026** |
| Starting a project | **Create React App is sunset** (14 Feb 2025). Vite, React Router's framework mode, or Next.js |
| Security | Two Server Components advisories in December 2025 — a **critical** one (3 Dec) and a **DoS / source-code exposure** one (11 Dec). Anything RSC must be on a patched release; this is a Phase 10 topic, not a footnote |

**The single most load-bearing fact for this syllabus:** `ViewTransition` and
gesture transitions are all over blog posts and conference talks from 2025–26 and
are **still not in the stable package**. Any page that shows them says so on the
page.

## Parts

| # | Part | Covers | Phases | Topics |
|---|---|---|---|---|
| 1 | **[The React model](syllabus/01-the-react-model.md)** | How React runs, JSX, components, state and the render cycle | 0–3 | 65 |
| 2 | **[Hooks, completely](syllabus/02-hooks.md)** | Effects, refs/context/reducers, performance and the Compiler, custom hooks | 4–7 | 63 |
| 3 | **[Concurrent React and the server](syllabus/03-concurrent-and-server.md)** | Suspense and transitions, Actions, Server Components, SSR and hydration | 8–11 | 68 |
| 4 | **[Testing React](syllabus/04-building-an-app.md)** | React Testing Library, Jest/Vitest, events and API mocking. Phases 12 and 13 were **dropped** | 14 | 14 |
| 5 | **[Patterns](pages/patterns/README.md)** | The ten React patterns, indexed by the problem they solve. Four are taught here; six in the phase that introduces them | — | 10 |

## Progress

import Progress from '@site/src/components/Progress';

<Progress lang="react" compact />

## Tier distribution

| Tier | Topics | Share |
|---|---|---|
| <span className="db-tier t-master">Master</span> | 70 | 29 % |
| <span className="db-tier t-understand">Understand</span> | 142 | 58 % |
| <span className="db-tier t-know">Know</span> | 29 | 12 % |
| <span className="db-tier t-when">When Needed</span> | 3 | 1 % |
| **Total** | **244** | |

Counted from the four part files, not estimated.

| Part | Topics | Master |
|---|---|---|
| 1 The React model | 65 | 23 |
| 2 Hooks, completely | 63 | 20 |
| 3 Concurrent React and the server | 68 | 17 |
| 4 Testing React | 14 | 6 |

Master sits inside the brief's 25–30 % band, weighted toward Parts 1 and 2 —
**43 of the 66** — because the render cycle and the hook rules are what you use
with no documentation open, in every file, every day. Part 3 is deliberately
lighter on Master despite being the most *modern* material: Server Components
matter enormously and still change often enough that memorising the plumbing is
the wrong investment.

**Understand is unusually heavy here** (58 %, against 37 % for Node and 51 % for
TypeScript), and that is a real property of React rather than a rounding
artefact. React's surface is small and its *consequences* are large: there are
only about twenty hooks, and most of the syllabus is behaviour you must be able
to reason about — hydration mismatches, Suspense inside a transition, what
crosses the RSC boundary — rather than signatures you must recall. Very little
of React is genuinely "look it up the day you need it", which is why
<span className="db-tier t-when">When Needed</span> is nearly empty.

## Prerequisites

| | |
|---|---|
| Required | **JavaScript** through closures, `this`, array methods, destructuring, modules and **promises**. Stale closures are the number-one React bug and they are a JavaScript concept |
| Required | The **DOM and events** (JavaScript Phases 9–10) before React Phase 5 — refs and portals assume it |
| Strongly recommended | **TypeScript** Phases 0–3. Every real React codebase in 2026 is typed; the pages use TS in examples and explain the React-specific types |
| Required for Part 3 | **Node** Phase 0 (the runtime model). Server Components run in Node; "it runs on the server" is meaningless without knowing what that means |
| Pairs with | **Express** and **PostgreSQL** — for Server Components reaching a database directly (Phase 10). The planned Phase 12 on the React half of talking to your own API was **dropped** |
| Not required | Any bundler expertise. Phase 0 sets up Vite and moves on |

## Reading order

Phases are sequential through Phase 7, and the order is load-bearing:

1. **Do not skip Phase 3.** Every "React is weird" complaint — stale values,
   the state that didn't update, the infinite loop — traces back to the render
   cycle.
2. **Do not start Phase 4 (effects) before Phase 3 is solid.** Most misuse of
   `useEffect` is really a misunderstanding of when a component re-renders.
3. **Do not start Phase 10 (Server Components) before Phase 8.** RSC is built on
   Suspense; learning it first means learning the abstraction without the thing
   it abstracts.

Phases 12–14 are parallelizable — testing and accessibility can run alongside
whatever you are building.

## Example policy

Every page runs on **React 19.2.8** with **Node 24 LTS**, built with **Vite** and
`@vitejs/plugin-react 6.0.5` unless the topic is framework-specific. A page shows:

| | |
|---|---|
| The code | Complete and runnable — no `...` elisions, real component and prop names |
| What renders | The actual DOM or the actual console output, captured from a run |
| The failure | The exact React warning or error text, not a paraphrase |
| The measurement | Where a page claims something is slow or fast, a real profile — never an assertion |

Server-side topics run against a real server render. Anything that can only be
demonstrated inside a framework says which framework and which version.
Experimental APIs are labelled **⚠ Experimental — not in 19.2.8** and are shown
only where knowing they exist changes a decision you make today.

## Explanations

The explanations will live in **`pages/`** — one page per topic (or tight group),
with runnable code, gotchas written symptom → cause → fix, and interview
questions with answers. **277 pages are written** — phases 0–11 and 14, plus the
[Patterns](pages/patterns/README.md) section. Phases 12 and 13 were dropped.

## Tier legend

| Badge | Bar to clear |
|---|---|
| <span className="db-tier t-master">Master</span> | Use confidently with no documentation open |
| <span className="db-tier t-understand">Understand</span> | Know how it works; looking up signatures is fine |
| <span className="db-tier t-know">Know</span> | Know what, why and when; details on demand |
| <span className="db-tier t-when">When Needed</span> | Don't study upfront |

## Sources

- [React 19.2 release notes](https://react.dev/blog/2025/10/01/react-19-2) · [React v19](https://react.dev/blog/2024/12/05/react-19)
- [React Compiler v1.0](https://react.dev/blog/2025/10/07/react-compiler-1)
- [The React Foundation](https://react.dev/blog/2026/02/24/the-react-foundation) · [Sunsetting Create React App](https://react.dev/blog/2025/02/14/sunsetting-create-react-app)
- [Critical Security Vulnerability in React Server Components](https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components) · [Denial of Service and Source Code Exposure in RSC](https://react.dev/blog/2025/12/11/denial-of-service-and-source-code-exposure-in-react-server-components)
- [React versions](https://react.dev/versions) · [React reference](https://react.dev/reference/react)

---

Start → [Part 1 — The React model](syllabus/01-the-react-model.md)
