---
title: "Errors do not stop the build by default"
sidebar_label: "03 · Errors do not stop the build"
sidebar_position: 3
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 — 🔴 **the behaviour below is read from the compiler's own
> build orchestrator**, not recalled: the `stopBuildOnErrors` option record
> (`defaultValueDescription: false`) and its **two** consumption sites in
> `getUpToDateStatus` and `queueReferencingProjects` in the installed
> **TypeScript 5.9.3** build, with the option's description string cross-checked
> in the **7.0.2** native binary. Diagnostics are quoted from the numbered
> message table. **No sandbox, no console blocks.**

There are four diagnostics about a dependency having failed:

```text
TS6362: Skipping build of project '{0}' because its dependency '{1}' has errors
TS6363: Project '{0}' can't be built because its dependency '{1}' has errors
TS6382: Skipping build of project '{0}' because its dependency '{1}' was not built
TS6383: Project '{0}' can't be built because its dependency '{1}' was not built
```

Reading those, the obvious conclusion is that `tsc -b` stops when an upstream
project fails. 🔴 **By default, it does not.**

## The option, and its default

```js
{
  name: "stopBuildOnErrors",
  category: Diagnostics.Command_line_Options,
  description: Diagnostics.Skip_building_downstream_projects_on_error_in_upstream_project,
  type: "boolean",
  defaultValueDescription: false
}
```

*"Skip building downstream projects on error in upstream project"* — **default
`false`**, so downstream projects are **not** skipped unless you ask.

## It gates two separate decisions

This is the part that makes the behaviour coherent rather than arbitrary. The
flag is read in exactly two places, and they are different questions.

**1. Whether an upstream failure blocks this project's status:**

```js
if (state.options.stopBuildOnErrors
    && (refStatus.type === Unbuildable || refStatus.type === UpstreamBlocked)) {
  return { type: UpstreamBlocked, upstreamProjectName: ref.path, … };
}
```

**2. Whether downstream projects are queued after a failure:**

```js
function queueReferencingProjects(state, project, projectPath, projectIndex, config, buildOrder, buildResult) {
  if (state.options.stopBuildOnErrors && buildResult & AnyErrors) return;
  …
}
```

> 🔴 **With the flag off — the default — a project whose dependency failed is
> neither marked blocked nor removed from the queue. It is built.**

## What that means in practice

`shared` fails to compile. `ui` depends on `shared`. By default:

- `shared` reports its errors and emits nothing new.
- `ui` **is still built**, and it is checked against whatever `shared/dist`
  contained *before* the failure — or against `shared`'s **source**, if the
  redirect is on ([topic 12 chunk 01](../12-sharing-types-across-a-monorepo/01-the-question-and-the-compilers-answer.md)).
- The overall exit code is non-zero, so CI fails.

⚠️ **So the build is not silently wrong — the errors are reported.** What is
surprising is the *volume*: one broken export in a base package produces errors
from every downstream project, all describing consequences of the same root
cause. A wall of errors whose actual content is one mistake.

🔴 **And there is a worse case.** If `shared`'s `dist` is stale but *valid*, `ui`
compiles **cleanly** against the old declarations. You get `shared`'s errors and
a clean `ui` — which reads as "only `shared` is broken" when in fact `ui` has not
been checked against the code you actually wrote. That is
[topic 12 chunk 05](../12-sharing-types-across-a-monorepo/05-the-failure-catalogue.md)'s
staleness problem meeting this default, and the combination is why the two topics
cross-reference here.

## Why the default is defensible

It looks wrong at first and there is a real argument for it:

- **You see every error in one run.** Stopping at the first failed project means
  fixing it, rebuilding, and discovering the next one — a slow loop over a large
  graph.
- **Downstream errors are often independently real.** Not every error in `ui` is
  a consequence of `shared`'s failure, and finding them now is worth something.
- **The exit code is still correct**, so nothing incorrect ships either way.

📌 **The cost is legibility, not correctness.** Which is exactly the trade you
want to be able to flip per environment.

## When to turn it on

```bash
tsc -b --stopBuildOnErrors
```

