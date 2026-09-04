/**
 * Single source of truth for "which version of each product this bible targets".
 *
 * The companion to `progress.js`. That file answers *how much is written*; this
 * one answers *is what is written still current*. Same arrangement: this file is
 * hand-maintained, `scripts/currency.mjs` reads it and generates
 * `static/currency.json`, and nothing else is edited by hand.
 *
 *   yarn currency           # rewrite static/currency.json
 *   yarn currency --check   # exit 1 if a pin has drifted (CI)
 *   yarn currency --scan    # also list the pages naming each pin
 *
 * ── Why watch products instead of re-reading pages ────────────────────────────
 * The corpus carries 4,400+ `> Verified:` lines and 1,400 of them name an exact
 * version. Re-verifying pages does not scale; watching ~40 upstream releases a
 * year does, and a grep maps a release back to the pages that name it.
 *
 * ── Fields ───────────────────────────────────────────────────────────────────
 * `source`   where "latest" comes from. Three forms, all reachable without auth:
 *              npm:<package>        registry.npmjs.org — exact, fastest
 *              eol:<product>        endoflife.date — ALSO gives EOL and LTS
 *                                   dates, which npm cannot. Use it for anything
 *                                   with a release *cycle* (runtimes, databases).
 *              gh:<owner>/<repo>    GitHub tags — the stragglers only.
 *
 * `policy`   🔴 NOT optional. It is what stops the checker crying wolf.
 *              'latest'  track the newest release.
 *              'lts'     track the current LTS line ONLY. A newer major is not
 *                        drift until it becomes LTS. Node 26.8.1 exists today
 *                        and Node 24 is still correct — without this field the
 *                        checker would demand work on 311 pages for nothing,
 *                        and then be ignored on 2026-10-28 when it matters.
 *              'major'   stay on `cycle`; only that line's patches are drift.
 *              'frozen'  deliberately pinned old. `reason` is then REQUIRED.
 *
 * `pin`      the version the corpus targets. `null` means the track has NO
 *            version anchor anywhere — a real defect, reported as `unanchored`,
 *            not silently skipped.
 * `cycle`    the release line, for policy 'major' / 'lts'.
 * `checked`  YYYY-MM-DD the pin was last confirmed against the source by a human
 *            or by `yarn currency`. Never back-date it.
 * `tracks`   docs/<dir> this pin governs. Drives the per-language rollup.
 * `names`    lowercase strings to look for in `> Verified:` lines when scanning
 *            for affected pages. Order does not matter; keep them specific
 *            enough not to collide (see 'motion' below).
 */

