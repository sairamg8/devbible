---
title: "Shared makes host and remote negotiate a dependency version at runtime instead of at build time, which is the whole point and also the whole risk once the two sides stop deploying together"
sidebar_label: "05a2 · Shared dep versioning gap"
sidebar_position: 13
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against [Module Federation — Vite integration](https://module-federation.io/integrations/build-tool/vite.html) and package facts from **registry.npmjs.org**, fetched 2026-09-08. Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+ · `@module-federation/vite` 1.21.5**.
> Validated: 2026-09-08 · claims + output provenance · session vite-t18

**Continues [05a](05a-shared-dependencies-and-singleton-breakage.md) — the failure
catalogue, the identity mechanism behind it, and the `singleton` / `requiredVersion` /
`strictVersion` / `eager` controls. This page is about what happens once host and remote
stop deploying together, which for an architecture built specifically to let them deploy
independently is not an edge case — it is the normal operating condition the whole pattern
exists for.**

## The versioning problem `shared` creates: a contract negotiated at runtime between artefacts built weeks apart

Everything on the previous page assumes host and remote agree on what `react` is. They
don't have to, and in an independently deployed micro-frontend architecture, they
eventually won't: `shell` and `checkout` build on separate pipelines, on separate
schedules, and nothing forces them to bump `react` together. `shared`'s `requiredVersion`
and `strictVersion` are the whole mechanism standing between "this drifted" and "the user
saw it."

Consider a major bump on one side only: `checkout` moves to React 19 while `shell` is still
on React 18, and both declare `react` as `shared`. Without `strictVersion`, the runtime's
negotiation resolves *something* — commonly the version that satisfies the more permissive
range, or whichever loaded first — and the side whose `requiredVersion` the resolved version
doesn't actually satisfy runs against a React major it was never tested against. That is a
correctness risk with no error message: deprecated APIs behave differently, some hooks change
internal contracts across majors, and the failure mode is degraded or subtly wrong rendering,
not a crash. With `strictVersion: true` on both sides, that same drift is instead a hard
failure the moment the mismatched pair is loaded together — ugly, visible, and immediately
attributable to a specific package and range, instead of a rendering bug someone has to trace
back to a version drift days or weeks after the remote's independent deploy.

This is the sense in which `shared` is a runtime contract rather than a build-time one:
neither side's own CI can catch the drift, because neither side's own test suite ever loads
the other side's build. The mismatch only exists once both artefacts are loaded into the same
browser tab — which for an architecture that has deliberately decoupled host and remote
deploys, may be the first time anyone or anything actually exercises the pairing.

## The N-remote case: `singleton` doesn't reconcile ranges, it just forces a choice

The single host/single remote example makes `shared` look like a two-party negotiation. A
host with several remotes makes the actual constraint clearer: if `checkout` declares
`react: { requiredVersion: '^17.0.0' }` and a second remote, `search`, declares
`react: { requiredVersion: '^18.0.0' }`, both loaded into the same `shell`, `singleton`
still means exactly one `react` instance exists across all three — it does **not** mean the
runtime finds a version satisfying both ranges, because for two disjoint major-version
ranges, no such version can exist. Something has to give: one remote runs against a `react`
major outside the range it declared it needed, silently, unless `strictVersion` is set —
in which case the remote whose range isn't satisfied fails to load instead, which is the
outcome you actually want to know about at integration time, not from a user's bug report.

## What's unspecified: `shared` and Vite's `optimizeDeps` pre-bundling

🔴 The general Module Federation property described on [05a](05a-shared-dependencies-and-singleton-breakage.md) —
two unshared module instances produce two independent objects, breaking identity-based
checks like `useContext` — is a property of the federation model itself, documented on the
integration page and consistent with how ESM module graphs work. **How that interacts with
Vite's dependency pre-bundling (`optimizeDeps`) specifically is not documented on the
integration page, and this page does not assert it.** Vite pre-bundles CommonJS and
loosely-ESM dependencies with esbuild for dev performance, which is itself a process that
can produce its own single pre-bundled instance of a package — whether a
federation-`shared` instance and an `optimizeDeps`-pre-bundled instance of the same package
are guaranteed to be the same object, or under what conditions they might not be, is not
stated anywhere in the source this page was verified against. Treat it as an open question
to test for a specific setup rather than a settled fact, and do not carry an assumption
about it into a debugging session for a symptom in the catalogue on
[05a](05a-shared-dependencies-and-singleton-breakage.md).

For how these shared-dependency decisions map onto team and repository topology — one
federation graph per org versus per-domain host/remote pairings — see
[architecture patterns and topologies](../../../webpack/pages/11-module-federation/04-architecture-patterns-and-topologies.md),
which covers the pattern independent of which bundler emits the federated chunks.

## Gotchas

**★ Symptom: a version mismatch between host and remote produces a subtly wrong render — a
deprecated warning, an unexpected re-render, a prop that used to be optional now required —
instead of a clean error.** Cause: `shared` was declared with `requiredVersion` but without
`strictVersion: true`, so an unsatisfiable range resolves to *something* anyway rather than
failing to load. Fix: set `strictVersion: true` in production federation configs so a
version drift between independently deployed artefacts fails loudly and immediately instead
of rendering incorrectly and silently.

**Symptom: one remote out of several behaves correctly and another, sharing the same
dependency, behaves as if it got a version it never declared support for.** Cause: multiple
remotes declared mutually incompatible `requiredVersion` ranges for the same `singleton`
package (one wants `^17`, another `^18`); `singleton` forces one instance to exist but does
not — and cannot — reconcile two disjoint ranges into a version that satisfies both. Fix:
align the declared ranges across every remote in the federation graph deliberately, and set
`strictVersion: true` so the remote whose range genuinely isn't satisfied fails to load
instead of running silently against the wrong major.

**Symptom: a shared-dependency bug reproduces in the dev server but not in the production
build, or the reverse.** Cause: unknown — and that is the point of this entry. Vite's
`optimizeDeps` pre-bundling is a dev-time-specific step with no documented relationship to
federation's `shared` resolution on the integration page this topic was verified against.
Fix: do not assume the dev/build discrepancy is "the `optimizeDeps` interaction" without
first ruling out the ordinary causes — a `singleton`/`requiredVersion` mismatch, a package
imported through two different specifiers, or a dependency not listed in `shared` at all.
Treat the pre-bundling interaction as unconfirmed rather than as a diagnosis.

## Interview questions

**★ Host and remote are built on separate pipelines and deployed independently — how does a
`react` version drift between them ever get caught, given that neither side's own CI loads
the other side's build?**
It doesn't get caught by either side's own test suite, because the mismatch only exists once
both artefacts are loaded into the same browser tab — which for a genuinely decoupled
deploy pipeline can be the first time the pairing is exercised at all. `shared`'s
`requiredVersion` and `strictVersion` are the only mechanism standing between an unnoticed
drift and a visible failure: with `strictVersion: true`, a drift big enough to break the
declared range fails loudly the moment the two are loaded together, rather than rendering
silently wrong. Beyond that, catching drift earlier requires deliberate integration or
contract testing that loads both artefacts together outside of either side's own CI.

**Two remotes in the same federation graph declare incompatible `requiredVersion` ranges
for the same shared package. What does `singleton` actually do in that situation?**
It forces exactly one instance of the package to exist across host and both remotes — it
does not reconcile the two ranges, because for disjoint ranges (`^17` versus `^18`) no
single version can satisfy both. One remote ends up running against a version outside the
range it declared. Without `strictVersion`, that happens silently; with it, the remote whose
range isn't satisfied fails to load instead, surfacing the conflict at load time rather than
as an unexplained rendering bug.

**Is it documented how `shared`'s singleton resolution interacts with Vite's `optimizeDeps`
pre-bundling?**
No. The general Module Federation property — that an unshared package produces separate
module instances with separate identities — is documented and is a consequence of how ESM
module graphs work generally. The specific interaction with Vite's esbuild-based dev-time
pre-bundling of dependencies is not addressed on the integration page this topic was
verified against, and should be treated as unspecified rather than assumed either way —
including as an explanation for a dev-versus-build discrepancy, which has more common causes
worth ruling out first.

---

← [Shared deps and singletons](05a-shared-dependencies-and-singleton-breakage.md) · [Vite overview](../../README.md) · Next → [Worked example and version spine](05b-worked-example-and-the-version-spine.md)
