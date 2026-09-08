---
title: "Version skew is not only a caching problem — exposes is a runtime contract no compiler checks across repositories, Subresource Integrity structurally fights an independently-deployed remote, and neither host nor remote can tell you which build the other is currently running unless you make them"
sidebar_label: "05d · exposes, SRI and observability"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against [Module Federation — Vite integration](https://module-federation.io/integrations/build-tool/vite.html) and package facts from **registry.npmjs.org**, fetched 2026-09-08. Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+ · `@module-federation/vite` 1.21.5**.
> Validated: 2026-09-08 · claims + output provenance · session vite-t18

**[05c](05c-version-skew-and-the-remote-manifest.md) covered version skew as a caching and
deploy-ordering problem — `remoteEntry.js` needing `index.html`'s treatment, chunk
retention, rollback asymmetry. This page covers the parts of the same underlying condition
— host and remote deploying on separate schedules — that caching headers cannot fix at all:
`exposes` is a contract with no compiler standing behind it across repository boundaries,
Subresource Integrity is a defence built on an assumption federation deliberately breaks,
and without deliberate instrumentation, neither side of a federation pairing can tell you
what build of the other side it's actually talking to.**

## `exposes` is a runtime boundary with no compile-time check across repos

`exposes: { './CheckoutFlow': './src/CheckoutFlow.tsx' }` on the remote and
`import('checkout/CheckoutFlow')` on the host are two independent statements in two
independent repositories. Nothing connects them at compile time — TypeScript in `shell`'s
repo has no visibility into `checkout`'s source tree (this is the same problem
[05b](05b-worked-example-and-the-version-spine.md)'s "Cannot find module" gotcha names for
the type-checking symptom specifically). The consequence that matters here is broader than a
missing type declaration: if `checkout` renames a prop the exposed component accepts, or
changes what it returns, `shell`'s code compiles cleanly against its own ambient
`declare module 'checkout/CheckoutFlow'` stub — because that stub is whatever `shell`'s
authors wrote by hand or generated at some earlier point — and then fails at runtime, in
production, the first time a user's browser actually loads the new `checkout` build and
`shell`'s code passes the old prop shape into it.

Two mitigations actually close this gap, and both require deliberate infrastructure the
federation runtime itself does not provide:

**A published types package.** `checkout` publishes its exposed components' prop types as a
versioned npm package (`@myorg/checkout-types`), and `shell` depends on it like any other
dependency:

```ts
// checkout's package: @myorg/checkout-types/index.d.ts
export interface CheckoutFlowProps {
  orderId: string;
  onComplete: (result: { success: boolean }) => void;
}
```

```ts
// shell's ambient module declaration, now backed by the published package
// instead of a hand-maintained guess
import type { CheckoutFlowProps } from '@myorg/checkout-types';

declare module 'checkout/CheckoutFlow' {
  const CheckoutFlow: React.ComponentType<CheckoutFlowProps>;
  export default CheckoutFlow;
}
```

This still doesn't catch a mismatch until `shell` bumps its dependency on
`@myorg/checkout-types` and rebuilds — but it converts an unbounded silent drift into an
ordinary, visible dependency-version bump that shows up in a diff and a changelog.

**A contract test in the remote's CI that imports the host's expectations.** `checkout`'s
own pipeline, at build or release time, runs a test that asserts the shape it exposes still
satisfies what `shell` declares it needs — for example, by importing the same
`@myorg/checkout-types` package `shell` consumes and type-checking `CheckoutFlow`'s actual
signature against it:

```ts
// checkout/test/contract.test.ts — runs in checkout's own CI, before it deploys
import type { CheckoutFlowProps } from '@myorg/checkout-types';
import type CheckoutFlow from '../src/CheckoutFlow';

// A type-level assertion: CheckoutFlow's actual prop type must be
// assignable to what the published contract promises consumers.
type _AssertContract = React.ComponentProps<typeof CheckoutFlow> extends CheckoutFlowProps
  ? true
  : never;
```

The point of running this in `checkout`'s own CI, not `shell`'s, is that it's the only place
a breaking change can be caught *before* it deploys — `shell`'s CI never rebuilds against
`checkout`'s current source at all, per [05b](05b-worked-example-and-the-version-spine.md)'s
argument that neither side's own test suite loads the other's build.

## Subresource Integrity fights an independently-deployed remote by design

Subresource Integrity (`integrity="sha384-…"` on a `<script>` tag) pins a script's expected
content hash at the point the referencing HTML or script was built, so the browser refuses
to execute anything that doesn't match — a defence against a CDN or origin serving something
other than what was intended. Applying that to a federated remote's chunks runs directly
against the property federation exists to provide: the host does not know at its own build
time what content the remote will be serving on any given request, because the remote is
free to redeploy independently, at any time, without the host rebuilding. An SRI hash
computed against `checkout`'s chunks as they existed when `shell` was last built would
correctly *break* the very next time `checkout` deploys anything — which for a genuinely
independently-deployed remote could be hourly.

