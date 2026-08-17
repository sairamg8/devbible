---
title: "AST tooling after TS 7"
sidebar_label: "14 · AST tooling after TS 7"
sidebar_position: 14
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08 against the published **TypeScript 7** package's `exports` map —
> ⚠️ **already read from disk with console output in
> [phase 0 · 07](../phase-0-how-typescript-runs/07-typescript-7-native-compiler.md)**,
> which owns that evidence — and the **`ts-morph`** documentation. ⚠️ **`ts-morph`
> is not installed in this repository**, so its claims are documentation-attributed.
> **The audit and the staged upgrade are [topic 02](./02-typescript-7-for-tooling/README.md)'s.**
> **No sandbox run, no console block.**

⚠️ **Read [topic 02](./02-typescript-7-for-tooling/README.md) first.** It decides
**whether you have a problem** — most pipelines do not, because tools that *run*
`tsc` are unaffected. **This topic is for the minority that came out of that audit
with something to port.**

## 🔴 What the move actually was

Phase 0 · 07 records the shape: the root export is no longer the compiler, and the
API is published under explicitly `unstable/` paths — a **sync** surface, an
**async** surface, and a set of **AST** entry points for the scanner, factory,
visitor and clone helpers.

**The practical consequence for a tool author, and it is the one that decides the
port's size:**

> 🔴 **The surface was re-shaped, not merely re-exported.** So a port is not a
> find-and-replace on import paths — it is a rewrite of however much of your tool
> touched the parts that changed.

📌 **Which is why [topic 02](./02-typescript-7-for-tooling/03-upgrading-in-stages.md)
puts your own AST code *last* in the upgrade order: it is the one item with no
upstream to wait for**, so it is the one that consumes your time rather than
somebody else's.

## The three positions you can be in

| You are | Do |
|---|---|
| **using a library** (`ts-morph`, a codemod framework) | ⚪ **wait for it.** Your work is tracking its support, not porting anything |
| **using the API directly, lightly** — a script that reads declarations | ✅ port it, behind **one adapter module** ([topic 02 · chunk 02](./02-typescript-7-for-tooling/02-what-unstable-promises.md)) |
| 🔴 **maintaining a custom transformer** | ⚠️ **the expensive case — and the one to check for existence first**, because it is often a script nobody remembers owning |

🔴 **The third row deserves the audit's attention disproportionately**, because a
custom transformer is usually old, undocumented, load-bearing, and written by
someone who has left. **Finding it is more of the work than porting it.**

## 🔴 The question to ask before porting anything

**Does this tool need to exist?**

Ask it honestly, because a compiler-API tool is expensive to own **at every
compiler upgrade**, not once:

| The tool does | Consider instead |
|---|---|
| a one-off codemod, already run | ⛔ **delete it** — it is finished, and keeping it is a standing liability |
| enforce a rule | 🔴 **a lint rule** — the linter absorbs the API churn for you |
| generate code from types | a build step that reads the **`.d.ts`**, which is stable output |
| collect metrics | often a `grep` over declarations, honestly |

📌 **Every row that moves work out of the compiler API converts a recurring cost
into someone else's problem** — and for a lint rule specifically, that "someone
else" is typescript-eslint, whose whole job is tracking this
([topic 02 · chunk 01](./02-typescript-7-for-tooling/01-which-tools-actually-reach-in.md)).

⚠️ **This is not an argument against AST tooling** — it is an argument for owning
only the AST tooling that earns a permanent maintenance line.

## If you do port it

- 🔴 **One adapter module.** The surface is documented as changeable, so contact
  with it belongs in one file rather than fifteen
  ([topic 02 · chunk 02](./02-typescript-7-for-tooling/02-what-unstable-promises.md)).
- 🔴 **Pin the exact compiler version**, because a caret range is a promise nobody
  made on an `unstable/` path.
- ⚠️ **Run it over the whole codebase to verify, not just a sample** — an API
  consumer **fails on input, not on load**
  ([topic 02 · chunk 01](./02-typescript-7-for-tooling/01-which-tools-actually-reach-in.md)),
  so "it starts" proves very little.
- **Keep the old version working until the new one is verified**, which is why the
  staged upgrade keeps the two compilers installable side by side.

## Gotchas

**Symptom:** the port was scoped as an import-path change and is taking weeks.
**Cause:** the surface was re-shaped, not re-exported.
**Fix:** 🔴 scope it as a rewrite of the parts that touched what changed. The
find-and-replace estimate is the standard way this gets mis-planned.

**Symptom:** a custom transformer surfaced during the upgrade that nobody knew
existed.
**Cause:** it is old, undocumented and load-bearing — the common profile.
**Fix:** ⚠️ **find these first**, in the audit rather than during the port. It is the
one item whose schedule is entirely yours.

**Symptom:** a codemod is being ported and it was last run two years ago.
**Cause:** nobody asked whether it should exist.
**Fix:** ⛔ delete it. A finished codemod kept "in case" is a maintenance line
against every future compiler release.

**Symptom:** the ported tool works on the sample and fails in CI.
**Cause:** it reaches into the API for a construct it only meets in some files.
**Fix:** run it over everything. These tools fail on input rather than on load.

**Symptom:** the tool broke again on the next minor compiler release.
**Cause:** a caret range on an `unstable/` surface.
**Fix:** pin exactly, and make each compiler bump a deliberate step. 📌 The label
told you semver does not apply.

**Symptom:** a rule enforced by a custom transformer keeps needing maintenance.
**Cause:** it is in the wrong place.
**Fix:** 🔴 a lint rule instead — the linter's maintainers absorb the API churn,
which is the whole argument for moving work out of your own AST code.

## Interview questions

**Is porting a tool to the TypeScript 7 API a find-and-replace?**
No, and estimating it that way is the common mistake. The surface was re-shaped
rather than re-exported, so the work is a rewrite of however much of the tool
touched the parts that changed — which is why the staged upgrade puts your own AST
code last, as the one item with no upstream to wait for.

**What should you ask before porting?**
Whether the tool needs to exist. A compiler-API tool costs you at every compiler
upgrade rather than once, so a finished codemod should be deleted, a rule belongs in
a lint rule where the linter's maintainers absorb the churn, and code generation can
often read the `.d.ts` instead — which is stable output rather than an unstable API.

**Which case is most expensive?**
A custom transformer, and the expense starts before the port: it is typically old,
undocumented, load-bearing and unowned, so finding it is more of the work than
fixing it. That is why it belongs in the audit rather than being discovered
mid-upgrade.

**How do you structure the port?**
Behind one adapter module, with the compiler version pinned exactly — a caret range
is a promise nobody made on a path labelled `unstable/`. And verify by running the
tool over the entire codebase, because API consumers fail on input rather than on
load, so a successful start proves almost nothing.

**Is this an argument against AST tooling?**
No — against owning AST tooling that has not earned a permanent maintenance line.
Where the tool does something only the compiler API can do, it is worth the cost.
Where a lint rule or a declaration-reading build step would serve, that is work
moved somewhere the churn is somebody else's job.

---

← [13 · Measuring type coverage](./13-measuring-type-coverage.md) · [Phase 12 index](./README.md)
