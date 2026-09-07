/**
 * The stack, grouped by the layer it lives in — the one place that says which
 * technologies exist, in what order, and under which heading.
 *
 * Split out of `src/pages/index.js` on 2026-09-05, when the docs sidebar gained a
 * technology rail. Before that the grouping existed only inside the homepage
 * component, so the rail would have had to either import a page or keep a second
 * copy of the list. A second copy is the kind that silently drifts: a technology
 * added to the homepage would simply be missing from the rail, and nothing would
 * fail.
 *
 * 🔴 What is NOT here, on purpose:
 *
 *   label, docsPath, page counts, phases, percentages   → `progress.js`
 *
 * `progress.js` already owns all of that for all 29 written tracks. Repeating a
 * label here would let the rail and the homepage disagree about what a technology
 * is called. So an entry is a `key` into `LANGUAGES` plus only what `progress.js`
 * has no opinion about: the homepage's one-line summary, and the hand-set `done`
 * flag.
 *
 * ── Fields ────────────────────────────────────────────────────────────────
 * `key`     index into `LANGUAGES` in `progress.js`. Everything displayable is
 *           read from there.
 * `desc`    the homepage card's one-line summary. Rail does not use it.
 * `done`    the syllabus is fully explained — every phase written, every topic
 *           covered, no broken links. 🔴 Hand-set, never derived from
 *           `percent === 100`: the percentage only knows a phase has *pages*, not
 *           whether those pages are finished. Express spent a while at 100% by
 *           the counter while still a draft, which is why this exists.
 * `short`   rail-only label, for the few names too long for a 170px column.
 *           Omitted means "use the label from `progress.js`".
 *
 * `imported` is deliberately absent — it lives on the language in `progress.js`
 * and reaches the homepage through `summarise()`. It is provenance, and provenance
 * belongs next to the numbers that measure the conversion.
 */