export const PINS = {
  // ── Runtimes, databases, servers ───────────────────────────────────────────
  node: {
    label: 'Node.js', source: 'eol:nodejs', policy: 'lts', cycle: '24',
    pin: '24.19.0', checked: '2026-08-31',
    tracks: ['nodejs', 'expressjs', 'javascript', 'typescript', 'postgresql', 'real-world'],
    names: ['node', 'node.js'],
    note: 'Node 26 becomes LTS 2026-10-28 — 311 pages say "Active LTS" and that claim expires then.',
  },
  postgresql: {
    label: 'PostgreSQL', source: 'eol:postgresql', policy: 'major', cycle: '18',
    pin: '18.4', patchIndex: 1, checked: '2026-08-31', tracks: ['postgresql', 'nodejs'],
    names: ['postgresql', 'postgres'],
  },
  mongodb: {
    label: 'MongoDB', source: 'eol:mongodb', policy: 'latest',
    // `nodejs` added 2026-09-03: `phase-6-data-access/05-mongodb-from-node.md`
    // bolds a server version. ⚠️ `docs/java` is deliberately NOT here — its
    // matches are *Spring Data MongoDB* 5.1, a different product.
    pin: '8.0', checked: '2026-08-31', tracks: ['mongodb', 'nodejs'], names: ['mongodb', 'mongo'],
  },
  redis: {
    label: 'Redis', source: 'eol:redis', policy: 'latest',
    pin: '8.10.0', checked: '2026-08-31', tracks: ['redis', 'nodejs'], names: ['redis'],
  },
  nginx: {
    label: 'Nginx', source: 'eol:nginx', policy: 'latest',
    pin: '1.31.3', checked: '2026-08-31', tracks: ['nginx'], names: ['nginx'],
  },
  docker: {
    label: 'Docker Engine', source: 'eol:docker-engine', policy: 'latest',
    pin: '29.7.2', checked: '2026-08-31', tracks: ['docker'], names: ['docker engine', 'docker'],
  },
  podman: {
    label: 'Podman', source: 'gh:containers/podman', policy: 'latest',
    pin: '6.1.0', checked: '2026-08-31', tracks: ['docker'], names: ['podman'],
  },
  python: {
    label: 'Python', source: 'eol:python', policy: 'latest',
    pin: '3.14', checked: '2026-08-31', tracks: ['python'], names: ['python', 'cpython'],
  },
  jdk: {
    label: 'JDK (Temurin)', source: 'eol:eclipse-temurin', policy: 'lts', cycle: '25',
    pin: '25', checked: '2026-08-31', tracks: ['java'], names: ['jdk', 'java'],
  },
  git: {
    label: 'Git', source: 'gh:git/git', policy: 'latest',
    pin: '2.55.0', checked: '2026-08-31', tracks: ['git'], names: ['git'],
  },
  firefox: {
    // 🔴 'frozen', not 'latest' — and the distinction matters more than it looks.
    //
    // Firefox is not something this bible TARGETS. It is the instrument the CSS
    // and React measurements were taken with, and `> Verified: 2026-08 in
    // **Firefox 153.0.3** via sandbox/css/ex09-…` is a provenance record. A
    // record of what was measured does not become false when a newer browser
    // ships.
    //
    // Modelling it as 'latest' produced a 48-page "major drift" alarm on
    // 2026-08-31 whose only cheap fix would have been to rewrite 153.0.3 →
    // 154.0.1 inside lines naming a script that was never re-run — i.e. to
    // fabricate a verification. That is the exact failure 216 PostgreSQL pages
    // once shipped, and a currency tool that pressures you into it is worse
    // than no tool.
    //
    // The instrument moving is still worth knowing, so the newer version is
    // resolved and reported — as information, not as drift. Re-measuring on a
    // newer Firefox is a real job, decided deliberately, never implied by a
    // version number.
    label: 'Firefox', source: 'eol:firefox', policy: 'frozen',
    pin: '153.0.3', checked: '2026-08-31', tracks: ['css', 'react'], names: ['firefox'],
    reason: 'Measurement instrument, not a target. Bumping the string without re-running the scripts would fabricate a verification.',
    note: 'System Firefox is 154.0.1 as of 2026-08-31 and the harness drives it fine — re-measuring is possible, it is simply a decision nobody has made.',
  },

  // ── The JS/TS stack ────────────────────────────────────────────────────────
  react: {
    label: 'React', source: 'npm:react', policy: 'latest',
    pin: '19.2.8', checked: '2026-08-31',
    tracks: ['react', 'jest-rtl', 'storybook', 'redux-toolkit', 'tanstack-query', 'framer-motion', 'real-world'],
    names: ['react', 'react-dom'],
  },
  typescript: {
    label: 'TypeScript', source: 'npm:typescript', policy: 'latest',
    pin: '7.0.2', checked: '2026-08-31', tracks: ['typescript', 'real-world'], names: ['typescript'],
  },
  express: {
    label: 'Express', source: 'npm:express', policy: 'latest',
    pin: '5.2.1', checked: '2026-08-31', tracks: ['expressjs'], names: ['express'],
  },
  angular: {
    label: 'Angular', source: 'npm:@angular/core', policy: 'latest',
    pin: '22.1.4', checked: '2026-08-31', tracks: ['angular'], names: ['angular'],
  },
  next: {
    label: 'Next.js', source: 'npm:next', policy: 'latest',
    // `nextjs` added 2026-09-03 — the track landed in commit `12349e4e` and the
    // pin that governs it still pointed only at `react`.
    // 🔴 16.3.1 → 16.3.4 is NOT a patch bump. It spans 16.3.3, the August 2026 security
    // release, which DISABLED AVIF image optimization to mitigate GHSA-2xp9-vwfh-vxw4
    // (unauthenticated RCE via libheif under sharp). A changed default reclassifies to
    // `minor` per the triage ladder — and that prose work was done 2026-09-03 across
    // docs/nextjs/. Do not treat a future 16.3.x the same way without reading the headline.
    pin: '16.3.4', checked: '2026-09-03', tracks: ['react', 'nextjs'], names: ['next.js', 'next'],
  },
  npm: {
    label: 'npm', source: 'npm:npm', policy: 'latest',
    pin: '12.0.2', checked: '2026-08-31', tracks: ['nodejs'], names: ['npm'],
  },
  undici: {
    label: 'undici', source: 'npm:undici', policy: 'latest',
    pin: '8.10.0', checked: '2026-08-31', tracks: ['nodejs'], names: ['undici'],
  },
  // Added 2026-09-03 under the library necessity test: password storage cannot be
  // taught without it. 6.0.0 published 2025-05-11; `engines: {node: '>= 18'}`.
  // ⚠️ NOT installed in this checkout — pages about it are doc-verified (T2), never
  // probed, because a probe needs the package present at the pinned version.
  bcrypt: {
    label: 'bcrypt', source: 'npm:bcrypt', policy: 'latest',
    pin: '6.0.0', checked: '2026-09-03', tracks: ['nodejs', 'expressjs', 'real-world'],
    names: ['bcrypt'],
    note: 'Native addon (node-gyp-build). Versions < 5.0.0 mishandle NUL bytes and truncate at 255 chars — a real upgrade boundary, not just a version number.',
  },
  // Added 2026-09-03 under the library necessity test: the Next.js PWA guide's push
  // chapter cannot be taught without it — sending a Web Push message requires VAPID JWT
  // signing plus aes128gcm payload encryption, which nobody hand-rolls. 3.6.7 confirmed
  // against registry.npmjs.org on 2026-09-03.
  // ⚠️ NOT installed in this checkout — pages about it are doc-verified (T2), never probed.
  webpush: {
    label: 'web-push', source: 'npm:web-push', policy: 'latest',
    pin: '3.6.7', checked: '2026-09-03', tracks: ['nextjs'],
    names: ['web-push'],
    note: 'Server side of Web Push only. The browser half (PushManager, VAPID public key) is platform API and has no pin.',
  },
  zod: {
    label: 'Zod', source: 'npm:zod', policy: 'latest',
    // `real-world` added 2026-09-03: 17 pages there bold **zod 4.4.3** and were
    // invisible to the scan while it ignored `tracks`. Zod is a minor behind.
    // `nextjs` added 2026-09-04, same defect: 18+ pages under docs/nextjs/pages name
    // zod and five bold **4.4.3**, and the scan could not see any of them.
    pin: '4.4.3', checked: '2026-08-31', tracks: ['nodejs', 'expressjs', 'real-world', 'nextjs'], names: ['zod'],
  },
  turbo: {
    label: 'Turborepo', source: 'npm:turbo', policy: 'latest',
    // Added 2026-09-04 with nextjs ch13 topic 04, which teaches it across four pages.
    // A monorepo reference implementation cannot be built without it, so it clears the
    // library-scope bar. Note turborepo.com now 301s to turborepo.dev.
    pin: '2.10.12', checked: '2026-09-04', tracks: ['nextjs'], names: ['turborepo', 'turbo'],
  },
  valibot: {
    label: 'Valibot', source: 'npm:valibot', policy: 'latest',
    pin: '1.4.2', checked: '2026-08-31', tracks: ['nodejs'], names: ['valibot'],
  },
  esbuild: {
    label: 'esbuild', source: 'npm:esbuild', policy: 'latest',
    pin: '0.28.2', checked: '2026-08-31', tracks: ['typescript', 'vite'], names: ['esbuild'],
  },
  docusaurus: {
    label: 'Docusaurus', source: 'npm:@docusaurus/core', policy: 'latest',
    pin: '3.10.2', checked: '2026-08-31', tracks: [], names: ['docusaurus'],
    note: 'The site itself, not a subject. Drift here breaks the build, not a claim.',
  },

  // ── The Java stack ─────────────────────────────────────────────────────────
  springBoot: {
    label: 'Spring Boot', source: 'eol:spring-boot', policy: 'latest',
    pin: '4.1.1', checked: '2026-09-04', tracks: ['java'], names: ['spring boot'],
  },
  springFramework: {
    label: 'Spring Framework', source: 'eol:spring-framework', policy: 'latest',
    pin: '7.0.9', checked: '2026-09-04', tracks: ['java'], names: ['spring framework'],
  },
  mockito: {
    label: 'Mockito', source: 'gh:mockito/mockito', policy: 'latest',
    pin: '5.23.0', checked: '2026-08-31', tracks: ['java'], names: ['mockito'],
  },
  junit: {
    label: 'JUnit', source: 'gh:junit-team/junit-framework', policy: 'latest',
    pin: '6.0.3', checked: '2026-08-31', tracks: ['java'], names: ['junit'],
    note: 'The repo is junit-team/junit-framework — junit-team/junit5 now 301-redirects.',
  },
  testcontainers: {
    label: 'Testcontainers', source: 'gh:testcontainers/testcontainers-java', policy: 'latest',
    pin: '2.0.5', checked: '2026-08-31', tracks: ['java'], names: ['testcontainers'],
  },
  jooq: {
    label: 'jOOQ', source: 'gh:jOOQ/jOOQ', policy: 'latest',
    pin: '3.21', checked: '2026-08-31', tracks: ['java'], names: ['jooq'],
  },
  flyway: {
    label: 'Flyway', source: 'gh:flyway/flyway', policy: 'latest',
    pin: '12', checked: '2026-08-31', tracks: ['java'], names: ['flyway'],
  },

  // ── The frontend toolchain ─────────────────────────────────────────────────
  // 🔴 `pin: null` is deliberate and is a FINDING, not a gap in this file. These
  // tracks were imported on 2026-08-14 and name no version anywhere, so no page
  // can be checked against anything. See project_frontend_toolchain_currency_plan.
  vite:       {label: 'Vite',            source: 'npm:vite',                    policy: 'latest', pin: null, checked: '2026-08-31', tracks: ['vite'],                  names: ['vite']},
  webpack:    {label: 'Webpack',         source: 'npm:webpack',                 policy: 'latest', pin: null, checked: '2026-08-31', tracks: ['webpack'],               names: ['webpack']},
  babel:      {label: 'Babel',           source: 'npm:@babel/core',             policy: 'latest', pin: null, checked: '2026-08-31', tracks: ['babel'],                 names: ['babel']},
  eslint:     {label: 'ESLint',          source: 'npm:eslint',                  policy: 'latest', pin: null, checked: '2026-08-31', tracks: ['eslint-oxlint'],         names: ['eslint']},
  oxlint:     {label: 'Oxlint',          source: 'npm:oxlint',                  policy: 'latest', pin: null, checked: '2026-08-31', tracks: ['eslint-oxlint'],         names: ['oxlint']},
  jest:       {label: 'Jest',            source: 'npm:jest',                    policy: 'latest', pin: null, checked: '2026-08-31', tracks: ['jest-rtl'],              names: ['jest']},
  rtl:        {label: 'Testing Library', source: 'npm:@testing-library/react',  policy: 'latest', pin: null, checked: '2026-08-31', tracks: ['jest-rtl'],              names: ['testing library', 'rtl']},
  playwright: {label: 'Playwright',      source: 'npm:playwright',              policy: 'latest', pin: null, checked: '2026-08-31', tracks: ['playwright'],            names: ['playwright']},
  storybook:  {label: 'Storybook',       source: 'npm:storybook',               policy: 'latest', pin: '10.5.8', checked: '2026-08-31', tracks: ['storybook'],         names: ['storybook']},
  // 2026-09-05, nextjs ch08 topic 05: both gained a pin AND the `nextjs` track. The chapter
  // teaches each across six pages, and an unpinned library is one nothing watches — the same
  // defect that left bcrypt, helmet, multer and passport taught across 81 pages with zero pins.
  rtk:        {label: 'Redux Toolkit',   source: 'npm:@reduxjs/toolkit',        policy: 'latest', pin: '2.12.0', checked: '2026-09-05', tracks: ['redux-toolkit', 'nextjs'], names: ['redux toolkit', 'rtk'],
    note: 'react-redux 9.3.0 travels with it. RTK Query has no documented server-prefetch equivalent of HydrationBoundary; its own docs recommend client-only fetching.'},
  tanstack:   {label: 'TanStack Query',  source: 'npm:@tanstack/react-query',   policy: 'latest', pin: '5.102.8', checked: '2026-09-05', tracks: ['tanstack-query', 'nextjs'], names: ['tanstack query', 'react query'],
    note: '@tanstack/query-core and @tanstack/react-query-next-experimental share the version. The docs on main show queryClient.query() and environmentManager.isServer(), which read as unreleased v6 API — they are not; both ship in published 5.102.8.'},
  motion:     {label: 'Motion',          source: 'npm:motion',                  policy: 'latest', pin: null, checked: '2026-08-31', tracks: ['framer-motion'],         names: ['framer motion', 'framer-motion'],
    note: 'Package renamed framer-motion → motion. 14 pages still import the old name.'},
  // ── Added 2026-09-05 with nextjs ch10 · forms, auth and security hardening ──
  // 🔴 next-auth is 'major' on cycle 5, NOT 'latest', and the distinction is load-bearing:
  // npm `latest` resolves to 4.24.15 while the chapter teaches v5. A 'latest' policy would
  // report these nine pages as stale forever and be ignored when they actually go stale.
  nextauth: {
    label: 'Auth.js (NextAuth)', source: 'npm:next-auth', policy: 'major', cycle: '5',
    pin: '5.0.0-beta.32', checked: '2026-09-05', tracks: ['nextjs'],
    names: ['next-auth', 'nextauth', 'auth.js'],
    note: 'v5 is still on the beta dist-tag (published 2026-07-20); npm latest is v4. The project states no date for a stable v5. @auth/core 0.41.3 travels with it and is not installed directly.',
  },
  // 🔴 bcrypt was taught across 32 pages of this corpus with NO pin at all — the exact gap
  // library-scope.md exists to close. Tracks set from a grep of what actually teaches it.
  bcrypt: {
    label: 'bcrypt', source: 'npm:bcrypt', policy: 'latest',
    pin: '6.0.0', checked: '2026-09-05',
    tracks: ['nextjs', 'nodejs', 'javascript', 'expressjs', 'real-world'],
    names: ['bcrypt'],
    note: 'Only the first 72 BYTES of a password are used, not the first 72 characters — a multi-byte password is truncated earlier than it looks.',
  },
  reactHookForm: {
    label: 'React Hook Form', source: 'npm:react-hook-form', policy: 'latest',
    pin: '7.87.0', checked: '2026-09-05', tracks: ['nextjs', 'react', 'real-world'],
    names: ['react-hook-form', 'react hook form'],
    note: '@hookform/resolvers 5.9.1 is the zod bridge and travels with it. RHF documentation never mentions Server Actions.',
  },
  jose: {
    label: 'jose', source: 'npm:jose', policy: 'latest',
    pin: '6.2.11', checked: '2026-09-05', tracks: ['nextjs', 'real-world'],
    names: ['jose'],
    note: 'Unsecured JWTs (alg: none) are never accepted by its verify API — the reason ch10 teaches it over jsonwebtoken 9.0.3.',
  },
  clerk: {
    label: 'Clerk', source: 'npm:@clerk/nextjs', policy: 'latest',
    pin: '7.9.1', checked: '2026-09-05', tracks: ['nextjs'], names: ['clerk', '@clerk/nextjs'],
  },
  supabase: {
    label: 'Supabase JS', source: 'npm:@supabase/supabase-js', policy: 'latest',
    pin: '2.115.0', checked: '2026-09-05', tracks: ['nextjs'],
    names: ['supabase', '@supabase/supabase-js'],
    note: '@supabase/ssr 0.12.6 travels with it. Its own docs: never trust supabase.auth.getSession() in server code such as Proxy.',
  },
  // Added 2026-09-05 with nextjs ch08 topic 03: nuqs is taught across two pages as the library
  // that packages typed search-param state, and topic 04 teaches jotai across three.
  nuqs:       {label: 'nuqs',           source: 'npm:nuqs',                    policy: 'latest', pin: '2.10.1', checked: '2026-09-05', tracks: ['nextjs'],            names: ['nuqs'],
    note: 'Throttles URL writes because browsers rate-limit history calls; Safari is the strict case at 120ms (320ms on older versions). Its server loaders parse but deliberately do not validate.'},
  jotai:      {label: 'Jotai',          source: 'npm:jotai',                   policy: 'latest', pin: '2.20.3', checked: '2026-09-05', tracks: ['nextjs', 'react'],   names: ['jotai'],
    note: 'A module-level default store is shared across requests on the server. atomWithHash documents a dependency on Router.events, which the App Router does not expose.'},
  // Added 2026-09-05 with nextjs ch08. Zustand is taught across the whole ch08 milestone
  // (the scoped board store, selectors, hydration) and in topic 04's comparison, so under the
  // library-necessity test it earns a pin rather than being taught with nothing watching it.
  zustand:    {label: 'Zustand',        source: 'npm:zustand',                 policy: 'latest', pin: '5.0.15', checked: '2026-09-05', tracks: ['nextjs', 'react'],   names: ['zustand'],
    note: 'v5 is stricter than v4 about selectors returning fresh references: a new object from a selector loops until Maximum update depth exceeded. useShallow is the documented fix.'},
  webVitals:  {label: 'web-vitals',      source: 'npm:web-vitals',              policy: 'latest', pin: null, checked: '2026-08-31', tracks: ['web-vitals-performance'], names: ['web-vitals', 'web vitals']},
};

/** Tracks with no pin governing them at all — nothing to check, and worth saying so. */
export const UNGOVERNED = ['frontend-architecture', 'real-world'];
