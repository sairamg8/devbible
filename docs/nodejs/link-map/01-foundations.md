---
title: "Link map · Node.js · Part 1 Foundations (phases 0–2)"
sidebar_label: "01 · Foundations"
sidebar_position: 1
---

# Link map · Node.js · Part 1 Foundations (phases 0–2)

Covers every topic row of `docs/nodejs/syllabus/01-foundations.md`: T00-01 to T00-13 (phase 0, runtime model), T01-01 to T01-16 (phase 1, modules and packages), T02-01 to T02-26 (phase 2, async and the event loop; numbered straight through its four sub-tables). **All 55 rows have a page of ours** under `docs/nodejs/pages/phase-0-runtime-model`, `phase-1-modules` and `phase-2-async`; where one page answers two rows both blocks name it.
*read* = I read the passage; *headings only* = fetched, headings and size checked. `#anchors` appear only where the id exists in the fetched HTML.

🔴 **Version note.** Node API docs are linked at `/docs/latest/`, which on 2026-10-12 is **v26.11.1**. Pages under nodejs.org/learn carry no date, so only the fetch date is given; third-party links carry theirs, or "undated" where the page shows none. `github.com` and `npmjs.com` return 403 to our fetcher, so the nvm, fnm, volta and p-limit repo pages can never be a Read-this (p-limit is read from its jsDelivr readme copy instead).

🔴 **Three places where the Node docs disagree with the syllabus text** (details in the blocks): `--experimental-transform-types` is **removed in v26.0.0** (T01-10); `module.register()` is **runtime-deprecated in v26.0.0** (T01-16); `process.nextTick` is marked **Legacy** since v22.7.0 / v20.18.0 (T02-03).

---

## Phase 0 — The runtime model

