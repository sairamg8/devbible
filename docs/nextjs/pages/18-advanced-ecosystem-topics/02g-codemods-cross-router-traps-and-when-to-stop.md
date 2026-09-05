---
title: "Not one of the twenty codemods Next.js publishes at 16.3.4 moves a route from `pages/` to `app/` — the automation exists for version upgrades, the boundaries are yours, and a codebase permanently split across two routers is a legitimate place to finish"
sidebar_label: "02g · Codemods, traps and when to stop"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [Codemods](https://nextjs.org/docs/app/guides/upgrading/codemods) (`version: 16.3.4`, `lastUpdated: 2026-08-25`) and [How to migrate from Pages to the App Router](https://nextjs.org/docs/app/guides/migrating/app-router-migration) (`lastUpdated: 2026-08-25`). The claim that no published codemod performs a Pages-to-App route migration is an **enumeration of the complete published list**, not an inference.
> Target: **Next.js 16.3.4 · React 19.2.8 · Node 20.9 floor**. Documentation-verified; **no sandbox run**.

**Every migration plan written by someone who has not read the codemods page contains a line like "run the codemods first". The codemods page at 16.3.4 publishes twenty transforms across nine major versions, and the set of them that converts `getServerSideProps` into a Server Component, rewrites a `next/router` import, or turns `pages/api/x.js` into `app/api/x/route.ts` is empty. What they automate is version upgrades — async request APIs, `middleware` to `proxy`, `next/image` renames — which you need, and which is a different job. The rest of this chunk is the failures that only appear once both routers are live in the same deploy, and the argument that stopping halfway is a defensible engineering outcome rather than an abandoned project.**

## What `@next/codemod` actually is

> *"Codemods are transformations that run on your codebase programmatically. This allows a large number of changes to be programmatically applied without having to manually go through every file."*

> *"Next.js provides Codemod transformations to help upgrade your Next.js codebase when an API is updated or deprecated."*

Read the second sentence carefully: *when an API is updated or deprecated*. That is the scope. The Pages Router is not deprecated, so there is no transform for leaving it.

```bash
# The general form
npx @next/codemod <transform> <path>

# --dry  "Do a dry-run, no code will be edited"
# --print "Prints the changed output for comparison"
npx @next/codemod next-async-request-api ./app --dry --print
```

The complete published list at 16.3.4, by the version that introduced each:

| Version | Transforms |
|---|---|
| 16.3 | `cache-components-instant-false`, `remove-partial-prefetch` |
| 16.0 | `remove-experimental-ppr`, `remove-unstable-prefix`, `middleware-to-proxy`, `next-lint-to-eslint-cli` |
| 15.0 | `app-dir-runtime-config-experimental-edge`, `next-async-request-api`, `next-request-geo-ip` |
| 14.0 | `next-og-import`, `metadata-to-viewport-export` |
| 13.2 | `built-in-next-font` |
| 13.0 | `next-image-to-legacy-image`, `next-image-experimental`, `new-link` |
| 11 | `cra-to-next` |
| 10 | `add-missing-react-import` |
| 9 | `name-default-component` |
| 8 | `withamp-to-config` — *"Built-in AMP support and this codemod have been removed in Next.js 16."* |
| 6 | `url-to-withrouter` |

🔴 **Nothing in that table moves a route between directories, converts a data-fetching function, rewrites a routing hook import, or turns an API Route into a Route Handler.** The three transforms whose names sound migration-adjacent are not: `app-dir-runtime-config-experimental-edge` renames a runtime value in files already in `app/`; `next-async-request-api` fixes `cookies()`/`headers()`/`params` for a *version* change; `new-link` removes `<a>` children from `<Link>` in either directory.

**The one that is actively misleading is `cra-to-next`**, still published at 16.3.4, described as: *"Migrates a Create React App project to Next.js; **creating a Pages Router** and necessary config to match behavior."* If your migration starts from CRA, the official codemod puts you on the router you are trying to leave.

### The two upgrade codemods you genuinely want, and the flag that will bite you

`next-async-request-api` is the one to run before hand-migrating anything, because it fixes the `await` shape that [02b](02b-translating-the-data-fetching-contracts.md) describes:

> *"This codemod will transform dynamic APIs (`cookies()`, `headers()` and `draftMode()` from `next/headers`) that are now asynchronous to be properly awaited or wrapped with `React.use()` if applicable. When an automatic migration isn't possible, the codemod will either add a typecast (if a TypeScript file) or a comment to inform the user that it needs to be manually reviewed & updated."*

🔴 *"Your build will error until these comments are explicitly removed."* — comments are prefixed `@next/codemod`, typecasts are prefixed `UnsafeUnwrapped`. So this transform deliberately leaves your build broken at every site it could not resolve. That is the correct design and it means **you cannot run it and walk away**; budget review time for every marker it plants.

`middleware-to-proxy` is the 16.0 rename, and it touches a file that serves *both* routers — see [ch2 · the proxy.ts layer](../02-routing-and-navigation/07-the-proxyts-layer-successor-to-middlewarets-request-intercep.md).

⚠️ **The `upgrade` command has a non-interactive default that matters more than it looks.** `npx @next/codemod upgrade [revision]` *"Upgrades your Next.js application, automatically running codemods and updating Next.js, React, and React DOM."* And its `-y, --yes` flag: *"Skip every interactive prompt and accept its default (upgrade React past 18, enable Turbopack, apply all recommended codemods, run the React 19 codemods). **Also auto-enabled when stdin is not a TTY (CI, an AI coding agent, or any non-interactive shell)**, so you usually don't need to pass it explicitly."*

**So the same command behaves differently depending on who runs it.** Typed by a human it asks; run in CI, in a script, or by a coding agent it silently accepts every default including enabling Turbopack and applying all recommended codemods. Mid-migration, that is a large uncontrolled change landing in a branch nobody reviewed as such.

## The traps that only exist while both routers are live

**1 · A shared `lib/` module can behave differently under each router, and this corpus has already proven one case.** The App Router uses a React canary bundled with Next; the Pages Router uses the React in your `package.json`. Stable `react` **19.2.8** exports no `experimental_taint*` at all, so a shared module reaching for them gets a working API under `app/` and `undefined` under `pages/` — same file, same import, two behaviours. Settled in [03 · OWASP mapping and token leakage](03-enterprise-compliance-owasp-mapping-token-leakage-prevention.md); do not re-derive it. The general rule it implies: **a shared module must only use React APIs present in your `package.json` React**, because that is the lower bound of the two.

**2 · Two rendering models, one `proxy.ts`.** The request interception layer applies to the whole deployment while the routers underneath it disagree about almost everything else. A rule written against `pages/` route shapes keeps matching after those paths move, and a rule written for `app/` matches unmigrated routes too. Audit it on every route migration, not once — [ch2 · 07](../02-routing-and-navigation/07-the-proxyts-layer-successor-to-middlewarets-request-intercep.md).

**3 · Cache behaviour differs and the interaction is not documented.** The App Router's caching model is not the Pages Router's, and **the 16.3.4 migration guide does not describe how the two interact** — it covers cross-router navigation only, and only to say it is a hard navigation with no prefetch. So an on-demand invalidation, a CDN rule or a `Cache-Control` header tuned for `pages/` behaviour is **unspecified** territory once the same path family exists on both. Do not reason about it from first principles; establish what each route actually does with [ch4 · 03c](../04-data-fetching-in-the-app-router/03c-diagnosing-stale-and-unexpectedly-dynamic-routes.md) and treat any cross-router caching assumption as unverified.

**4 · The client bundle gets bigger before it gets smaller.** Both routers' runtimes are present while both directories exist, and shared components are compiled into both graphs. A migration measured at its midpoint looks like a regression. That is expected, and the useful measurement is per-route rather than aggregate — see [ch3 · bundle size implications](../03-server-components-vs-client-components/06-bundle-size-implications-and-core-web-vitals-impact.md).

**5 · Two styling regimes, one page a user might see in sequence.** Global CSS rules, font delivery and Tailwind globs all differ across the seam — [02f](02f-the-document-shell-metadata-and-styles.md).

## How you know a route is done

The migration guide has no completion criterion, so this is engineering judgement stated as such. A route is done when all of the following hold — not when it renders:

1. **No `next/router` import remains in any file the route reaches**, enforced by the path-scoped lint rule in [02e](02e-the-two-routers-and-the-client-side-hooks.md).
2. **Its `pages/` file is deleted in the same commit** that added the `app/` route, so no path is defined twice — [02](02-pages-router-app-router-migration-roadmaps-for-legacy-codeba.md).
3. **Every `fetch` in the route's subtree carries an explicit cache option**, and the strategy the build chose has been checked rather than assumed.
4. **Its metadata is present in rendered HTML**, particularly if it used to come from a nested `<Head>` — the silent failure from [02f](02f-the-document-shell-metadata-and-styles.md).
5. **Its `'use client'` boundaries are where you intended**, not inherited from a provider or a barrel file import.
6. **You have named every link that now crosses the router seam** and confirmed none of them sits inside a stateful flow.
7. **It has been in production for a full traffic cycle** with its error rate and Core Web Vitals compared against unchanged siblings.

Points 3, 4 and 6 are the ones that pass a code review and fail in production, which is why "it renders" is not on the list.

## When to stop migrating

**A codebase permanently split across two routers is a legitimate outcome, and the documentation supports it rather than merely tolerating it.** *"Upgrading to Next.js 13 does **not** require using the App Router."* *"API Routes continue to work in the `pages/api` directory without any changes."* The `app` directory is *"intentionally designed to work simultaneously with the `pages` directory"*, with no deadline attached anywhere in the guide.

Stop when the next route's migration cost stops buying anything:

- **The route is genuinely static and already fast.** RSC's advantage is moving data-dependent work to the server. A prerendered marketing page with no data has nothing to gain and a real regression risk.
- **The route is scheduled for deletion.** Migrating something that will not exist in two quarters is pure cost.
- **The route depends on a library whose provider cannot be made a Client Component cleanly**, and the library has no App Router story. That is an adoption decision about the library, not about the router — [02f](02f-the-document-shell-metadata-and-styles.md).
- **The remaining routes are a coherent section with no seam inside it.** If everything left is `/admin/*`, and users enter it once and stay, the hard-navigation cost is paid once per session, which is often acceptable.
- **The team has stopped learning anything from each migration.** The knowledge transfer is a real part of the return; when it is exhausted, only the cost remains.

⚠️ **What you must not do is stop without writing it down.** An undeclared halt looks identical to an abandoned project: the next engineer finds two routers, no rationale, and re-opens the argument every quarter. Record which routes are staying on the Pages Router and why, and put the boundary in the same document as the seam list, so the split is a decision with a rationale rather than a residue.

## Gotchas

**★ Symptom: "we ran the codemods and nothing migrated."** Cause: there is no codemod that performs a Pages-to-App migration. The published set at 16.3.4 automates version upgrades only, and the guide's own framing is that codemods exist *"when an API is updated or deprecated"* — the Pages Router is neither. Fix: use codemods for the upgrade, and plan the route migration as hand work with a per-route checklist.

**★ Symptom: the build fails after `next-async-request-api` with errors referencing `@next/codemod` comments.** Cause: this is the transform working as designed — where it could not resolve a call site automatically it plants a comment or an `UnsafeUnwrapped` typecast, and *"Your build will error until these comments are explicitly removed."* Fix: treat every marker as a review task, not a build error to suppress.

```bash
# Find every site the codemod could not resolve
grep -rn "@next/codemod\|UnsafeUnwrapped" app pages lib components
```

**★ Symptom: a CI job or a coding agent ran `npx @next/codemod upgrade` and the branch now has Turbopack enabled and several codemods applied that nobody chose.** Cause: `--yes` is *"auto-enabled when stdin is not a TTY (CI, an AI coding agent, or any non-interactive shell)"*, so the non-interactive run accepts every default. Fix: never run `upgrade` unpinned from automation; pin the revision, and review the diff as a change in its own right.

```bash
# Deliberate and reviewable: one revision, one commit, no prompts implied
npx @next/codemod upgrade patch
git diff --stat
```

**★ Symptom: a shared `lib/` helper works under `app/` and returns `undefined` under `pages/`.** Cause: the App Router renders with a React canary bundled into Next while the Pages Router uses your `package.json` React, so an API that exists only in canary is present on one router and absent on the other. Fix: constrain shared modules to the React surface your `package.json` actually has, and verify against the installed package rather than the docs.

```bash
# The lower bound of the two routers is your installed React
node -p "require('./node_modules/react/package.json').version"
node -p "Object.keys(require('react')).filter(k => k.startsWith('experimental')).join(', ') || '(none)'"
```

**★ Symptom: the client bundle grew after three routes were migrated, and someone proposes reverting.** Cause: both router runtimes ship while both directories exist, and shared components are compiled into both graphs — a midpoint measurement is expected to look worse. Fix: measure per route, not in aggregate, and record the expectation in the migration plan *before* the first route ships so the mid-migration number is not a surprise.

**Symptom: a `proxy.ts` rule silently stops matching, or starts matching routes it should not.** Cause: it is one file serving both routers, and route migration changes which router handles a path without changing the path. Fix: re-read the matcher on every route migration and add the route to its test cases; do not treat it as migrated-once infrastructure.

**Symptom: an on-demand cache invalidation that worked in `pages/` does not refresh the migrated route.** Cause: the two routers have different caching models and the migration guide does not document how they interact — this is genuinely unspecified territory, not a known behaviour to work around. Fix: stop reasoning from the Pages Router's model, establish what the migrated route actually does using the diagnostic procedure in [ch4 · 03c](../04-data-fetching-in-the-app-router/03c-diagnosing-stale-and-unexpectedly-dynamic-routes.md), and rebuild the invalidation against that.

**Symptom: a migration that was deliberately stopped is re-litigated every planning cycle.** Cause: the halt was a decision that nobody wrote down, so it is indistinguishable from neglect. Fix: record the routes staying on the Pages Router, the reason for each, and the condition that would change the answer — the same document that lists your cross-router seams.

**Symptom: a team migrating from Create React App follows the official codemod and ends up on the Pages Router.** Cause: `cra-to-next` is still published at 16.3.4 and explicitly *"creating a Pages Router and necessary config to match behavior."* Fix: for a CRA codebase targeting the App Router, do not use it as the starting point — the codemod exists to get you onto Next.js at all, and using it commits you to a second migration.

## Interview questions

**★ Which codemods will do the Pages-to-App migration for you?**
None. The 16.3.4 codemods page publishes twenty transforms across nine major versions and not one of them moves a route between directories, converts `getServerSideProps`, rewrites a `next/router` import or turns an API Route into a Route Handler. That is not an oversight — the guide's own framing is that codemods exist *"when an API is updated or deprecated"*, and the Pages Router is neither deprecated nor updated. The transforms you do want are the version-upgrade ones, `next-async-request-api` above all, and they should be run and reviewed before the hand migration begins so you are not debugging two classes of change at once.

**★ `next-async-request-api` broke the build. Is that a bug?**
No, it is the documented design. Where the transform cannot determine the correct fix it plants a comment prefixed `@next/codemod` or an `UnsafeUnwrapped` typecast, and the docs state that *"Your build will error until these comments are explicitly removed."* Failing loudly is the right choice for a transform touching request-time APIs, because a silent partial migration of `cookies()` and `headers()` would produce runtime behaviour that differs from what the code appears to say. The operational implication is that you cannot run it unattended; every marker is a review task with a human decision behind it.

**★ Why is a shared `lib/` module riskier during a migration than a shared component?**
Because a component's failure is usually visible and a module's is not. The specific mechanism this corpus has already proven: the App Router renders with a React canary bundled into Next while the Pages Router uses the React declared in your `package.json`. A shared module importing an API that exists only in canary gets a working function under `app/` and `undefined` under `pages/` — same file, same import specifier, two behaviours, no error. The rule that falls out is that shared modules are constrained to the *lower bound* of the two React surfaces, which is your installed version, and the way to establish that is to inspect the installed package rather than trust the documentation of whichever React you had in mind.

**★ When is it correct to stop migrating and stay on two routers permanently?**
When the next route's migration stops buying anything. Concretely: the route is already static and fast, so RSC has nothing to move server-side; the route is scheduled for deletion; the route depends on a library with no App Router story, which is a library decision rather than a routing one; or everything remaining is a coherent section users enter once and stay inside, so the hard-navigation cost is paid once per session. The documentation supports stopping — *"Upgrading to Next.js 13 does not require using the App Router"*, `pages/api` *"continue to work … without any changes"*, and nothing anywhere sets a deadline. The one non-negotiable is writing the decision down, because an unrecorded halt is indistinguishable from an abandoned project and gets re-argued every quarter.

**★ How do you know a migrated route is actually done?**
Not by it rendering. The checks that matter are the ones that pass review and fail in production: every `fetch` in its subtree carries an explicit cache option and the build's chosen strategy has been verified rather than assumed; its metadata appears in the rendered HTML, especially if it used to come from a nested `next/head`; and every link that now crosses the router seam has been identified and confirmed not to sit inside a stateful flow, because that seam is a hard navigation with no prefetch and client state does not survive it. Around those, the mechanical ones: no `next/router` import remains, the `pages/` file was deleted in the same commit, the client boundaries are where you intended, and it has run in production for a full traffic cycle compared against unchanged siblings.

**Your client bundle is 15% larger at the midpoint of the migration. What do you tell the stakeholder who wants to revert?**
That the aggregate number is measuring the wrong thing, and that this was predictable. While both directories exist, both router runtimes ship, and shared components are compiled into both graphs — so the total is expected to rise before it falls. The measurement that answers the question is per route: a migrated route's client JavaScript against the same route before migration. If those are not improving, the problem is boundary placement rather than the migration itself, and it is fixable. The real lesson is process: state the mid-migration bundle expectation in the plan before the first route ships, so the number is a checkpoint rather than an alarm.

---

← [The shell, metadata and styles](02f-the-document-shell-metadata-and-styles.md) · [Chapter index](01-explanation.md) · Next → [OWASP mapping and token leakage](03-enterprise-compliance-owasp-mapping-token-leakage-prevention.md)
