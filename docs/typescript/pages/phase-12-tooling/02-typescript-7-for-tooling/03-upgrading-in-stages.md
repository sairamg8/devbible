---
title: "Upgrading in stages"
sidebar_label: "03 · Upgrading in stages"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript 7 release notes** and the **`tsconfig`
> reference**. ⚠️ **The compiler's speed and the defaults that changed belong to
> [phase 0 · 07](../../phase-0-how-typescript-runs/07-typescript-7-native-compiler.md)**,
> which is sandbox-proven; the editor-versus-build disagreements belong to
> [phase 0 · 09](../../phase-0-how-typescript-runs/09-language-server-vs-build.md).
> Package-manager behaviour is attributed to npm's documentation.
> **No sandbox run of our own, no console block.**

[Chunk 01](./01-which-tools-actually-reach-in.md) produced the list.
[Chunk 02](./02-what-unstable-promises.md) said what the exposed entries are exposed
*to*. This chunk is the sequence — **and its whole point is that "upgrade
TypeScript" is not one decision.**

## 🔴 The gate can move before the tools do

The insight that makes a staged upgrade possible, and it falls straight out of
chunk 01's two columns:

> **Your type-check gate invokes `tsc`. Your codemod imports the compiler. Those are
> different consumers, and nothing requires them to be the same version.**

So the order that works:

1. **Move the gate.** `tsc --noEmit` in CI is the unexposed column — the CLI, its
   flags and its exit codes are unchanged
   ([topic 01](../01-type-checking-in-ci/README.md)). **This is where the speed
   arrives**, and it is the step with the least risk.
2. **Leave the API consumers where they are**, on the version they support, until
   their maintainers publish.
3. **Move them as they land**, one at a time, each with its own verification.
4. **Do your own AST code last** — it is the entry with no upstream, so it is the
   one that needs your time rather than someone else's.

⚠️ **Two compilers in one repository is a real cost, not a free trick.** Package
managers support installing a second copy under an alias, and it works — but you now
have two versions to reason about, and **a tool that resolves the wrong one fails
confusingly rather than loudly.** 📌 **Treat it as a temporary state with an owner
and an end date**, not as an arrangement.

## 🔴 The editor is a third consumer, and it is nobody's list

The audit in chunk 01 covers your pipeline. **It does not cover the language
server**, and the editor runs its own compiler — the bundled one by default, your
workspace's only if configured.

So a half-finished upgrade produces exactly the situation
[phase 0 · 09](../../phase-0-how-typescript-runs/09-language-server-vs-build.md)
warns about, now with a version gap as the cause:

| Where | Which compiler | Consequence |
|---|---|---|
| CI gate | the new one | authoritative |
| a developer's editor | whichever it was told to use | ⚠️ **errors that appear in one and not the other** |

**Point the editor at the workspace version as part of the upgrade**, and say so in
the commit. 🔴 **Otherwise the first symptom is a developer insisting CI is wrong**,
which costs more to diagnose than the setting costs to change.

## Verify the gate itself, not just that it runs

⚠️ **A compiler upgrade is exactly the kind of change that can silently shrink what
the gate covers** — [topic 01 · chunk 02](../01-type-checking-in-ci/02-what-the-gate-guarantees.md)
lists the ways. So:

- **Compare the error count before and after**, on the same commit. Zero to zero is
  the expected result; **zero to zero because the second run checked nothing is the
  failure this catches.**
- **Compare the file count** the program included — `--listFilesOnly` — rather than
  trusting that the configuration means the same thing.
- 🔴 **Break something on purpose and confirm CI still goes red.** The gate was
  tested when it was built; **a compiler swap is a reason to test it again.**

📌 **New errors after an upgrade are usually a finding, not a regression.** Defaults
change between major versions (phase 0 · 07 records which), and a compiler that
reports something the old one missed has found a real bug. **Read them before
configuring them away** — which is [topic 01 · chunk 05](../01-type-checking-in-ci/05-when-the-gate-fails.md)'s
baseline argument arriving through a different door.

