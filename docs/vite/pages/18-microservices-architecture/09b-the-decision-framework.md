---
title: "The question do we have the organisational problem a split solves has five yes-no tests, an asymmetric migration cost, and a short honest list of cases where the answer is genuinely yes"
sidebar_label: "09b · The decision framework"
sidebar_position: 24
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08 against [Module Federation — Vite integration](https://module-federation.io/integrations/build-tool/vite.html), [Vite — Configuring Vite](https://vite.dev/config/), and package facts from **registry.npmjs.org**, fetched 2026-09-08. Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+ · `@module-federation/vite` 1.21.5**.
> Validated: 2026-09-08 · claims + output provenance · session vite-t18

**[09](09-when-not-to-split-the-frontend.md) tallied what splitting the frontend buys —
independent deploy cadence, nothing else — against the runtime coupling, build complexity
and debugging cost every mechanism in this topic pays for it. This chunk turns that tally
into a decision: five organisational tests with a yes/no consequence, why the migration
cost from one app to many is so much smaller than the cost of merging back, and the short
list of cases where splitting genuinely is the right call, stated fairly.**

## The organisational tests

Ask these before writing a `module-federation.config.ts`. Each has a yes/no answer, and the
consequence follows directly.

- **Do the pieces deploy on genuinely different schedules?** If everything ships together
  today and would keep shipping together even if it were technically separable, splitting
  buys nothing — it only adds coordination the team doesn't currently pay for.
- **Do different teams own different pieces, with different release approvals?** A split
  is an organisational chart made executable. If there is one team, or one release
  approval covers everything anyway, the org chart doesn't demand a split.
- **Would a shared release train actually block someone?** Not "could it in theory" — has
  it, or would it demonstrably, this quarter. A hypothetical blocker is not a justification.
- **Is there a regulatory or vendor boundary?** A payments widget under PCI scope, or a
  third-party embed with its own security review, is a real boundary that argues for
  isolation regardless of deploy cadence.
- **Can one team's bad deploy be allowed to take down another team's surface?** If the
  answer is no, ask what isolates it. 🔴 **Module Federation does not answer this.** A
  broken remote is loaded into the host's own process, sharing the host's DOM, its own
  `shared` React instance and its own error boundaries at best — a remote that throws
  during module evaluation can take the host page down with it. An `<iframe>` is the
  mechanism that actually isolates a failure domain: its own document, its own JS realm,
  its own crash blast radius. If the requirement is fault isolation, not code sharing,
  reach for an iframe, not federation.

## The migration-cost asymmetry

Going from one app to many is a weekend of scaffolding. Going back is a quarter, because
the split does not stay contained to the build — it leaks into:

- **Routing** — client-side routes that used to be one router's concern now have to agree
  on ownership boundaries across apps or remotes.
- **Auth** — a session or token has to work identically across origins or federated
  contexts, which is exactly the CORS/cookie territory `02a-cors-cookies-and-websockets-through-the-proxy.md`
  covers for the dev proxy and that production has to solve for real.
- **State** — anything that used to be one component tree's context now has to be
  explicitly shared (`shared` singletons) or explicitly synchronised across a boundary.
- **Design tokens** — style drift starts the moment two builds stop reading from the same
  compiled CSS, and staying in sync becomes a shared-package discipline
  (`04b-shared-packages-and-the-deploy-decision.md`) rather than a given.
- **CI** — one pipeline becomes N pipelines with N sets of flaky-test tolerances and N
  deploy gates to keep roughly in sync.
- **On-call** — an incident that used to have one obvious owner now needs a triage step to
  work out which deployed artefact the failing stack trace belongs to.

Unwinding a split means someone has to re-merge all of that by hand, under the same
organisational pressure that made the split look easy the first time. That asymmetry is the
strongest argument for defaulting to the cheap end of `09`'s ladder and only moving up when
a cost has actually been paid, not anticipated.

## What genuinely justifies it

Stated fairly, without strawmanning the case for splitting:

- **A platform team owns a shell with many independently-released product surfaces inside
  it.** Different product teams, different release cadences, a platform team whose entire
  job is hosting them — this is the organisational shape federation and micro-frontends
  were built for.
- **An acquired app must appear inside an existing one**, and rewriting it is not on the
  table on any reasonable timeline. Composing it in, rather than rewriting it, is often the
  only realistic option.
- **A third-party or differently-secured surface needs to live on the page.** Here an
  `<iframe>` is the right isolation — a different security boundary, not just a different
  deploy cadence — and reaching for Module Federation instead trades away the isolation an
  iframe gives for free.
- **A migration seam, where a legacy app is being replaced page by page.** This is the
  strongest and most common good reason: the old app keeps serving pages the new one
  hasn't rebuilt yet, both live under one gateway prefix scheme
  (`04-one-repo-many-vite-apps.md`), and the seam is temporary by design — it disappears
  once the migration finishes, rather than becoming permanent architecture.

## The reversibility rule

Prefer the mechanism you can back out of cheaply. A shared package is a version bump in a
`package.json` — reversible in an afternoon. A federated remote is an architecture decision
that touches routing, auth, state and CI, and un-splitting it later costs a quarter, not an
afternoon. When two mechanisms would both technically satisfy today's requirement, pick the
one lower on `09`'s ladder — it is very likely also the one that costs less to undo when the
requirement turns out to have been temporary.

For the architecture-level treatment of scaling a frontend beyond one team, see
`../../../frontend-architecture/pages/14-performance-and-scalability-patterns/01-architecting-for-scale.md`.
The backend half of "many services, one product" — service boundaries, the gateway, the
BFF pattern from the deployment side rather than the build side — is `docs/system-design/`'s
territory, not this topic's.

## Gotchas

**★ Symptom: "we want independent deploys" turns out to mean nobody has actually been
blocked by the shared release train.** Cause: the organisational tests above were never
asked, and the split was reached for because federation was the new interesting tool, not
because a cost was being paid. Fix: ask the five organisational-test questions before
writing a `module-federation.config.ts`; if all five come back "not really", the answer is
one app.

**★ Symptom: a "temporary" migration seam becomes permanent architecture.** Cause: the legacy
app never finished being replaced, so the gateway split from
`04-one-repo-many-vite-apps.md` — meant to disappear once the migration finished — stays
forever, and the team inherits its CI/deploy/on-call overhead indefinitely. Fix: track the
migration seam as a project with an end date and an owner, not as a permanent fixture; revisit
it explicitly if the end date slips rather than letting it become the architecture by default.

**★ Symptom: fault isolation was the actual requirement, and the team shipped Module
Federation instead of an iframe.** Cause: federation and iframes both look like "run someone
else's frontend inside ours" from a distance, but federation shares the host's JS realm and
DOM while an iframe does not. Fix: if a bad deploy from the embedded piece must never be able
to crash the host page, use an `<iframe>`; federation's `shared` singletons mean a throw
during remote module evaluation can propagate into the host's own render.

**Symptom: "going back to one app" is scoped as a small cleanup task and turns into a
quarter.** Cause: the migration-cost asymmetry above — routing, auth, state, design tokens,
CI and on-call all absorbed the split silently over time, so unwinding it means finding and
reversing every place that happened, not reverting one config file. Fix: when evaluating
whether to split in the first place, budget the *unsplit* cost, not just the split cost, and
weigh it against the organisational-test answers.

## Interview questions

**★ What does Module Federation give you that an iframe does not, and what does an iframe
give you that Module Federation does not?** Federation gives you a shared runtime — the
remote's components run inside the host's own React tree, can share the host's state and
context, and can participate in the host's own routing. An iframe gives you fault and
security isolation — its own document, its own JS realm, its own crash blast radius — at the
cost of the embedded content being a separate application the host cannot share state with
directly. If the requirement is "compose a live component tree", reach for federation. If
the requirement is "run untrusted or differently-secured content safely", reach for an
iframe — federation's shared singletons mean a bad remote deploy can take the host down with
it, which an iframe boundary prevents by construction.

**★ Why is the migration cost from one app to many so much smaller than the cost of merging
back?** Splitting is a scaffolding decision — set up a second build, a second deploy
pipeline, wire a gateway prefix or a federation config, done in a weekend. But the split
doesn't stay contained to the build: once two teams are shipping separately, routing
ownership, auth, shared state, design tokens, CI pipelines and on-call all start assuming
the split exists, and each of those absorbs the split independently and silently over
months. Reversing it means finding and undoing all of that, not reverting one commit — which
is why it costs a quarter rather than a weekend.

**When is splitting the frontend the right call, stated without strawmanning it?** Four
cases hold up: a platform team hosting genuinely independent, independently-released
product surfaces inside a shell; an acquired application that has to appear inside an
existing product without a full rewrite; a third-party or differently-secured surface that
needs real isolation (an iframe, specifically, not federation); and a migration seam where a
legacy app is being replaced page by page and the split is explicitly temporary. The last
one is both the strongest and the most common legitimate reason — it has a natural end date,
unlike the others.

**A director asks why the same feature can't just ship in two apps that were "always going
to be independent anyway." How do you push back?** Ask whether they've actually paid the
release-train cost yet, or whether they're anticipating it. If nobody has been blocked
shipping from one repo, "always going to be independent" is a prediction, not a fact — and
the migration-cost asymmetry means guessing wrong is expensive to undo. Propose starting
with one app plus route-level code splitting, and set a concrete trigger (a specific team,
a specific release-train collision) that would justify revisiting the split later, rather
than architecting for an org chart that doesn't exist yet.

---

← [When not to split](09-when-not-to-split-the-frontend.md) · [Vite overview](../../README.md) · **end of the Vite track**