This page does not have a documented Module Federation position on SRI to cite — the
integration page's documented scope is the config keys and the two limitations covered on
[05](05-module-federation-on-vite.md), and it says nothing about integrity attributes. The
tension described above follows from what SRI structurally requires (a hash fixed at
reference time) versus what federation structurally provides (content that can change at any
time the host doesn't control), not from a specific documented federation feature or
restriction.

## Observability: knowing which build is actually running

Given that a host's own deploy history says nothing about which remote build it's currently
paired with — per [05c](05c-version-skew-and-the-remote-manifest.md)'s rollback-asymmetry
argument — the practical fix is to make both sides self-report their own build identity at
runtime, using the same `define` build-time substitution [03](03-service-urls-are-baked-in-at-build-time.md)
covers for baked-in service URLs:

```ts
// vite.config.ts — set on both shell and checkout's own build
import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    // Populated by CI (`GIT_SHA=$(git rev-parse HEAD)`), not read from a .env
    // file — this needs to be exact per build, not per environment.
    __BUILD_SHA__: JSON.stringify(process.env.GIT_SHA ?? 'unknown'),
  },
});
```

```ts
// src/report-build.ts — imported once, near the app's entry point,
// in BOTH shell and checkout independently
declare const __BUILD_SHA__: string;

document
  .querySelector('html')
  ?.setAttribute('data-build-sha', __BUILD_SHA__);
```

With both sides tagging their own DOM (or reporting to whatever telemetry pipeline is
already in place) with their own build SHA independently, an incident report can answer
"which `checkout` build is this user's tab actually running" without needing either side's
deploy log — the two SHAs are visible in the page itself, and they don't have to agree with
each other, because they are two independent artefacts that were never guaranteed to.

## Gotchas

**★ Symptom: `checkout` renames a prop on its exposed component; `shell` compiles cleanly
and deploys without incident, then throws at runtime the first time a real user's browser
loads the new `checkout` build.** Cause: `exposes`/`import()` is a runtime contract with no
compile-time link across the two repositories — `shell`'s TypeScript checks its own
hand-written or previously-generated ambient module declaration, not `checkout`'s actual
current source, because `shell`'s own build never touches `checkout`'s repository at all.
Fix: back the ambient declaration with a published, versioned types package both sides
depend on, and add a contract test to `checkout`'s own CI that checks its exposed shape
against that same published contract before it deploys — see the code above.

**Symptom: someone proposes adding Subresource Integrity hashes to the federated `<script>`
tags the runtime injects, "for security," and it breaks the very next remote deploy.**
Cause: SRI pins a content hash at the point the referencing document was built; a federated
remote's content is, by the entire design of the pattern, free to change without the host
rebuilding. A hash fixed at the host's last build time is guaranteed to mismatch the moment
the remote deploys anything new. Fix: SRI, as a mechanism, assumes the referenced content is
fixed at reference-authoring time — that assumption doesn't hold for an independently
deployed remote, so applying it here trades an intended security property for breaking every
routine remote deploy; it is not a drop-in hardening measure for this specific boundary.

**Symptom: an incident report says "checkout is broken" and nobody can tell whether it's
today's `checkout` deploy or today's `shell` deploy, because both went out within the hour.**
Cause: no runtime signal distinguishes which build of which side is actually running in a
given user's tab — both sides' deploy histories are independent, and neither is visible from
the other's logs. Fix: have both `shell` and `checkout` self-report their own build SHA at
runtime (via `define`, as shown above), tagged into the DOM or sent to telemetry, so an
incident can be attributed to a specific build of a specific side without cross-referencing
two separate deploy pipelines by timestamp.

## Interview questions

**★ What actually closes the gap left by `exposes` having no compile-time check across
repositories, and why doesn't a hand-written ambient module declaration alone do it?**
A hand-written `declare module 'checkout/CheckoutFlow'` in the host's repo type-checks the
host's own code against whatever the host's authors *believe* the remote's shape is at the
time they wrote it — it has no mechanism to notice when the remote's actual shape changes,
because the host's build never touches the remote's source. Closing the gap requires making
that belief an artefact both sides can check against: a published, versioned types package
both repos depend on turns a silent belief into a visible dependency bump, and a contract
test in the *remote's* own CI — checking its exposed component's actual shape against that
same published contract — is the only place a breaking change can be caught before it
deploys, since it's the one pipeline that runs after the remote's real source changes and
before that change reaches any host.

**★ Why does applying Subresource Integrity to a federated remote's chunks work against the
whole point of the pattern, rather than just being an extra layer of hardening?**
SRI's guarantee — "this exact content, or refuse to execute" — requires fixing a content hash
at the time the reference is authored. A federated host's whole value proposition is that it
does *not* fix what the remote serves at its own build time; the remote is free to redeploy
independently, and the host picks up the new content on the next load with no rebuild. Any
SRI hash the host could compute would be pinned to whatever the remote was serving at the
host's last build — and would then correctly break on the remote's very next deploy, because
that's exactly the scenario SRI is designed to reject. The two mechanisms are not
complementary here; they encode opposite assumptions about whether the referenced content is
allowed to change.

**Why do both `shell` and `checkout` need to self-report their own build SHA, rather than
relying on either side's own deploy log to answer "what's live right now"?**
Because the two deploy pipelines are independent and neither logs the other's activity — a
`checkout` deploy log has no entry for what `shell` version was live when it happened, and
vice versa, even though both are rendered into the same browser tab. A deploy log can tell
you what that *one* side deployed and when, but an incident report needs to know what pairing
of the two a specific affected user's tab was actually running, which requires a signal
visible from inside that tab itself — hence tagging the DOM or telemetry with a `define`-injected
build SHA from both sides independently, rather than trying to reconstruct the pairing after
the fact from two separate, uncorrelated deploy histories.

---

← [Version skew and the manifest](05c-version-skew-and-the-remote-manifest.md) · [Vite overview](../../README.md) · Next → [Import maps and the alternatives](06-import-maps-and-the-other-answers.md)