## The rollback

**Decide it before you need it**, because the decision is not symmetric:

- **The gate** rolls back cleanly — it is a version number, and the CLI contract is
  the same in both directions.
- ⚠️ **Your own API code does not.** If it has been ported to the new surface, going
  back means reverting that work too, so **land the port behind its own commit** and
  keep it separate from the version bump.

🔴 **Which is the argument for staging in the order above one more time:** each step
is individually reversible, and a single "upgrade TypeScript" commit that moves the
gate, the tools and your transformer together is reversible only as a whole.

## Gotchas

**Symptom:** the upgrade is blocked on one unported tool.
**Cause:** it is being treated as a single decision.
**Fix:** 🔴 move the gate first. It is a `tsc` invocation, it is where the speed is,
and it does not depend on the tool that is blocking.

**Symptom:** two copies of the compiler are installed and something resolves the
wrong one.
**Cause:** aliasing works, and resolution is easy to get subtly wrong.
**Fix:** it is a temporary state with an owner and an end date. ⚠️ The failure mode
is confusing rather than loud, which is what makes it expensive to leave in place.

**Symptom:** a developer's editor disagrees with CI after the upgrade.
**Cause:** the editor is running its bundled compiler, not the workspace's.
**Fix:** point it at the workspace version as part of the upgrade. 🔴 The first
symptom is somebody insisting CI is wrong.

**Symptom:** the gate is green after the upgrade and errors appear later.
**Cause:** the new run checked a different — smaller — program.
**Fix:** compare error and file counts on the same commit before and after, and
re-test the gate by breaking something. A compiler swap is a config change in
disguise.

**Symptom:** the upgrade produced forty new errors and they were suppressed to ship
it.
**Cause:** they were read as a regression.
**Fix:** ⚠️ they are usually findings — a changed default, or a check the old
compiler did not make. Read them first; baseline them if they must wait.

**Symptom:** the upgrade has to be reverted and the revert is enormous.
**Cause:** the version bump and the API port were one commit.
**Fix:** separate commits, in the staged order. The gate step is trivially
reversible; the API port is not, and mixing them makes both irreversible.

## Interview questions

**How do you stage a TypeScript 7 upgrade?**
Gate first, tools after. The type-check gate invokes `tsc`, which is the unexposed
column — the CLI and its exit codes are unchanged — so it can move on its own, and
it is where the speed arrives. API consumers stay on their supported version until
their maintainers publish, and your own AST code goes last because it is the entry
with no upstream.

**Can you run two compiler versions at once?**
Yes, via package-manager aliasing, and it is genuinely useful for the middle of a
staged upgrade. The cost is that resolution errors are confusing rather than loud,
so it should be a temporary state with an owner and an end date rather than an
arrangement you settle into.

**What does the upgrade do to the editor?**
Nothing, unless you tell it to — the editor runs its own compiler, the bundled one
by default. So a half-finished upgrade leaves developers checking against a
different version from CI, and the first symptom is usually somebody insisting CI is
wrong. Point the editor at the workspace version as part of the change.

**Why re-test the gate after a compiler upgrade?**
Because a compiler swap can silently change what the program includes, and a green
run over a smaller program looks exactly like a green run. Compare the error count
and the file count on the same commit before and after, and break something
deliberately to confirm it still fails.

**The upgrade produces new errors. Is that a regression?**
Usually not — it is a changed default or a check the previous compiler did not make,
which means it found a real bug. Read them before configuring them away, and if they
cannot all be fixed now, baseline them so the population is frozen rather than
suppressed.

**Why does commit structure matter here?**
Because the steps are not equally reversible. Bumping the version for the gate rolls
back cleanly; porting your own code to the new API does not, since going back means
reverting that work as well. One combined "upgrade TypeScript" commit is reversible
only as a whole, which is precisely what you do not want under time pressure.

---

← [02 · What `unstable/` actually promises](./02-what-unstable-promises.md) · [Topic index](./README.md) · [Phase 12 index](../README.md)
