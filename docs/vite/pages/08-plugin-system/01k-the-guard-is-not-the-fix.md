---
title: "The Guard Is Not the Fix: How `if (server)` Turns a Loud Crash Into a Silent Production Regression"
sidebar_label: "The Guard Is Not the Fix"
sidebar_position: 12
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Plugin API § `configureServer`](https://vite.dev/guide/api-plugin), [§ Conditional Application](https://vite.dev/guide/api-plugin). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ The Guard Is Not the Fix

[Chunk 1j](01j-storing-the-server.md) ends with a `TypeError` in CI and the documented instruction —
*"your other hooks need to guard against its absence."* This chunk is about what happens next, which
is where the expensive bug actually lives.

`if (server)` stops the crash. It does not give you a build-time equivalent of whatever you were
doing, so **the behaviour silently disappears in production** — and that is frequently worse than
the crash it replaced.

---

## 1. Under-The-Hood Mechanics

### The three options, and only one of them is a bug

The guard's *shape* is identical in all three cases. Choosing deliberately is the entire skill:

```
1. DERIVE IT DIFFERENTLY
   Compute the same decision from something available in BOTH pipelines —
   the module id, the code, the resolved config.
   → the behaviour survives the pipeline change.

2. IMPLEMENT A BUILD EQUIVALENT
   e.g. `this.getModuleInfo(id)` instead of `server.moduleGraph`.
   → two paths, both real, differences understood and written down.

3. DECLARE IT DEV-ONLY
   `apply: 'serve'` makes the restriction STRUCTURAL, not conditional.
   → no absence to guard, no branch to get wrong, no silent gap.

⛔ 4. ADD `if (server)` AND CLOSE THE TICKET
   → CI is green. The feature is gone from production. Nothing says so.
```

🔴 **Ask which you are choosing before writing the `if`.** The compiler cannot tell them apart, the
reviewer cannot tell them apart from the diff, and CI reports all four as success.

### Why option 3 beats a runtime guard

`apply: 'serve'` is documented conditional application:

> *"By default plugins are invoked for both serve and build. In cases where a plugin needs to be conditionally applied only during serve or build, use the `apply` property."*

```
if (server) { … }        "this MIGHT not be here"  → a branch, checked at runtime,
                                                     silently taken either way

apply: 'serve'           "this plugin does not      → structural. The plugin is not
                          participate in builds"      invoked at all in a build.
```

The second is stronger and self-documenting, and it makes any non-null assertion in the plugin
*true* rather than merely quiet.

### Why the degradation hides

The failure mode is not absence of data — it is **plausible data**:

```
telemetry plugin guarded out of the build
   → production emits nothing
   → the dashboard still has numbers … from developers' local sessions
   → nobody investigates a dashboard that has numbers
```

Same shape for a validation that stops validating, a codemod that stops applying, a header that
stops being injected. **A guard converts a loud crash into a quiet degradation, and the monitoring
that would catch the degradation is often partially fed by the path that still works.**

### The control that actually works

Assert in CI that the **build** path produced its side effect. It is the only place the difference
is observable, and no unit test can reach it — Vitest runs through Vite's dev transform, so a test
suite exercises the branch that was never broken.

---

## 2. Real-World Engineering Scenario

**Six weeks of telemetry that came entirely from developer laptops.**

Continuing the plugin from [chunk 1j](01j-storing-the-server.md): after three days diagnosing the
`TypeError`, someone added `if (server)`, CI went green, and the ticket closed.

That was the second bug.

The plugin's *purpose* was to instrument modules imported more than once — a property it could only
observe through `server.moduleGraph`, which does not exist in a build. So the guard meant the
instrumentation ran in dev and **never in production**, which is exactly backwards: the
instrumentation existed for production telemetry.

Nobody noticed for six weeks, because the dashboard had data. Developers running `vite` locally
emitted events all day, and a graph with a plausible shape does not prompt anyone to check whether
production is represented in it.

It surfaced during an incident, when the telemetry that should have localised a regression showed
nothing from the affected release. The investigation into *why* took longer than the incident.

The real fix used `this.getModuleInfo(id)` for the build path — the same decision, derived from
information the build does have — and kept the module-graph path for dev.

**Two transferable rules.** First: a green CI run after adding a guard is evidence the crash is
gone, not evidence the behaviour is correct; those are different claims. Second: when a feature's
purpose is production observability, verifying it in dev verifies nothing at all — and the failure
will present as *data you believe* rather than as an error.

---

## 3. Production-Grade Code Example

```typescript
// ✅ OPTION 2 — an explicit build-time equivalent. The behaviour survives the
//    pipeline change instead of silently disappearing.
import type { Plugin, ViteDevServer } from 'vite';

export function instrument(): Plugin {
  let server: ViteDevServer | undefined;

  return {
    name: 'instrument',
    configureServer(s) { server = s },

    transform(code, id) {
      if (!server) {
        // Build path: the same question, asked of something the build HAS.
        const info = this.getModuleInfo(id);
        return (info?.importers.length ?? 0) > 1 ? instrumentCode(code) : null;
      }
      const mod = server.moduleGraph.getModuleById(id);
      return (mod?.importers.size ?? 0) > 1 ? instrumentCode(code) : null;
    },
  };
}
```

```typescript
// ✅ OPTION 3 — a dev-only feature, declared as one. Structural, not conditional.
export function devOverlay(): Plugin {
  let server: ViteDevServer | undefined;

  return {
    name: 'dev-overlay',
    // The plugin cannot participate in a build at all, so there is no absence
    // to guard — and the `server!` below is now genuinely true.
    apply: 'serve',
    configureServer(s) { server = s },
    transform(code, id) {
      server!.ws.send({ type: 'custom', event: 'overlay:seen', data: { id } });
      return null;
    },
  };
}
```

```typescript
// ⛔ OPTION 4 — the anti-pattern. A guard added to make CI green,
//    with no decision behind it.
transform(code, id) {
  if (!server) return null;          // ← what SHOULD the build do? Nobody asked.
  return instrumentCode(code);        //    Production telemetry silently stops.
}
```

```yaml
# The control that actually works: assert the BUILD path's side effect in CI.
# No unit test can do this — Vitest runs through Vite's dev transform.
- run: yarn build
- name: The instrumentation must be present in the artefact
  run: |
    if ! grep -rq '__acme_instrument__' dist/; then
      echo "::error::instrumentation missing from the production build"
      exit 1
    fi
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Adding `if (server)` and calling it fixed

It stops the crash and silently disables the behaviour in production. Decide what the build should
do first; the guard is the shape of the fix, not the fix.

### ⚠️ Pitfall 2 — A dev-only plugin without `apply: 'serve'`

If the feature is genuinely dev-only, make the restriction structural. A plugin scoped with `apply`
is not invoked in a build at all, which is stronger than a runtime `if` and needs no guard.

### ⚠️ Pitfall 3 — Trusting a dashboard fed by local sessions

Telemetry that degraded to dev-only still produces data. "The dashboard has numbers" is not evidence
the production path runs.

### ⚠️ Pitfall 4 — `server!` to silence TypeScript

The assertion is a claim the docs contradict. If the plugin genuinely cannot run without the server,
express that with `apply: 'serve'` — then the assertion is true rather than merely quiet.

### ⚠️ Pitfall 5 — Testing the guarded branch with unit tests

Vitest shares the dev transform, so the suite exercises the path that was never broken. The build
path is only observable against `dist/`.

### ⚠️ Pitfall 6 — Reviewing the guard without asking what it guards

All four options above produce a diff containing `if (!server)`. The reviewer's question is not
whether the guard is present but which of the four it is.

---

## Gotchas

**★ Symptom: adding `if (server)` makes CI pass and a production feature quietly stops working.** Cause: the guard suppressed the symptom; the logic depended on a dev-only API. Fix: derive the decision from something available in both pipelines, or declare the feature dev-only with `apply: 'serve'`.

**★ Symptom: telemetry from a build plugin shows only developer machines.** Cause: the reporting path was guarded out of the build. Fix: this is the failure mode that looks like success — data exists, so nobody investigates. Assert in CI that the build path emits its side effect.

```bash
grep -rq '__acme_instrument__' dist/ || exit 1
```

**★ Symptom: the guard is `server!` with a non-null assertion.** Cause: TypeScript complained and someone silenced it. Fix: the assertion contradicts the docs. If the plugin cannot run without the server, use `apply: 'serve'` — the assertion then becomes true.

**★ Symptom: a plugin's build path was never executed by any test.** Cause: tests run through Vitest, which shares the dev transform. Fix: the same gap as [build-time env defects](../07-env-variables-and-modes/01a-build-time-vs-runtime-config.md) — assert against `dist/`, because no unit test can reach the build path.

**★ Symptom: a code review approves a guard that introduces a regression.** Cause: all four responses produce the same diff. Fix: require the pull request to state which option it chose. "Guarded" is not a decision; "dev-only, declared with `apply`" is.

**★ Symptom: `server.watcher` handlers never fire in a build and nothing errors.** Cause: no watcher exists and the guard skipped registration silently. Fix: file-watching is inherently dev-only — `apply: 'serve'` makes that structural instead of conditional.

**★ Symptom: a feature is discovered missing during an incident, not before.** Cause: the thing that would have detected it was the thing that broke. Fix: any plugin whose purpose is production observability needs an artefact-level assertion, because verifying it in dev verifies the wrong pipeline by construction.

**★ Symptom: two paths were implemented and they drift.** Cause: option 2 is real work — a build equivalent is a second implementation of the same decision. Fix: acceptable and worth writing down: comment both paths with the property they compute, so the next change to one prompts a look at the other.

**★ Symptom: `this.getModuleInfo` returns `null` in the build path.** Cause: the module has not been parsed yet at the point `transform` runs for it. Fix: importer information is only complete later in the build; if the decision genuinely needs the full graph, it belongs in a later hook — which also means it cannot be a `transform` in dev either, so the two paths were never symmetric.

---

## Interview questions

**★ Is `if (server)` the fix?**
It is the *shape* of the fix and often not the fix. It stops the crash and silently disables whatever
you were doing in the build, which is frequently worse — instrumentation that stops instrumenting in
production while still reporting from developers' machines looks like success. There are three
honest options and you should pick one deliberately: derive the same decision from something
available in both pipelines; implement an explicit build-time equivalent, for instance via
`this.getModuleInfo`; or declare the feature dev-only and enforce that structurally with
`apply: 'serve'`. The guard looks identical in all three, and only the fourth — adding it and
closing the ticket — is a bug.

**★ Your plugin is genuinely dev-only. What is better than a runtime guard?**
`apply: 'serve'`, which makes the restriction structural: the plugin is not invoked during a build
at all, so there is no absence to guard and no branch to get wrong. A runtime `if (server)` says
"this might not be here"; `apply` says "this plugin does not participate in that pipeline", and the
second is both stronger and self-documenting. It also makes any non-null assertion in the plugin
honest, since the server really is guaranteed within the only command that runs it — which converts
`server!` from a lie the compiler accepted into a fact.

**★ Why did nobody notice the instrumentation had stopped for six weeks?**
Because the dashboard had data — from developers' local sessions, where the dev-server path still
ran. That is the general shape of the most expensive failures here: the guard converts a loud crash
into a quiet degradation, and the monitoring that would catch a degradation is itself partially fed
by the path that still works. It surfaced during an incident, when the telemetry that should have
localised a regression showed nothing from the affected release — so the cost was paid at the worst
possible moment, which is characteristic of observability that silently observes the wrong thing.

**★ How do you verify a plugin's build path?**
Against `dist/`, in CI. It is the only place the difference is observable, and no unit test can
reach it: Vitest shares Vite's dev transform, so a test suite exercises the branch that was never
broken. Concretely that means an assertion on the artefact — a marker string, a file that should
exist, a header that should be present — run after `yarn build`. It is two lines of CI and it is the
only control that distinguishes "the crash is gone" from "the behaviour is correct", which is the
distinction this entire chunk exists to make.

**★ A pull request adds `if (!server) return null`. What do you ask in review?**
Which of the four responses this is — because all four produce that diff. Specifically: what should
the build do here, and is the answer "nothing" a decision or an omission? If the feature is
dev-only, the pull request should be using `apply: 'serve'` instead and deleting the guard. If it is
not dev-only, there must be a build path, and the review should be looking at that rather than at
the guard. "Guarded" is not a decision, and a review that accepts it as one has approved a silent
production change.

---

← [Storing the Server](01j-storing-the-server.md) · [Vite overview](../../README.md) · Next → [`transformIndexHtml`](01l-transform-index-html.md)