**Turn it on in CI** if your monorepo is deep and a base-package failure produces
hundreds of derived errors. The first failure is the one worth reading, and the
rest are noise that makes the log hostile to whoever is on call.

**Leave it off locally**, where seeing everything at once is usually what you
want during a refactor that touches several packages.

⚠️ **Do not turn it on to make a build "safer".** It changes nothing about
correctness — both settings fail the build. It changes only how much output you
get.

## The `was not built` pair

`TS6382`/`TS6383` are the *other* upstream failure: the dependency did not fail,
it never ran. That happens when a dependency is itself blocked, or when the build
order could not reach it.

📌 **Distinguish them from the `has errors` pair when reading a log**, because
they point at different causes: *has errors* is a code problem in a known
project; *was not built* is a graph problem — usually something further upstream,
or a reference to a project that does not build at all.

## Gotchas

**Symptom:** One broken package produces errors from every package downstream.
**Cause:** The default — downstream projects are still built.
**Fix:** `--stopBuildOnErrors` in CI if the volume is the problem. Fix the root
cause either way.

**Symptom:** A base package fails and a dependent reports **no** errors.
**Cause:** The dependent was checked against a stale-but-valid `dist`.
**Fix:** The dependent has not been checked against your actual code. Topic 12
chunk 05.

**Symptom:** `--stopBuildOnErrors` was added and errors "went away".
**Cause:** They were downstream consequences and are no longer reported.
**Fix:** They have not been fixed. The exit code is the same either way.

**Symptom:** `TS6382` on a project whose dependency looks fine.
**Cause:** *Was not built* rather than *has errors* — the dependency never ran,
usually because something further upstream blocked it.
**Fix:** Read the log from the top; the first failure is the real one.

**Symptom:** CI logs are unreadable during a large refactor.
**Cause:** Every downstream project reporting the same root cause.
**Fix:** `--stopBuildOnErrors`, and read the first project's errors.

**Symptom:** Someone argues the default is a bug.
**Cause:** The four "skipping" diagnostics imply the opposite behaviour.
**Fix:** Those messages only appear with the flag on. The default is deliberate —
one run, all errors.

**Symptom:** A team enables it expecting a correctness improvement.
**Cause:** Reading "stop on errors" as "be stricter".
**Fix:** It is purely about output volume. Both settings fail the build.

## Interview questions

**★ Does `tsc -b` stop building when an upstream project has errors?**
Not by default. `stopBuildOnErrors` defaults to `false`, so a project whose
dependency failed is neither marked blocked nor dropped from the queue — it is
built, against whatever declarations already existed or against the dependency's
source if the redirect is on.

**★ How is that visible in the compiler?**
The flag is read in exactly two places: `getUpToDateStatus`, where it decides
whether an upstream failure marks this project `UpstreamBlocked`, and
`queueReferencingProjects`, where it decides whether downstream projects are
queued after an error. With it off, neither happens.

**★ What is the practical consequence?**
A wall of errors from every downstream project, all consequences of one root
cause. And in the worse case — a stale but valid `dist` — the downstream project
compiles *cleanly* against old declarations, which reads as "only the base
package is broken" when the dependent was never checked against your actual
code.

**★ Is the default defensible?**
Yes. You see every error in one run instead of fixing-and-rebuilding down the
graph, downstream errors are often independently real, and the exit code is
correct either way. The cost is legibility, not correctness.

**When would you enable `--stopBuildOnErrors`?**
In CI on a deep monorepo, where a base-package failure produces hundreds of
derived errors and only the first matters. Locally, leaving it off is usually
better during a multi-package refactor.

**Does enabling it make the build safer?**
No. Both settings fail the build; it changes only how much output you get.
Treating it as a correctness setting is a misreading.

**What is the difference between `TS6362` and `TS6382`?**
*Has errors* means the dependency ran and failed — a code problem in a known
project. *Was not built* means it never ran — a graph problem, usually something
further upstream. They point at different investigations.

---

← Prev: [02 · The up-to-date check](./02-the-up-to-date-check.md) · Next → [04 · When you do not need references](./04-when-you-do-not-need-them.md)