export const LAYERS = [
  {
    name: 'Frontend',
    note: 'What the browser runs',
    items: [
      {
        key: 'css',
        done: true,
        desc: 'Flexbox, Grid, container queries, and the 2026 feature set',
      },
      {
        key: 'javascript',
        done: true,
        desc: 'Language core, Web APIs, machine coding and an applied storefront — the DSA track is parked at its Master tier',
      },
      {
        key: 'typescript',
        desc: 'Narrowing, generics, mapped and conditional types, typed at every layer',
      },
      {
        key: 'react',
        done: true,
        desc: 'Every hook, the render cycle, Suspense, Actions, Server Components, and a patterns layer — phases 12 and 13 dropped by decision',
      },
      {
        key: 'nextjs',
        desc: 'App Router, Server Components, the caching model, PPR and Cache Components, deployment — a 19-chapter corpus imported at 16.2 and being refreshed chapter by chapter for 16.3',
      },
      {
        key: 'angular',
        desc: 'Signals, zoneless change detection, the signal component API, signal forms, httpResource and SSR — targeting Angular 22, the current major. Syllabus written; pages not started',
      },
    ],
  },
  {
    name: 'Backend',
    note: 'What the server runs',
    items: [
      {
        key: 'nodejs',
        done: true,
        desc: 'Runtime model, event loop, streams, security, production',
      },
      {
        key: 'expressjs',
        done: true,
        short: 'Express',
        desc: 'Routing, middleware, error handling, auth, layering',
      },
    ],
  },
  {
    name: 'Data',
    note: 'Where state lives',
    items: [
      {
        key: 'mongodb',
        desc: 'Document model, aggregation, indexes, Mongoose',
      },
      {
        key: 'postgresql',
        done: true,
        desc: 'SQL, indexes, MVCC, raw pg from Node, ops and security',
      },
      {
        key: 'redis',
        desc: 'Data types, caching patterns, sessions, rate limits, locks',
      },
    ],
  },
  {
    name: 'Infrastructure',
    note: 'How it ships and stays up',
    items: [
      {
        key: 'docker',
        done: true,
        short: 'Docker',
        desc: 'Namespaces and cgroups, multi-stage builds, Compose, rootless, Quadlet',
      },
      {
        key: 'nginx',
        desc: 'Reverse proxy, load balancing, TLS, caching',
      },
    ],
  },
  {
    name: 'Workflow',
    note: 'How the code gets there',
    items: [
      {
        key: 'git',
        done: true,
        desc: 'The object model, rebase vs merge, recovery, review workflow — re-scoped to the daily-driver 52',
      },
    ],
  },
  {
    name: 'Beyond the JS stack',
    note: 'Second backend languages',
    items: [
      {
        key: 'java',
        desc: 'JVM model, collections, virtual threads, Spring Boot, JPA, JUnit 5, GC and JFR — targeting JDK 25 LTS',
      },
      {
        key: 'python',
        desc: 'CPython and the GIL, the data model, typing, uv and ruff, asyncio, FastAPI, pytest — targeting 3.14',
      },
    ],
  },
  {
    name: 'Real world',
    note: 'One storefront, implemented across the whole stack',
    items: [
      {
        key: 'realworld',
        desc: 'The storefront: raw pg schema, Node services, the Express API, React hooks and screens, typed end to end',
      },
    ],
  },
  {
    name: 'Frontend toolchain',
    note: 'Moved in from the frontend-bible repo on 2026-08-14. Every page here already exists, so the percentage counts pages validated against this bible’s contract — a tier badge and a dated “Verified” line — not pages written. Jest & RTL is through that pass; Storybook was written here from phase 0',
    items: [
      {
        key: 'vite',
        desc: 'Dual-engine dev server, HMR, plugins, code-splitting — the draft predates Rolldown and the Environment API',
      },
      {
        key: 'webpack',
        desc: 'Module Federation, loaders, plugins, Tapable hooks, chunks — the draft never mentions Rspack',
      },
      {
        key: 'babel',
        desc: 'Compiler pipeline, presets/plugins, macros, SWC/esbuild migration — written against 7.x, before Babel 8',
      },
      {
        key: 'eslint-oxlint',
        short: 'ESLint',
        desc: 'Flat config, typescript-eslint, Oxlint, dual-run, CI — three pages still reference .eslintrc, and none name ESLint 10',
      },
      {
        key: 'jest-rtl',
        desc: 'JSDOM, async queries, module mocking, userEvent, coverage — validated end to end, with a syllabus and a 14-page configs reference; the version pass to Jest 30 is still owed',
      },
      {
        key: 'playwright',
        desc: 'Cross-browser E2E, visual regression, network interception, CI — the draft names no Playwright version anywhere',
      },
      {
        key: 'storybook',
        desc: 'CSF, args and controls, decorators, interaction and a11y testing — written to full depth from phase 0, alongside 22 imported pages',
      },
      {
        key: 'redux-toolkit',
        desc: 'RTK Query, Immer, entity adapters, custom middleware — the least version drift of the eleven, so the draft is the closest to current',
      },
      {
        key: 'tanstack-query',
        desc: 'QueryCache internals, mutations, optimistic updates, SSR — the draft predates v5',
      },
      {
        key: 'framer-motion',
        desc: 'Layout animations, FLIP, AnimatePresence, scroll and gestures — every import in the draft is the old framer-motion package, now motion/react',
      },
      {
        key: 'web-vitals-performance',
        short: 'Web Vitals',
        desc: 'LCP, INP, CLS, critical rendering path, budgets — two pages still teach FID, retired in 2024',
      },
      {
        key: 'frontend-architecture',
        short: 'Architecture',
        desc: 'Micro-frontends, monorepos, state machines, observability — not version-pinned by nature; the risk here is stale practice',
      },
    ],
  },
  {
    /**
     * The senior loop: what product-company interviews and staff-level ownership
     * test beyond any one technology. Added 2026-09-07. This layer replaced the
     * parked "Beyond the core stack" list (GraphQL, tRPC, Kubernetes) — all three
     * are now phases inside System Design rather than cards of their own.
     */
    name: 'Architecture and interviews',
    note: 'What the senior loop tests',
    items: [
      {
        key: 'dsa',
        desc: 'The coding rounds: patterns, complexity, the problem ladder pattern by pattern, design-flavoured problems, in TypeScript first and Java second — syllabus written, pages not started',
      },
      {
        key: 'system-design',
        desc: 'HLD and LLD, distributed theory, Kafka, Kubernetes and IaC, reliability, security, AI systems, and the catalogue of 53 classic designs — syllabus written, pages not started',
      },
    ],
  },
];
