---
name: devbible-react-syllabus
description: The React syllabus — 15 phases, 244 topics, written 2026-08-13 and UI-wired; the measured React 19.2.8 API facts and the experimental-vs-stable trap
metadata:
  type: project
---

Written 2026-08-13 on the user's instruction ("pick react js which should be relevant and
upto date till 2026 aug … all concepts and hooks server api total react"), with a
mid-turn correction: **"Syllabus structure should follow other syllabus pick one node
js"** — so the shape is modelled on `docs/nodejs/`, not TypeScript's. Syllabus only —
**no explanation pages exist yet**.

## Where it lives

`docs/react/` — `README.md` + `syllabus/01…04` + both `_category_.json`
(`{"label":"React","position":7}`; positions 1–6 were already taken by
nodejs/expressjs/postgresql/javascript/typescript/css). Straight into its final home,
the JavaScript and TypeScript precedent.

## Shape

**15 phases · 244 topics · 4 parts.** Master 70 (29 %) · Understand 142 (58 %) ·
Know 29 (12 %) · When Needed 3 (1 %). **Counted with grep, not estimated** — the first
draft README carried invented Understand/Know/When numbers (125/43/6) that were wrong
and were corrected from the files.

| Part | Phases | Topics | Master |
|---|---|---|---|
| 1 The React model — how React runs, JSX, components, state and the render cycle | 0–3 | 65 | 23 |
| 2 Hooks, completely — effects, refs/context/reducers, performance + Compiler, custom hooks | 4–7 | 63 | 20 |
| 3 Concurrent React and the server — Suspense/transitions, Actions, RSC, SSR/hydration | 8–11 | 68 | 17 |
| 4 Building a real app — data/state, routing/structure, correctness and delivery | 12–14 | 48 | 10 |

**Understand at 58 % is deliberate and defended on the page** (Node is 37 %, TS 51 %).
React's surface is small and its consequences are large — ~20 hooks, and most of the
syllabus is behaviour you must reason about (hydration mismatch, Suspense inside a
transition, what crosses the RSC boundary) rather than signatures to recall. Almost
nothing in React is genuinely "look it up the day you need it", hence 3 When-Needed rows.

**Every hook React ships is placed.** The 18 in `react` + `useFormStatus`/`useFormState`
in `react-dom` + `use`. The four concurrent/action hooks (`useTransition`,
`useDeferredValue`, `useActionState`, `useOptimistic`) are held back to Part 3 on
purpose — unlearnable without Suspense and Actions around them; Part 2 says so in a note.

## Version facts — measured, not recalled (2026-08-13)

Probed in the scratchpad (`npm view`, plus `Object.keys()` on the installed packages):

1. **`react@19.2.8` / `react-dom@19.2.8` are `latest`**, published **2026-07-21**.
   Latest *minor* is **19.2 (1 Oct 2025)** — **no 19.3 stable** as of Aug 2026, patch-only
   for ten months. Canary `19.3.0-canary-22e4f993-20260811`.
2. 🔴 **`ViewTransition` is NOT in stable.** Diffing `Object.keys(require('react'))` on
   `latest` vs `experimental` shows experimental-only: **`ViewTransition`**,
   `addTransitionType`, `unstable_startGestureTransition`, `unstable_SuspenseList`,
   `unstable_getCacheForType`, `experimental_useOptimistic`, `optimisticKey`.
   **This is the trap of the whole syllabus** — View Transitions are all over 2025–26
   blog posts and talks. Every page showing them must be labelled
   `⚠ Experimental — not in 19.2.8`.
3. Stable `react` also exports `Activity`, `cacheSignal`, `useEffectEvent`,
   `captureOwnerStack`, `cache`, `act`, `unstable_useCacheRefresh`, `__COMPILER_RUNTIME`.
4. `react-dom/client` is exactly `createRoot` + `hydrateRoot`.
   `react-dom/server`: `renderToPipeableStream` `renderToReadableStream`
   `renderToStaticMarkup` `renderToString` **`resume`** **`resumeToPipeableStream`**.
   `react-dom/static`: `prerender` `prerenderToNodeStream` **`resumeAndPrerender`**
   **`resumeAndPrerenderToNodeStream`** (Partial Pre-rendering, 19.2).
5. `react-dom` still exports **`useFormState`** — deprecated, renamed `useActionState`.
6. **React Compiler is stable**: `babel-plugin-react-compiler@1.0.0` (2025-10-07),
   `react-compiler-runtime@1.0.0` (only for React 17/18 targets),
   `react-compiler-webpack@1.0.1`. Lint rules ship inside
   **`eslint-plugin-react-hooks@7.1.1`** `recommended`; the standalone
   `eslint-plugin-react-compiler` stopped at `19.1.0-rc.2` and is superseded.
7. Ecosystem: **React Router 8.3.0** (8.0.0 shipped 2026-06-17; 7.x at 7.18.2) ·
   **Next.js 16.3.0** (2026-08-03) · **`@vitejs/plugin-react` 6.0.5**.
8. **React Foundation** under the Linux Foundation since **2026-02-24**.
   **CRA sunset** 2025-02-14.
9. **Two RSC security advisories, Dec 2025** — critical (3 Dec) and DoS/source-code
   exposure (11 Dec). Given a syllabus row in Phase 10, not a footnote.

## Scope boundaries drawn

Rule stated on the README: *if removing React would remove the topic, it is React's.*
JS semantics → JavaScript · typing → TypeScript Phase 8 · styling → CSS ·
HTTP/API contract → Express · query design → PostgreSQL · SPA fallback + cache headers
→ Nginx. Two deliberate overlaps, handled by linking: **routing** (Phase 13 — React owns
the integration, the router owns its API) and **RSC** (Phase 10 — React owns the model
and directives, the framework owns the plumbing). Consistent with
[[devbible-scope-boundaries]]; no domain-modelling phase, per [[devbible-typescript-syllabus]].

## UI wiring — done

Four files, matching the TypeScript precedent: `sidebars.js` (`reactSidebar`),
`src/data/progress.js` (`react` block, 15 phases, every `pages: 0`, topics summing to
244), `src/pages/index.js` (card **04** activated with live `summarise('react')`),
`docs/README.md` (React row → "Syllabus complete").

## Traps hit this session

- **`cd` persists across Bash calls.** A `cd docs` earlier in the turn made a later
  `mkdir -p docs/react/syllabus` create `docs/docs/react/` — removed. Use absolute paths.
- **A `</content></invoke>` fragment landed at the end of the written README** and had to
  be stripped. Check the tail of a long Write.
- MDX hazards were checked with a script (bare `<Component>` outside backticks, bare `{`,
  wrong pipe count per table row) — all clean before building.

Related: [[devbible-brief]] · [[devbible-progress]] · [[devbible-scope-boundaries]] ·
[[devbible-typescript-syllabus]] · [[devbible-never-compress-to-fit-cap]]