### T00-01 · What Node.js is: V8 + libuv + bindings + stdlib — Master · ✅ written `docs/nodejs/pages/phase-0-runtime-model/01-what-node-is.md`
- **Read this:** [Introduction to Node.js](https://nodejs.org/learn/getting-started/introduction-to-nodejs) · nodejs.org · runs V8 outside the browser, one process with no new thread per request, async I/O primitives in the stdlib (*read*) · covers our angle: **partial** — the four-part breakdown (libuv, C++ bindings) is not drawn on this page · fetched 2026-10-12
- **Also good:** [libuv Design overview](https://docs.libuv.org/en/v1.x/design.html) · libuv.org · handles and requests, the I/O loop, file I/O; states that libuv uses a thread pool for file I/O but network I/O stays on the loop thread (*read*) · fetched 2026-10-12
- **Our delta:** the V8 / libuv / bindings / stdlib split is ours to draw; neither page names all four.

### T00-02 · Single-threaded execution vs multi-threaded I/O — Master · ✅ `…/02-single-thread-and-io.md`
- **Read this:** [Overview of Blocking vs Non-Blocking](https://nodejs.org/learn/asynchronous-work/overview-of-blocking-vs-non-blocking) · nodejs.org · defines blocking as JavaScript waiting on a non-JavaScript operation while the loop cannot continue (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Don't Block the Event Loop (or the Worker Pool)](https://nodejs.org/learn/asynchronous-work/dont-block-the-event-loop) · nodejs.org · one Event Loop plus a pool of k Workers; the thread model in one section (*read*) · fetched 2026-10-12

### T00-03 · Blocking the event loop — Master · ✅ `…/03-blocking-the-event-loop.md`
- **Read this:** [Don't Block the Event Loop (or the Worker Pool)](https://nodejs.org/learn/asynchronous-work/dont-block-the-event-loop) · nodejs.org · what runs on the loop vs the pool, then what to avoid (REDOS is a named section) (*read* intro and API list) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Overview of Blocking vs Non-Blocking](https://nodejs.org/learn/asynchronous-work/overview-of-blocking-vs-non-blocking) · nodejs.org · sections "Comparing Code" and "Dangers of Mixing Blocking and Non-Blocking Code" (*read* first section) · fetched 2026-10-12

### T00-04 · The libuv thread pool (size 4, `UV_THREADPOOL_SIZE`) — Understand · ✅ `…/04-libuv-thread-pool.md`
- **Read this:** [libuv Thread pool work scheduling](https://docs.libuv.org/en/v1.x/threadpool.html) · libuv.org · used for file system operations plus getaddrinfo and getnameinfo; default size 4, set by `UV_THREADPOOL_SIZE`, absolute maximum 1024 (raised from 128 in libuv 1.30.0) (*read*) · covers our angle: **partial** — says nothing of which Node APIs hit it · fetched 2026-10-12
- **Also good:** [Don't Block the Event Loop → Worker Pool](https://nodejs.org/learn/asynchronous-work/dont-block-the-event-loop) · nodejs.org · lists the Node APIs: `dns.lookup()` and `dns.lookupService()`, all `fs` except FSWatcher and the explicit sync ones, `crypto.pbkdf2/scrypt/randomBytes/randomFill/generateKeyPair`, and "All zlib APIs except those that are explicitly synchronous" (*read*) · fetched 2026-10-12
- **Our delta:** this page also settles the syllabus claim: `zlib` is on the Worker Pool list. The libuv page names only the file system, `getaddrinfo` and `getnameinfo`, so cite the Node page for the Node APIs.

### T00-05 · Node vs browser — Understand · ✅ `…/05-node-vs-browser.md`
- **Read this:** [Differences between Node.js and the Browser](https://nodejs.org/learn/getting-started/differences-between-nodejs-and-the-browser) · nodejs.org · no `document`, `window` or Web Platform APIs like cookies; Node supports both CommonJS and ES modules, the browser only `import` (*read*) · covers our angle: full · fetched 2026-10-12

### T00-06 · Globals: `process`, `globalThis`, `Buffer`, `__dirname` vs `import.meta` — Master · ✅ `…/06-globals.md`
- **Read this:** [Node.js Globals](https://nodejs.org/docs/latest/api/globals.html) · nodejs.org · `global` is marked Legacy ("Use globalThis instead"); `__dirname` / `__filename` entries only say they "may appear to be global but is not" and point to the modules page (*read*) · covers our angle: **partial** — `process` and `Buffer` live on their own pages · fetched 2026-10-12
- **Also good:** [Modules: ECMAScript modules](https://nodejs.org/docs/latest/api/esm.html) · nodejs.org · `import.meta.dirname` added v21.2.0 / v20.11.0, no longer experimental from v24.0.0 / v22.16.0; only on `file:` modules (*read*) · fetched 2026-10-12

### T00-07 · Version management: nvm / fnm / volta, `.nvmrc`, `engines` — Understand · ✅ `…/07-choosing-a-version.md`
- **Read this:** [Node version managers](https://nodejs.org/learn/getting-started/node-version-managers) · nodejs.org · a one-minute list: asdf, fnm, mise, n, nave, nvm, nvs, volta; says some detect the project version automatically (*read*) · covers our angle: **partial** — no `.nvmrc` or `engines` guidance · fetched 2026-10-12
- **Also good:** [package.json → engines](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#engines) · docs.npmjs.com · "advisory only" unless `engine-strict` is set; `devEngines` is the field that runs before install/ci/run (*read*) · fetched 2026-10-12
- **Our delta:** the same list marks volta "works but unmaintained" (*read*); our page must not recommend it unqualified. nvm and fnm READMEs are 403 (not opened); `.nvmrc` behaviour not confirmed from a primary source.

### T00-08 · Release model: one major each April, LTS each October — Understand · ✅ `…/07-choosing-a-version.md`
- **Read this:** [Evolving the Node.js Release Schedule](https://nodejs.org/en/blog/announcements/evolving-the-nodejs-release-schedule) · nodejs.org · from October 2026: one major per year (April), LTS promotion in October, every release becomes LTS, Node 27 will be LTS, an Alpha channel for early testing (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Node.js Releases](https://nodejs.org/en/about/previous-releases) · nodejs.org · status table; v26 first released May 05, 2026; LTS guaranteed about 30 months; "Production applications should only use Active LTS or Maintenance LTS" (*read*) · fetched 2026-10-12

### T00-09 · Dev-loop flags: `--watch`, `--watch-path`, `--env-file` — Know · ✅ `…/08-running-node.md`
- **Read this:** [CLI → --watch](https://nodejs.org/docs/latest/api/cli.html#--watch) · nodejs.org · restarts on change; watches the entry point and required/imported modules; `--watch-path` turns that off for the paths given; stable since v22.0.0 / v20.13.0 (*read*) · covers our angle: **partial** — `--env-file` has its own entry (next line) · fetched 2026-10-12
- **Also good:** [CLI → --env-file=file](https://nodejs.org/docs/latest/api/cli.html#--env-filefile) · nodejs.org · "no longer experimental" in v24.10.0 / v22.21.0, multi-line values from v21.7.0 / v20.12.0 (*read*) · [Run Node.js scripts from the command line](https://nodejs.org/learn/command-line/run-nodejs-scripts-from-the-command-line) · nodejs.org · sections on restarting automatically and the `--run` task runner (*headings only*) · fetched 2026-10-12

### T00-10 · CLI flags and `NODE_OPTIONS` — Know · ✅ `…/08-running-node.md`
- **Read this:** [CLI → NODE_OPTIONS=options](https://nodejs.org/docs/latest/api/cli.html#node_optionsoptions) · nodejs.org · the reference for every flag and the environment variable, one long page (*headings only* for this section; `-e` is at [#-eval-script](https://nodejs.org/docs/latest/api/cli.html#-eval-script)) · covers our angle: full as a reference, not a tutorial · fetched 2026-10-12

### T00-11 · The REPL, `--eval`, `--print` — Know · ✅ `…/08-running-node.md`
- **Read this:** [How to use the Node.js REPL](https://nodejs.org/learn/command-line/how-to-use-the-nodejs-repl) · nodejs.org · the `_` variable, up-arrow history, dot commands such as `.editor` and `.load` (*read*) · covers our angle: **partial** — `--eval` / `--print` are not here · fetched 2026-10-12
- **Also good:** [CLI → -e, --eval script](https://nodejs.org/docs/latest/api/cli.html#-eval-script) · nodejs.org · the flag reference (id verified; *headings only*) · [REPL API](https://nodejs.org/docs/latest/api/repl.html) · nodejs.org · default evaluation, `await` keyword, `_` assignment (*headings only*) · fetched 2026-10-12

### T00-12 · Node vs Deno vs Bun — Know · ✅ `…/09-node-deno-bun.md`
- **Read this:** [Node.js vs Deno vs Bun: Comparing JavaScript Runtimes](https://betterstack.com/community/guides/scaling-nodejs/nodejs-vs-deno-vs-bun/) · betterstack.com · published 2024-09-09, updated 2026-01-30; concludes switching from Node "is generally not necessary" and names maturity and ecosystem (*read* the "When to use" section) · covers our angle: **partial** — a vendor blog; its own Express benchmarks should not be quoted · fetched 2026-10-12
- **Also good:** [Deno: Node and npm compatibility](https://docs.deno.com/runtime/fundamentals/node/) · docs.deno.com · "Most Node.js code runs in Deno without modification" (*read* opening) · [Bun: Node.js compatibility](https://bun.sh/docs/runtime/nodejs-compat) · bun.sh · the vendor's own status page (*headings only*) · fetched 2026-10-12
- **Our delta:** web results disagreed on benchmark numbers, so our page keeps its "about the benchmarks" caveat.

### T00-13 · How V8 compiles and optimizes (Ignition, TurboFan, deopt) — When Needed · ✅ `…/10-how-v8-optimizes.md`
- **Read this:** [An Introduction to Speculative Optimization in V8](https://benediktmeurer.de/2017/12/13/an-introduction-to-speculative-optimization-in-v8/) · benediktmeurer.de · 13 Dec 2017; type feedback, checks in optimized code, and bailing out to the interpreter ("Deoptimization"), plus the deopt-loop risk (*read*) · covers our angle: **partial** — written when V8 had only Ignition and TurboFan · fetched 2026-10-12
- **Also good:** [Maglev - V8's Fastest Optimizing JIT](https://v8.dev/blog/maglev) · v8.dev · 05 December 2023; Maglev sits between Sparkplug and TurboFan; "Until 2021" there were two tiers (*read* intro) · [Maps (Hidden Classes) in V8](https://v8.dev/docs/hidden-classes) · v8.dev · (*read* opening) · fetched 2026-10-12
- **Our delta:** the current pipeline has four tiers (Ignition, Sparkplug, Maglev, TurboFan); the syllabus names two.

## Phase 1 — Modules and packages

### T01-01 · ESM: `import`/`export`, top-level `await`, dynamic `import()` — Master · ✅ `docs/nodejs/pages/phase-1-modules/01-esm.md`
- **Read this:** [Modules: ECMAScript modules](https://nodejs.org/docs/latest/api/esm.html) · nodejs.org · sections [#mandatory-file-extensions](https://nodejs.org/docs/latest/api/esm.html#mandatory-file-extensions), [#import-expressions](https://nodejs.org/docs/latest/api/esm.html#import-expressions) and [#top-level-await](https://nodejs.org/docs/latest/api/esm.html#top-level-await); a file extension is required for relative specifiers (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [MDN: JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules) · mdn · undated; sections [#dynamic_module_loading](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules#dynamic_module_loading) and [#top_level_await](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules#top_level_await) (*headings only*) · fetched 2026-10-12

### T01-02 · CommonJS: `require`, `module.exports` vs `exports`, the cache — Master · ✅ `…/02-commonjs.md`
- **Read this:** [Modules: CommonJS modules](https://nodejs.org/docs/latest/api/modules.html) · nodejs.org · [#exports-shortcut](https://nodejs.org/docs/latest/api/modules.html#exports-shortcut) (`exports` starts as `module.exports`) and [#caching](https://nodejs.org/docs/latest/api/modules.html#caching) (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [#the-module-wrapper](https://nodejs.org/docs/latest/api/modules.html#the-module-wrapper) · same page · the module wrapper section (*headings only*) · fetched 2026-10-12

### T01-03 · The `node:` prefix — Master · ✅ `…/03-node-prefix.md`
- **Read this:** [CommonJS → Built-in modules with mandatory node: prefix](https://nodejs.org/docs/latest/api/modules.html#built-in-modules-with-mandatory-node-prefix) · nodejs.org · some built-ins must carry `node:` so new core names cannot clash with userland packages (*read*) · covers our angle: **partial** — "faster to resolve" is not stated · fetched 2026-10-12
- **Also good:** [CommonJS → Built-in modules](https://nodejs.org/docs/latest/api/modules.html#built-in-modules) · same page · the `node:` prefix "bypasses the require cache", so `require('node:http')` always returns the built-in; this supports "unshadowable" (*read*; id verified) · fetched 2026-10-12
- **Our delta:** the speed claim is not confirmed by any page here (not confirmed); cite the "no conflict with userland" and "bypasses the require cache" reasons, or find a benchmark before keeping "faster".

### T01-04 · `package.json` essentials: `type`, `main`, `scripts`, `engines`, `files` — Master · ✅ `…/07-package-json.md`
- **Read this:** [npm: package.json](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/) · docs.npmjs.com · ids for [#files](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#files), [#main](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#main), [#scripts](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#scripts), [#engines](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#engines); `engines` is advisory unless `engine-strict` (*read* engines) · covers our angle: **partial** — `type` is Node's field, not npm's · fetched 2026-10-12
- **Also good:** [Node packages → type](https://nodejs.org/docs/latest/api/packages.html#type) · nodejs.org · how `type` decides CJS vs ESM for `.js` (id verified; *headings only*) · fetched 2026-10-12

### T01-05 · Semver and ranges; lockfiles — Master · ✅ `…/09-semver-and-lockfiles.md`
- **Read this:** [Semantic Versioning 2.0.0](https://semver.org/) · semver.org · the MAJOR.MINOR.PATCH rules (*read* summary) · covers our angle: **partial** — nothing on `^` ranges or lockfiles · fetched 2026-10-12
- **Also good:** [About semantic versioning](https://docs.npmjs.com/about-semantic-versioning/) · docs.npmjs.com · last edited October 23, 2023; `~1.0.4` patch range, `^1.0.4` minor range (*read*) · [package-lock.json](https://docs.npmjs.com/cli/v11/configuring-npm/package-lock-json/) · docs.npmjs.com · (*headings only*) · fetched 2026-10-12
- **Our delta:** "why `^` bites you" is not argued by either source; ours to make.

### T01-06 · npm basics: `install` vs `ci`, dependencies vs devDependencies, `npx` — Master · ✅ `…/10-npm-day-to-day.md`
- **Read this (1/2):** [npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci/) · docs.npmjs.com · exits with an error if the lockfile and `package.json` do not match, rather than updating the lock; installs are "essentially frozen"; flags must match those used to create the lockfile (*read*) · covers our angle: full for `ci` · fetched 2026-10-12
- **Read this (2/2):** [package.json → devDependencies](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#devdependencies) · docs.npmjs.com · (*headings only*; id verified) · fetched 2026-10-12
- **Also good:** [npx](https://docs.npmjs.com/cli/v11/commands/npx/) · docs.npmjs.com · last edited October 5, 2025; sections "npx vs npm exec" and "Examples" (*headings only*) · fetched 2026-10-12

### T01-07 · CJS ↔ ESM interop — Understand · ✅ `…/04-cjs-esm-interop.md`
- **Read this:** [ESM → Interoperability with CommonJS](https://nodejs.org/docs/latest/api/esm.html#interoperability-with-commonjs) · nodejs.org · `import` of CJS gives `module.exports` as the default; `require()` of ESM only loads synchronous modules (no top-level await) (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [module.createRequire(filename)](https://nodejs.org/docs/latest/api/module.html#modulecreaterequirefilename) · nodejs.org · (*headings only*; the ESM page also says addons load via `createRequire`) · fetched 2026-10-12

### T01-08 · The `exports` map: conditional, subpath, encapsulation — Understand · ✅ `…/08-exports-map.md`
- **Read this:** [Packages → Subpath exports](https://nodejs.org/docs/latest/api/packages.html#subpath-exports) · nodejs.org · adding `exports` blocks entry points not listed, even `package.json`, so it is a breaking change (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Conditional exports](https://nodejs.org/docs/latest/api/packages.html#conditional-exports) · same page · maps different targets for `import` and `require` (*read*) · fetched 2026-10-12

### T01-09 · Module resolution: `node_modules` walk, CJS vs ESM — Understand · ✅ `…/05-module-resolution.md`
- **Read this (1/2):** [CommonJS → All together](https://nodejs.org/docs/latest/api/modules.html#all-together) · nodejs.org · pseudocode of `require(X)`: core module, relative path, `node_modules` lookup (*read* opening) · covers our angle: CJS side, full · fetched 2026-10-12
- **Read this (2/2):** [ESM → Resolution algorithm](https://nodejs.org/docs/latest/api/esm.html#resolution-algorithm) · nodejs.org · the ESM_RESOLVE specification; [#mandatory-file-extensions](https://nodejs.org/docs/latest/api/esm.html#mandatory-file-extensions) says relative specifiers need the extension and directory indexes must be fully specified (*read*) · covers the ESM side: full · fetched 2026-10-12

### T01-10 · TypeScript natively (type stripping) — Understand · ✅ `…/12-typescript-natively.md`
- **Read this:** [Modules: TypeScript](https://nodejs.org/docs/latest/api/typescript.html) · nodejs.org · history: enabled by default v23.6.0 / v22.18.0, warning-free v24.3.0 / v22.18.0, "now stable" v25.2.0 / v24.12.0; Node refuses TS inside `node_modules`; path aliases not transformed (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Running TypeScript Natively](https://nodejs.org/learn/typescript/run-natively) · nodejs.org · enums, parameter properties, runtime namespaces need a runner or transpile step; running a `.ts` file "is not the same as running tsc" (*read*) · fetched 2026-10-12
- **Our delta:** 🔴 the same API page's history says **v26.0.0 "Removed --experimental-transform-types flag"**. The syllabus line "`--experimental-transform-types` still required" is true only for older lines; confirm on the Node 24 docs before keeping it.

### T01-11 · Circular dependencies in CJS vs ESM — Understand · ✅ `…/06-circular-dependencies.md`
- **Read this (1/2):** [CommonJS → Cycles](https://nodejs.org/docs/latest/api/modules.html#cycles) · nodejs.org · a module may be returned before it finishes executing (an unfinished exports object); worked a.js / b.js example (*read*) · covers our angle: CJS side, full · fetched 2026-10-12
- **Read this (2/2):** [MDN: JavaScript modules → Cyclic imports](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules#cyclic_imports) · mdn · undated; cycles don't always fail, a read of an uninitialized binding throws `ReferenceError` (*read*) · covers the ESM side: full · fetched 2026-10-12
- **Our delta:** "why they signal a design problem" is ours; neither page argues it.

### T01-12 · pnpm vs npm vs yarn: the `node_modules` layout — Know · ✅ `…/11-package-managers.md`
- **Read this:** [pnpm: Motivation](https://pnpm.io/motivation) · pnpm.io · npm and Yarn Classic hoist to the root, so code can reach undeclared dependencies; pnpm uses a content-addressable store and a non-flat layout (*read*) · covers our angle: **partial** — pnpm's own account, no yarn modern coverage · fetched 2026-10-12
- **Also good:** [Symlinked node_modules structure](https://pnpm.io/symlinked-node-modules-structure) · pnpm.io · (*read* opening) · [pnpm vs npm](https://pnpm.io/pnpm-vs-npm) · pnpm.io · hard and symbolic links to a global store (*read*) · fetched 2026-10-12

### T01-13 · Subpath imports (`#internal`) — Know · ✅ `…/08-exports-map.md`
- **Read this:** [Packages → Subpath imports](https://nodejs.org/docs/latest/api/packages.html#subpath-imports) · nodejs.org · `imports` entries must start with `#`; `#/` prefixes allowed from v25.4.0 / v24.14.0 (*read*) · covers our angle: full · fetched 2026-10-12
- **Our delta:** the TypeScript page notes `tsconfig` "paths" are not transformed and subpath imports are the closest feature.

### T01-14 · Workspaces / monorepos — Know · ✅ `…/11-package-managers.md`
- **Read this:** [npm: workspaces](https://docs.npmjs.com/cli/v11/using-npm/workspaces/) · docs.npmjs.com · a set of features for managing several packages from one root package (*read* intro) · covers our angle: **partial** — npm only · fetched 2026-10-12
- **Also good:** [pnpm workspaces](https://pnpm.io/workspaces) · pnpm.io · [Yarn workspaces](https://yarnpkg.com/features/workspaces) · yarnpkg.com · both (*headings only*) · fetched 2026-10-12

### T01-15 · Publishing: scoped packages, `npm pack`, provenance, dual CJS/ESM — Know · ✅ `…/13-publishing.md`
- **Read this:** [Publishing a package](https://nodejs.org/learn/modules/publishing-a-package) · nodejs.org · ≈5k words on CJS/ESM source and distribution choices and the "Dual Package Hazard" (two instances of one package in a runtime) (*read* the hazard section) · covers our angle: **partial** — scope, `npm pack` and provenance are elsewhere · fetched 2026-10-12
- **Also good:** [Generating provenance statements](https://docs.npmjs.com/generating-provenance-statements/) · docs.npmjs.com · a GitHub Actions example with `id-token: write` (*read*) · [Scoped public packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/) · docs.npmjs.com · `npm init --scope=@my-org` (*read*) · fetched 2026-10-12
- *Checked, not chosen:* [npm pack](https://docs.npmjs.com/cli/v11/commands/npm-pack/) · docs.npmjs.com · the command reference, a lookup page rather than an explanation (*headings only*) · fetched 2026-10-12

### T01-16 · `node:module` API: `register()`, hooks, `enableCompileCache()` — When Needed · ✅ `…/14-node-module-api.md`
- **Read this:** [Modules: node:module API](https://nodejs.org/docs/latest/api/module.html) · nodejs.org · [module.enableCompileCache()](https://nodejs.org/docs/latest/api/module.html#moduleenablecompilecacheoptions) uses an on-disk V8 code cache; `NODE_COMPILE_CACHE=dir` is the env form (*read*) · covers our angle: full · fetched 2026-10-12
- **Our delta:** 🔴 on `module.register(specifier[, parentURL][, options])` the page says "Deprecated in: v25.9.0" and "v26.0.0 Runtime deprecation (DEP0205)" (*read*); `module.registerHooks()` exists beside it. Our page must lead with the replacement.

## Phase 2 — Async and the event loop

### T02-01 · Event loop phases in order — Master · ✅ `docs/nodejs/pages/phase-2-async/01-event-loop-phases.md`
- **Read this:** [The Node.js Event Loop](https://nodejs.org/learn/asynchronous-work/event-loop-timers-and-nexttick) · nodejs.org · [#phases-overview](https://nodejs.org/learn/asynchronous-work/event-loop-timers-and-nexttick#phases-overview): pending callbacks, "idle, prepare: only used internally", poll, check, close (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [libuv Design overview → The I/O loop](https://docs.libuv.org/en/v1.x/design.html#the-i-o-loop) · libuv.org · the loop iteration as libuv defines it (*read* timeout rules) · fetched 2026-10-12
- **Beyond the docs:** [A Complete Visual Guide to Understanding the Node.js Event Loop](https://www.builder.io/blog/visual-guide-to-nodejs-event-loop) · builder.io / Vishwas Gopinath, March 23, 2023 · walks the phases as queues with diagrams and step-by-step output traces, easier to follow than the prose reference · fetched 2026-10-13 (*read*)

### T02-02 · The poll phase and how it decides to block — Master · ✅ `…/02-poll-phase.md`
- **Read this:** [The Node.js Event Loop → poll](https://nodejs.org/learn/asynchronous-work/event-loop-timers-and-nexttick#poll) · nodejs.org · poll retrieves I/O events and "will block here when appropriate" (*read*) · covers our angle: **partial** — the rules for the blocking timeout are in libuv · fetched 2026-10-12
- **Also good:** [libuv Design overview → The I/O loop](https://docs.libuv.org/en/v1.x/design.html#the-i-o-loop) · libuv.org · timeout is 0 with `UV_RUN_NOWAIT`, a stopped loop, no active handles, idle handles, or handles pending close; else the nearest timer (*read*) · fetched 2026-10-12

### T02-03 · Microtasks vs macrotasks: `nextTick`, `queueMicrotask`, promises, timers — Master · ✅ `…/03-microtasks-and-macrotasks.md`
- **Read this:** [process.nextTick → queueMicrotask vs nextTick](https://nodejs.org/docs/latest/api/process.html#when-to-use-queuemicrotask-vs-processnexttick) · nodejs.org · `queueMicrotask` uses the same queue as promise `then`/`catch`/`finally` handlers; the next tick queue is drained after the current operation, before the loop continues (*read*) · covers our angle: full for Node · fetched 2026-10-12
- **Also good:** [MDN: Using microtasks](https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide) · mdn · undated; a microtask runs after the creating function exits and the stack is empty, before control returns to the loop (*read* opening) · fetched 2026-10-12
- **Beyond the docs:** [A Complete Visual Guide to Understanding the Node.js Event Loop](https://www.builder.io/blog/visual-guide-to-nodejs-event-loop) · builder.io / Vishwas Gopinath, March 23, 2023 · states the Node-specific order directly: the nextTick queue drains before the Promise queue, both between callbacks and after each phase · fetched 2026-10-13 (*read*)
- **Our delta:** 🔴 `process.nextTick` carries "Stability: 3 - Legacy: Use queueMicrotask() instead" (history: v22.7.0 / v20.18.0) (*read*).

### T02-04 · Call stack → task queue → microtask queue — Master · ✅ `…/03-microtasks-and-macrotasks.md`
- **Read this:** [Event loop: microtasks and macrotasks](https://javascript.info/event-loop) · javascript.info · May 17, 2024; says the flow is the same "as well as in Node.js" (*read* opening); browser-centred · covers our angle: **partial** — no Node phases · fetched 2026-10-12
- **Also good:** [Tasks, microtasks, queues and schedules](https://jakearchibald.com/2015/tasks-microtasks-queues-and-schedules/) · jakearchibald.com · 17 August 2015; microtask queue "processed after callbacks as long as no other JavaScript is mid-execution" and at the end of each task (*read*); browser, spec-heavy · fetched 2026-10-12
- **Our delta:** the Node-specific order (nextTick queue before promises) is ours; both sources are browser-first.

### T02-05 · `setImmediate` vs `setTimeout(fn, 0)` — Understand · ✅ `…/04-setimmediate-vs-settimeout.md`
- **Read this:** [The Node.js Event Loop → setImmediate() vs setTimeout()](https://nodejs.org/learn/asynchronous-work/event-loop-timers-and-nexttick#setimmediate-vs-settimeout) · nodejs.org · order in the main module is non-deterministic; inside an I/O callback `immediate` always runs first (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Understanding setImmediate()](https://nodejs.org/learn/asynchronous-work/understanding-setimmediate) · nodejs.org · (*headings only*, ≈1.3k words) · fetched 2026-10-12

### T02-06 · `nextTick` starvation — Understand · ✅ `…/05-nexttick-starvation.md`
- **Read this:** [The Node.js Event Loop → process.nextTick](https://nodejs.org/learn/asynchronous-work/event-loop-timers-and-nexttick#processnexttick) · nodejs.org · recursive `process.nextTick()` "starve" I/O by keeping the loop from reaching poll (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Understanding process.nextTick()](https://nodejs.org/learn/asynchronous-work/understanding-processnexttick) · nodejs.org · (*headings only*) · fetched 2026-10-12

### T02-07 · Timers: `setTimeout`, `setInterval`, `unref()`, `node:timers/promises` — Understand · ✅ `…/06-timers.md`
- **Read this:** [Timers](https://nodejs.org/docs/latest/api/timers.html) · nodejs.org · [#timeoutunref](https://nodejs.org/docs/latest/api/timers.html#timeoutunref) and [#timers-promises-api](https://nodejs.org/docs/latest/api/timers.html#timers-promises-api); timers are ref'ed by default and keep the loop alive (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Discover JavaScript Timers](https://nodejs.org/learn/asynchronous-work/discover-javascript-timers) · nodejs.org · `setTimeout` zero delay, `setInterval`, recursive `setTimeout` (*headings only*) · fetched 2026-10-12

### T02-08 · `async`/`await` — `await` yields to microtasks — Master · ✅ `…/08-async-await.md`
- **Read this:** [Async functions and await](https://javascript.info/async-await) · javascript.info · March 24, 2025; an `async` function always returns a promise; `await` waits for it, with an error-handling section (*read*) · covers our angle: **partial** — the microtask-not-phase point is not made · fetched 2026-10-12
- **Also good:** [MDN: async function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function) · mdn · undated; a call returns a new Promise; includes a sequentialStart example (*read*) · fetched 2026-10-12

### T02-09 · Promise states, chaining, return vs not return — Master · ✅ `…/07-promise-states.md`
- **Read this:** [Promises chaining](https://javascript.info/promise-chaining) · javascript.info · April 6, 2023; "Returning promises allows us to build chains of asynchronous actions" (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [MDN: Using promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises) · mdn · undated; [#nesting](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises#nesting) shows flattening a nested chain (*read*) · fetched 2026-10-12

### T02-10 · Combinators: `all` / `allSettled` / `race` / `any` — Master · ✅ `…/09-combinators.md`
- **Read this:** [Promise API](https://javascript.info/promise-api) · javascript.info · February 20, 2022; `all`, `allSettled` ("waits for all promises to settle"), `race`, `any` (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [MDN: Promise.all()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all) · mdn · undated; fail-fast: rejects as soon as one input rejects, others keep running (*read*) · fetched 2026-10-12

### T02-11 · Sequential vs parallel `await` — Master · ✅ `…/10-sequential-vs-parallel.md`
- **Read this:** [ESLint: no-await-in-loop](https://eslint.org/docs/latest/rules/no-await-in-loop) · eslint.org · an `await` per element "may indicate" lost parallelism; refactor to create all promises first (*read*) · covers our angle: full for the loop case · fetched 2026-10-12
- **Also good:** [MDN: async function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function) · mdn · undated; its sequentialStart example (*read*) · fetched 2026-10-12

### T02-12 · Error handling: `try`/`catch` with `await`, `.catch()` placement — Master · ✅ `…/11-error-handling.md`
- **Read this:** [Error handling with promises](https://javascript.info/promise-error-handling) · javascript.info · June 18, 2022; the "implicit try…catch" around executors and handlers, and the `setTimeout` throw that escapes it (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [MDN: Using promises → error handling](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises#error_handling) · mdn · undated (id verified; *headings only*) · fetched 2026-10-12

### T02-13 · Floating promises — Master · ✅ `…/12-floating-promises.md`
- **Read this:** [typescript-eslint: no-floating-promises](https://typescript-eslint.io/rules/no-floating-promises/) · typescript-eslint.io · a floating promise is created "without any code set up to handle any errors it might throw" (*read*) · covers our angle: full as a lint rule · fetched 2026-10-12
- **Also good:** [typescript-eslint: no-misused-promises](https://typescript-eslint.io/rules/no-misused-promises/) · typescript-eslint.io · (*headings only*) · fetched 2026-10-12
- **Our delta:** both sources need TypeScript type info; plain-JS projects have no equivalent rule here.

### T02-14 · Error-first callbacks; `util.promisify` / `callbackify` — Understand · ✅ `…/13-callbacks-and-promisify.md`
- **Read this:** [util.promisify(original)](https://nodejs.org/docs/latest/api/util.html#utilpromisifyoriginal) · nodejs.org · takes an error-first callback function, returns a promise version; [util.callbackify](https://nodejs.org/docs/latest/api/util.html#utilcallbackifyoriginal) is the reverse (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [JavaScript Asynchronous Programming and Callbacks](https://nodejs.org/learn/asynchronous-work/javascript-asynchronous-programming-and-callbacks) · nodejs.org · (*headings only*) · fetched 2026-10-12

### T02-15 · Concurrency control: bounded pools, not unbounded `Promise.all` — Understand · ✅ `…/14-concurrency-control.md`
- **Read this:** [p-limit readme (v7.3.3)](https://cdn.jsdelivr.net/npm/p-limit@7.3.3/readme.md) · jsDelivr copy of the npm readme · `pLimit(n)` wrapped around `Promise.all` so only n run at once; minimum 1 (*read*) · covers our angle: **partial** — a library's API, not the "why unbounded is an outage" argument; release date not confirmed · fetched 2026-10-12
- **Our delta:** no neutral article found for the outage argument (searched "limit concurrency Promise.all Node.js batch pool"); results were mirrors of this readme.

### T02-16 · `unhandledRejection` and `uncaughtException` — Understand · ✅ `…/15-unhandled-rejections.md`
- **Read this:** [process → Event: 'unhandledRejection'](https://nodejs.org/docs/latest/api/process.html#event-unhandledrejection) · nodejs.org · an unhandled `'unhandledRejection'` is raised as an uncaught exception; [Warning: Using 'uncaughtException' correctly](https://nodejs.org/docs/latest/api/process.html#warning-using-uncaughtexception-correctly): a "crude mechanism … last resort", resuming is unsafe (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [CLI → --unhandled-rejections=mode](https://nodejs.org/docs/latest/api/cli.html#--unhandled-rejectionsmode) · nodejs.org · "v15.0.0 Changed default mode to throw" (*read*) · fetched 2026-10-12

### T02-17 · Error design: codes, custom classes, `error.cause`, `AggregateError` — Understand · ✅ `…/16-error-design.md`
- **Read this (1/2):** [Errors → error.cause](https://nodejs.org/docs/latest/api/errors.html#errorcause) · nodejs.org · `cause` keeps the original error when you catch and throw a new one (*read*) · covers our angle: **partial** — no design guidance · fetched 2026-10-12
- **Read this (2/2):** [MDN: AggregateError](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AggregateError) · mdn · undated; a list of unrelated errors, thrown by `Promise.any()` when all reject (*read*) · fetched 2026-10-12
- **Our delta:** error codes and operational-vs-programmer errors have no source here; none found beyond the Node `ERR_*` list, not opened.

### T02-18 · Promise anti-patterns — Know · ✅ `…/17-promise-antipatterns.md`
- **Read this:** [ESLint: no-async-promise-executor](https://eslint.org/docs/latest/rules/no-async-promise-executor) · eslint.org · "Disallow using an async function as a Promise executor"; in the recommended config (*read* intro) · covers our angle: **partial** — only the async-executor case · fetched 2026-10-12
- **Also good:** [MDN: Using promises → nesting](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises#nesting) · mdn · undated; flatten nested chains (*read*) · [ESLint: no-promise-executor-return](https://eslint.org/docs/latest/rules/no-promise-executor-return) · eslint.org · (*headings only*) · fetched 2026-10-12

### T02-19 · Async iterators and generators (`for await...of`) — Know · ✅ `…/18-async-iterators.md`
- **Read this:** [Async iteration and generators](https://javascript.info/async-iterators-generators) · javascript.info · February 4, 2022; `for await (let item of iterable)` over an object with async `next()` (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [MDN: for await...of](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of) · mdn · undated; loops over async iterables and sync iterables; only where `await` is allowed (*read*) · fetched 2026-10-12

### T02-20 · `AbortController` / `AbortSignal` — Master · ✅ `…/19-abortcontroller.md`
- **Read this:** [Node globals → Class: AbortController](https://nodejs.org/docs/latest/api/globals.html#class-abortcontroller) · nodejs.org · the Node-side class and `abortController.signal` (*headings only*) · covers our angle: **partial** · fetched 2026-10-12
- **Also good:** [MDN: AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController) · mdn · undated; "allows you to abort one or more Web requests"; widely available since March 2019 (*read*) · fetched 2026-10-12

### T02-21 · `AbortSignal.timeout()` and `.any()`; threading a signal — Understand · ✅ `…/19-abortcontroller.md`
- **Read this:** [Node globals → AbortSignal.any(signals)](https://nodejs.org/docs/latest/api/globals.html#static-method-abortsignalanysignals) · nodejs.org · aborts when any given signal aborts; added v20.3.0 / v18.17.0; [timeout(delay)](https://nodejs.org/docs/latest/api/globals.html#static-method-abortsignaltimeoutdelay) added v17.3.0 / v16.14.0 (*read*) · covers our angle: **partial** — "thread it through your own APIs" is not here · fetched 2026-10-12
- **Also good:** [MDN: AbortSignal.any()](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/any_static) · mdn · undated; widely available since March 2024 (*read*) · fetched 2026-10-12

### T02-22 · `AsyncLocalStorage` — Understand · ✅ `…/20-asynclocalstorage.md`
- **Read this:** [Asynchronous context tracking → AsyncLocalStorage](https://nodejs.org/docs/latest/api/async_context.html#class-asynclocalstorage) · nodejs.org · `run(store, callback)`: store reachable inside the callback only; a [#troubleshooting-context-loss](https://nodejs.org/docs/latest/api/async_context.html#troubleshooting-context-loss) section (*read* `run`) · covers our angle: **partial** — the trace-ID-in-logs recipe is ours · fetched 2026-10-12
- **Beyond the docs:** [Keeping Context Across Async Calls in Node.js](https://blog.openreplay.com/async-context-nodejs/) · blog.openreplay.com / OpenReplay Team, May 18, 2026 · a worked Express middleware storing request and user IDs with a logger reading them anywhere, which is the recipe the API reference omits · fetched 2026-10-13 (*read*)

### T02-23 · `async_hooks` — low-level, superseded — When Needed · ✅ `…/21-async-hooks.md`
- **Read this:** [Async hooks](https://nodejs.org/docs/latest/api/async_hooks.html) · nodejs.org · "Stability: 1 - Experimental. Please migrate away from this API, if you can"; `createHook` has "usability issues, safety risks, and performance implications"; use `AsyncLocalStorage` (*read*) · covers our angle: full · fetched 2026-10-12

### T02-24 · `AsyncResource` for context propagation — When Needed · ✅ `…/21-async-hooks.md`
- **Read this:** [Asynchronous context tracking → AsyncResource](https://nodejs.org/docs/latest/api/async_context.html#class-asyncresource) · nodejs.org · `AsyncResource.bind(fn)`, `runInAsyncScope`; sections on a Worker thread pool and EventEmitter (*headings only*) · covers our angle: **partial** · fetched 2026-10-12

### T02-25 · Recognizing CPU-bound work — Master · ✅ `…/22-cpu-bound-work.md`
- **Read this:** [Don't Block the Event Loop (or the Worker Pool)](https://nodejs.org/learn/asynchronous-work/dont-block-the-event-loop) · nodejs.org · why a slow callback stalls every client sharing the loop; REDOS is a named section (*read* intro) · covers our angle: full · fetched 2026-10-12

### T02-26 · Escape hatches: chunking, worker threads, offloading — Understand · ✅ `…/22-cpu-bound-work.md`
- **Read this:** [Comparing Node.js concurrency models](https://nodejs.org/learn/concurrency/comparing-nodejs-concurrency-models) · nodejs.org · child process, worker threads, cluster, with a worker CPU-bound example (*headings only*, ≈2.9k words) · covers our angle: **partial** — `setImmediate` chunking is not listed in the headings · fetched 2026-10-12
- **Also good:** [worker_threads](https://nodejs.org/docs/latest/api/worker_threads.html) · nodejs.org · workers "are useful for performing CPU-intensive JavaScript operations", not I/O (*read*) · fetched 2026-10-12

---

← Syllabus: [01-foundations.md](../syllabus/01-foundations.md)
