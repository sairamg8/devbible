---
title: "What `unstable/` actually promises"
sidebar_label: "02 · What `unstable/` promises"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript 7 release notes** and the published
> package's `exports` map — ⚠️ **read from disk with console output in
> [phase 0 · 07](../../phase-0-how-typescript-runs/07-typescript-7-native-compiler.md)**,
> which owns that evidence. **No sandbox run of our own, no console block.**

The new API is published under paths that begin `unstable/`. **That word is doing
real work, and reading it as a warning label — the kind every 1.0 has and nobody
heeds — is the mistake this chunk is about.**

> 🔴 **`unstable/` is a versioning contract: this surface may change without a major
> version bump.** It is not a disclaimer about quality or an invitation to be brave.
> It is a statement that **semantic versioning does not protect you here.**

## Why that is a bigger deal than it sounds

Everything you do with dependency ranges assumes the opposite. A caret range exists
because a minor or patch release is supposed to be safe — so the moment a package
declares part of its surface exempt, **your normal update policy is silently wrong
for that package.**

📌 **This is the same shape as a finding from
[phase 10 · 11 · chunk 01](../../phase-10-strictness/11-typescript-eslint/01-what-type-aware-means.md):**
typescript-eslint's `strict` config is explicitly *not* semver-stable, so a patch
update can add a rule and fail your build. **Two of the most important pieces of the
TypeScript toolchain have carved out an exemption from semver, in different places,
for different reasons.** The general lesson is worth more than either instance:

> ⚠️ **Check whether the thing you are pinning considers itself bound by semver at
> all.** A range is a promise the *publisher* makes, not one the range syntax
> enforces.

## What it means in practice

| If you… | Then |
|---|---|
| only **run** `tsc` | ✅ nothing here applies — the CLI is not the unstable surface |
| depend on a tool that imports it | ⚠️ **your exposure is that tool's problem to absorb**, and its version range is the thing to watch |
| import it **yourself** | 🔴 **pin the exact version**, and treat every compiler bump as a change to test |

🔴 **The third row is the one to act on.** If your own code imports the compiler —
a codemod, a transformer, a build script that reads an AST — a caret range is
actively misleading there, and an exact pin plus a deliberate upgrade step is the
honest configuration.

## The name is also a roadmap

⚠️ **Do not read `unstable/` as "temporary".** It says the surface may move; it does
not promise a stable one is arriving on a schedule you can plan around. **Design as
if the current shape is what you have**, and keep your own code's contact with it
narrow.

📌 **The practical form of that: put every import of the compiler behind one module
of your own.** A codemod that reaches into the API from fifteen files has fifteen
places to update; one that imports through a single adapter has one. It is ordinary
dependency hygiene, and it is worth more than usual precisely because the upstream
has told you the surface is allowed to move.

## What is *not* unstable

Worth stating, because the anxiety spreads further than the change:

- 🔴 **The language.** Same syntax, same types, same inference. Phase 0 · 07's
  framing — *the language did not change, the tool did* — is the load-bearing part.
- 🔴 **The CLI.** `tsc`, its flags and its exit codes are how nearly everything in
  your pipeline talks to TypeScript, and that is untouched.
- **`tsconfig.json`.** Your configuration is the same file.
- **The diagnostics.** The codes and messages this corpus reads from the tables are
  present in both lines; where a message changed, that is a normal release note, not
  an API break.

📌 **So the blast radius is: your own AST code, plus whichever dependencies from
[chunk 01](./01-which-tools-actually-reach-in.md)'s audit are in the exposed
column.** Everything else is a version number changing.

## Gotchas

**Symptom:** a caret range on `typescript` in a package that imports the compiler.
**Cause:** the normal policy was applied to a package that has exempted part of its
surface from semver.
**Fix:** 🔴 pin exactly and upgrade deliberately. A caret range there is a promise
nobody made.

**Symptom:** `unstable/` is read as "not ready yet, wait for the stable one".
**Cause:** the word means something different from what it means in a version
number.
**Fix:** it is a versioning statement, not a maturity one. ⚠️ Nothing has promised a
stable surface on a timetable, so waiting is a plan with no completion condition.

**Symptom:** the compiler is imported from a dozen files across a codemod.
**Cause:** it grew that way.
**Fix:** one adapter module. 📌 Ordinary hygiene, worth more than usual here because
upstream has explicitly reserved the right to move the surface.

**Symptom:** a team concludes the whole upgrade is unsafe because the API is
"unstable".
**Cause:** the label is being applied to the compiler rather than to one export
path.
**Fix:** the language, the CLI, `tsconfig.json` and the diagnostics are unchanged.
Chunk 01's audit turns the anxiety into a list, which is the point of doing it.

**Symptom:** a dependency updated and its API usage broke on a minor bump.
**Cause:** exactly what the label warns about, arriving through someone else's
range rather than yours.
**Fix:** ⚠️ your exposure includes your dependencies' ranges, not just your own —
which is why the audit lists packages rather than just your own imports.

## Interview questions

**What does `unstable/` mean on the TypeScript 7 API paths?**
That the surface may change without a major version bump — a versioning contract,
not a comment on quality or readiness. It matters because every dependency range you
write assumes the opposite: a caret exists because minors and patches are supposed
to be safe, so a package that exempts part of its surface makes your normal update
policy silently wrong for it.

**How should you pin it?**
If you only run `tsc`, this does not apply — the CLI is not the unstable surface. If
a dependency imports the compiler, its range is the thing to watch and the exposure
is largely theirs to absorb. If your own code imports it, pin the exact version and
make every compiler bump a deliberate, tested step.

**Is there a wider lesson here?**
Yes, and it has a second instance in this corpus: typescript-eslint's `strict`
config is also explicitly not semver-stable, so a patch update can add a rule and
break your build. Two central pieces of the toolchain have carved out semver
exemptions for different reasons — so the habit worth forming is checking whether
what you are pinning considers itself bound by semver at all.

**Should you wait for a stable API before upgrading?**
That is a plan with no completion condition — nothing has promised a stable surface
on a timetable. The workable version is to upgrade the parts that are not exposed,
which is most of the pipeline, and keep your own contact with the API narrow enough
that moving with it is cheap.

**What is definitely not affected?**
The language, the CLI and its flags, `tsconfig.json`, and the diagnostics. That is
why the blast radius is your own AST code plus whatever the audit put in the exposed
column, and why "we can't upgrade, too much depends on TypeScript" is almost always
an unexamined worry rather than a finding.

---

← [01 · Which of your tools actually reach in](./01-which-tools-actually-reach-in.md) · [Topic index](./README.md) · Next → **03 · Upgrading in stages** *(not written yet)*
